//! In-memory implementation of ContextStore.
//! Mirrors src/store/in-memory-store.ts (subset).

use std::collections::HashMap;
use std::sync::RwLock;

use async_trait::async_trait;

use crate::store::context_store::{ContextStore, StoreError};
use crate::types::{
    Comment, ContextNode, NodeId, NodeQuery, NodeQueryResult, NodeStatus, Operation, Proposal,
    ProposalQuery, ProposalStatus, Review, ReviewAction,
};

fn node_key(id: &NodeId) -> String {
    id.key()
}

pub struct InMemoryStore {
    nodes: RwLock<HashMap<String, ContextNode>>,
    proposals: RwLock<HashMap<String, Proposal>>,
    reviews: RwLock<HashMap<String, Vec<Review>>>,
}

impl Default for InMemoryStore {
    fn default() -> Self {
        Self::new()
    }
}

impl InMemoryStore {
    pub fn new() -> Self {
        Self {
            nodes: RwLock::new(HashMap::new()),
            proposals: RwLock::new(HashMap::new()),
            reviews: RwLock::new(HashMap::new()),
        }
    }

    fn apply_operation(
        nodes: &mut HashMap<String, ContextNode>,
        op: &Operation,
        modified_at: &str,
        modified_by: &str,
    ) -> Result<(), StoreError> {
        match op {
            Operation::Create { node, .. } => {
                let key = node_key(&node.id);
                let mut node = node.clone();
                node.metadata.modified_at = modified_at.to_string();
                node.metadata.modified_by = modified_by.to_string();
                node.metadata.version += 1;
                nodes.insert(key, node);
            }
            Operation::Update {
                node_id, changes, ..
            } => {
                let key = node_key(node_id);
                let existing = nodes
                    .get_mut(&key)
                    .ok_or_else(|| StoreError::NotFound(format!("node {}", key)))?;
                existing.metadata.modified_at = modified_at.to_string();
                existing.metadata.modified_by = modified_by.to_string();
                existing.metadata.version += 1;
                if let Some(ref c) = changes.content {
                    existing.content = c.clone();
                    existing.description = Some(c.clone());
                }
                if let Some(s) = changes.status {
                    existing.status = s;
                }
            }
            Operation::Delete { node_id, .. } => {
                let key = node_key(node_id);
                if let Some(n) = nodes.get_mut(&key) {
                    n.status = NodeStatus::Rejected;
                    n.metadata.modified_at = modified_at.to_string();
                    n.metadata.modified_by = modified_by.to_string();
                    n.metadata.version += 1;
                }
            }
            Operation::StatusChange {
                node_id,
                new_status,
                ..
            } => {
                let key = node_key(node_id);
                if let Some(n) = nodes.get_mut(&key) {
                    n.status = *new_status;
                    n.metadata.modified_at = modified_at.to_string();
                    n.metadata.modified_by = modified_by.to_string();
                    n.metadata.version += 1;
                }
            }
        }
        Ok(())
    }
}

#[async_trait]
impl ContextStore for InMemoryStore {
    async fn get_node(&self, node_id: &NodeId) -> Result<Option<ContextNode>, StoreError> {
        let key = node_key(node_id);
        let nodes = self.nodes.read().map_err(|e| StoreError::Internal(e.to_string()))?;
        Ok(nodes.get(&key).cloned())
    }

    async fn query_nodes(&self, query: NodeQuery) -> Result<NodeQueryResult, StoreError> {
        let nodes = self.nodes.read().map_err(|e| StoreError::Internal(e.to_string()))?;
        let mut list: Vec<ContextNode> = nodes.values().cloned().collect();

        if let Some(ref statuses) = query.status {
            list.retain(|n| statuses.contains(&n.status));
        }
        if let Some(ref types) = query.r#type {
            list.retain(|n| types.contains(&n.node_type));
        }
        if let Some(ref search) = query.search {
            let s = search.to_lowercase();
            list.retain(|n| {
                n.content.to_lowercase().contains(&s)
                    || n.title.as_ref().map(|t| t.to_lowercase().contains(&s)).unwrap_or(false)
                    || n.description.as_ref().map(|d| d.to_lowercase().contains(&s)).unwrap_or(false)
            });
        }

        let total = list.len() as u64;
        let limit = query.limit.unwrap_or(50).min(1000);
        let offset = query.offset.unwrap_or(0) as usize;
        let end = (offset + limit as usize).min(list.len());
        list = list[offset..end].to_vec();
        let has_more = (offset + list.len()) < total as usize;

        Ok(NodeQueryResult {
            nodes: list,
            total,
            limit,
            offset: offset as u32,
            has_more,
        })
    }

    async fn get_proposal(&self, proposal_id: &str) -> Result<Option<Proposal>, StoreError> {
        let proposals = self.proposals.read().map_err(|e| StoreError::Internal(e.to_string()))?;
        Ok(proposals.get(proposal_id).cloned())
    }

    async fn query_proposals(&self, query: ProposalQuery) -> Result<Vec<Proposal>, StoreError> {
        let proposals = self.proposals.read().map_err(|e| StoreError::Internal(e.to_string()))?;
        let mut list: Vec<Proposal> = proposals.values().cloned().collect();
        if let Some(ref statuses) = query.status {
            list.retain(|p| statuses.contains(&p.status));
        }
        let limit = query.limit.unwrap_or(50) as usize;
        let offset = query.offset.unwrap_or(0) as usize;
        list = list.into_iter().skip(offset).take(limit).collect();
        Ok(list)
    }

    async fn create_proposal(&self, proposal: Proposal) -> Result<(), StoreError> {
        let id = proposal.id.clone();
        let mut proposals = self.proposals.write().map_err(|e| StoreError::Internal(e.to_string()))?;
        if proposals.contains_key(&id) {
            return Err(StoreError::Conflict(format!("proposal {} already exists", id)));
        }
        proposals.insert(id, proposal);
        Ok(())
    }

    async fn update_proposal(
        &self,
        proposal_id: &str,
        updates: serde_json::Value,
    ) -> Result<(), StoreError> {
        let mut proposals = self.proposals.write().map_err(|e| StoreError::Internal(e.to_string()))?;
        let p = proposals
            .get_mut(proposal_id)
            .ok_or_else(|| StoreError::NotFound(format!("proposal {}", proposal_id)))?;
        if let Some(s) = updates.get("status").and_then(|v| v.as_str()) {
            p.status = match s {
                "open" => ProposalStatus::Open,
                "accepted" => ProposalStatus::Accepted,
                "rejected" => ProposalStatus::Rejected,
                "withdrawn" => ProposalStatus::Withdrawn,
                _ => return Err(StoreError::Invalid(format!("unknown status {}", s))),
            };
        }
        if let Some(m) = updates.get("metadata").and_then(|v| v.as_object()) {
            if let Some(v) = m.get("modified_at").and_then(|v| v.as_str()) {
                p.metadata.modified_at = v.to_string();
            }
            if let Some(v) = m.get("modified_by").and_then(|v| v.as_str()) {
                p.metadata.modified_by = v.to_string();
            }
        }
        if let Some(arr) = updates.get("comments").and_then(|v| v.as_array()) {
            if let Ok(comments) = serde_json::from_value(serde_json::Value::Array(arr.clone())) {
                p.comments = Some(comments);
            }
        }
        Ok(())
    }

    async fn submit_review(&self, review: Review) -> Result<(), StoreError> {
        let proposal_id = review.proposal_id.clone();
        let mut proposals = self.proposals.write().map_err(|e| StoreError::Internal(e.to_string()))?;
        let p = proposals
            .get_mut(&proposal_id)
            .ok_or_else(|| StoreError::NotFound(format!("proposal {}", proposal_id)))?;
        if p.status != ProposalStatus::Open {
            return Err(StoreError::Invalid("proposal is not open for review".to_string()));
        }
        if review.action == ReviewAction::Accept {
            p.status = ProposalStatus::Accepted;
        } else if review.action == ReviewAction::Reject {
            p.status = ProposalStatus::Rejected;
        }

        let mut reviews = self.reviews.write().map_err(|e| StoreError::Internal(e.to_string()))?;
        reviews.entry(proposal_id).or_default().push(review);
        Ok(())
    }

    async fn apply_proposal(&self, proposal_id: &str) -> Result<(), StoreError> {
        let proposals = self.proposals.read().map_err(|e| StoreError::Internal(e.to_string()))?;
        let proposal = proposals
            .get(proposal_id)
            .ok_or_else(|| StoreError::NotFound(format!("proposal {}", proposal_id)))?;
        if proposal.status != ProposalStatus::Accepted {
            return Err(StoreError::Invalid(
                "only accepted proposals can be applied".to_string(),
            ));
        }

        let mut nodes = self.nodes.write().map_err(|e| StoreError::Internal(e.to_string()))?;
        let mut ops = proposal.operations.clone();
        ops.sort_by_key(|o| {
            match o {
                Operation::Create { order, .. }
                | Operation::Update { order, .. }
                | Operation::Delete { order, .. }
                | Operation::StatusChange { order, .. } => *order,
            }
        });
        for op in &ops {
            InMemoryStore::apply_operation(
                &mut nodes,
                op,
                &proposal.metadata.modified_at,
                &proposal.metadata.modified_by,
            )?;
        }

        drop(nodes);
        let mut proposals = self.proposals.write().map_err(|e| StoreError::Internal(e.to_string()))?;
        if let Some(p) = proposals.get_mut(proposal_id) {
            p.status = ProposalStatus::Accepted; // already accepted; could add "applied" state later
        }
        Ok(())
    }

    async fn get_review_history(&self, proposal_id: &str) -> Result<Vec<Review>, StoreError> {
        let reviews = self.reviews.read().map_err(|e| StoreError::Internal(e.to_string()))?;
        Ok(reviews.get(proposal_id).cloned().unwrap_or_default())
    }

    async fn get_proposal_comments(&self, proposal_id: &str) -> Result<Vec<Comment>, StoreError> {
        let proposals = self.proposals.read().map_err(|e| StoreError::Internal(e.to_string()))?;
        Ok(proposals
            .get(proposal_id)
            .and_then(|p| p.comments.as_ref())
            .cloned()
            .unwrap_or_default())
    }

    async fn add_proposal_comment(
        &self,
        proposal_id: &str,
        comment: Comment,
    ) -> Result<(), StoreError> {
        let mut proposals = self.proposals.write().map_err(|e| StoreError::Internal(e.to_string()))?;
        let p = proposals
            .get_mut(proposal_id)
            .ok_or_else(|| StoreError::NotFound(format!("proposal {}", proposal_id)))?;
        p.comments.get_or_insert_with(Vec::new).push(comment);
        Ok(())
    }

    async fn get_accepted_nodes(&self) -> Result<Vec<ContextNode>, StoreError> {
        self.query_nodes(NodeQuery {
            status: Some(vec![NodeStatus::Accepted]),
            ..Default::default()
        })
        .await
        .map(|r| r.nodes)
    }

    async fn get_open_proposals(&self) -> Result<Vec<Proposal>, StoreError> {
        self.query_proposals(ProposalQuery {
            status: Some(vec![ProposalStatus::Open]),
            ..Default::default()
        })
        .await
    }

    async fn reset(&self) -> Result<(), StoreError> {
        let mut nodes = self.nodes.write().map_err(|e| StoreError::Internal(e.to_string()))?;
        let mut proposals = self.proposals.write().map_err(|e| StoreError::Internal(e.to_string()))?;
        let mut reviews = self.reviews.write().map_err(|e| StoreError::Internal(e.to_string()))?;
        nodes.clear();
        proposals.clear();
        reviews.clear();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{NodeMetadata, NodeType, NodeStatus, ProposalMetadata, ProposalStatus};

    fn meta() -> NodeMetadata {
        NodeMetadata {
            created_at: "2026-01-01T00:00:00Z".to_string(),
            created_by: "test".to_string(),
            modified_at: "2026-01-01T00:00:00Z".to_string(),
            modified_by: "test".to_string(),
            tags: None,
            implemented_in_commit: None,
            referenced_in_commits: None,
            version: 1,
        }
    }

    fn proposal_meta() -> ProposalMetadata {
        ProposalMetadata {
            created_at: "2026-01-01T00:00:00Z".to_string(),
            created_by: "test".to_string(),
            modified_at: "2026-01-01T00:00:00Z".to_string(),
            modified_by: "test".to_string(),
            rationale: None,
            required_approvers: None,
            approved_by: None,
            base_versions: None,
        }
    }

    #[tokio::test]
    async fn create_and_get_proposal() {
        let store = InMemoryStore::new();
        let proposal = Proposal {
            id: "p-1".to_string(),
            status: ProposalStatus::Open,
            operations: vec![],
            metadata: proposal_meta(),
            comments: None,
        };
        store.create_proposal(proposal.clone()).await.unwrap();
        let got = store.get_proposal("p-1").await.unwrap();
        assert!(got.is_some());
        assert_eq!(got.unwrap().id, "p-1");
    }

    #[tokio::test]
    async fn apply_create_then_get_node() {
        let store = InMemoryStore::new();
        let node = ContextNode {
            id: NodeId {
                id: "goal-1".to_string(),
                namespace: None,
            },
            node_type: NodeType::Goal,
            status: NodeStatus::Accepted,
            title: Some("A goal".to_string()),
            description: None,
            content: "A goal".to_string(),
            text_range: None,
            metadata: meta(),
            relationships: None,
            relations: None,
            referenced_by: None,
            source_files: None,
            decision: None,
            rationale: None,
            alternatives: None,
            decided_at: None,
            state: None,
            assignee: None,
            due_date: None,
            dependencies: None,
            severity: None,
            likelihood: None,
            mitigation: None,
            question: None,
            answer: None,
            answered_at: None,
            constraint: None,
            reason: None,
        };
        let proposal = Proposal {
            id: "p-create".to_string(),
            status: ProposalStatus::Accepted,
            operations: vec![Operation::Create {
                id: "op-1".to_string(),
                order: 1,
                node: node.clone(),
            }],
            metadata: proposal_meta(),
            comments: None,
        };
        store.create_proposal(proposal).await.unwrap();
        store.apply_proposal("p-create").await.unwrap();
        let got = store.get_node(&NodeId { id: "goal-1".to_string(), namespace: None }).await.unwrap();
        assert!(got.is_some());
        assert_eq!(got.unwrap().content, "A goal");
    }

    #[tokio::test]
    async fn reset_clears_store() {
        let store = InMemoryStore::new();
        let proposal = Proposal {
            id: "p-1".to_string(),
            status: ProposalStatus::Open,
            operations: vec![],
            metadata: proposal_meta(),
            comments: None,
        };
        store.create_proposal(proposal).await.unwrap();
        store.reset().await.unwrap();
        let got = store.get_proposal("p-1").await.unwrap();
        assert!(got.is_none());
    }
}
