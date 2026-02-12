//! TruthLayer server: server-centric config, storage, RBAC, policy, audit, sensitivity.
//! Rust port: types, ContextStore trait, in-memory store, HTTP API, governance enforcement.

pub mod api;
pub mod auth;
pub mod config;
pub mod policy;
pub mod rbac;
pub mod retention;
pub mod sensitivity;
pub mod store;
pub mod telemetry;
pub mod types;

pub use auth::{ActorContext, ActorType, AuthConfig, AuthLayer, Role};
pub use config::{load_config, ServerConfig};
pub use policy::PolicyConfig;
pub use sensitivity::Sensitivity;
pub use store::{ContextStore, InMemoryStore};
pub use telemetry::{
    init_meter_provider, init_tracer, HttpServerMetricsLayer, RequestSpanLayer, TraceContextLayer,
};
pub use types::*;
