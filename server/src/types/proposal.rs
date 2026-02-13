//! Proposal, review, comment types.
//! Mirrors src/types/proposal.ts.

use serde::{Deserialize, Serialize};

use crate::types::{ContextNode, NodeId, NodeStatus};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProposalStatus {
    Open,
    Accepted,
    Rejected,
    Withdrawn,
    /// Terminal: proposal has been applied to accepted truth. Prevents double-apply.
    Applied,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalMetadata {
    pub created_at: String,
    pub created_by: String,
    pub modified_at: String,
    pub modified_by: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rationale: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required_approvers: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approved_by: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_versions: Option<std::collections::HashMap<String, u32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum Operation {
    Create {
        id: String,
        order: u32,
        node: ContextNode,
    },
    Update {
        id: String,
        order: u32,
        node_id: NodeId,
        changes: UpdateChanges,
    },
    Delete {
        id: String,
        order: u32,
        node_id: NodeId,
        #[serde(skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
    },
    StatusChange {
        id: String,
        order: u32,
        node_id: NodeId,
        new_status: NodeStatus,
        old_status: NodeStatus,
        #[serde(skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
    },
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateChanges {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<NodeStatus>,
    #[serde(flatten)]
    pub extra: Option<std::collections::HashMap<String, serde_json::Value>>,
}

/// Metadata recorded when a proposal is applied. Required for audit and idempotency.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppliedMetadata {
    pub applied_at: String,
    pub applied_by: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub applied_from_review_id: Option<String>,
    pub applied_from_proposal_id: String,
    pub applied_to_revision_id: String,
    pub previous_revision_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Proposal {
    pub id: String,
    pub status: ProposalStatus,
    pub operations: Vec<Operation>,
    pub metadata: ProposalMetadata,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comments: Option<Vec<Comment>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relations: Option<Vec<String>>,
    /// Present only when status is Applied. Mandatory for audit and idempotent apply.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub applied: Option<AppliedMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentAnchor {
    pub node_id: NodeId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub range: Option<CommentRange>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quote: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommentRange {
    pub start: u32,
    pub end: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CommentStatus {
    Open,
    Resolved,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    pub id: String,
    pub content: String,
    pub author: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<CommentStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolved_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolved_by: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anchor: Option<CommentAnchor>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub replies: Option<Vec<Comment>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ReviewAction {
    Accept,
    Reject,
    RequestChanges,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Review {
    pub id: String,
    pub proposal_id: String,
    pub reviewer: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reviewer_role: Option<String>,
    pub reviewed_at: String,
    pub action: ReviewAction,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comments: Option<Vec<Comment>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub operation_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_approval: Option<bool>,
}
