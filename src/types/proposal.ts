/**
 * Proposal system for tracked changes.
 * Changes are represented as proposals, not diffs.
 * Accepting or rejecting a change is a first-class decision.
 */

import { NodeId, AnyNode, NodeStatus } from "./node.js";

export type ProposalStatus = "open" | "accepted" | "rejected" | "withdrawn";

export type OperationType = "insert" | "delete" | "update" | "move" | "create" | "status-change";

export interface ProposalMetadata {
  /** When this proposal was created */
  createdAt: string;
  /** Who created this proposal */
  createdBy: string;
  /** When this proposal was last modified */
  modifiedAt: string;
  /** Who last modified this proposal */
  modifiedBy: string;
  /** Optional description of why this change is proposed */
  rationale?: string;
}

/**
 * Base interface for all operations in a proposal.
 */
export interface Operation {
  /** Unique identifier for this operation */
  id: string;
  /** Type of operation */
  type: OperationType;
  /** Order of operations (for applying changes) */
  order: number;
}

/**
 * Create a new node.
 */
export interface CreateOperation extends Operation {
  type: "create";
  /** The node to create */
  node: AnyNode;
}

/**
 * Update an existing node.
 */
export interface UpdateOperation extends Operation {
  type: "update";
  /** ID of the node to update */
  nodeId: NodeId;
  /** Field-level changes */
  changes: {
    content?: string;
    status?: NodeStatus;
    [key: string]: unknown;
  };
}

/**
 * Delete a node (mark as deleted, preserve for provenance).
 */
export interface DeleteOperation extends Operation {
  type: "delete";
  /** ID of the node to delete */
  nodeId: NodeId;
  /** Reason for deletion */
  reason?: string;
}

/**
 * Change the status of a node.
 */
export interface StatusChangeOperation extends Operation {
  type: "status-change";
  /** ID of the node */
  nodeId: NodeId;
  /** New status */
  newStatus: NodeStatus;
  /** Previous status */
  oldStatus: NodeStatus;
  /** Reason for status change */
  reason?: string;
}

/**
 * Insert text at a specific position.
 */
export interface InsertOperation extends Operation {
  type: "insert";
  /** Position to insert at */
  position: number;
  /** Text to insert */
  text: string;
  /** Optional reference to source node */
  sourceNodeId?: NodeId;
}

/**
 * Delete text at a specific range.
 */
export interface DeleteTextOperation extends Operation {
  type: "delete";
  /** Start position */
  start: number;
  /** End position */
  end: number;
  /** Optional reference to source node */
  sourceNodeId?: NodeId;
}

/**
 * Move a node (change its position or parent).
 */
export interface MoveOperation extends Operation {
  type: "move";
  /** ID of the node to move */
  nodeId: NodeId;
  /** New position or parent */
  target: {
    position?: number;
    parentId?: NodeId;
  };
}

/**
 * Union type of all operations.
 */
export type AnyOperation =
  | CreateOperation
  | UpdateOperation
  | DeleteOperation
  | StatusChangeOperation
  | InsertOperation
  | DeleteTextOperation
  | MoveOperation;

/**
 * A proposal contains one or more operations that represent a change.
 */
export interface Proposal {
  /** Unique identifier for this proposal */
  id: string;
  /** Current status */
  status: ProposalStatus;
  /** Operations in this proposal */
  operations: AnyOperation[];
  /** Metadata */
  metadata: ProposalMetadata;
  /** Optional comments attached to this proposal */
  comments?: Comment[];
  /** Related proposal IDs (e.g., supersedes, conflicts with) */
  relations?: string[];
}

/**
 * A comment attached to a proposal or a specific operation.
 */
export interface Comment {
  /** Unique identifier */
  id: string;
  /** The comment text */
  content: string;
  /** Who made the comment */
  author: string;
  /** When the comment was made */
  createdAt: string;
  /** Optional reference to a specific operation */
  operationId?: string;
  /** Optional text range this comment refers to */
  textRange?: {
    start: number;
    end: number;
  };
  /** Replies to this comment */
  replies?: Comment[];
}

/**
 * Review action on a proposal.
 */
export interface Review {
  /** Unique identifier */
  id: string;
  /** The proposal being reviewed */
  proposalId: string;
  /** Who reviewed */
  reviewer: string;
  /** When reviewed */
  reviewedAt: string;
  /** Action taken */
  action: "accept" | "reject" | "request-changes";
  /** Optional comment */
  comment?: string;
  /** Which operations were accepted/rejected (if partial) */
  operationIds?: string[];
}
