//! Axum HTTP routes: health, nodes, proposals, review, apply.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, put},
    Json, Router,
};
use std::sync::Arc;

use crate::store::ContextStore;
use crate::types::{NodeId, NodeQuery, Proposal, Review};

pub fn router<S: ContextStore + 'static>(store: S) -> Router<()> {
    let state = Arc::new(store);
    Router::new()
        .route("/health", get(health))
        .route("/nodes", get(query_nodes))
        .route("/nodes/:id", get(get_node))
        .route("/proposals", get(list_proposals).post(create_proposal))
        .route("/proposals/:id", get(get_proposal).put(update_proposal))
        .route("/proposals/:id/reviews", get(get_review_history))
        .route("/proposals/:id/review", post(submit_review))
        .route("/proposals/:id/apply", post(apply_proposal))
        .route("/reset", post(reset_store))
        .with_state(store)
}

async fn health() -> impl IntoResponse {
    (StatusCode::OK, Json(serde_json::json!({ "status": "ok" })))
}

#[derive(Debug, serde::Deserialize)]
pub struct NodeQueryParams {
    pub status: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

async fn query_nodes(
    State(store): State<Arc<dyn ContextStore>>,
    Query(params): Query<NodeQueryParams>,
) -> Result<Json<NodeQueryResultResponse>, ApiError> {
    let mut query = NodeQuery::default();
    if let Some(s) = params.status {
        let statuses: Vec<crate::types::NodeStatus> = s
            .split(',')
            .filter_map(|x| match x.trim() {
                "accepted" => Some(crate::types::NodeStatus::Accepted),
                "proposed" => Some(crate::types::NodeStatus::Proposed),
                "rejected" => Some(crate::types::NodeStatus::Rejected),
                "superseded" => Some(crate::types::NodeStatus::Superseded),
                _ => None,
            })
            .collect();
        if !statuses.is_empty() {
            query.status = Some(statuses);
        }
    }
    query.limit = params.limit;
    query.offset = params.offset;
    let result = store.query_nodes(query).await?;
    Ok(Json(NodeQueryResultResponse {
        nodes: result.nodes,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        has_more: result.has_more,
    }))
}

async fn get_node(
    State(store): State<Arc<dyn ContextStore>>,
    Path(id): Path<String>,
) -> Result<Json<crate::types::ContextNode>, ApiError> {
    let node_id = NodeId {
        id: id.clone(),
        namespace: None,
    };
    let node = store
        .get_node(&node_id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("node {}", id)))?;
    Ok(Json(node))
}

async fn list_proposals(
    State(store): State<Arc<dyn ContextStore>>,
) -> Result<Json<Vec<Proposal>>, ApiError> {
    let list = store
        .get_open_proposals()
        .await?;
    Ok(Json(list))
}

async fn create_proposal(
    State(store): State<Arc<dyn ContextStore>>,
    Json(proposal): Json<Proposal>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    store.create_proposal(proposal).await?;
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "ok": true })),
    ))
}

async fn get_proposal(
    State(store): State<Arc<dyn ContextStore>>,
    Path(id): Path<String>,
) -> Result<Json<Proposal>, ApiError> {
    let proposal = store
        .get_proposal(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("proposal {}", id)))?;
    Ok(Json(proposal))
}

async fn update_proposal(
    State(store): State<Arc<dyn ContextStore>>,
    Path(id): Path<String>,
    Json(updates): Json<serde_json::Value>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    store.update_proposal(&id, updates).await?;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({ "ok": true })),
    ))
}

async fn get_review_history(
    State(store): State<Arc<dyn ContextStore>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<Review>>, ApiError> {
    let reviews = store.get_review_history(&id).await?;
    Ok(Json(reviews))
}

async fn submit_review(
    State(store): State<Arc<dyn ContextStore>>,
    Path(id): Path<String>,
    Json(review): Json<Review>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    if review.proposal_id != id {
        return Err(ApiError::Invalid("proposal_id mismatch".to_string()));
    }
    store.submit_review(review).await?;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({ "ok": true })),
    ))
}

async fn apply_proposal(
    State(store): State<Arc<dyn ContextStore>>,
    Path(id): Path<String>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    store.apply_proposal(&id).await?;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({ "ok": true })),
    ))
}

async fn reset_store(
    State(store): State<Arc<dyn ContextStore>>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    store.reset().await?;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({ "ok": true })),
    ))
}

#[derive(serde::Serialize)]
pub struct NodeQueryResultResponse {
    pub nodes: Vec<crate::types::ContextNode>,
    pub total: u64,
    pub limit: u32,
    pub offset: u32,
    pub has_more: bool,
}

pub enum ApiError {
    NotFound(String),
    Invalid(String),
    Store(crate::store::context_store::StoreError),
}

impl From<crate::store::context_store::StoreError> for ApiError {
    fn from(e: crate::store::context_store::StoreError) -> Self {
        ApiError::Store(e)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        let (status, msg) = match &self {
            ApiError::NotFound(m) => (StatusCode::NOT_FOUND, m.clone()),
            ApiError::Invalid(m) => (StatusCode::BAD_REQUEST, m.clone()),
            ApiError::Store(s) => (
                match s {
                    crate::store::context_store::StoreError::NotFound(_) => StatusCode::NOT_FOUND,
                    crate::store::context_store::StoreError::Conflict(_) => StatusCode::CONFLICT,
                    _ => StatusCode::INTERNAL_SERVER_ERROR,
                },
                s.to_string(),
            ),
        };
        (status, Json(serde_json::json!({ "error": msg }))).into_response()
    }
}
