/**
 * Canonical context store interface.
 * The system stores meaning, not blobs of text.
 */

import { AnyNode, NodeId } from "./node.js";
import { Proposal, Review } from "./proposal.js";

/**
 * The context store is the source of truth.
 * It maintains:
 * - All accepted nodes (truth)
 * - All open proposals (pending changes)
 * - All rejected proposals (provenance)
 * - Review history
 */
export interface ContextStore {
  /**
   * Get a node by ID.
   */
  getNode(nodeId: NodeId): Promise<AnyNode | null>;

  /**
   * Get all nodes matching a query.
   */
  queryNodes(query: NodeQuery): Promise<AnyNode[]>;

  /**
   * Get a proposal by ID.
   */
  getProposal(proposalId: string): Promise<Proposal | null>;

  /**
   * Get all proposals matching a query.
   */
  queryProposals(query: ProposalQuery): Promise<Proposal[]>;

  /**
   * Create a new proposal.
   */
  createProposal(proposal: Proposal): Promise<void>;

  /**
   * Update a proposal.
   */
  updateProposal(proposalId: string, updates: Partial<Proposal>): Promise<void>;

  /**
   * Submit a review for a proposal.
   */
  submitReview(review: Review): Promise<void>;

  /**
   * Apply an accepted proposal (make it truth).
   */
  applyProposal(proposalId: string): Promise<void>;

  /**
   * Create actions from an approved proposal.
   * Called automatically when a proposal is approved (if configured).
   */
  createActionsFromProposal(proposalId: string, reviewId: string): Promise<ActionCreationResult>;

  /**
   * Get review history for a proposal.
   */
  getReviewHistory(proposalId: string): Promise<Review[]>;

  /**
   * Get all accepted nodes (truth).
   */
  getAcceptedNodes(): Promise<AnyNode[]>;

  /**
   * Get all open proposals (pending changes).
   */
  getOpenProposals(): Promise<Proposal[]>;

  /**
   * Get all rejected proposals (for provenance).
   */
  getRejectedProposals(): Promise<Proposal[]>;
}

/**
 * Query for nodes.
 */
export interface NodeQuery {
  /** Filter by node type */
  type?: string[];
  /** Filter by status */
  status?: string[];
  /** Filter by tags */
  tags?: string[];
  /** Filter by creator */
  createdBy?: string;
  /** Filter by namespace */
  namespace?: string;
  /** Text search in content */
  search?: string;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Query for proposals.
 */
export interface ProposalQuery {
  /** Filter by status */
  status?: string[];
  /** Filter by creator */
  createdBy?: string;
  /** Filter by node ID (proposals affecting a specific node) */
  nodeId?: NodeId;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}
