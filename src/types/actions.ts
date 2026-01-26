/**
 * Action system for creating actionable items from approved proposals.
 */

import { NodeId, TaskNode } from "./node.js";

/**
 * Action template defines what actions should be created when a proposal is approved.
 */
export interface ActionTemplate {
  /** Unique identifier for this template */
  id: string;
  /** Description of the action to create */
  description: string;
  /** Type of action (task, follow-up, implementation, etc.) */
  type: "task" | "follow-up" | "implementation" | "review" | "custom";
  /** Optional assignee (can be overridden) */
  assignee?: string;
  /** Optional due date or deadline calculation */
  dueDate?: string | {
    /** Days from approval */
    days: number;
  };
  /** Dependencies (other action IDs or node IDs) */
  dependencies?: (string | NodeId)[];
  /** Conditions for when this action should be created */
  conditions?: {
    /** Node types that trigger this action */
    nodeTypes?: string[];
    /** Proposal types that trigger this action */
    proposalTypes?: string[];
    /** Required proposal metadata fields */
    requiresFields?: string[];
  };
  /** Priority of the action */
  priority?: "low" | "medium" | "high" | "critical";
  /** Tags for categorization */
  tags?: string[];
}

/**
 * An action created from an approved proposal.
 */
export interface Action {
  /** Unique identifier */
  id: string;
  /** The proposal that triggered this action */
  proposalId: string;
  /** The review/approval that triggered this action */
  reviewId: string;
  /** Action template used (if any) */
  templateId?: string;
  /** Description of the action */
  description: string;
  /** Type of action */
  type: "task" | "follow-up" | "implementation" | "review" | "custom";
  /** Current state */
  state: "open" | "in-progress" | "blocked" | "completed" | "cancelled";
  /** Assignee */
  assignee?: string;
  /** Due date */
  dueDate?: string;
  /** Priority */
  priority?: "low" | "medium" | "high" | "critical";
  /** Dependencies */
  dependencies?: (string | NodeId)[];
  /** Related node IDs */
  relatedNodes?: NodeId[];
  /** Tags */
  tags?: string[];
  /** When this action was created */
  createdAt: string;
  /** Who created this action (usually system) */
  createdBy: string;
  /** Optional: link to created task node */
  taskNodeId?: NodeId;
}

/**
 * Action creation configuration for a proposal.
 */
export interface ActionConfiguration {
  /** Action templates to use when proposal is approved */
  templates?: ActionTemplate[];
  /** Custom actions to create (if templates aren't sufficient) */
  customActions?: Omit<Action, "id" | "proposalId" | "reviewId" | "createdAt" | "createdBy">[];
  /** Whether to auto-create actions on approval */
  autoCreate?: boolean;
  /** Whether actions should be created as task nodes in context store */
  createAsTaskNodes?: boolean;
}

/**
 * Result of creating actions from an approved proposal.
 */
export interface ActionCreationResult {
  /** Actions that were created */
  actions: Action[];
  /** Task nodes created (if createAsTaskNodes is true) */
  taskNodes?: TaskNode[];
  /** Any errors during creation */
  errors?: string[];
}
