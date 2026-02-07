//! Binary: load config from server config root, start Axum server.

use std::sync::Arc;

use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use truthlayer_server::{
    api::routes,
    config::load_config,
    store::InMemoryStore,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config_root = std::env::args().nth(1).map(std::path::PathBuf::from);
    let config = load_config(config_root);
    tracing::info!(config_root = ?config.config_root, backend = %config.storage_backend, "config loaded");

    let store: Arc<dyn truthlayer_server::ContextStore> = match config.storage_backend.as_str() {
        "memory" | "mem" => Arc::new(InMemoryStore::new()),
        _ => {
            tracing::warn!("unknown storage backend '{}', using memory", config.storage_backend);
            Arc::new(InMemoryStore::new())
        }
    };

    let app = routes::router(store).layer(CorsLayer::permissive());
    let listener = tokio::net::TcpListener::bind(&config.listen_addr).await?;
    tracing::info!("listening on {}", config.listen_addr);
    axum::serve(listener, app).await?;
    Ok(())
}
