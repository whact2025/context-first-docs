/**
 * Governance types: RBAC, policy, sensitivity, provenance.
 */

// --- RBAC ---

export type ActorType = "human" | "agent" | "system";

export type Role = "reader" | "contributor" | "reviewer" | "applier" | "admin";

export interface ActorContext {
  actorId: string;
  actorType: ActorType;
  roles: Role[];
}

// --- Policy ---

export interface PolicyViolation {
  rule: string;
  message: string;
}

export type PolicyRuleType =
  | "min_approvals"
  | "required_reviewer_role"
  | "change_window"
  | "agent_restriction"
  | "agent_proposal_limit"
  | "egress_control";

export interface PolicyRule {
  type: PolicyRuleType;
  [key: string]: unknown;
}

export interface PolicyConfig {
  rules: PolicyRule[];
}

// --- Provenance ---

export interface ProvenanceResponse {
  resourceId: string;
  events: import("./audit.js").AuditEvent[];
}

// --- DSAR ---

export interface DsarExportResponse {
  subject: string;
  auditEvents: import("./audit.js").AuditEvent[];
}
