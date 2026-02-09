//! Axum HTTP routes: health, nodes, proposals, review, apply.
//!
//! Verb usage: GET (read), POST (create / actions), PATCH (partial update).

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use std::sync::Arc;

use crate::store::ContextStore;
use crate::types::{NodeId, NodeQuery, Proposal, Review};

pub fn router(store: Arc<dyn ContextStore>) -> Router<()> {
    Router::new()
        .route("/health", get(health))
        .route("/nodes", get(query_nodes))
        .route("/nodes/:id", get(get_node))
        .route("/proposals", get(list_proposals).post(create_proposal))
        .route("/proposals/:id", get(get_proposal).patch(update_proposal)) // GET + PATCH
        .route("/proposals/:id/reviews", get(get_review_history))
        .route("/proposals/:id/review", post(submit_review))
        .route("/proposals/:id/apply", post(apply_proposal))
        .route("/proposals/:id/withdraw", post(withdraw_proposal))
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

#[derive(Debug, serde::Deserialize)]
pub struct ProposalListParams {
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

async fn list_proposals(
    State(store): State<Arc<dyn ContextStore>>,
    Query(params): Query<ProposalListParams>,
) -> Result<Json<ProposalListResponse>, ApiError> {
    let full = store.get_open_proposals().await?;
    let total = full.len() as u64;
    let limit = params.limit.unwrap_or(50).min(1000);
    let offset = (params.offset.unwrap_or(0) as usize).min(full.len());
    let end = (offset + limit as usize).min(full.len());
    let proposals = full[offset..end].to_vec();
    let has_more = end < full.len();
    Ok(Json(ProposalListResponse {
        proposals,
        total,
        limit,
        offset: offset as u32,
        has_more,
    }))
}

async fn create_proposal(
    State(store): State<Arc<dyn ContextStore>>,
    Json(proposal): Json<Proposal>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    store.create_proposal(proposal).await?;
    Ok((StatusCode::CREATED, Json(serde_json::json!({ "ok": true }))))
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
    // 200 OK with body for compatibility with clients that expect JSON
    Ok((StatusCode::OK, Json(serde_json::json!({ "ok": true }))))
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
    Ok((StatusCode::OK, Json(serde_json::json!({ "ok": true }))))
}

#[derive(Debug, serde::Deserialize)]
pub struct ApplyBody {
    #[serde(default)]
    pub applied_by: Option<String>,
}

async fn apply_proposal(
    State(store): State<Arc<dyn ContextStore>>,
    Path(id): Path<String>,
    body: Option<Json<ApplyBody>>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    let applied_by = body
        .and_then(|b| b.applied_by.clone())
        .unwrap_or_else(|| "unknown".to_string());
    store.apply_proposal(&id, &applied_by).await?;
    Ok((StatusCode::OK, Json(serde_json::json!({ "ok": true }))))
}

async fn withdraw_proposal(
    State(store): State<Arc<dyn ContextStore>>,
    Path(id): Path<String>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    store.withdraw_proposal(&id).await?;
    Ok((StatusCode::OK, Json(serde_json::json!({ "ok": true }))))
}

async fn reset_store(
    State(store): State<Arc<dyn ContextStore>>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    store.reset().await?;
    Ok((StatusCode::OK, Json(serde_json::json!({ "ok": true }))))
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeQueryResultResponse {
    pub nodes: Vec<crate::types::ContextNode>,
    pub total: u64,
    pub limit: u32,
    pub offset: u32,
    pub has_more: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalListResponse {
    pub proposals: Vec<Proposal>,
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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use http::Request;
    use http_body_util::BodyExt;
    use std::sync::Arc;
    use tower::ServiceExt;

    fn app() -> Router<()> {
        router(Arc::new(crate::store::InMemoryStore::new()))
    }

    #[tokio::test]
    async fn health_returns_ok() {
        let app = app();
        let req = Request::builder().uri("/health").body(Body::empty()).unwrap();
        let res = app.oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = res.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json.get("status").and_then(|v| v.as_str()), Some("ok"));
    }

    #[tokio::test]
    async fn get_node_404_when_missing() {
        let app = app();
        let req = Request::builder()
            .uri("/nodes/missing-id")
            .body(Body::empty())
            .unwrap();
        let res = app.oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn nodes_query_returns_empty() {
        let app = app();
        let req = Request::builder().uri("/nodes").body(Body::empty()).unwrap();
        let res = app.oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = res.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert!(json.get("nodes").unwrap().as_array().unwrap().is_empty());
    }

    #[tokio::test]
    async fn list_proposals_returns_paginated_response() {
        let app = app();
        let req = Request::builder().uri("/proposals").body(Body::empty()).unwrap();
        let res = app.oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = res.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert!(json.get("proposals").unwrap().as_array().is_some());
        assert!(json.get("total").unwrap().as_u64().is_some());
        assert!(json.get("limit").unwrap().as_u64().is_some());
        assert!(json.get("offset").unwrap().as_u64().is_some());
        assert!(json.get("hasMore").unwrap().as_bool().is_some());
    }

    #[tokio::test]
    async fn get_proposal_404_when_missing() {
        let app = app();
        let req = Request::builder()
            .uri("/proposals/missing-p")
            .body(Body::empty())
            .unwrap();
        let res = app.oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn create_proposal_then_get_and_patch() {
        let app = app();
        let proposal = serde_json::json!({
            "id": "p-1",
            "status": "open",
            "operations": [],
            "metadata": {
                "createdAt": "2026-01-01T00:00:00Z",
                "createdBy": "test",
                "modifiedAt": "2026-01-01T00:00:00Z",
                "modifiedBy": "test"
            }
        });
        let create_req = Request::builder()
            .method("POST")
            .uri("/proposals")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_vec(&proposal).unwrap()))
            .unwrap();
        let create_res = app.clone().oneshot(create_req).await.unwrap();
        assert_eq!(create_res.status(), StatusCode::CREATED);

        let get_req = Request::builder()
            .uri("/proposals/p-1")
            .body(Body::empty())
            .unwrap();
        let get_res = app.clone().oneshot(get_req).await.unwrap();
        assert_eq!(get_res.status(), StatusCode::OK);
        let body = get_res.into_body().collect().await.unwrap().to_bytes();
        let got: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(got["id"], "p-1");
        assert_eq!(got["status"], "open");

        let patch_req = Request::builder()
            .method("PATCH")
            .uri("/proposals/p-1")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::to_vec(&serde_json::json!({ "status": "accepted" })).unwrap(),
            ))
            .unwrap();
        let patch_res = app.clone().oneshot(patch_req).await.unwrap();
        assert_eq!(patch_res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn apply_proposal_accepts_optional_body() {
        let app = app();
        let node = serde_json::json!({
            "id": {"id": "goal-1"},
            "type": "goal",
            "status": "accepted",
            "content": "A goal",
            "metadata": {"createdAt":"2026-01-01T00:00:00Z","createdBy":"u","modifiedAt":"2026-01-01T00:00:00Z","modifiedBy":"u","version":1}
        });
        let proposal = serde_json::json!({
            "id": "p-apply",
            "status": "accepted",
            "operations": [{"id":"op1","order":1,"type":"create","node": node}],
            "metadata": {"createdAt":"2026-01-01T00:00:00Z","createdBy":"u","modifiedAt":"2026-01-01T00:00:00Z","modifiedBy":"u"}
        });
        let create_req = Request::builder()
            .method("POST")
            .uri("/proposals")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_vec(&proposal).unwrap()))
            .unwrap();
        let create_res = app.clone().oneshot(create_req).await.unwrap();
        assert_eq!(create_res.status(), StatusCode::CREATED, "create proposal");

        let get_req = Request::builder()
            .uri("/proposals/p-apply")
            .body(Body::empty())
            .unwrap();
        let get_res = app.clone().oneshot(get_req).await.unwrap();
        assert_eq!(get_res.status(), StatusCode::OK, "get proposal after create");

        let apply_req = Request::builder()
            .method("POST")
            .uri("/proposals/p-apply/apply")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::to_vec(&serde_json::json!({ "appliedBy": "test-actor" })).unwrap(),
            ))
            .unwrap();
        let apply_res = app.clone().oneshot(apply_req).await.unwrap();
        assert_eq!(apply_res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn withdraw_proposal() {
        let app = app();
        let proposal = serde_json::json!({
            "id": "p-withdraw",
            "status": "open",
            "operations": [],
            "metadata": {"createdAt":"2026-01-01T00:00:00Z","createdBy":"u","modifiedAt":"2026-01-01T00:00:00Z","modifiedBy":"u"}
        });
        let create_req = Request::builder()
            .method("POST")
            .uri("/proposals")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_vec(&proposal).unwrap()))
            .unwrap();
        app.clone().oneshot(create_req).await.unwrap();

        let withdraw_req = Request::builder()
            .method("POST")
            .uri("/proposals/p-withdraw/withdraw")
            .body(Body::empty())
            .unwrap();
        let withdraw_res = app.clone().oneshot(withdraw_req).await.unwrap();
        assert_eq!(withdraw_res.status(), StatusCode::OK);

        let get_req = Request::builder()
            .uri("/proposals/p-withdraw")
            .body(Body::empty())
            .unwrap();
        let get_res = app.oneshot(get_req).await.unwrap();
        assert_eq!(get_res.status(), StatusCode::OK);
        let body = get_res.into_body().collect().await.unwrap().to_bytes();
        let got: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(got["status"], "withdrawn");
    }

    #[tokio::test]
    async fn reset_returns_ok() {
        let app = app();
        let req = Request::builder()
            .method("POST")
            .uri("/reset")
            .body(Body::empty())
            .unwrap();
        let res = app.oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
    }
}
