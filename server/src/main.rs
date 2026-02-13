//! Binary: load config from server config root, start HTTP/3 (QUIC) server.
//!
//! Transport: HTTP/3 primary (decision-038).
//! TLS: loads PEM certs from config, or generates self-signed for development.
//! All axum middleware (auth, RBAC, policy, OTEL, CORS) applies through the h3→axum bridge.
//!
//! Dev mode: set `TRUTHTLAYER_DEV_TCP=true` to also start a plain TCP/HTTP listener
//! on the same port for Node.js tooling (fetch, integration tests, smoke scripts).
//! Node.js does not yet support HTTP/3/QUIC clients. The TCP dev listener must NEVER
//! be enabled in production — QUIC is the only production transport.

use std::sync::Arc;

use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use truthlayer_server::{
    api::routes,
    auth::{AuthConfig, AuthLayer},
    config::load_config,
    events::EventBus,
    h3_server,
    policy::PolicyConfig,
    retention::RetentionConfig,
    store::InMemoryStore,
    telemetry::{
        init_meter_provider, init_tracer, HttpServerMetricsLayer, RequestSpanLayer,
        TraceContextLayer,
    },
    tls,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let config_root = std::env::args().nth(1).map(std::path::PathBuf::from);
    let config = load_config(config_root);

    // --- OpenTelemetry (optional) ---
    let enable_console = std::env::var("OTEL_CONSOLE_SPANS")
        .is_ok_and(|v| v == "1" || v.eq_ignore_ascii_case("true"));
    let otel_enabled = config.otel_exporter_otlp_endpoint.is_some() || enable_console;

    let _tracer_provider = if otel_enabled {
        match init_tracer(
            config.otel_exporter_otlp_endpoint.as_deref(),
            None,
            enable_console,
        ) {
            Ok(provider) => {
                if let Some(ref ep) = config.otel_exporter_otlp_endpoint {
                    tracing::info!(endpoint = %ep, "OTLP tracing enabled");
                }
                if enable_console {
                    tracing::info!("OTEL console span export enabled");
                }
                Some(provider)
            }
            Err(e) => {
                tracing::warn!(error = %e, "OTEL tracer init failed, continuing without export");
                None
            }
        }
    } else {
        None
    };

    let _meter_provider = if otel_enabled {
        match init_meter_provider(
            config.otel_exporter_otlp_endpoint.as_deref(),
            None,
            enable_console,
        ) {
            Ok(provider) => {
                tracing::info!("OTEL metrics enabled (http.server.request.*)");
                Some(provider)
            }
            Err(e) => {
                tracing::warn!(error = %e, "OTEL meter provider init failed");
                None
            }
        }
    } else {
        None
    };

    let env_filter =
        tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into());

    if _tracer_provider.is_some() {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(tracing_subscriber::fmt::layer())
            .with(tracing_opentelemetry::layer())
            .init();
    } else {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(tracing_subscriber::fmt::layer())
            .init();
    }

    tracing::info!(config_root = ?config.config_root, backend = %config.storage_backend, "config loaded");

    // --- Auth ---
    let auth_config = AuthConfig::from_env();
    if auth_config.disabled {
        tracing::warn!("authentication DISABLED (AUTH_DISABLED=true or default). Set AUTH_SECRET and AUTH_DISABLED=false for production.");
    }

    // --- Policy ---
    let policies_path = config.config_root.join("policies.json");
    let policies = Arc::new(PolicyConfig::load_from_file(&policies_path));
    if !policies.rules.is_empty() {
        tracing::info!(rules = policies.rules.len(), "policy engine loaded");
    }

    // --- Storage ---
    let store: Arc<dyn truthlayer_server::ContextStore> = match config.storage_backend.as_str() {
        "memory" | "mem" => Arc::new(InMemoryStore::new()),
        "file" => {
            let data_dir = config.file_data_dir.as_deref().unwrap_or("data");
            let data_path = config.config_root.join(data_dir);
            tracing::info!(path = ?data_path, "using file-based storage");
            Arc::new(
                truthlayer_server::store::FileStore::new(data_path)
                    .expect("failed to initialize file store"),
            )
        }
        _ => {
            tracing::warn!(
                "unknown storage backend '{}', using memory",
                config.storage_backend
            );
            Arc::new(InMemoryStore::new())
        }
    };

    // --- Retention (background task) ---
    let retention_path = config.config_root.join("retention.json");
    let retention_config = RetentionConfig::load_from_file(&retention_path);
    if !retention_config.rules.is_empty() {
        tracing::info!(rules = retention_config.rules.len(), "retention engine loaded");
        truthlayer_server::retention::spawn_retention_task(store.clone(), retention_config);
    }

    // --- Event bus (SSE notifications) ---
    let event_bus = EventBus::new();

    // --- Axum router + middleware ---
    let app = routes::router(store, policies, event_bus);

    let app = app.layer(AuthLayer {
        config: Arc::new(auth_config),
    });

    let app = if _tracer_provider.is_some() {
        app.layer(HttpServerMetricsLayer::default())
            .layer(TraceContextLayer::default())
            .layer(RequestSpanLayer::default())
    } else {
        app
    };
    let app = app.layer(CorsLayer::permissive());

    // --- TLS certificates ---
    let (certs, key) = if let (Some(cert_path), Some(key_path)) =
        (&config.tls_cert_path, &config.tls_key_path)
    {
        tracing::info!(cert = %cert_path, key = %key_path, "loading TLS certificates from disk");
        tls::load_certs_from_pem(
            std::path::Path::new(cert_path),
            std::path::Path::new(key_path),
        )?
    } else {
        tracing::warn!("no TLS cert configured — generating self-signed dev certificate (NOT for production)");
        tracing::warn!("set TRUTHTLAYER_TLS_CERT and TRUTHTLAYER_TLS_KEY for production");
        tls::generate_dev_cert()?
    };

    // --- QUIC server config ---
    let server_config = tls::build_quinn_server_config(certs, key)?;

    // --- Start HTTP/3 server ---
    let addr: std::net::SocketAddr = config
        .listen_addr
        .parse()
        .map_err(|e| format!("invalid listen address '{}': {}", config.listen_addr, e))?;

    // --- Optional dev-mode TCP listener ---
    // Node.js (v24) does not support HTTP/3/QUIC clients yet. To allow `fetch()`-based
    // tools (integration tests, smoke scripts, VS Code extension host) to reach the
    // server during development, set TRUTHTLAYER_DEV_TCP=true.
    // TCP and UDP ports are independent, so both can bind to the same port.
    let dev_tcp = std::env::var("TRUTHTLAYER_DEV_TCP")
        .is_ok_and(|v| v == "1" || v.eq_ignore_ascii_case("true"));

    if dev_tcp {
        let tcp_app = app.clone();
        let tcp_addr = addr;
        tokio::spawn(async move {
            tracing::warn!(
                %tcp_addr,
                "DEV TCP listener starting (TRUTHTLAYER_DEV_TCP=true) — NOT for production"
            );
            let listener = match tokio::net::TcpListener::bind(tcp_addr).await {
                Ok(l) => l,
                Err(e) => {
                    tracing::error!(error = %e, "failed to bind dev TCP listener");
                    return;
                }
            };
            tracing::info!(%tcp_addr, protocol = "HTTP/1.1 (TCP, dev-only)", "listening");
            if let Err(e) = axum::serve(listener, tcp_app).await {
                tracing::error!(error = %e, "dev TCP listener error");
            }
        });
    }

    h3_server::serve_h3(server_config, addr, app).await?;

    Ok(())
}
