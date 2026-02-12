//! In-memory implementation of ContextStore.
//! Mirrors src/store/in-memory-store.ts (subset).

use std::collections::HashMap;
use std::sync::RwLock;

use async_trait::async_trait;

use crate::store::context_store::{ContextStore, StoreError};
use crate::types::{
    AppliedMetadata, AuditEvent, Comment, ConflictDetectionResult, ConflictSeverity, ContextNode,
    FieldChange, MergeConflictField, MergeResult, NodeId, NodeQuery, NodeQueryResult, NodeStatus,
    Operation, Proposal, ProposalConflict, ProposalQuery, ProposalStatus, Review, ReviewAction,
};

fn node_key(id: &NodeId) -> String {
    id.key()
}

fn operations_node_keys(ops: &[Operation]) -> std::collections::HashSet<String> {
    let mut keys = std::collections::HashSet::new();
    for op in ops {
        match op {
            Operation::Create { node, .. } => {
                keys.insert(node_key(&node.id));
            }
            Operation::Update { node_id, .. }
            | Operation::Delete { node_id, .. }
            | Operation::StatusChange { node_id, .. } => {
                keys.insert(node_key(node_id));
            }
        }
    }
    keys
}

fn key_to_node_id(key: &str) -> Option<NodeId> {
    if key.contains(':') {
        let mut it = key.splitn(2, ':');
        let namespace = it.next().map(String::from);
        let id = it.next().map(String::from)?;
        Some(NodeId { id, namespace })
    } else {
        Some(NodeId {
            id: key.to_string(),
            namespace: None,
        })
    }
}

pub struct InMemoryStore {
    nodes: RwLock<HashMap<String, ContextNode>>,
    proposals: RwLock<HashMap<String, Proposal>>,
    reviews: RwLock<HashMap<String, Vec<Review>>>,
    /// Incremented on each apply; used for appliedToRevisionId / previousRevisionId.
    revision_counter: RwLock<u64>,
    /// Immutable audit log (append-only).
    audit_log: RwLock<Vec<AuditEvent>>,
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
            audit_log: RwLock::new(Vec::new()),
            reviews: RwLock::new(HashMap::new()),
            revision_counter: RwLock::new(0),
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
                // Content fingerprinting: SHA-256 hash for IP protection
                node.metadata.content_hash =
                    Some(crate::sensitivity::content_hash(&node.content));
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
                    // Recompute content hash on content change
                    existing.metadata.content_hash =
                        Some(crate::sensitivity::content_hash(c));
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
        let nodes = self
            .nodes
            .read()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        Ok(nodes.get(&key).cloned())
    }

    async fn query_nodes(&self, query: NodeQuery) -> Result<NodeQueryResult, StoreError> {
        let nodes = self
            .nodes
            .read()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
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
                    || n.title
                        .as_ref()
                        .map(|t| t.to_lowercase().contains(&s))
                        .unwrap_or(false)
                    || n.description
                        .as_ref()
                        .map(|d| d.to_lowercase().contains(&s))
                        .unwrap_or(false)
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
        let proposals = self
            .proposals
            .read()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        Ok(proposals.get(proposal_id).cloned())
    }

    async fn query_proposals(&self, query: ProposalQuery) -> Result<Vec<Proposal>, StoreError> {
        let proposals = self
            .proposals
            .read()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
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
        let mut proposals = self
            .proposals
            .write()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        if proposals.contains_key(&id) {
            return Err(StoreError::Conflict(format!(
                "proposal {} already exists",
                id
            )));
        }
        proposals.insert(id, proposal);
        Ok(())
    }

    async fn update_proposal(
        &self,
        proposal_id: &str,
        updates: serde_json::Value,
    ) -> Result<(), StoreError> {
        let mut proposals = self
            .proposals
            .write()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        let p = proposals
            .get_mut(proposal_id)
            .ok_or_else(|| StoreError::NotFound(format!("proposal {}", proposal_id)))?;
        if let Some(s) = updates.get("status").and_then(|v| v.as_str()) {
            // Only apply_proposal may set status to Applied (it also sets applied metadata).
            if s == "applied" {
                return Err(StoreError::Invalid(
                    "cannot set status to applied via PATCH; use POST /proposals/:id/apply"
                        .to_string(),
                ));
            }
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
        let mut proposals = self
            .proposals
            .write()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        let p = proposals
            .get_mut(&proposal_id)
            .ok_or_else(|| StoreError::NotFound(format!("proposal {}", proposal_id)))?;
        if p.status != ProposalStatus::Open {
            return Err(StoreError::Invalid(
                "proposal is not open for review".to_string(),
            ));
        }
        if review.action == ReviewAction::Accept {
            p.status = ProposalStatus::Accepted;
        } else if review.action == ReviewAction::Reject {
            p.status = ProposalStatus::Rejected;
        }

        let mut reviews = self
            .reviews
            .write()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        reviews.entry(proposal_id).or_default().push(review);
        Ok(())
    }

    async fn apply_proposal(&self, proposal_id: &str, applied_by: &str) -> Result<(), StoreError> {
        // Idempotent: if already Applied, return Ok without mutating.
        {
            let proposals = self
                .proposals
                .read()
                .map_err(|e| StoreError::Internal(e.to_string()))?;
            if let Some(p) = proposals.get(proposal_id) {
                if p.status == ProposalStatus::Applied {
                    return Ok(());
                }
            }
        }

        let (ops, _modified_at, _modified_by, last_review_id) = {
            let proposals = self
                .proposals
                .read()
                .map_err(|e| StoreError::Internal(e.to_string()))?;
            let proposal = proposals
                .get(proposal_id)
                .ok_or_else(|| StoreError::NotFound(format!("proposal {}", proposal_id)))?;
            if proposal.status != ProposalStatus::Accepted {
                return Err(StoreError::Invalid(
                    "only accepted proposals can be applied".to_string(),
                ));
            }
            let reviews = self
                .reviews
                .read()
                .map_err(|e| StoreError::Internal(e.to_string()))?;
            let last_review_id = reviews
                .get(proposal_id)
                .and_then(|v| v.last())
                .map(|r| r.id.clone());
            (
                proposal.operations.clone(),
                proposal.metadata.modified_at.clone(),
                proposal.metadata.modified_by.clone(),
                last_review_id,
            )
        };

        let mut sorted_ops = ops;
        sorted_ops.sort_by_key(|o| match o {
            Operation::Create { order, .. }
            | Operation::Update { order, .. }
            | Operation::Delete { order, .. }
            | Operation::StatusChange { order, .. } => *order,
        });

        let now = chrono::Utc::now().to_rfc3339();
        let (previous_revision_id, applied_to_revision_id) = {
            let mut rev = self
                .revision_counter
                .write()
                .map_err(|e| StoreError::Internal(e.to_string()))?;
            let prev = format!("rev_{}", *rev);
            *rev += 1;
            let applied_to = format!("rev_{}", *rev);
            (prev, applied_to)
        };

        {
            let mut nodes = self
                .nodes
                .write()
                .map_err(|e| StoreError::Internal(e.to_string()))?;
            for op in &sorted_ops {
                InMemoryStore::apply_operation(&mut nodes, op, &now, applied_by)?;
            }
        }
        {
            let mut proposals = self
                .proposals
                .write()
                .map_err(|e| StoreError::Internal(e.to_string()))?;
            if let Some(p) = proposals.get_mut(proposal_id) {
                p.status = ProposalStatus::Applied;
                p.applied = Some(AppliedMetadata {
                    applied_at: now,
                    applied_by: applied_by.to_string(),
                    applied_from_review_id: last_review_id,
                    applied_from_proposal_id: proposal_id.to_string(),
                    applied_to_revision_id: applied_to_revision_id.clone(),
                    previous_revision_id: previous_revision_id.clone(),
                });
            }
        }
        Ok(())
    }

    async fn withdraw_proposal(&self, proposal_id: &str) -> Result<(), StoreError> {
        let mut proposals = self
            .proposals
            .write()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        let p = proposals
            .get_mut(proposal_id)
            .ok_or_else(|| StoreError::NotFound(format!("proposal {}", proposal_id)))?;
        if p.status != ProposalStatus::Open {
            return Err(StoreError::Invalid(
                "only open proposals (draft/submitted/changes_requested) can be withdrawn"
                    .to_string(),
            ));
        }
        p.status = ProposalStatus::Withdrawn;
        Ok(())
    }

    async fn get_review_history(&self, proposal_id: &str) -> Result<Vec<Review>, StoreError> {
        let reviews = self
            .reviews
            .read()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        Ok(reviews.get(proposal_id).cloned().unwrap_or_default())
    }

    async fn get_proposal_comments(&self, proposal_id: &str) -> Result<Vec<Comment>, StoreError> {
        let proposals = self
            .proposals
            .read()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
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
        let mut proposals = self
            .proposals
            .write()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
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

    async fn detect_conflicts(
        &self,
        proposal_id: &str,
    ) -> Result<ConflictDetectionResult, StoreError> {
        let (proposal, open) = {
            let proposals = self
                .proposals
                .read()
                .map_err(|e| StoreError::Internal(e.to_string()))?;
            let proposal = proposals
                .get(proposal_id)
                .cloned()
                .ok_or_else(|| StoreError::NotFound(format!("proposal {}", proposal_id)))?;
            let open: Vec<Proposal> = proposals
                .values()
                .filter(|p| p.status == ProposalStatus::Open && p.id != proposal_id)
                .cloned()
                .collect();
            (proposal, open)
        };
        let node_ids_self: std::collections::HashSet<String> =
            operations_node_keys(&proposal.operations);
        let mut conflicts = Vec::new();
        let mut needs_resolution = Vec::new();
        for other in &open {
            let node_ids_other = operations_node_keys(&other.operations);
            let conflicting_nodes: Vec<NodeId> = node_ids_self
                .intersection(&node_ids_other)
                .filter_map(|k| key_to_node_id(k))
                .collect();
            if conflicting_nodes.is_empty() {
                continue;
            }
            let severity = if conflicting_nodes.len() > 1 {
                ConflictSeverity::Critical
            } else {
                ConflictSeverity::Node
            };
            conflicts.push(ProposalConflict {
                proposals: vec![proposal_id.to_string(), other.id.clone()],
                conflicting_nodes: conflicting_nodes.clone(),
                conflicting_fields: None,
                severity,
                auto_resolvable: false,
            });
            if !needs_resolution.contains(&other.id) {
                needs_resolution.push(other.id.clone());
            }
        }
        let mergeable: Vec<String> = open
            .iter()
            .map(|p| p.id.clone())
            .filter(|id| !needs_resolution.contains(id))
            .collect();
        Ok(ConflictDetectionResult {
            conflicts,
            mergeable,
            needs_resolution,
        })
    }

    async fn is_proposal_stale(&self, proposal_id: &str) -> Result<bool, StoreError> {
        let (proposal, nodes) = {
            let proposals = self
                .proposals
                .read()
                .map_err(|e| StoreError::Internal(e.to_string()))?;
            let proposal = proposals
                .get(proposal_id)
                .cloned()
                .ok_or_else(|| StoreError::NotFound(format!("proposal {}", proposal_id)))?;
            let nodes = self
                .nodes
                .read()
                .map_err(|e| StoreError::Internal(e.to_string()))?;
            let node_keys: Vec<String> = operations_node_keys(&proposal.operations)
                .into_iter()
                .collect();
            let current_versions: std::collections::HashMap<String, u32> = node_keys
                .iter()
                .filter_map(|k| nodes.get(k).map(|n| (k.clone(), n.metadata.version)))
                .collect();
            (proposal, current_versions)
        };
        let base = match &proposal.metadata.base_versions {
            Some(b) => b,
            None => return Ok(false),
        };
        for (key, &current_v) in &nodes {
            if let Some(&base_v) = base.get(key) {
                if current_v > base_v {
                    return Ok(true);
                }
            }
        }
        Ok(false)
    }

    async fn merge_proposals(&self, proposal_ids: &[String]) -> Result<MergeResult, StoreError> {
        let proposals: Vec<Proposal> = {
            let p = self
                .proposals
                .read()
                .map_err(|e| StoreError::Internal(e.to_string()))?;
            proposal_ids
                .iter()
                .filter_map(|id| p.get(id).cloned())
                .collect()
        };
        if proposals.len() != proposal_ids.len() {
            return Err(StoreError::NotFound(
                "one or more proposal ids not found".to_string(),
            ));
        }
        // Field-level: (node_key, field) -> (proposal_id, value)
        let mut by_field: std::collections::HashMap<
            (String, String),
            Vec<(String, serde_json::Value)>,
        > = std::collections::HashMap::new();
        for prop in &proposals {
            for op in &prop.operations {
                match op {
                    Operation::Update {
                        node_id, changes, ..
                    } => {
                        let key = node_id.key();
                        if let Some(ref c) = changes.content {
                            by_field
                                .entry((key.clone(), "content".to_string()))
                                .or_default()
                                .push((prop.id.clone(), serde_json::json!(c)));
                        }
                        if let Some(s) = &changes.status {
                            by_field
                                .entry((key.clone(), "status".to_string()))
                                .or_default()
                                .push((
                                    prop.id.clone(),
                                    serde_json::to_value(s).unwrap_or(serde_json::Value::Null),
                                ));
                        }
                    }
                    _ => {}
                }
            }
        }
        let mut merged = Vec::new();
        let mut conflicts = Vec::new();
        let mut auto_merged = Vec::new();
        for ((node_key, field), values) in by_field {
            let node_id = key_to_node_id(&node_key).unwrap_or_else(|| NodeId {
                id: node_key.clone(),
                namespace: None,
            });
            if values.len() == 1 {
                let (_pid, v) = &values[0];
                auto_merged.push(FieldChange {
                    node_id: node_id.clone(),
                    field: field.clone(),
                    old_value: serde_json::Value::Null,
                    new_value: v.clone(),
                });
                continue;
            }
            let uniq: std::collections::HashSet<_> = values.iter().map(|(_, v)| v).collect();
            if uniq.len() > 1 {
                conflicts.push(MergeConflictField {
                    field: field.clone(),
                    node_id: node_id.clone(),
                    proposal1_value: values[0].1.clone(),
                    proposal2_value: values[1].1.clone(),
                });
            } else {
                merged.push(FieldChange {
                    node_id: node_id.clone(),
                    field: field.clone(),
                    old_value: serde_json::Value::Null,
                    new_value: values[0].1.clone(),
                });
            }
        }
        Ok(MergeResult {
            merged,
            conflicts,
            auto_merged,
        })
    }

    async fn reset(&self) -> Result<(), StoreError> {
        let mut nodes = self
            .nodes
            .write()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        let mut proposals = self
            .proposals
            .write()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        let mut reviews = self
            .reviews
            .write()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        let mut rev = self
            .revision_counter
            .write()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        nodes.clear();
        proposals.clear();
        reviews.clear();
        *rev = 0;
        // Note: audit log is NOT cleared on reset (intentional — audit is immutable).
        Ok(())
    }

    async fn append_audit(&self, event: AuditEvent) -> Result<(), StoreError> {
        let mut log = self
            .audit_log
            .write()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        log.push(event);
        Ok(())
    }

    async fn query_audit(
        &self,
        actor: Option<&str>,
        action: Option<&str>,
        resource_id: Option<&str>,
        from: Option<&str>,
        to: Option<&str>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<AuditEvent>, StoreError> {
        let log = self
            .audit_log
            .read()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        let filtered: Vec<&AuditEvent> = log
            .iter()
            .filter(|e| {
                if let Some(a) = actor {
                    if e.actor_id != a {
                        return false;
                    }
                }
                if let Some(act) = action {
                    let action_str = serde_json::to_string(&e.action)
                        .unwrap_or_default()
                        .replace('"', "");
                    if action_str != act {
                        return false;
                    }
                }
                if let Some(rid) = resource_id {
                    if e.resource_id != rid {
                        return false;
                    }
                }
                if let Some(f) = from {
                    if e.timestamp.as_str() < f {
                        return false;
                    }
                }
                if let Some(t) = to {
                    if e.timestamp.as_str() > t {
                        return false;
                    }
                }
                true
            })
            .collect();
        let off = offset.unwrap_or(0) as usize;
        let lim = limit.unwrap_or(100) as usize;
        let page = filtered.into_iter().skip(off).take(lim).cloned().collect();
        Ok(page)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{NodeMetadata, NodeStatus, NodeType, ProposalMetadata, ProposalStatus};

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
            sensitivity: None,
            content_hash: None,
            source_attribution: None,
            ip_classification: None,
            license: None,
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
            relations: None,
            applied: None,
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
            relations: None,
            applied: None,
        };
        store.create_proposal(proposal).await.unwrap();
        store.apply_proposal("p-create", "test-user").await.unwrap();
        let got = store
            .get_node(&NodeId {
                id: "goal-1".to_string(),
                namespace: None,
            })
            .await
            .unwrap();
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
            relations: None,
            applied: None,
        };
        store.create_proposal(proposal).await.unwrap();
        store.reset().await.unwrap();
        let got = store.get_proposal("p-1").await.unwrap();
        assert!(got.is_none());
    }

    #[tokio::test]
    async fn apply_sets_content_hash() {
        let store = InMemoryStore::new();
        let node = ContextNode {
            id: NodeId {
                id: "hash-node".to_string(),
                namespace: None,
            },
            node_type: NodeType::Goal,
            status: NodeStatus::Accepted,
            title: Some("Hash test".to_string()),
            description: None,
            content: "Test content for hashing".to_string(),
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
            id: "p-hash".to_string(),
            status: ProposalStatus::Accepted,
            operations: vec![Operation::Create {
                id: "op-1".to_string(),
                order: 1,
                node: node.clone(),
            }],
            metadata: proposal_meta(),
            comments: None,
            relations: None,
            applied: None,
        };
        store.create_proposal(proposal).await.unwrap();
        store.apply_proposal("p-hash", "test-user").await.unwrap();

        let got = store
            .get_node(&NodeId {
                id: "hash-node".to_string(),
                namespace: None,
            })
            .await
            .unwrap()
            .unwrap();

        // Verify content_hash was set on apply
        assert!(
            got.metadata.content_hash.is_some(),
            "content_hash should be set after apply"
        );
        // Verify it's the correct SHA-256 hash
        let expected_hash = crate::sensitivity::content_hash("Test content for hashing");
        assert_eq!(got.metadata.content_hash.unwrap(), expected_hash);
    }

    #[tokio::test]
    async fn audit_log_survives_reset() {
        let store = InMemoryStore::new();
        let event = crate::types::AuditEvent::new(
            "test-actor",
            "human",
            crate::types::AuditAction::StoreReset,
            "store",
            crate::types::AuditOutcome::Success,
        );
        store.append_audit(event).await.unwrap();
        store.reset().await.unwrap();
        let events = store
            .query_audit(None, None, None, None, None, None, None)
            .await
            .unwrap();
        assert!(!events.is_empty(), "audit log should survive reset");
    }
}
