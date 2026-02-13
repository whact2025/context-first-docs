//! HTTP/3 server: accepts QUIC connections via `quinn`, bridges requests to the axum `Router`.
//!
//! Architecture:
//! ```text
//! quinn::Endpoint (UDP)
//!   └── per-connection task
//!         └── h3::server::Connection (HTTP/3 framing)
//!               └── per-request task
//!                     ├── read h3 request body
//!                     ├── call axum Router (all middleware: auth, RBAC, OTEL, CORS)
//!                     └── stream response body back through h3
//! ```
//!
//! Each QUIC connection and each HTTP/3 request within it runs in its own tokio task,
//! giving full stream multiplexing with no head-of-line blocking.
//! SSE responses (infinite streaming bodies) are handled naturally: the body streaming
//! loop runs until either the body ends or the client disconnects.

use std::net::SocketAddr;

use axum::Router;
use bytes::{Buf, Bytes};
use http_body_util::BodyExt;
use tower::ServiceExt;

/// Start the HTTP/3 server on a QUIC endpoint and bridge all requests to the axum router.
///
/// This function runs until the endpoint is closed or the process is shut down.
/// All axum middleware (auth, RBAC, policy, OTEL, CORS) applies to every request —
/// the router is invoked identically to how `axum::serve` would invoke it over TCP.
pub async fn serve_h3(
    server_config: quinn::ServerConfig,
    addr: SocketAddr,
    app: Router,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let endpoint = quinn::Endpoint::server(server_config, addr)?;
    tracing::info!(%addr, protocol = "HTTP/3 (QUIC)", "listening");

    while let Some(incoming) = endpoint.accept().await {
        let app = app.clone();
        tokio::spawn(async move {
            let remote = incoming.remote_address();
            match incoming.await {
                Ok(conn) => {
                    tracing::debug!(%remote, "QUIC connection established");
                    handle_connection(conn, app).await;
                    tracing::debug!(%remote, "QUIC connection closed");
                }
                Err(e) => {
                    tracing::warn!(%remote, error = %e, "QUIC handshake failed");
                }
            }
        });
    }

    Ok(())
}

/// Handle a single QUIC connection: upgrade to HTTP/3 and accept request streams.
async fn handle_connection(conn: quinn::Connection, app: Router) {
    let h3_conn = h3_quinn::Connection::new(conn);
    let mut server_conn = match h3::server::Connection::new(h3_conn).await {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!(error = %e, "HTTP/3 connection setup failed");
            return;
        }
    };

    loop {
        match server_conn.accept().await {
            Ok(Some(resolver)) => {
                let app = app.clone();
                tokio::spawn(async move {
                    // Resolve the request (reads HTTP/3 headers from the stream)
                    let (req, stream) = match resolver.resolve_request().await {
                        Ok(pair) => pair,
                        Err(e) => {
                            tracing::debug!(error = %e, "HTTP/3 request resolution failed");
                            return;
                        }
                    };
                    if let Err(e) = handle_request(req, stream, app).await {
                        // Debug level: most errors are client disconnects, not server bugs
                        tracing::debug!(error = %e, "request handling error");
                    }
                });
            }
            // Connection closed cleanly
            Ok(None) => break,
            Err(e) => {
                tracing::debug!(error = %e, "HTTP/3 accept error (connection closing)");
                break;
            }
        }
    }
}

/// Bridge a single HTTP/3 request to the axum router and stream the response back.
///
/// Flow:
/// 1. Read the request body from the h3 stream (collected for JSON endpoints)
/// 2. Construct an `http::Request<axum::body::Body>` that axum understands
/// 3. Call the router (auth, RBAC, policy, OTEL all apply)
/// 4. Send response headers through h3
/// 5. Stream response body frame-by-frame (handles both regular and SSE streaming)
/// 6. Finish the h3 stream
async fn handle_request(
    req: http::Request<()>,
    mut stream: h3::server::RequestStream<h3_quinn::BidiStream<Bytes>, Bytes>,
    app: Router,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // 1. Read request body from h3 stream
    let mut body_data = Vec::new();
    while let Some(mut chunk) = stream.recv_data().await? {
        let data = chunk.copy_to_bytes(chunk.remaining());
        body_data.extend_from_slice(&data);
    }

    // 2. Convert to axum-compatible request (preserves method, URI, headers, extensions)
    let (parts, _) = req.into_parts();
    let body = axum::body::Body::from(Bytes::from(body_data));
    let axum_req = http::Request::from_parts(parts, body);

    // 3. Route through axum — all middleware applies (auth, RBAC, OTEL, CORS)
    // Router<()> error type is Infallible, so unwrap is safe
    let response = app.oneshot(axum_req).await.unwrap();

    // 4. Split response and send headers
    let (resp_parts, resp_body) = response.into_parts();
    let h3_resp = http::Response::from_parts(resp_parts, ());
    stream.send_response(h3_resp).await?;

    // 5. Stream response body frame-by-frame
    //    - Regular responses: body produces frames then None → loop exits
    //    - SSE responses: body produces frames indefinitely → loop runs until client disconnects
    let mut body = resp_body;
    loop {
        match body.frame().await {
            Some(Ok(frame)) => {
                if let Some(data) = frame.data_ref() {
                    if !data.is_empty() {
                        if let Err(e) = stream.send_data(data.clone()).await {
                            // Client disconnected — normal for SSE when the tab closes
                            tracing::debug!(error = %e, "client disconnected during response");
                            return Ok(());
                        }
                    }
                }
            }
            Some(Err(e)) => {
                tracing::debug!(error = %e, "response body frame error");
                break;
            }
            None => break, // body complete
        }
    }

    // 6. Finish the h3 stream (sends FIN)
    stream.finish().await?;
    Ok(())
}
