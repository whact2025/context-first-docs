//! RBAC enforcement: Axum extractors that check ActorContext roles.
//! Used in route handlers to gate access.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};

use crate::auth::{ActorContext, ActorType, Role};

/// Error returned when RBAC check fails.
pub struct Forbidden(pub String);

impl IntoResponse for Forbidden {
    fn into_response(self) -> Response {
        (
            StatusCode::FORBIDDEN,
            axum::Json(serde_json::json!({ "error": self.0 })),
        )
            .into_response()
    }
}

/// Require the actor to hold (at least) the given role.
pub fn require_role(actor: &ActorContext, role: Role) -> Result<(), Forbidden> {
    if actor.has_role(&role) {
        Ok(())
    } else {
        Err(Forbidden(format!(
            "insufficient role: requires {:?}, actor {} has {:?}",
            role, actor.actor_id, actor.roles
        )))
    }
}

/// Reject if actor_type is Agent (agents cannot review or apply).
pub fn reject_agent(actor: &ActorContext, action: &str) -> Result<(), Forbidden> {
    if actor.actor_type == ActorType::Agent {
        Err(Forbidden(format!(
            "agents cannot {}: agent {}",
            action, actor.actor_id
        )))
    } else {
        Ok(())
    }
}
