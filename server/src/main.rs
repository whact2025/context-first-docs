//! Binary: load config from server config root, start Axum server.

use std::sync::Arc;

use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use truthlayer_server::{
    api::routes,
    config::load_config,
    store::InMemoryStore,
    telemetry::{
        init_meter_provider, init_tracer, HttpServerMetricsLayer, RequestSpanLayer,
        TraceContextLayer,
    },
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let config_root = std::env::args().nth(1).map(std::path::PathBuf::from);
    let config = load_config(config_root);

    // Optional OpenTelemetry: OTLP endpoint and/or console spans (OTEL_CONSOLE_SPANS=true for local dev).
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

    let store: Arc<dyn truthlayer_server::ContextStore> = match config.storage_backend.as_str() {
        "memory" | "mem" => Arc::new(InMemoryStore::new()),
        _ => {
            tracing::warn!(
                "unknown storage backend '{}', using memory",
                config.storage_backend
            );
            Arc::new(InMemoryStore::new())
        }
    };

    let app = routes::router(store);
    // When OTEL is enabled: metrics, trace context, and one span per request.
    let app = if _tracer_provider.is_some() {
        app.layer(HttpServerMetricsLayer::default())
            .layer(TraceContextLayer::default())
            .layer(RequestSpanLayer::default())
    } else {
        app
    };
    let app = app.layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind(&config.listen_addr).await?;
    tracing::info!("listening on {}", config.listen_addr);
    axum::serve(listener, app).await?;
    Ok(())
}
