//! Context store trait: source of truth for nodes, proposals, reviews.
//! Mirrors src/types/context-store.ts.

use async_trait::async_trait;

use crate::types::{
    Comment, ContextNode, NodeId, NodeQuery, NodeQueryResult, Proposal, ProposalQuery, Review,
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

    async fn apply_proposal(&self, proposal_id: &str) -> Result<(), StoreError>;

    async fn get_review_history(&self, proposal_id: &str) -> Result<Vec<Review>, StoreError>;

    async fn get_proposal_comments(&self, proposal_id: &str) -> Result<Vec<Comment>, StoreError>;

    async fn add_proposal_comment(
        &self,
        proposal_id: &str,
        comment: Comment,
    ) -> Result<(), StoreError>;

    async fn get_accepted_nodes(&self) -> Result<Vec<ContextNode>, StoreError>;

    async fn get_open_proposals(&self) -> Result<Vec<Proposal>, StoreError>;

    /// Reset store state (for dev/demo only). In-memory clears all; other backends may return error.
    async fn reset(&self) -> Result<(), StoreError>;
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
