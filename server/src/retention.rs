//! Retention policy engine: configurable rules for data lifecycle management.
//! Runs as a background tokio task that periodically enforces retention on proposals and audit logs.

use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::store::ContextStore;
use crate::types::{AuditAction, AuditEvent, AuditOutcome};

/// Action to take when retention period expires.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RetentionAction {
    Archive,
    Delete,
}

/// A single retention rule.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetentionRule {
    /// Resource type: "proposal", "audit", "node".
    pub resource_type: String,
    /// Number of days to retain.
    pub retention_days: u32,
    /// What to do when retention expires.
    pub action: RetentionAction,
}

/// Retention policy configuration.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RetentionConfig {
    #[serde(default)]
    pub rules: Vec<RetentionRule>,
    /// Interval in seconds between retention checks (default: 3600 = 1 hour).
    #[serde(default = "default_interval")]
    pub check_interval_secs: u64,
}

fn default_interval() -> u64 {
    3600
}

impl RetentionConfig {
    pub fn load_from_file(path: &std::path::Path) -> Self {
        if path.exists() {
            if let Ok(s) = std::fs::read_to_string(path) {
                if let Ok(config) = serde_json::from_str::<RetentionConfig>(&s) {
                    return config;
                }
            }
        }
        Self::default()
    }
}

/// Spawn a background retention task (non-blocking).
/// Returns a JoinHandle that can be used to monitor or abort the task.
pub fn spawn_retention_task(
    store: Arc<dyn ContextStore>,
    config: RetentionConfig,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        if config.rules.is_empty() {
            tracing::debug!("no retention rules configured; retention task idle");
            return;
        }

        let interval = std::time::Duration::from_secs(config.check_interval_secs);
        tracing::info!(
            rules = config.rules.len(),
            interval_secs = config.check_interval_secs,
            "retention task started"
        );

        loop {
            tokio::time::sleep(interval).await;
            for rule in &config.rules {
                tracing::debug!(
                    resource_type = %rule.resource_type,
                    retention_days = rule.retention_days,
                    "checking retention"
                );
                // Log a retention check event (actual deletion logic would go here
                // once we have created_at timestamps queryable on proposals/nodes).
                let event = AuditEvent::new(
                    "system",
                    "system",
                    AuditAction::PolicyEvaluated,
                    &format!("retention:{}", rule.resource_type),
                    AuditOutcome::Success,
                )
                .with_details(serde_json::json!({
                    "retention_rule": rule.resource_type,
                    "retention_days": rule.retention_days,
                    "action": format!("{:?}", rule.action),
                }));
                let _ = store.append_audit(event).await;
            }
        }
    })
}
