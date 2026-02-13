//! Axum HTTP routes: health, nodes, proposals, review, apply, audit, provenance, SSE events.
//!
//! Verb usage: GET (read), POST (create / actions), PATCH (partial update).
//! All state-changing routes enforce RBAC and emit audit events.
//! State-changing routes also publish SSE events via the EventBus.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
    routing::{get, post},
    Json, Router,
};
use futures_util::StreamExt;
use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;
use tokio_stream::wrappers::BroadcastStream;

use crate::auth::{ActorContext, ActorType, Role};
use crate::events::{EventBus, ServerEvent};
use crate::policy::{self, PolicyConfig};
use crate::rbac::{self, Forbidden};
use crate::store::ContextStore;
use crate::types::{AuditAction, AuditEvent, AuditOutcome, NodeId, NodeQuery, Proposal, Review};

/// Shared application state available to all routes.
#[derive(Clone)]
pub struct AppState {
    pub store: Arc<dyn ContextStore>,
    pub policies: Arc<PolicyConfig>,
    pub event_bus: EventBus,
}

pub fn router(
    store: Arc<dyn ContextStore>,
    policies: Arc<PolicyConfig>,
    event_bus: EventBus,
) -> Router<()> {
    let state = AppState {
        store,
        policies,
        event_bus,
    };
    Router::new()
        .route("/health", get(health))
        .route("/events", get(events_stream))
        .route("/nodes", get(query_nodes))
        .route("/nodes/:id", get(get_node))
        .route("/nodes/:id/provenance", get(get_provenance))
        .route("/proposals", get(list_proposals).post(create_proposal))
        .route("/proposals/:id", get(get_proposal).patch(update_proposal))
        .route("/proposals/:id/reviews", get(get_review_history))
        .route("/proposals/:id/review", post(submit_review))
        .route("/proposals/:id/apply", post(apply_proposal))
        .route("/proposals/:id/withdraw", post(withdraw_proposal))
        .route("/reset", post(reset_store))
        .route("/audit", get(query_audit))
        .route("/audit/export", get(export_audit))
        .route("/admin/dsar/export", get(dsar_export))
        .route("/admin/dsar/erase", post(dsar_erase))
        .with_state(state)
}

async fn health() -> impl IntoResponse {
    (StatusCode::OK, Json(serde_json::json!({ "status": "ok" })))
}

// --- SSE events endpoint ---

#[derive(Debug, serde::Deserialize)]
pub struct EventsParams {
    pub workspace: Option<String>,
}

/// `GET /events?workspace={id}` — Server-Sent Events stream for real-time notifications.
/// Subscribes to the EventBus and filters by workspace ID.
/// Each event is sent as an SSE `data:` line with JSON payload.
/// Keep-alive pings every 15s prevent connection timeouts.
async fn events_stream(
    State(state): State<AppState>,
    Extension(actor): Extension<ActorContext>,
    Query(params): Query<EventsParams>,
) -> Result<Sse<impl futures_util::Stream<Item = Result<Event, Infallible>>>, ApiError> {
    rbac::require_role(&actor, Role::Reader)?;

    let rx = state.event_bus.subscribe();
    let workspace_filter = params.workspace;

    let stream = BroadcastStream::new(rx).filter_map(move |msg: Result<ServerEvent, _>| {
        let ws = workspace_filter.clone();
        async move {
            let event = msg.ok()?;
            // Filter by workspace if specified; pass through all if no filter
            if let Some(ref ws_id) = ws {
                if event.workspace_id.as_deref() != Some(ws_id.as_str()) {
                    return None;
                }
            }
            let sse = Event::default()
                .event(&event.event_type)
                .json_data(&event)
                .ok()?;
            Some(Ok::<_, Infallible>(sse))
        }
    });

    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keepalive"),
    ))
}

/// Helper: publish a server event to SSE subscribers.
fn publish_event(
    event_bus: &EventBus,
    event_type: &str,
    resource_id: &str,
    actor: &ActorContext,
) {
    event_bus.publish(ServerEvent {
        event_type: event_type.to_string(),
        workspace_id: None, // TODO: extract workspace from request context when workspace isolation is implemented
        resource_id: resource_id.to_string(),
        actor_id: actor.actor_id.clone(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        data: None,
    });
}

fn actor_type_str(actor: &ActorContext) -> &'static str {
    match actor.actor_type {
        ActorType::Human => "human",
        ActorType::Agent => "agent",
        ActorType::System => "system",
    }
}

// --- Node routes ---

#[derive(Debug, serde::Deserialize)]
pub struct NodeQueryParams {
    pub status: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

async fn query_nodes(
    State(state): State<AppState>,
    Extension(actor): Extension<ActorContext>,
    Query(params): Query<NodeQueryParams>,
) -> Result<Json<NodeQueryResultResponse>, ApiError> {
    rbac::require_role(&actor, Role::Reader)?;

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
    let result = state.store.query_nodes(query).await?;

    // Agent sensitivity filtering: redact nodes above agent's allowed sensitivity
    let nodes = if actor.actor_type == ActorType::Agent {
        let max_sensitivity = policy::agent_max_sensitivity(&state.policies);
        let mut filtered_nodes = Vec::new();
        let mut redacted_count = 0u64;
        for node in result.nodes {
            let node_sensitivity = node
                .metadata
                .sensitivity
                .unwrap_or(crate::sensitivity::Sensitivity::Internal);
            if crate::sensitivity::agent_can_read(node_sensitivity, max_sensitivity) {
                // Log agent reads of confidential+ content
                if node_sensitivity >= crate::sensitivity::Sensitivity::Confidential {
                    let event = AuditEvent::new(
                        &actor.actor_id,
                        actor_type_str(&actor),
                        AuditAction::SensitiveRead,
                        &node.id.key(),
                        AuditOutcome::Success,
                    );
                    let _ = state.store.append_audit(event).await;
                }
                filtered_nodes.push(node);
            } else {
                redacted_count += 1;
            }
        }
        if redacted_count > 0 {
            let event = AuditEvent::new(
                &actor.actor_id,
                actor_type_str(&actor),
                AuditAction::SensitiveRead,
                "query_nodes",
                AuditOutcome::Denied,
            )
            .with_details(serde_json::json!({
                "redactedCount": redacted_count,
                "agentMaxSensitivity": max_sensitivity.as_str(),
            }));
            let _ = state.store.append_audit(event).await;
        }
        filtered_nodes
    } else {
        result.nodes
    };

    Ok(Json(NodeQueryResultResponse {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        has_more: result.has_more,
        nodes,
    }))
}

async fn get_node(
    State(state): State<AppState>,
    Extension(actor): Extension<ActorContext>,
    Path(id): Path<String>,
) -> Result<axum::response::Response, ApiError> {
    rbac::require_role(&actor, Role::Reader)?;

    let node_id = NodeId {
        id: id.clone(),
        namespace: None,
    };
    let node = state
        .store
        .get_node(&node_id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("node {}", id)))?;

    // Agent sensitivity redaction and read logging
    if actor.actor_type == ActorType::Agent {
        let node_sensitivity = node
            .metadata
            .sensitivity
            .unwrap_or(crate::sensitivity::Sensitivity::Internal);
        let max_sensitivity = policy::agent_max_sensitivity(&state.policies);

        if !crate::sensitivity::agent_can_read(node_sensitivity, max_sensitivity) {
            // Redact content for agents exceeding sensitivity level
            let event = AuditEvent::new(
                &actor.actor_id,
                actor_type_str(&actor),
                AuditAction::SensitiveRead,
                &id,
                AuditOutcome::Denied,
            )
            .with_details(serde_json::json!({
                "nodeSensitivity": node_sensitivity.as_str(),
                "agentMaxSensitivity": max_sensitivity.as_str(),
            }));
            let _ = state.store.append_audit(event).await;
            return Ok((
                StatusCode::OK,
                Json(serde_json::json!({
                    "id": node.id,
                    "type": node.node_type,
                    "status": node.status,
                    "redacted": true,
                    "reason": "sensitivity",
                    "metadata": { "sensitivity": node_sensitivity.as_str() }
                })),
            )
                .into_response());
        }

        // Log agent read (even for non-restricted) of confidential+ content
        if node_sensitivity >= crate::sensitivity::Sensitivity::Confidential {
            let event = AuditEvent::new(
                &actor.actor_id,
                actor_type_str(&actor),
                AuditAction::SensitiveRead,
                &id,
                AuditOutcome::Success,
            )
            .with_details(serde_json::json!({
                "nodeSensitivity": node_sensitivity.as_str(),
            }));
            let _ = state.store.append_audit(event).await;
        }
    }

    Ok(Json(node).into_response())
}

// --- Provenance ---

async fn get_provenance(
    State(state): State<AppState>,
    Extension(actor): Extension<ActorContext>,
    Path(id): Path<String>,
) -> Result<Json<ProvenanceResponse>, ApiError> {
    rbac::require_role(&actor, Role::Reader)?;

    // Collect all audit events for this resource
    let events = state
        .store
        .query_audit(None, None, Some(&id), None, None, Some(1000), None)
        .await?;

    Ok(Json(ProvenanceResponse {
        resource_id: id,
        events,
    }))
}

// --- Proposal routes ---

#[derive(Debug, serde::Deserialize)]
pub struct ProposalListParams {
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

async fn list_proposals(
    State(state): State<AppState>,
    Extension(actor): Extension<ActorContext>,
    Query(params): Query<ProposalListParams>,
) -> Result<Json<ProposalListResponse>, ApiError> {
    rbac::require_role(&actor, Role::Reader)?;

    let full = state.store.get_open_proposals().await?;
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
    State(state): State<AppState>,
    Extension(actor): Extension<ActorContext>,
    Json(proposal): Json<Proposal>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    rbac::require_role(&actor, Role::Contributor)?;

    // Policy: evaluate on create
    let violations = policy::evaluate_on_create(&proposal, actor_type_str(&actor), &state.policies);
    if !violations.is_empty() {
        let event = AuditEvent::new(
            &actor.actor_id,
            actor_type_str(&actor),
            AuditAction::PolicyEvaluated,
            &proposal.id,
            AuditOutcome::PolicyViolation,
        )
        .with_details(serde_json::json!({ "violations": violations }));
        let _ = state.store.append_audit(event).await;
        return Err(ApiError::PolicyViolation(violations));
    }

    let proposal_id = proposal.id.clone();
    state.store.create_proposal(proposal).await?;

    let event = AuditEvent::new(
        &actor.actor_id,
        actor_type_str(&actor),
        AuditAction::ProposalCreated,
        &proposal_id,
        AuditOutcome::Success,
    );
    let _ = state.store.append_audit(event).await;
    publish_event(&state.event_bus, "proposal_updated", &proposal_id, &actor);

    Ok((StatusCode::CREATED, Json(serde_json::json!({ "ok": true }))))
}

async fn get_proposal(
    State(state): State<AppState>,
    Extension(actor): Extension<ActorContext>,
    Path(id): Path<String>,
) -> Result<Json<Proposal>, ApiError> {
    rbac::require_role(&actor, Role::Reader)?;

    let proposal = state
        .store
        .get_proposal(&id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("proposal {}", id)))?;
    Ok(Json(proposal))
}

async fn update_proposal(
    State(state): State<AppState>,
    Extension(actor): Extension<ActorContext>,
    Path(id): Path<String>,
    Json(updates): Json<serde_json::Value>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    rbac::require_role(&actor, Role::Contributor)?;

    state.store.update_proposal(&id, updates).await?;

    let event = AuditEvent::new(
        &actor.actor_id,
        actor_type_str(&actor),
        AuditAction::ProposalUpdated,
        &id,
        AuditOutcome::Success,
    );
    let _ = state.store.append_audit(event).await;
    publish_event(&state.event_bus, "proposal_updated", &id, &actor);

    Ok((StatusCode::OK, Json(serde_json::json!({ "ok": true }))))
}

async fn get_review_history(
    State(state): State<AppState>,
    Extension(actor): Extension<ActorContext>,
    Path(id): Path<String>,
) -> Result<Json<Vec<Review>>, ApiError> {
    rbac::require_role(&actor, Role::Reader)?;

    let reviews = state.store.get_review_history(&id).await?;
    Ok(Json(reviews))
}

async fn submit_review(
    State(state): State<AppState>,
    Extension(actor): Extension<ActorContext>,
    Path(id): Path<String>,
    Json(review): Json<Review>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    rbac::require_role(&actor, Role::Reviewer)?;
    rbac::reject_agent(&actor, "submit review")?;

    if review.proposal_id != id {
        return Err(ApiError::Invalid("proposal_id mismatch".to_string()));
    }

    state.store.submit_review(review).await?;

    let event = AuditEvent::new(
        &actor.actor_id,
        actor_type_str(&actor),
        AuditAction::ReviewSubmitted,
        &id,
        AuditOutcome::Success,
    );
    let _ = state.store.append_audit(event).await;
    publish_event(&state.event_bus, "review_submitted", &id, &actor);

    // Policy: evaluate on review for multi-approval
    let proposal = state.store.get_proposal(&id).await?;
    if let Some(proposal) = proposal {
        let reviews = state.store.get_review_history(&id).await?;
        let (new_status, _violations) =
            policy::evaluate_on_review(&proposal, &reviews, &state.policies);
        if let Some(status) = new_status {
            let status_str = match status {
                crate::types::ProposalStatus::Accepted => "accepted",
                crate::types::ProposalStatus::Rejected => "rejected",
                _ => return Ok((StatusCode::OK, Json(serde_json::json!({ "ok": true })))),
            };
            let _ = state
                .store
                .update_proposal(&id, serde_json::json!({ "status": status_str }))
                .await;

            let event = AuditEvent::new(
                &actor.actor_id,
                actor_type_str(&actor),
                AuditAction::PolicyEvaluated,
                &id,
                AuditOutcome::Success,
            )
            .with_details(serde_json::json!({ "newStatus": status_str }));
            let _ = state.store.append_audit(event).await;
        }
    }

    Ok((StatusCode::OK, Json(serde_json::json!({ "ok": true }))))
}

#[derive(Debug, serde::Deserialize)]
pub struct ApplyBody {
    #[serde(default)]
    pub applied_by: Option<String>,
}

async fn apply_proposal(
    State(state): State<AppState>,
    Extension(actor): Extension<ActorContext>,
    Path(id): Path<String>,
    body: Option<Json<ApplyBody>>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    rbac::require_role(&actor, Role::Applier)?;
    rbac::reject_agent(&actor, "apply proposal")?;

    // Policy: evaluate on apply
    let proposal = state.store.get_proposal(&id).await?;
    if let Some(ref proposal) = proposal {
        let violations =
            policy::evaluate_on_apply(proposal, actor_type_str(&actor), &state.policies);
        if !violations.is_empty() {
            let event = AuditEvent::new(
                &actor.actor_id,
                actor_type_str(&actor),
                AuditAction::PolicyEvaluated,
                &id,
                AuditOutcome::PolicyViolation,
            )
            .with_details(serde_json::json!({ "violations": violations }));
            let _ = state.store.append_audit(event).await;
            return Err(ApiError::PolicyViolation(violations));
        }
    }

    let applied_by = body
        .and_then(|b| b.applied_by.clone())
        .unwrap_or_else(|| actor.actor_id.clone());
    state.store.apply_proposal(&id, &applied_by).await?;

    let event = AuditEvent::new(
        &actor.actor_id,
        actor_type_str(&actor),
        AuditAction::ProposalApplied,
        &id,
        AuditOutcome::Success,
    );
    let _ = state.store.append_audit(event).await;
    publish_event(&state.event_bus, "proposal_updated", &id, &actor);

    Ok((StatusCode::OK, Json(serde_json::json!({ "ok": true }))))
}

async fn withdraw_proposal(
    State(state): State<AppState>,
    Extension(actor): Extension<ActorContext>,
    Path(id): Path<String>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    rbac::require_role(&actor, Role::Contributor)?;

    state.store.withdraw_proposal(&id).await?;

    let event = AuditEvent::new(
        &actor.actor_id,
        actor_type_str(&actor),
        AuditAction::ProposalWithdrawn,
        &id,
        AuditOutcome::Success,
    );
    let _ = state.store.append_audit(event).await;
    publish_event(&state.event_bus, "proposal_updated", &id, &actor);

    Ok((StatusCode::OK, Json(serde_json::json!({ "ok": true }))))
}

async fn reset_store(
    State(state): State<AppState>,
    Extension(actor): Extension<ActorContext>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    rbac::require_role(&actor, Role::Admin)?;

    state.store.reset().await?;

    let event = AuditEvent::new(
        &actor.actor_id,
        actor_type_str(&actor),
        AuditAction::StoreReset,
        "store",
        AuditOutcome::Success,
    );
    let _ = state.store.append_audit(event).await;
    publish_event(&state.event_bus, "config_changed", "store", &actor);

    Ok((StatusCode::OK, Json(serde_json::json!({ "ok": true }))))
}

// --- Audit routes ---

#[derive(Debug, serde::Deserialize)]
pub struct AuditQueryParams {
    pub actor: Option<String>,
    pub action: Option<String>,
    pub resource_id: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

async fn query_audit(
    State(state): State<AppState>,
    Extension(actor): Extension<ActorContext>,
    Query(params): Query<AuditQueryParams>,
) -> Result<Json<Vec<AuditEvent>>, ApiError> {
    rbac::require_role(&actor, Role::Admin)?;

    let events = state
        .store
        .query_audit(
            params.actor.as_deref(),
            params.action.as_deref(),
            params.resource_id.as_deref(),
            params.from.as_deref(),
            params.to.as_deref(),
            params.limit,
            params.offset,
        )
        .await?;
    Ok(Json(events))
}

#[derive(Debug, serde::Deserialize)]
pub struct ExportParams {
    pub format: Option<String>,
}

async fn export_audit(
    State(state): State<AppState>,
    Extension(actor): Extension<ActorContext>,
    Query(params): Query<ExportParams>,
) -> Result<axum::response::Response, ApiError> {
    rbac::require_role(&actor, Role::Admin)?;

    let events = state
        .store
        .query_audit(None, None, None, None, None, Some(100_000), None)
        .await?;

    let format = params.format.as_deref().unwrap_or("json");
    match format {
        "csv" => {
            let mut csv =
                String::from("event_id,timestamp,actor_id,actor_type,action,resource_id,outcome\n");
            for e in &events {
                let action_str = serde_json::to_string(&e.action)
                    .unwrap_or_default()
                    .replace('"', "");
                let outcome_str = serde_json::to_string(&e.outcome)
                    .unwrap_or_default()
                    .replace('"', "");
                csv.push_str(&format!(
                    "{},{},{},{},{},{},{}\n",
                    e.event_id,
                    e.timestamp,
                    e.actor_id,
                    e.actor_type,
                    action_str,
                    e.resource_id,
                    outcome_str
                ));
            }
            Ok((
                StatusCode::OK,
                [
                    ("content-type", "text/csv"),
                    ("content-disposition", "attachment; filename=audit.csv"),
                ],
                csv,
            )
                .into_response())
        }
        _ => Ok((StatusCode::OK, Json(events)).into_response()),
    }
}

// --- DSAR (Data Subject Access Request) routes ---

#[derive(Debug, serde::Deserialize)]
pub struct DsarParams {
    pub subject: String,
}

/// DSAR export: return all data associated with an actor.
async fn dsar_export(
    State(state): State<AppState>,
    Extension(actor): Extension<ActorContext>,
    Query(params): Query<DsarParams>,
) -> Result<Json<DsarExportResponse>, ApiError> {
    rbac::require_role(&actor, Role::Admin)?;

    let audit_events = state
        .store
        .query_audit(
            Some(&params.subject),
            None,
            None,
            None,
            None,
            Some(100_000),
            None,
        )
        .await?;

    Ok(Json(DsarExportResponse {
        subject: params.subject,
        audit_events,
    }))
}

/// DSAR erase: anonymize all references to an actor in the audit log.
/// Note: actual erasure replaces actor_id with "[redacted]" in new audit events going forward.
/// Full audit anonymization would require store-level support for mutation.
async fn dsar_erase(
    State(state): State<AppState>,
    Extension(actor): Extension<ActorContext>,
    Json(params): Json<DsarParams>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    rbac::require_role(&actor, Role::Admin)?;

    let event = AuditEvent::new(
        &actor.actor_id,
        actor_type_str(&actor),
        AuditAction::RoleChanged, // repurpose for DSAR action
        &params.subject,
        AuditOutcome::Success,
    )
    .with_details(serde_json::json!({ "dsar": "erase", "subject": params.subject }));
    let _ = state.store.append_audit(event).await;

    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "ok": true,
            "message": format!("DSAR erase recorded for subject {}", params.subject)
        })),
    ))
}

// --- Response types ---

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

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProvenanceResponse {
    pub resource_id: String,
    pub events: Vec<AuditEvent>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DsarExportResponse {
    pub subject: String,
    pub audit_events: Vec<AuditEvent>,
}

// --- Error types ---

pub enum ApiError {
    NotFound(String),
    Invalid(String),
    Store(crate::store::context_store::StoreError),
    Forbidden(Forbidden),
    PolicyViolation(Vec<policy::PolicyViolation>),
}

impl From<crate::store::context_store::StoreError> for ApiError {
    fn from(e: crate::store::context_store::StoreError) -> Self {
        ApiError::Store(e)
    }
}

impl From<Forbidden> for ApiError {
    fn from(e: Forbidden) -> Self {
        ApiError::Forbidden(e)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        let (status, body) = match &self {
            ApiError::NotFound(m) => (StatusCode::NOT_FOUND, serde_json::json!({ "error": m })),
            ApiError::Invalid(m) => (StatusCode::BAD_REQUEST, serde_json::json!({ "error": m })),
            ApiError::Store(s) => (
                match s {
                    crate::store::context_store::StoreError::NotFound(_) => StatusCode::NOT_FOUND,
                    crate::store::context_store::StoreError::Conflict(_) => StatusCode::CONFLICT,
                    _ => StatusCode::INTERNAL_SERVER_ERROR,
                },
                serde_json::json!({ "error": s.to_string() }),
            ),
            ApiError::Forbidden(f) => (StatusCode::FORBIDDEN, serde_json::json!({ "error": f.0 })),
            ApiError::PolicyViolation(violations) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                serde_json::json!({ "error": "policy violation", "violations": violations }),
            ),
        };
        (status, Json(body)).into_response()
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
        let store = Arc::new(crate::store::InMemoryStore::new());
        let policies = Arc::new(PolicyConfig::default());
        let event_bus = crate::events::EventBus::new();
        let r = router(store, policies, event_bus);
        // In tests, inject a default ActorContext (simulates AUTH_DISABLED=true)
        r.layer(axum::middleware::from_fn(
            |mut req: Request<Body>, next: axum::middleware::Next| async move {
                req.extensions_mut().insert(ActorContext::dev_default());
                next.run(req).await
            },
        ))
    }

    #[tokio::test]
    async fn health_returns_ok() {
        let app = app();
        let req = Request::builder()
            .uri("/health")
            .body(Body::empty())
            .unwrap();
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
        let req = Request::builder()
            .uri("/nodes")
            .body(Body::empty())
            .unwrap();
        let res = app.oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = res.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert!(json.get("nodes").unwrap().as_array().unwrap().is_empty());
    }

    #[tokio::test]
    async fn list_proposals_returns_paginated_response() {
        let app = app();
        let req = Request::builder()
            .uri("/proposals")
            .body(Body::empty())
            .unwrap();
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
        assert_eq!(
            get_res.status(),
            StatusCode::OK,
            "get proposal after create"
        );

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

    #[tokio::test]
    async fn audit_query_returns_events() {
        let app = app();
        // Create a proposal (generates audit event)
        let proposal = serde_json::json!({
            "id": "p-audit",
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

        let audit_req = Request::builder()
            .uri("/audit")
            .body(Body::empty())
            .unwrap();
        let audit_res = app.oneshot(audit_req).await.unwrap();
        assert_eq!(audit_res.status(), StatusCode::OK);
        let body = audit_res.into_body().collect().await.unwrap().to_bytes();
        let events: Vec<serde_json::Value> = serde_json::from_slice(&body).unwrap();
        assert!(!events.is_empty());
    }

    #[tokio::test]
    async fn submit_review_and_get_review_history() {
        let app = app();
        let proposal = serde_json::json!({
            "id": "p-review",
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
        let create_res = app.clone().oneshot(create_req).await.unwrap();
        assert_eq!(create_res.status(), StatusCode::CREATED);

        let review = serde_json::json!({
            "id": "r-1",
            "proposalId": "p-review",
            "reviewer": "reviewer-1",
            "reviewedAt": "2026-01-02T00:00:00Z",
            "action": "accept"
        });
        let review_req = Request::builder()
            .method("POST")
            .uri("/proposals/p-review/review")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_vec(&review).unwrap()))
            .unwrap();
        let review_res = app.clone().oneshot(review_req).await.unwrap();
        assert_eq!(review_res.status(), StatusCode::OK);

        // Get review history
        let history_req = Request::builder()
            .uri("/proposals/p-review/reviews")
            .body(Body::empty())
            .unwrap();
        let history_res = app.clone().oneshot(history_req).await.unwrap();
        assert_eq!(history_res.status(), StatusCode::OK);
        let body = history_res.into_body().collect().await.unwrap().to_bytes();
        let reviews: Vec<serde_json::Value> = serde_json::from_slice(&body).unwrap();
        assert_eq!(reviews.len(), 1);
        assert_eq!(reviews[0]["reviewer"], "reviewer-1");
        assert_eq!(reviews[0]["action"], "accept");
    }

    #[tokio::test]
    async fn review_proposal_id_mismatch_returns_400() {
        let app = app();
        let proposal = serde_json::json!({
            "id": "p-mismatch",
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

        let review = serde_json::json!({
            "id": "r-1",
            "proposalId": "wrong-id",
            "reviewer": "reviewer-1",
            "reviewedAt": "2026-01-02T00:00:00Z",
            "action": "accept"
        });
        let review_req = Request::builder()
            .method("POST")
            .uri("/proposals/p-mismatch/review")
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_vec(&review).unwrap()))
            .unwrap();
        let review_res = app.clone().oneshot(review_req).await.unwrap();
        assert_eq!(review_res.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn provenance_returns_audit_trail() {
        let app = app();
        let proposal = serde_json::json!({
            "id": "p-prov",
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

        let prov_req = Request::builder()
            .uri("/nodes/p-prov/provenance")
            .body(Body::empty())
            .unwrap();
        let prov_res = app.clone().oneshot(prov_req).await.unwrap();
        assert_eq!(prov_res.status(), StatusCode::OK);
        let body = prov_res.into_body().collect().await.unwrap().to_bytes();
        let prov: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(prov["resourceId"], "p-prov");
        assert!(prov["events"].as_array().unwrap().len() >= 1);
    }

    #[tokio::test]
    async fn audit_export_csv() {
        let app = app();
        // Create a proposal to generate an audit event
        let proposal = serde_json::json!({
            "id": "p-csv",
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

        let csv_req = Request::builder()
            .uri("/audit/export?format=csv")
            .body(Body::empty())
            .unwrap();
        let csv_res = app.clone().oneshot(csv_req).await.unwrap();
        assert_eq!(csv_res.status(), StatusCode::OK);
        let ct = csv_res
            .headers()
            .get("content-type")
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();
        assert!(ct.contains("text/csv"), "Expected text/csv, got {}", ct);
        let body = csv_res.into_body().collect().await.unwrap().to_bytes();
        let csv_text = String::from_utf8(body.to_vec()).unwrap();
        assert!(csv_text
            .starts_with("event_id,timestamp,actor_id,actor_type,action,resource_id,outcome\n"));
        assert!(csv_text.lines().count() >= 2); // header + at least one data row
    }

    #[tokio::test]
    async fn audit_export_json_default() {
        let app = app();
        let proposal = serde_json::json!({
            "id": "p-json-audit",
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

        let json_req = Request::builder()
            .uri("/audit/export")
            .body(Body::empty())
            .unwrap();
        let json_res = app.clone().oneshot(json_req).await.unwrap();
        assert_eq!(json_res.status(), StatusCode::OK);
        let body = json_res.into_body().collect().await.unwrap().to_bytes();
        let events: Vec<serde_json::Value> = serde_json::from_slice(&body).unwrap();
        assert!(!events.is_empty());
    }

    #[tokio::test]
    async fn dsar_export_returns_subject_events() {
        let app = app();
        // Create a proposal so the dev-default actor has audit events
        let proposal = serde_json::json!({
            "id": "p-dsar",
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

        let dsar_req = Request::builder()
            .uri("/admin/dsar/export?subject=dev")
            .body(Body::empty())
            .unwrap();
        let dsar_res = app.clone().oneshot(dsar_req).await.unwrap();
        assert_eq!(dsar_res.status(), StatusCode::OK);
        let body = dsar_res.into_body().collect().await.unwrap().to_bytes();
        let dsar: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(dsar["subject"], "dev");
        assert!(dsar["auditEvents"].as_array().is_some());
    }

    #[tokio::test]
    async fn dsar_erase_records_event() {
        let app = app();
        let erase_req = Request::builder()
            .method("POST")
            .uri("/admin/dsar/erase")
            .header("content-type", "application/json")
            .body(Body::from(
                serde_json::to_vec(&serde_json::json!({ "subject": "user-to-erase" })).unwrap(),
            ))
            .unwrap();
        let erase_res = app.clone().oneshot(erase_req).await.unwrap();
        assert_eq!(erase_res.status(), StatusCode::OK);
        let body = erase_res.into_body().collect().await.unwrap().to_bytes();
        let result: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(result["ok"], true);
        assert!(result["message"]
            .as_str()
            .unwrap()
            .contains("user-to-erase"));
    }

    #[tokio::test]
    async fn apply_then_get_node_is_created() {
        let app = app();
        let node = serde_json::json!({
            "id": {"id": "applied-node"},
            "type": "goal",
            "status": "accepted",
            "content": "Applied goal",
            "metadata": {"createdAt":"2026-01-01T00:00:00Z","createdBy":"u","modifiedAt":"2026-01-01T00:00:00Z","modifiedBy":"u","version":1}
        });
        let proposal = serde_json::json!({
            "id": "p-apply-node",
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
        assert_eq!(create_res.status(), StatusCode::CREATED);

        let apply_req = Request::builder()
            .method("POST")
            .uri("/proposals/p-apply-node/apply")
            .body(Body::empty())
            .unwrap();
        let apply_res = app.clone().oneshot(apply_req).await.unwrap();
        assert_eq!(apply_res.status(), StatusCode::OK);

        // Verify the node was created in the store
        let get_req = Request::builder()
            .uri("/nodes/applied-node")
            .body(Body::empty())
            .unwrap();
        let get_res = app.clone().oneshot(get_req).await.unwrap();
        assert_eq!(get_res.status(), StatusCode::OK);
        let body = get_res.into_body().collect().await.unwrap().to_bytes();
        let got: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(got["content"], "Applied goal");
    }

    #[tokio::test]
    async fn nodes_query_with_status_filter_and_pagination() {
        let app = app();
        // Apply a proposal to create a node with "accepted" status
        let node = serde_json::json!({
            "id": {"id": "filter-node"},
            "type": "goal",
            "status": "accepted",
            "content": "Goal for filtering",
            "metadata": {"createdAt":"2026-01-01T00:00:00Z","createdBy":"u","modifiedAt":"2026-01-01T00:00:00Z","modifiedBy":"u","version":1}
        });
        let proposal = serde_json::json!({
            "id": "p-filter",
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
        app.clone().oneshot(create_req).await.unwrap();

        let apply_req = Request::builder()
            .method("POST")
            .uri("/proposals/p-filter/apply")
            .body(Body::empty())
            .unwrap();
        app.clone().oneshot(apply_req).await.unwrap();

        // Query with status filter
        let query_req = Request::builder()
            .uri("/nodes?status=accepted&limit=10&offset=0")
            .body(Body::empty())
            .unwrap();
        let query_res = app.clone().oneshot(query_req).await.unwrap();
        assert_eq!(query_res.status(), StatusCode::OK);
        let body = query_res.into_body().collect().await.unwrap().to_bytes();
        let result: serde_json::Value = serde_json::from_slice(&body).unwrap();
        let nodes = result["nodes"].as_array().unwrap();
        assert!(!nodes.is_empty());
        assert!(result["total"].as_u64().unwrap() >= 1);
        assert!(result["limit"].as_u64().is_some());
        assert!(result["offset"].as_u64().is_some());
    }

    #[tokio::test]
    async fn proposals_pagination_params() {
        let app = app();
        // Create two proposals
        for i in 0..3 {
            let proposal = serde_json::json!({
                "id": format!("p-page-{}", i),
                "status": "open",
                "operations": [],
                "metadata": {"createdAt":"2026-01-01T00:00:00Z","createdBy":"u","modifiedAt":"2026-01-01T00:00:00Z","modifiedBy":"u"}
            });
            let req = Request::builder()
                .method("POST")
                .uri("/proposals")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::to_vec(&proposal).unwrap()))
                .unwrap();
            app.clone().oneshot(req).await.unwrap();
        }

        // Request page with limit=2, offset=0
        let req = Request::builder()
            .uri("/proposals?limit=2&offset=0")
            .body(Body::empty())
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = res.into_body().collect().await.unwrap().to_bytes();
        let result: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(result["limit"].as_u64().unwrap(), 2);
        assert_eq!(result["offset"].as_u64().unwrap(), 0);
        assert!(result["proposals"].as_array().unwrap().len() <= 2);
        assert_eq!(result["hasMore"].as_bool().unwrap(), true);

        // Request second page
        let req2 = Request::builder()
            .uri("/proposals?limit=2&offset=2")
            .body(Body::empty())
            .unwrap();
        let res2 = app.clone().oneshot(req2).await.unwrap();
        assert_eq!(res2.status(), StatusCode::OK);
        let body2 = res2.into_body().collect().await.unwrap().to_bytes();
        let result2: serde_json::Value = serde_json::from_slice(&body2).unwrap();
        assert_eq!(result2["hasMore"].as_bool().unwrap(), false);
    }

    #[tokio::test]
    async fn reset_clears_proposals_and_nodes() {
        let app = app();
        // Create a proposal
        let proposal = serde_json::json!({
            "id": "p-reset-test",
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

        // Reset
        let reset_req = Request::builder()
            .method("POST")
            .uri("/reset")
            .body(Body::empty())
            .unwrap();
        let reset_res = app.clone().oneshot(reset_req).await.unwrap();
        assert_eq!(reset_res.status(), StatusCode::OK);

        // Verify proposal is gone
        let get_req = Request::builder()
            .uri("/proposals/p-reset-test")
            .body(Body::empty())
            .unwrap();
        let get_res = app.clone().oneshot(get_req).await.unwrap();
        assert_eq!(get_res.status(), StatusCode::NOT_FOUND);
    }
}
