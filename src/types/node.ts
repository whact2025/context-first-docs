/**
 * Core node types for the context graph.
 * Every concept in the system is a typed node with identity and status.
 */

export type NodeType =
  | "goal"
  | "decision"
  | "constraint"
  | "task"
  | "risk"
  | "question"
  | "context"
  | "plan"
  | "note";

export type NodeStatus = "accepted" | "proposed" | "rejected" | "superseded";

export interface NodeId {
  /** Stable identifier for this node, survives rebases and merges */
  id: string;
  /** Optional namespace for organizing nodes */
  namespace?: string;
}

export interface TextRange {
  /** Start position in the source text */
  start: number;
  /** End position in the source text */
  end: number;
  /** Optional reference to the source file */
  source?: string;
}

export interface NodeMetadata {
  /** When this node was created */
  createdAt: string;
  /** Who created this node */
  createdBy: string;
  /** When this node was last modified */
  modifiedAt: string;
  /** Who last modified this node */
  modifiedBy: string;
  /** Tags for categorization */
  tags?: string[];
  /** Git commit hash when this node was first accepted/implemented */
  implementedInCommit?: string;
  /** Git commit hashes that reference or update this node */
  referencedInCommits?: string[];
}

/**
 * Base interface for all context nodes.
 */
export interface ContextNode {
  /** Unique identifier */
  id: NodeId;
  /** Type of node */
  type: NodeType;
  /** Current status */
  status: NodeStatus;
  /** The semantic content of this node */
  content: string;
  /** Text range in source Markdown (if applicable) */
  textRange?: TextRange;
  /** Metadata */
  metadata: NodeMetadata;
  /** Related node IDs */
  relations?: NodeId[];
}

/**
 * A goal represents an objective or desired outcome.
 */
export interface GoalNode extends ContextNode {
  type: "goal";
  /** Optional success criteria */
  criteria?: string[];
}

/**
 * A decision represents a made choice with rationale.
 */
export interface DecisionNode extends ContextNode {
  type: "decision";
  /** The decision that was made */
  decision: string;
  /** Why this decision was made */
  rationale: string;
  /** Alternatives that were considered */
  alternatives?: string[];
  /** When this decision was made */
  decidedAt?: string;
}

/**
 * A constraint represents a limitation or requirement.
 */
export interface ConstraintNode extends ContextNode {
  type: "constraint";
  /** The constraint itself */
  constraint: string;
  /** Why this constraint exists */
  reason?: string;
}

/**
 * A task represents work to be done.
 */
export interface TaskNode extends ContextNode {
  type: "task";
  /** Current state of the task */
  state: "open" | "in-progress" | "blocked" | "completed" | "cancelled";
  /** Optional assignee */
  assignee?: string;
  /** Optional due date */
  dueDate?: string;
  /** Dependencies (other task IDs) */
  dependencies?: NodeId[];
}

/**
 * A risk represents a potential problem or concern.
 */
export interface RiskNode extends ContextNode {
  type: "risk";
  /** Severity: low, medium, high, critical */
  severity: "low" | "medium" | "high" | "critical";
  /** Likelihood: unlikely, possible, likely, certain */
  likelihood: "unlikely" | "possible" | "likely" | "certain";
  /** Mitigation strategy */
  mitigation?: string;
}

/**
 * A question represents an open question that needs an answer.
 */
export interface QuestionNode extends ContextNode {
  type: "question";
  /** The question being asked */
  question: string;
  /** Optional answer (if resolved) */
  answer?: string;
  /** When answered (if resolved) */
  answeredAt?: string;
}

/**
 * A plan represents a structured approach or roadmap.
 */
export interface PlanNode extends ContextNode {
  type: "plan";
  /** Steps or phases in the plan */
  steps?: PlanStep[];
}

export interface PlanStep {
  /** Description of the step */
  description: string;
  /** Related task or goal IDs */
  references?: NodeId[];
  /** Order/sequence */
  order: number;
}

/**
 * Union type of all node types.
 */
export type AnyNode =
  | GoalNode
  | DecisionNode
  | ConstraintNode
  | TaskNode
  | RiskNode
  | QuestionNode
  | ContextNode
  | PlanNode;
