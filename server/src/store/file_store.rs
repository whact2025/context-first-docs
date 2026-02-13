//! File-based implementation of ContextStore.
//! Stores data as JSON files under `data/workspaces/{workspaceId}/` with atomic writes.
//! Git-friendly format for versioned truth.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::RwLock;

use async_trait::async_trait;

use crate::store::context_store::{ContextStore, StoreError};
use crate::types::{
    AppliedMetadata, AuditEvent, Comment, ConflictDetectionResult, ContextNode, MergeResult,
    NodeId, NodeQuery, NodeQueryResult, Proposal, ProposalQuery, ProposalStatus, Review,
};

/// File-based ContextStore: persists all data as JSON files.
pub struct FileStore {
    root: PathBuf,
    /// In-memory cache synchronized with disk.
    nodes: RwLock<HashMap<String, ContextNode>>,
    proposals: RwLock<HashMap<String, Proposal>>,
    reviews: RwLock<HashMap<String, Vec<Review>>>,
    audit_log: RwLock<Vec<AuditEvent>>,
    revision_counter: RwLock<u64>,
}

impl FileStore {
    /// Create a new FileStore rooted at the given data directory.
    /// Loads existing data from disk if present.
    pub fn new(root: impl Into<PathBuf>) -> Result<Self, StoreError> {
        let root = root.into();
        std::fs::create_dir_all(&root)
            .map_err(|e| StoreError::Internal(format!("cannot create data dir: {}", e)))?;

        let store = Self {
            root: root.clone(),
            nodes: RwLock::new(HashMap::new()),
            proposals: RwLock::new(HashMap::new()),
            reviews: RwLock::new(HashMap::new()),
            audit_log: RwLock::new(Vec::new()),
            revision_counter: RwLock::new(0),
        };

        // Load existing data
        store.load_from_disk()?;
        Ok(store)
    }

    fn nodes_dir(&self) -> PathBuf {
        self.root.join("nodes")
    }

    fn proposals_dir(&self) -> PathBuf {
        self.root.join("proposals")
    }

    fn reviews_dir(&self) -> PathBuf {
        self.root.join("reviews")
    }

    fn audit_file(&self) -> PathBuf {
        self.root.join("audit.json")
    }

    fn revision_file(&self) -> PathBuf {
        self.root.join("revision.json")
    }

    /// Atomic write: write to temp file then rename.
    fn atomic_write(path: &Path, content: &[u8]) -> Result<(), StoreError> {
        let dir = path.parent().unwrap_or(path);
        std::fs::create_dir_all(dir).map_err(|e| StoreError::Internal(format!("mkdir: {}", e)))?;
        let tmp = path.with_extension("tmp");
        std::fs::write(&tmp, content)
            .map_err(|e| StoreError::Internal(format!("write tmp: {}", e)))?;
        std::fs::rename(&tmp, path).map_err(|e| StoreError::Internal(format!("rename: {}", e)))?;
        Ok(())
    }

    fn load_from_disk(&self) -> Result<(), StoreError> {
        // Load nodes
        if self.nodes_dir().exists() {
            let mut nodes = self
                .nodes
                .write()
                .map_err(|e| StoreError::Internal(e.to_string()))?;
            for entry in std::fs::read_dir(self.nodes_dir())
                .map_err(|e| StoreError::Internal(e.to_string()))?
            {
                let entry = entry.map_err(|e| StoreError::Internal(e.to_string()))?;
                if entry.path().extension().map_or(false, |ext| ext == "json") {
                    let content = std::fs::read_to_string(entry.path())
                        .map_err(|e| StoreError::Internal(e.to_string()))?;
                    if let Ok(node) = serde_json::from_str::<ContextNode>(&content) {
                        let key = node.id.key();
                        nodes.insert(key, node);
                    }
                }
            }
        }

        // Load proposals
        if self.proposals_dir().exists() {
            let mut proposals = self
                .proposals
                .write()
                .map_err(|e| StoreError::Internal(e.to_string()))?;
            for entry in std::fs::read_dir(self.proposals_dir())
                .map_err(|e| StoreError::Internal(e.to_string()))?
            {
                let entry = entry.map_err(|e| StoreError::Internal(e.to_string()))?;
                if entry.path().extension().map_or(false, |ext| ext == "json") {
                    let content = std::fs::read_to_string(entry.path())
                        .map_err(|e| StoreError::Internal(e.to_string()))?;
                    if let Ok(proposal) = serde_json::from_str::<Proposal>(&content) {
                        proposals.insert(proposal.id.clone(), proposal);
                    }
                }
            }
        }

        // Load reviews
        if self.reviews_dir().exists() {
            let mut reviews = self
                .reviews
                .write()
                .map_err(|e| StoreError::Internal(e.to_string()))?;
            for entry in std::fs::read_dir(self.reviews_dir())
                .map_err(|e| StoreError::Internal(e.to_string()))?
            {
                let entry = entry.map_err(|e| StoreError::Internal(e.to_string()))?;
                if entry.path().extension().map_or(false, |ext| ext == "json") {
                    let content = std::fs::read_to_string(entry.path())
                        .map_err(|e| StoreError::Internal(e.to_string()))?;
                    if let Ok(review_list) = serde_json::from_str::<Vec<Review>>(&content) {
                        let stem = entry
                            .path()
                            .file_stem()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string();
                        reviews.insert(stem, review_list);
                    }
                }
            }
        }

        // Load audit log
        if self.audit_file().exists() {
            let content = std::fs::read_to_string(self.audit_file())
                .map_err(|e| StoreError::Internal(e.to_string()))?;
            if let Ok(events) = serde_json::from_str::<Vec<AuditEvent>>(&content) {
                let mut log = self
                    .audit_log
                    .write()
                    .map_err(|e| StoreError::Internal(e.to_string()))?;
                *log = events;
            }
        }

        // Load revision counter
        if self.revision_file().exists() {
            let content = std::fs::read_to_string(self.revision_file())
                .map_err(|e| StoreError::Internal(e.to_string()))?;
            if let Ok(rev) = serde_json::from_str::<u64>(&content) {
                let mut counter = self
                    .revision_counter
                    .write()
                    .map_err(|e| StoreError::Internal(e.to_string()))?;
                *counter = rev;
            }
        }

        Ok(())
    }

    fn save_node(&self, node: &ContextNode) -> Result<(), StoreError> {
        let path = self.nodes_dir().join(format!("{}.json", node.id.key()));
        let json =
            serde_json::to_string_pretty(node).map_err(|e| StoreError::Internal(e.to_string()))?;
        Self::atomic_write(&path, json.as_bytes())
    }

    fn save_proposal(&self, proposal: &Proposal) -> Result<(), StoreError> {
        let path = self.proposals_dir().join(format!("{}.json", proposal.id));
        let json = serde_json::to_string_pretty(proposal)
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        Self::atomic_write(&path, json.as_bytes())
    }

    fn save_reviews(&self, proposal_id: &str, reviews: &[Review]) -> Result<(), StoreError> {
        let path = self.reviews_dir().join(format!("{}.json", proposal_id));
        let json = serde_json::to_string_pretty(reviews)
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        Self::atomic_write(&path, json.as_bytes())
    }

    fn save_audit_log(&self) -> Result<(), StoreError> {
        let log = self
            .audit_log
            .read()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        let json =
            serde_json::to_string_pretty(&*log).map_err(|e| StoreError::Internal(e.to_string()))?;
        Self::atomic_write(&self.audit_file(), json.as_bytes())
    }

    fn save_revision(&self) -> Result<(), StoreError> {
        let rev = self
            .revision_counter
            .read()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        let json = serde_json::to_string(&*rev).map_err(|e| StoreError::Internal(e.to_string()))?;
        Self::atomic_write(&self.revision_file(), json.as_bytes())
    }
}

// Helper to generate node key from NodeId
fn node_key(id: &NodeId) -> String {
    id.key()
}

#[async_trait]
impl ContextStore for FileStore {
    async fn get_node(&self, node_id: &NodeId) -> Result<Option<ContextNode>, StoreError> {
        let nodes = self
            .nodes
            .read()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        Ok(nodes.get(&node_key(node_id)).cloned())
    }

    async fn query_nodes(&self, query: NodeQuery) -> Result<NodeQueryResult, StoreError> {
        let nodes = self
            .nodes
            .read()
            .map_err(|e| StoreError::Internal(e.to_string()))?;

        let mut filtered: Vec<&ContextNode> = nodes.values().collect();
        if let Some(ref statuses) = query.status {
            filtered.retain(|n| statuses.contains(&n.status));
        }
        let total = filtered.len() as u64;
        let limit = query.limit.unwrap_or(50).min(1000);
        let offset = query.offset.unwrap_or(0);
        let start = (offset as usize).min(filtered.len());
        let end = (start + limit as usize).min(filtered.len());
        let page = filtered[start..end].iter().cloned().cloned().collect();

        Ok(NodeQueryResult {
            nodes: page,
            total,
            limit,
            offset,
            has_more: end < filtered.len(),
        })
    }

    async fn get_proposal(&self, proposal_id: &str) -> Result<Option<Proposal>, StoreError> {
        let proposals = self
            .proposals
            .read()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        Ok(proposals.get(proposal_id).cloned())
    }

    async fn query_proposals(&self, _query: ProposalQuery) -> Result<Vec<Proposal>, StoreError> {
        let proposals = self
            .proposals
            .read()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        Ok(proposals.values().cloned().collect())
    }

    async fn create_proposal(&self, proposal: Proposal) -> Result<(), StoreError> {
        let mut proposals = self
            .proposals
            .write()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        if proposals.contains_key(&proposal.id) {
            return Err(StoreError::Conflict(format!(
                "proposal {} already exists",
                proposal.id
            )));
        }
        self.save_proposal(&proposal)?;
        proposals.insert(proposal.id.clone(), proposal);
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
        let proposal = proposals
            .get_mut(proposal_id)
            .ok_or_else(|| StoreError::NotFound(format!("proposal {}", proposal_id)))?;

        if let Some(status) = updates.get("status").and_then(|v| v.as_str()) {
            match status {
                "open" => proposal.status = ProposalStatus::Open,
                "accepted" => proposal.status = ProposalStatus::Accepted,
                "rejected" => proposal.status = ProposalStatus::Rejected,
                "withdrawn" => proposal.status = ProposalStatus::Withdrawn,
                "applied" => proposal.status = ProposalStatus::Applied,
                _ => {}
            }
        }
        self.save_proposal(proposal)?;
        Ok(())
    }

    async fn submit_review(&self, review: Review) -> Result<(), StoreError> {
        let mut reviews = self
            .reviews
            .write()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        let list = reviews.entry(review.proposal_id.clone()).or_default();
        list.push(review.clone());
        self.save_reviews(&review.proposal_id, list)?;
        Ok(())
    }

    async fn apply_proposal(&self, proposal_id: &str, applied_by: &str) -> Result<(), StoreError> {
        let mut proposals = self
            .proposals
            .write()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        let mut nodes = self
            .nodes
            .write()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        let mut rev = self
            .revision_counter
            .write()
            .map_err(|e| StoreError::Internal(e.to_string()))?;

        let proposal = proposals
            .get_mut(proposal_id)
            .ok_or_else(|| StoreError::NotFound(format!("proposal {}", proposal_id)))?;

        if proposal.status == ProposalStatus::Applied {
            return Ok(()); // idempotent
        }

        let prev_rev = *rev;
        *rev += 1;
        let new_rev = *rev;

        // Apply operations
        for op in &proposal.operations {
            match op {
                crate::types::Operation::Create { node, .. } => {
                    let key = node_key(&node.id);
                    let mut node = node.clone();
                    // Content fingerprinting: SHA-256 hash for IP protection
                    node.metadata.content_hash =
                        Some(crate::sensitivity::content_hash(&node.content));
                    self.save_node(&node)?;
                    nodes.insert(key, node);
                }
                crate::types::Operation::Update {
                    node_id, changes, ..
                } => {
                    let key = node_key(node_id);
                    if let Some(existing) = nodes.get_mut(&key) {
                        if let Some(ref c) = changes.content {
                            existing.content = c.clone();
                            // Recompute content hash on content change
                            existing.metadata.content_hash =
                                Some(crate::sensitivity::content_hash(c));
                        }
                        if let Some(s) = changes.status {
                            existing.status = s;
                        }
                        existing.metadata.version += 1;
                        self.save_node(existing)?;
                    }
                }
                crate::types::Operation::Delete { node_id, .. } => {
                    let key = node_key(node_id);
                    nodes.remove(&key);
                    let path = self.nodes_dir().join(format!("{}.json", key));
                    let _ = std::fs::remove_file(path);
                }
                crate::types::Operation::StatusChange {
                    node_id,
                    new_status,
                    ..
                } => {
                    let key = node_key(node_id);
                    if let Some(existing) = nodes.get_mut(&key) {
                        existing.status = *new_status;
                        self.save_node(existing)?;
                    }
                }
            }
        }

        proposal.status = ProposalStatus::Applied;
        proposal.applied = Some(AppliedMetadata {
            applied_at: chrono::Utc::now().to_rfc3339(),
            applied_by: applied_by.to_string(),
            applied_from_review_id: None,
            applied_from_proposal_id: proposal_id.to_string(),
            applied_to_revision_id: format!("rev-{}", new_rev),
            previous_revision_id: format!("rev-{}", prev_rev),
        });
        self.save_proposal(proposal)?;
        self.save_revision()?;
        Ok(())
    }

    async fn withdraw_proposal(&self, proposal_id: &str) -> Result<(), StoreError> {
        let mut proposals = self
            .proposals
            .write()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        let proposal = proposals
            .get_mut(proposal_id)
            .ok_or_else(|| StoreError::NotFound(format!("proposal {}", proposal_id)))?;

        match proposal.status {
            ProposalStatus::Open => {
                proposal.status = ProposalStatus::Withdrawn;
                self.save_proposal(proposal)?;
                Ok(())
            }
            _ => Err(StoreError::Invalid(format!(
                "cannot withdraw proposal in status {:?}",
                proposal.status
            ))),
        }
    }

    async fn get_review_history(&self, proposal_id: &str) -> Result<Vec<Review>, StoreError> {
        let reviews = self
            .reviews
            .read()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        Ok(reviews.get(proposal_id).cloned().unwrap_or_default())
    }

    async fn get_proposal_comments(&self, _proposal_id: &str) -> Result<Vec<Comment>, StoreError> {
        Ok(vec![])
    }

    async fn add_proposal_comment(
        &self,
        _proposal_id: &str,
        _comment: Comment,
    ) -> Result<(), StoreError> {
        Ok(())
    }

    async fn get_accepted_nodes(&self) -> Result<Vec<ContextNode>, StoreError> {
        let nodes = self
            .nodes
            .read()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        Ok(nodes
            .values()
            .filter(|n| n.status == crate::types::NodeStatus::Accepted)
            .cloned()
            .collect())
    }

    async fn get_open_proposals(&self) -> Result<Vec<Proposal>, StoreError> {
        let proposals = self
            .proposals
            .read()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        Ok(proposals
            .values()
            .filter(|p| p.status == ProposalStatus::Open)
            .cloned()
            .collect())
    }

    async fn detect_conflicts(
        &self,
        _proposal_id: &str,
    ) -> Result<ConflictDetectionResult, StoreError> {
        Ok(ConflictDetectionResult {
            conflicts: vec![],
            mergeable: vec![],
            needs_resolution: vec![],
        })
    }

    async fn is_proposal_stale(&self, _proposal_id: &str) -> Result<bool, StoreError> {
        Ok(false)
    }

    async fn merge_proposals(&self, _proposal_ids: &[String]) -> Result<MergeResult, StoreError> {
        Err(StoreError::Internal(
            "merge not yet implemented for file store".to_string(),
        ))
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

        // Clear files on disk (but not audit log)
        let _ = std::fs::remove_dir_all(self.nodes_dir());
        let _ = std::fs::remove_dir_all(self.proposals_dir());
        let _ = std::fs::remove_dir_all(self.reviews_dir());
        let _ = std::fs::remove_file(self.revision_file());
        Ok(())
    }

    async fn append_audit(&self, event: AuditEvent) -> Result<(), StoreError> {
        let mut log = self
            .audit_log
            .write()
            .map_err(|e| StoreError::Internal(e.to_string()))?;
        log.push(event);
        // Persist immediately
        drop(log);
        self.save_audit_log()
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
