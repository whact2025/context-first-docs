//! Core node types for the context graph.
//! Mirrors src/types/node.ts.

use serde::{Deserialize, Serialize};

use crate::sensitivity::Sensitivity;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum NodeType {
    Goal,
    Decision,
    Constraint,
    Task,
    Risk,
    Question,
    Context,
    Plan,
    Note,
}

impl NodeType {
    pub fn as_str(&self) -> &'static str {
        match self {
            NodeType::Goal => "goal",
            NodeType::Decision => "decision",
            NodeType::Constraint => "constraint",
            NodeType::Task => "task",
            NodeType::Risk => "risk",
            NodeType::Question => "question",
            NodeType::Context => "context",
            NodeType::Plan => "plan",
            NodeType::Note => "note",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum NodeStatus {
    Accepted,
    Proposed,
    Rejected,
    Superseded,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct NodeId {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
}

impl NodeId {
    pub fn key(&self) -> String {
        self.namespace
            .as_ref()
            .map(|n| format!("{}:{}", n, self.id))
            .unwrap_or_else(|| self.id.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn node_id_key_without_namespace() {
        let id = NodeId {
            id: "a".to_string(),
            namespace: None,
        };
        assert_eq!(id.key(), "a");
    }

    #[test]
    fn node_id_key_with_namespace() {
        let id = NodeId {
            id: "goal-001".to_string(),
            namespace: Some("ui".to_string()),
        };
        assert_eq!(id.key(), "ui:goal-001");
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextRange {
    pub start: u32,
    pub end: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RelationshipType {
    ParentChild,
    DependsOn,
    References,
    Supersedes,
    RelatedTo,
    Implements,
    Blocks,
    Mitigates,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeRelationship {
    #[serde(rename = "type")]
    pub relationship_type: RelationshipType,
    pub target: NodeId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reverse_type: Option<RelationshipType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<RelationshipMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelationshipMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeMetadata {
    pub created_at: String,
    pub created_by: String,
    pub modified_at: String,
    pub modified_by: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub implemented_in_commit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub referenced_in_commits: Option<Vec<String>>,
    pub version: u32,
    /// Sensitivity classification for the node (default: internal).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sensitivity: Option<Sensitivity>,
    /// SHA-256 hash of node content at apply time (fingerprinting for IP protection).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_hash: Option<String>,
    /// Source attribution for provenance tracking.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_attribution: Option<String>,
    /// IP classification for governance.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip_classification: Option<String>,
    /// License identifier for content.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub license: Option<String>,
}

/// Context node: unified struct for all node types.
/// Type-specific fields (e.g. decision, rationale for Decision) are optional.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextNode {
    pub id: NodeId,
    #[serde(rename = "type")]
    pub node_type: NodeType,
    pub status: NodeStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text_range: Option<TextRange>,
    pub metadata: NodeMetadata,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relationships: Option<Vec<NodeRelationship>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relations: Option<Vec<NodeId>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub referenced_by: Option<Vec<NodeId>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_files: Option<Vec<String>>,
    // Type-specific (decision)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub decision: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rationale: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alternatives: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub decided_at: Option<String>,
    // Type-specific (task)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state: Option<TaskState>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assignee: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub due_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dependencies: Option<Vec<NodeId>>,
    // Type-specific (risk)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity: Option<RiskSeverity>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub likelihood: Option<RiskLikelihood>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mitigation: Option<String>,
    // Type-specific (question)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub question: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub answer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub answered_at: Option<String>,
    // Type-specific (constraint)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub constraint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TaskState {
    Open,
    InProgress,
    Blocked,
    Completed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RiskSeverity {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RiskLikelihood {
    Unlikely,
    Possible,
    Likely,
    Certain,
}
