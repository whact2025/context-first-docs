/**
 * Role and permission system for contributors and approvers.
 */

export type Role = "contributor" | "approver" | "admin";

export interface User {
  /** Unique identifier (e.g., GitHub username, email) */
  id: string;
  /** Display name */
  name: string;
  /** Email address */
  email?: string;
  /** Roles assigned to this user */
  roles: Role[];
  /** Optional: specific permissions beyond roles */
  permissions?: Permission[];
}

export type Permission =
  | "create-proposal"
  | "create-node"
  | "review-proposal"
  | "approve-proposal"
  | "reject-proposal"
  | "modify-node"
  | "delete-node"
  | "manage-users"
  | "manage-roles";

/**
 * Role configuration for a project or namespace.
 */
export interface RoleConfiguration {
  /** Contributors who can create proposals and nodes */
  contributors: string[]; // User IDs
  /** Approvers who can review and approve/reject proposals */
  approvers: string[]; // User IDs
  /** Admins with full access */
  admins?: string[]; // User IDs
  /** Optional: per-node-type approvers */
  nodeTypeApprovers?: {
    [nodeType: string]: string[]; // User IDs for specific node types
  };
  /** Optional: require multiple approvals for certain node types */
  approvalRequirements?: {
    [nodeType: string]: {
      minApprovals: number;
      requiredApprovers?: string[]; // Specific approvers required
    };
  };
}

/**
 * Check if a user has a specific role.
 */
export function hasRole(user: User, role: Role): boolean {
  return user.roles.includes(role);
}

/**
 * Check if a user has a specific permission.
 */
export function hasPermission(user: User, permission: Permission): boolean {
  // Admins have all permissions
  if (user.roles.includes("admin")) {
    return true;
  }

  // Check explicit permissions
  if (user.permissions?.includes(permission)) {
    return true;
  }

  // Check role-based permissions
  switch (permission) {
    case "create-proposal":
    case "create-node":
      return user.roles.includes("contributor") || user.roles.includes("approver");
    case "review-proposal":
    case "approve-proposal":
    case "reject-proposal":
      return user.roles.includes("approver");
    case "modify-node":
    case "delete-node":
      return user.roles.includes("contributor") || user.roles.includes("approver");
    case "manage-users":
    case "manage-roles":
      return user.roles.includes("admin");
    default:
      return false;
  }
}

/**
 * Check if a user can approve a specific node type.
 */
export function canApproveNodeType(
  user: User,
  nodeType: string,
  config: RoleConfiguration
): boolean {
  // Admins can approve anything
  if (user.roles.includes("admin")) {
    return true;
  }

  // Check if user is a general approver
  if (config.approvers.includes(user.id)) {
    return true;
  }

  // Check if user is a specific approver for this node type
  const typeApprovers = config.nodeTypeApprovers?.[nodeType];
  if (typeApprovers?.includes(user.id)) {
    return true;
  }

  return false;
}
