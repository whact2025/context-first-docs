/**
 * Audit event types for the immutable governance audit log.
 */

export type AuditAction =
  | "proposal_created"
  | "proposal_updated"
  | "review_submitted"
  | "proposal_applied"
  | "proposal_withdrawn"
  | "node_created"
  | "node_updated"
  | "node_deleted"
  | "role_changed"
  | "policy_evaluated"
  | "store_reset"
  | "sensitive_read";

export type AuditOutcome = "success" | "denied" | "policy_violation" | "error";

export interface AuditEvent {
  eventId: string;
  timestamp: string;
  actorId: string;
  actorType: string;
  action: AuditAction;
  resourceId: string;
  workspaceId?: string;
  details?: Record<string, unknown>;
  outcome: AuditOutcome;
}
