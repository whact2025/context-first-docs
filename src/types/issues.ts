/**
 * Issue system for creating issues from approved proposals.
 */

import { NodeId, TaskNode } from "./node.js";

/**
 * Issue template defines what issues should be created when a proposal is approved.
 */
export interface IssueTemplate {
  /** Unique identifier for this template */
  id: string;
  /** Description of the issue to create */
  description: string;
  /** Type of issue (task, follow-up, implementation, etc.) */
  type: "task" | "follow-up" | "implementation" | "review" | "custom";
  /** Optional assignee (can be overridden) */
  assignee?: string;
  /** Optional due date or deadline calculation */
  dueDate?: string | {
    /** Days from approval */
    days: number;
  };
  /** Dependencies (other issue IDs or node IDs) */
  dependencies?: (string | NodeId)[];
  /** Conditions for when this issue should be created */
  conditions?: {
    /** Node types that trigger this issue */
    nodeTypes?: string[];
    /** Proposal types that trigger this issue */
    proposalTypes?: string[];
    /** Required proposal metadata fields */
    requiresFields?: string[];
  };
  /** Priority of the issue */
  priority?: "low" | "medium" | "high" | "critical";
  /** Tags for categorization */
  tags?: string[];
}

/**
 * An issue created from an approved proposal.
 */
export interface Issue {
  /** Unique identifier */
  id: string;
  /** The proposal that triggered this issue */
  proposalId: string;
  /** The review/approval that triggered this issue */
  reviewId: string;
  /** Issue template used (if any) */
  templateId?: string;
  /** Description of the issue */
  description: string;
  /** Type of issue */
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
  /** When this issue was created */
  createdAt: string;
  /** Who created this issue (usually system) */
  createdBy: string;
  /** Optional: link to created task node */
  taskNodeId?: NodeId;
}

/**
 * Issue creation configuration for a proposal.
 */
export interface IssueConfiguration {
  /** Issue templates to use when proposal is approved */
  templates?: IssueTemplate[];
  /** Custom issues to create (if templates aren't sufficient) */
  customIssues?: Omit<Issue, "id" | "proposalId" | "reviewId" | "createdAt" | "createdBy">[];
  /** Whether to auto-create issues on approval */
  autoCreate?: boolean;
  /** Whether issues should be created as task nodes in context store */
  createAsTaskNodes?: boolean;
}

/**
 * Result of creating issues from an approved proposal.
 */
export interface IssueCreationResult {
  /** Issues that were created */
  issues: Issue[];
  /** Task nodes created (if createAsTaskNodes is true) */
  taskNodes?: TaskNode[];
  /** Any errors during creation */
  errors?: string[];
}
