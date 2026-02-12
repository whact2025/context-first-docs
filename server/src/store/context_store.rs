//! Context store trait: source of truth for nodes, proposals, reviews.
//! Mirrors src/types/context-store.ts.

use async_trait::async_trait;

use crate::types::{
    AuditEvent, Comment, ConflictDetectionResult, ContextNode, MergeResult, NodeId, NodeQuery,
    NodeQueryResult, Proposal, ProposalQuery, Review,
};

#[async_trait]
pub trait ContextStore: Send + Sync {
    async fn get_node(&self, node_id: &NodeId) -> Result<Option<ContextNode>, StoreError>;

    async fn query_nodes(&self, query: NodeQuery) -> Result<NodeQueryResult, StoreError>;

    async fn get_proposal(&self, proposal_id: &str) -> Result<Option<Proposal>, StoreError>;

    async fn query_proposals(&self, query: ProposalQuery) -> Result<Vec<Proposal>, StoreError>;

    async fn create_proposal(&self, proposal: Proposal) -> Result<(), StoreError>;

    async fn update_proposal(
        &self,
        proposal_id: &str,
        updates: serde_json::Value,
    ) -> Result<(), StoreError>;

    async fn submit_review(&self, review: Review) -> Result<(), StoreError>;

    /// Apply an accepted proposal to the store. Records AppliedMetadata and sets status to Applied.
    /// Idempotent: if the proposal is already Applied, returns Ok without mutating.
    async fn apply_proposal(&self, proposal_id: &str, applied_by: &str) -> Result<(), StoreError>;

    /// Withdraw a proposal (author only). Allowed only from Open (DRAFT/SUBMITTED/CHANGES_REQUESTED); status → Withdrawn.
    /// Returns error if proposal is already Accepted, Rejected, Withdrawn, or Applied.
    async fn withdraw_proposal(&self, proposal_id: &str) -> Result<(), StoreError>;

    async fn get_review_history(&self, proposal_id: &str) -> Result<Vec<Review>, StoreError>;

    async fn get_proposal_comments(&self, proposal_id: &str) -> Result<Vec<Comment>, StoreError>;

    async fn add_proposal_comment(
        &self,
        proposal_id: &str,
        comment: Comment,
    ) -> Result<(), StoreError>;

    async fn get_accepted_nodes(&self) -> Result<Vec<ContextNode>, StoreError>;

    async fn get_open_proposals(&self) -> Result<Vec<Proposal>, StoreError>;

    /// Compare proposal's operations (by node and field) with other open proposals.
    /// Returns conflicts, mergeable (proposal IDs), needsResolution (proposal IDs).
    /// Per AGENT_API § Conflict detection and merge; RECONCILIATION_STRATEGIES.
    async fn detect_conflicts(
        &self,
        proposal_id: &str,
    ) -> Result<ConflictDetectionResult, StoreError>;

    /// True if the base revision or target nodes have changed since the proposal was created (optimistic locking).
    /// Per AGENT_API § Conflict detection and merge.
    async fn is_proposal_stale(&self, proposal_id: &str) -> Result<bool, StoreError>;

    /// Attempts field-level merge; returns merged, conflicts, auto_merged.
    /// Per AGENT_API § Conflict detection and merge; RECONCILIATION_STRATEGIES.
    async fn merge_proposals(&self, proposal_ids: &[String]) -> Result<MergeResult, StoreError>;

    /// Reset store state (for dev/demo only). In-memory clears all; other backends may return error.
    async fn reset(&self) -> Result<(), StoreError>;

    // --- Audit log ---

    /// Append an audit event to the immutable log.
    async fn append_audit(&self, event: AuditEvent) -> Result<(), StoreError>;

    /// Query audit events with optional filters.
    async fn query_audit(
        &self,
        actor: Option<&str>,
        action: Option<&str>,
        resource_id: Option<&str>,
        from: Option<&str>,
        to: Option<&str>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<AuditEvent>, StoreError>;
}

#[derive(Debug)]
pub enum StoreError {
    NotFound(String),
    Conflict(String),
    Invalid(String),
    Internal(String),
}

impl std::fmt::Display for StoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StoreError::NotFound(msg) => write!(f, "not found: {}", msg),
            StoreError::Conflict(msg) => write!(f, "conflict: {}", msg),
            StoreError::Invalid(msg) => write!(f, "invalid: {}", msg),
            StoreError::Internal(msg) => write!(f, "internal: {}", msg),
        }
    }
}

impl std::error::Error for StoreError {}
