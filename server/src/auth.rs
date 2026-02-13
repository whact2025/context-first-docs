//! Authentication middleware: JWT (HS256) validation and ActorContext extraction.
//! When AUTH_DISABLED=true (or 1, or not set — default for dev), all requests get a default admin actor.
//! Otherwise, requires `Authorization: Bearer <token>` with a valid HS256 JWT signed by AUTH_SECRET.

use axum::http::{HeaderMap, StatusCode};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::sync::Arc;

type HmacSha256 = Hmac<Sha256>;

/// Actor type: human user, automated agent, or system service.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActorType {
    Human,
    Agent,
    System,
}

/// Role within the RBAC model.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Reader,
    Contributor,
    Reviewer,
    Applier,
    Admin,
}

impl Role {
    /// Higher roles implicitly include lower ones (Admin > Applier > Reviewer > Contributor > Reader).
    pub fn includes(&self, other: &Role) -> bool {
        let rank = |r: &Role| -> u8 {
            match r {
                Role::Reader => 0,
                Role::Contributor => 1,
                Role::Reviewer => 2,
                Role::Applier => 3,
                Role::Admin => 4,
            }
        };
        rank(self) >= rank(other)
    }
}

/// Identity and roles extracted from the JWT (or defaults when auth is disabled).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActorContext {
    pub actor_id: String,
    pub actor_type: ActorType,
    pub roles: Vec<Role>,
}

impl ActorContext {
    /// Returns true if the actor holds the given role (or a higher one).
    pub fn has_role(&self, role: &Role) -> bool {
        self.roles.iter().any(|r| r.includes(role))
    }

    /// Default admin actor used when auth is disabled.
    pub fn dev_default() -> Self {
        Self {
            actor_id: "dev-user".to_string(),
            actor_type: ActorType::Human,
            roles: vec![Role::Admin],
        }
    }
}

/// JWT claims expected in the Bearer token.
#[derive(Debug, Deserialize)]
pub struct Claims {
    /// Subject (actor ID).
    pub sub: String,
    /// Actor type: "human", "agent", "system".
    #[serde(default = "default_actor_type")]
    pub actor_type: ActorType,
    /// Roles: ["reader", "contributor", "reviewer", "applier", "admin"].
    #[serde(default)]
    pub roles: Vec<Role>,
    /// Expiration (Unix timestamp). 0 means no expiration.
    #[serde(default)]
    pub exp: u64,
}

fn default_actor_type() -> ActorType {
    ActorType::Human
}

/// Auth configuration: shared secret.
#[derive(Debug, Clone)]
pub struct AuthConfig {
    /// When true, skip auth and use dev defaults.
    pub disabled: bool,
    /// HMAC-SHA256 shared secret for JWT validation.
    pub secret: Option<String>,
}

impl AuthConfig {
    /// Load from environment variables.
    pub fn from_env() -> Self {
        let disabled = std::env::var("AUTH_DISABLED")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(true); // default: disabled for backward compat
        let secret = std::env::var("AUTH_SECRET").ok();
        Self { disabled, secret }
    }
}

/// Decode and verify an HS256 JWT token. Returns the Claims on success.
fn decode_jwt(token: &str, secret: &str) -> Result<Claims, String> {
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;

    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err("invalid JWT: expected 3 parts".to_string());
    }

    let header_payload = format!("{}.{}", parts[0], parts[1]);
    let signature = URL_SAFE_NO_PAD
        .decode(parts[2])
        .map_err(|e| format!("invalid signature encoding: {}", e))?;

    // Verify HMAC-SHA256
    let mut mac =
        HmacSha256::new_from_slice(secret.as_bytes()).map_err(|e| format!("hmac error: {}", e))?;
    mac.update(header_payload.as_bytes());
    mac.verify_slice(&signature)
        .map_err(|_| "invalid signature".to_string())?;

    // Decode payload
    let payload_bytes = URL_SAFE_NO_PAD
        .decode(parts[1])
        .map_err(|e| format!("invalid payload encoding: {}", e))?;
    let claims: Claims =
        serde_json::from_slice(&payload_bytes).map_err(|e| format!("invalid claims: {}", e))?;

    // Check expiration
    if claims.exp > 0 {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        if now > claims.exp {
            return Err("token expired".to_string());
        }
    }

    Ok(claims)
}

/// Extract ActorContext from request headers using the given AuthConfig.
/// Returns 401 Unauthorized if the token is missing/invalid (when auth is enabled).
pub fn extract_actor(
    headers: &HeaderMap,
    config: &AuthConfig,
) -> Result<ActorContext, (StatusCode, String)> {
    if config.disabled {
        return Ok(ActorContext::dev_default());
    }

    let auth_header = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or((
            StatusCode::UNAUTHORIZED,
            "missing Authorization header".to_string(),
        ))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .or_else(|| auth_header.strip_prefix("bearer "))
        .ok_or((
            StatusCode::UNAUTHORIZED,
            "invalid Authorization scheme (expected Bearer)".to_string(),
        ))?;

    let secret = config.secret.as_ref().ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        "AUTH_SECRET not configured".to_string(),
    ))?;

    let claims = decode_jwt(token, secret)
        .map_err(|e| (StatusCode::UNAUTHORIZED, format!("auth: {}", e)))?;

    let mut roles = claims.roles;
    if roles.is_empty() {
        roles.push(Role::Reader);
    }

    Ok(ActorContext {
        actor_id: claims.sub,
        actor_type: claims.actor_type,
        roles,
    })
}

/// Tower layer that extracts ActorContext from request headers and inserts it as a request extension.
#[derive(Clone)]
pub struct AuthLayer {
    pub config: Arc<AuthConfig>,
}

impl<S> tower::Layer<S> for AuthLayer {
    type Service = AuthService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        AuthService {
            inner,
            config: self.config.clone(),
        }
    }
}

/// Tower service that validates auth and injects ActorContext.
#[derive(Clone)]
pub struct AuthService<S> {
    inner: S,
    config: Arc<AuthConfig>,
}

impl<S, ReqBody, ResBody> tower::Service<axum::http::Request<ReqBody>> for AuthService<S>
where
    S: tower::Service<axum::http::Request<ReqBody>, Response = axum::http::Response<ResBody>>
        + Clone
        + Send
        + 'static,
    S::Future: Send + 'static,
    ReqBody: Send + 'static,
    ResBody: Default + Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = std::pin::Pin<
        Box<dyn std::future::Future<Output = Result<Self::Response, Self::Error>> + Send>,
    >;

    fn poll_ready(
        &mut self,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, mut req: axum::http::Request<ReqBody>) -> Self::Future {
        let config = self.config.clone();
        let mut inner = self.inner.clone();
        Box::pin(async move {
            match extract_actor(req.headers(), &config) {
                Ok(actor) => {
                    req.extensions_mut().insert(actor);
                    inner.call(req).await
                }
                Err((_status, _msg)) => {
                    let body = ResBody::default();
                    let res = axum::http::Response::builder()
                        .status(_status)
                        .body(body)
                        .unwrap();
                    Ok(res)
                }
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn role_hierarchy() {
        assert!(Role::Admin.includes(&Role::Reader));
        assert!(Role::Admin.includes(&Role::Admin));
        assert!(Role::Reviewer.includes(&Role::Contributor));
        assert!(!Role::Reader.includes(&Role::Contributor));
    }

    #[test]
    fn actor_has_role() {
        let actor = ActorContext {
            actor_id: "u1".to_string(),
            actor_type: ActorType::Human,
            roles: vec![Role::Reviewer],
        };
        assert!(actor.has_role(&Role::Reader));
        assert!(actor.has_role(&Role::Reviewer));
        assert!(!actor.has_role(&Role::Admin));
    }

    #[test]
    fn dev_default_is_admin() {
        let actor = ActorContext::dev_default();
        assert!(actor.has_role(&Role::Admin));
        assert_eq!(actor.actor_type, ActorType::Human);
    }

    #[test]
    fn extract_actor_disabled() {
        let config = AuthConfig {
            disabled: true,
            secret: None,
        };
        let headers = HeaderMap::new();
        let actor = extract_actor(&headers, &config).unwrap();
        assert_eq!(actor.actor_id, "dev-user");
    }

    #[test]
    fn extract_actor_missing_header() {
        let config = AuthConfig {
            disabled: false,
            secret: Some("test-secret".to_string()),
        };
        let headers = HeaderMap::new();
        let err = extract_actor(&headers, &config).unwrap_err();
        assert_eq!(err.0, StatusCode::UNAUTHORIZED);
    }
}
