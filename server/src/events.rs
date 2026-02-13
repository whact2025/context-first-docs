//! Server-Sent Events broadcast system for real-time notifications.
//!
//! Extensions subscribe to `GET /events?workspace={id}` to receive live updates:
//! `proposal_updated`, `review_submitted`, `config_changed`, `audit_event`.
//!
//! Uses `tokio::sync::broadcast` — late subscribers that fall behind by more than
//! `EVENT_CHANNEL_CAPACITY` events will miss older events (acceptable for
//! notification-style SSE where clients can refresh on reconnect).

use serde::Serialize;
use tokio::sync::broadcast;

/// Capacity of the event broadcast channel.
const EVENT_CHANNEL_CAPACITY: usize = 256;

/// A server event broadcast to SSE subscribers.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerEvent {
    /// Event type: `proposal_updated`, `review_submitted`, `config_changed`, `audit_event`.
    pub event_type: String,
    /// Workspace ID this event belongs to (for filtering).
    pub workspace_id: Option<String>,
    /// The resource that changed (proposal ID, node ID, etc.).
    pub resource_id: String,
    /// Who triggered the change.
    pub actor_id: String,
    /// ISO 8601 timestamp.
    pub timestamp: String,
    /// Optional additional data.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// Broadcast channel for server events. Cheaply cloneable (Arc-wrapped internally by broadcast).
#[derive(Clone)]
pub struct EventBus {
    tx: broadcast::Sender<ServerEvent>,
}

impl EventBus {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(EVENT_CHANNEL_CAPACITY);
        Self { tx }
    }

    /// Publish an event to all active SSE subscribers.
    /// If no subscribers are listening, the event is silently dropped.
    pub fn publish(&self, event: ServerEvent) {
        // send() returns Err only when there are zero receivers — that's fine.
        let _ = self.tx.send(event);
    }

    /// Subscribe to the event stream. Returns a receiver that yields events.
    pub fn subscribe(&self) -> broadcast::Receiver<ServerEvent> {
        self.tx.subscribe()
    }
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn publish_and_receive() {
        let bus = EventBus::new();
        let mut rx = bus.subscribe();

        bus.publish(ServerEvent {
            event_type: "proposal_updated".into(),
            workspace_id: Some("ws-1".into()),
            resource_id: "p-1".into(),
            actor_id: "user-1".into(),
            timestamp: "2026-01-01T00:00:00Z".into(),
            data: None,
        });

        let event = rx.recv().await.unwrap();
        assert_eq!(event.event_type, "proposal_updated");
        assert_eq!(event.resource_id, "p-1");
    }

    #[test]
    fn publish_with_no_subscribers_does_not_panic() {
        let bus = EventBus::new();
        bus.publish(ServerEvent {
            event_type: "test".into(),
            workspace_id: None,
            resource_id: "x".into(),
            actor_id: "a".into(),
            timestamp: "2026-01-01T00:00:00Z".into(),
            data: None,
        });
    }
}
