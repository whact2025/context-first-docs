//! Audit event model: immutable log of all state-changing actions.

use serde::{Deserialize, Serialize};

/// Actions that are recorded in the audit log.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditAction {
    ProposalCreated,
    ProposalUpdated,
    ReviewSubmitted,
    ProposalApplied,
    ProposalWithdrawn,
    NodeCreated,
    NodeUpdated,
    NodeDeleted,
    RoleChanged,
    PolicyEvaluated,
    StoreReset,
    /// Agent read of sensitive content.
    SensitiveRead,
}

/// Outcome of the audited action.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditOutcome {
    Success,
    Denied,
    PolicyViolation,
    Error,
}

/// A single audit event in the immutable log.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEvent {
    pub event_id: String,
    pub timestamp: String,
    pub actor_id: String,
    pub actor_type: String,
    pub action: AuditAction,
    pub resource_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
    pub outcome: AuditOutcome,
}

impl AuditEvent {
    /// Create a new audit event with a generated UUID and current timestamp.
    pub fn new(
        actor_id: &str,
        actor_type: &str,
        action: AuditAction,
        resource_id: &str,
        outcome: AuditOutcome,
    ) -> Self {
        Self {
            event_id: uuid::Uuid::new_v4().to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            actor_id: actor_id.to_string(),
            actor_type: actor_type.to_string(),
            action,
            resource_id: resource_id.to_string(),
            workspace_id: None,
            details: None,
            outcome,
        }
    }

    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }
}
