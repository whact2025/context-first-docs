//! Conflict detection and merge types.
//! Per docs/core/AGENT_API.md § Conflict detection and merge and
//! docs/appendix/RECONCILIATION_STRATEGIES.md.

use serde::{Deserialize, Serialize};

use crate::types::NodeId;

/// One conflict between two proposals. Per AGENT_API: proposals, conflictingNodes,
/// conflictingFields?, severity, autoResolvable.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalConflict {
    /// Proposal IDs [id1, id2]
    pub proposals: Vec<String>,
    pub conflicting_nodes: Vec<NodeId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conflicting_fields: Option<std::collections::HashMap<String, Vec<String>>>,
    pub severity: ConflictSeverity,
    pub auto_resolvable: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConflictSeverity {
    Field,
    Node,
    Critical,
}

/// Result of detectConflicts(proposalId). Per AGENT_API: conflicts, mergeable, needsResolution.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictDetectionResult {
    pub conflicts: Vec<ProposalConflict>,
    pub mergeable: Vec<String>,
    pub needs_resolution: Vec<String>,
}

/// Field-level change. Used in MergeResult (merged, auto_merged).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldChange {
    pub node_id: NodeId,
    pub field: String,
    pub old_value: serde_json::Value,
    pub new_value: serde_json::Value,
}

/// One conflicting field in merge result. Per AGENT_API: field, nodeId, proposal1Value, proposal2Value.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeConflictField {
    pub field: String,
    pub node_id: NodeId,
    pub proposal1_value: serde_json::Value,
    pub proposal2_value: serde_json::Value,
}

/// Result of mergeProposals(proposalIds). Per AGENT_API: merged, conflicts, autoMerged.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeResult {
    pub merged: Vec<FieldChange>,
    pub conflicts: Vec<MergeConflictField>,
    pub auto_merged: Vec<FieldChange>,
}
