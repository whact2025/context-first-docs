//! TruthLayer server: server-centric config, storage, RBAC.
//! Rust port (first slice): types, ContextStore trait, in-memory store, minimal HTTP API.

pub mod api;
pub mod config;
pub mod store;
pub mod telemetry;
pub mod types;

pub use config::{load_config, ServerConfig};
pub use store::{ContextStore, InMemoryStore};
pub use telemetry::{
    init_meter_provider, init_tracer, HttpServerMetricsLayer, RequestSpanLayer, TraceContextLayer,
};
pub use types::*;
