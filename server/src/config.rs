//! Server configuration: all runtime config lives in a predefined location
//! relative to the server (config root). See question-038.

use std::path::PathBuf;

use serde::Deserialize;

/// Runtime configuration root. Storage, RBAC, and other runtime settings
/// live under this path (e.g. config/storage.json, config/rbac.json).
#[derive(Debug, Clone)]
pub struct ServerConfig {
    /// Absolute or relative path to the config root directory.
    pub config_root: PathBuf,
    /// Storage backend: "memory" | "file" | "mongodb"
    pub storage_backend: String,
    /// For file backend: data directory under config root (e.g. "data").
    pub file_data_dir: Option<String>,
    /// For MongoDB: connection URI (can be overridden by env).
    pub mongo_uri: Option<String>,
    /// RBAC provider: "git" | "gitlab" | "azure_ad" | "dls" | etc.
    pub rbac_provider: Option<String>,
    /// HTTP listen address.
    pub listen_addr: String,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            config_root: PathBuf::from("."),
            storage_backend: "memory".to_string(),
            file_data_dir: Some("data".to_string()),
            mongo_uri: None,
            rbac_provider: None,
            listen_addr: "127.0.0.1:3080".to_string(),
        }
    }
}

/// Config file shape (e.g. config.json under config root).
#[derive(Debug, Deserialize)]
pub struct ConfigFile {
    pub storage: Option<StorageConfig>,
    pub rbac: Option<RbacConfig>,
    pub server: Option<ServerConfigFile>,
}

#[derive(Debug, Deserialize)]
pub struct StorageConfig {
    pub backend: Option<String>,
    pub file_data_dir: Option<String>,
    pub mongo_uri: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RbacConfig {
    pub provider: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ServerConfigFile {
    pub listen_addr: Option<String>,
}

/// Load server config from a config root directory.
/// Reads config/config.json (or config.json in root). Env overrides: TRUTHTLAYER_CONFIG_ROOT, TRUTHTLAYER_STORAGE, TRUTHTLAYER_LISTEN.
pub fn load_config(config_root_override: Option<PathBuf>) -> ServerConfig {
    let config_root = config_root_override
        .or_else(|| std::env::var("TRUTHTLAYER_CONFIG_ROOT").ok().map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from("."));

    let mut cfg = ServerConfig {
        config_root: config_root.clone(),
        ..Default::default()
    };

    // Try config/config.json then config.json in root
    let paths = [
        config_root.join("config").join("config.json"),
        config_root.join("config.json"),
    ];
    for path in &paths {
        if path.exists() {
            if let Ok(s) = std::fs::read_to_string(path) {
                if let Ok(file) = serde_json::from_str::<ConfigFile>(&s) {
                    if let Some(s) = file.storage {
                        if let Some(b) = s.backend {
                            cfg.storage_backend = b;
                        }
                        cfg.file_data_dir = s.file_data_dir.or(cfg.file_data_dir);
                        cfg.mongo_uri = s.mongo_uri.or(cfg.mongo_uri);
                    }
                    if let Some(r) = file.rbac {
                        cfg.rbac_provider = r.provider;
                    }
                    if let Some(s) = file.server {
                        if let Some(a) = s.listen_addr {
                            cfg.listen_addr = a;
                        }
                    }
                }
            }
            break;
        }
    }

    if let Ok(v) = std::env::var("TRUTHTLAYER_STORAGE") {
        cfg.storage_backend = v;
    }
    if let Ok(v) = std::env::var("TRUTHTLAYER_LISTEN") {
        cfg.listen_addr = v;
    }
    if let Ok(v) = std::env::var("TRUTHTLAYER_MONGO_URI") {
        cfg.mongo_uri = Some(v);
    }

    cfg
}
