//! Binary: load config from server config root, start Axum server.

use std::sync::Arc;

use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use truthlayer_server::{
    api::routes,
    auth::{AuthConfig, AuthLayer},
    config::load_config,
    policy::PolicyConfig,
    retention::RetentionConfig,
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

    // Auth configuration
    let auth_config = AuthConfig::from_env();
    if auth_config.disabled {
        tracing::warn!("authentication DISABLED (AUTH_DISABLED=true or default). Set AUTH_SECRET and AUTH_DISABLED=false for production.");
    }

    // Policy configuration
    let policies_path = config.config_root.join("policies.json");
    let policies = Arc::new(PolicyConfig::load_from_file(&policies_path));
    if !policies.rules.is_empty() {
        tracing::info!(rules = policies.rules.len(), "policy engine loaded");
    }

    let store: Arc<dyn truthlayer_server::ContextStore> = match config.storage_backend.as_str() {
        "memory" | "mem" => Arc::new(InMemoryStore::new()),
        "file" => {
            let data_dir = config
                .file_data_dir
                .as_deref()
                .unwrap_or("data");
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

    // Retention policy (background task)
    let retention_path = config.config_root.join("retention.json");
    let retention_config = RetentionConfig::load_from_file(&retention_path);
    if !retention_config.rules.is_empty() {
        tracing::info!(rules = retention_config.rules.len(), "retention engine loaded");
        truthlayer_server::retention::spawn_retention_task(store.clone(), retention_config);
    }

    let app = routes::router(store, policies);

    // Auth layer (extracts ActorContext from JWT or dev defaults)
    let app = app.layer(AuthLayer {
        config: Arc::new(auth_config),
    });

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
