/**
 * Public type exports.
 */

export * from "./node.js";
export * from "./proposal.js";
export * from "./context-store.js";
// Re-export selectively from roles to avoid conflict with governance.ts Role (RBAC model)
export {
  type User,
  type Permission,
  type RoleConfiguration,
  hasRole,
  hasPermission,
  canApproveNodeType,
} from "./roles.js";
// Note: Role type is exported from governance.ts (reader|contributor|reviewer|applier|admin)
// The legacy roles.ts Role (contributor|approver|admin) is available via direct import if needed.
export * from "./issues.js";
export * from "./conflicts.js";
export * from "./audit.js";
export * from "./governance.js";