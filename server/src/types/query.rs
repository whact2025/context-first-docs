//! Query types for nodes and proposals.
//! Mirrors context-store NodeQuery, NodeQueryResult, ProposalQuery.

use serde::{Deserialize, Serialize};

use crate::types::{NodeStatus, NodeType, ProposalStatus};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NodeQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<Vec<NodeType>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<Vec<NodeStatus>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified_by: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort_by: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort_order: Option<SortOrder>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortOrder {
    Asc,
    Desc,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeQueryResult {
    pub nodes: Vec<crate::types::ContextNode>,
    pub total: u64,
    pub limit: u32,
    pub offset: u32,
    pub has_more: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProposalQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<Vec<ProposalStatus>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<u32>,
}
