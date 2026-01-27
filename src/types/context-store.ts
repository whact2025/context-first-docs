/**
 * Canonical context store interface.
 * The system stores meaning, not blobs of text.
 */

import { AnyNode, NodeId, NodeType, NodeStatus, RelationshipType } from "./node.js";
import { Proposal, Review } from "./proposal.js";
import { IssueCreationResult } from "./issues.js";
import { ConflictDetectionResult, MergeResult } from "./conflicts.js";

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
   * Returns query result with pagination metadata.
   */
  queryNodes(query: NodeQuery): Promise<NodeQueryResult>;

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
   * Create issues from an approved proposal.
   * Called automatically when a proposal is approved (if configured).
   */
  createIssuesFromProposal(proposalId: string, reviewId: string): Promise<IssueCreationResult>;

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

  /**
   * Get nodes that reference a given node.
   */
  getReferencingNodes(nodeId: NodeId): Promise<AnyNode[]>;

  /**
   * Update referencing nodes when a node changes.
   */
  updateReferencingNodes(nodeId: NodeId): Promise<void>;

  /**
   * Detect conflicts between proposals.
   */
  detectConflicts(proposalId: string): Promise<ConflictDetectionResult>;

  /**
   * Check if a proposal is stale (node versions have changed).
   */
  isProposalStale(proposalId: string): Promise<boolean>;

  /**
   * Merge field-level changes from multiple proposals.
   */
  mergeProposals(proposalIds: string[]): Promise<MergeResult>;
}

/**
 * Query for nodes with comprehensive filtering and search capabilities.
 * See docs/AGENT_API.md for detailed usage examples.
 */
export interface NodeQuery {
  // Type filtering
  /** Filter by node types */
  type?: NodeType[];
  
  // Status filtering (default: ["accepted"] for safety)
  /** Filter by status. Default: ["accepted"] - agents should explicitly opt-in for proposals */
  status?: NodeStatus[];
  
  // Keyword/Full-text search
  /** Simple string search or advanced search options */
  search?: string | SearchOptions;
  
  // Tag filtering
  /** Filter by tags (must have all specified tags) */
  tags?: string[];
  
  // Namespace filtering
  /** Filter by namespace */
  namespace?: string;
  
  // Creator filtering
  /** Filter by creator */
  createdBy?: string;
  /** Filter by last modifier */
  modifiedBy?: string;
  
  // Date range filtering
  /** Filter by creation date (ISO date string) */
  createdAfter?: string;
  /** Filter by creation date (ISO date string) */
  createdBefore?: string;
  /** Filter by modification date (ISO date string) */
  modifiedAfter?: string;
  /** Filter by modification date (ISO date string) */
  modifiedBefore?: string;
  
  // Relationship filtering
  /** Find nodes related to this node */
  relatedTo?: NodeId;
  /** Filter by relationship types */
  relationshipTypes?: RelationshipType[];
  /** Traversal depth (default: 1) */
  depth?: number;
  /** Traversal direction */
  direction?: "outgoing" | "incoming" | "both";
  
  // Hierarchical queries
  /** Find all descendants of this node */
  descendantsOf?: NodeId;
  /** Find all ancestors of this node */
  ancestorsOf?: NodeId;
  /** Relationship type for hierarchical queries */
  relationshipType?: RelationshipType;
  
  // Dependency queries
  /** Find all dependencies of this node */
  dependenciesOf?: NodeId;
  /** Find all dependents of this node */
  dependentsOf?: NodeId;
  
  // Relationship existence
  /** Filter by relationship existence */
  hasRelationship?: {
    /** Must have this relationship type */
    type?: RelationshipType;
    /** Target must be one of these types */
    targetType?: NodeType[];
    /** Relationship direction */
    direction?: "outgoing" | "incoming" | "both";
  };
  
  // Sorting
  /** Sort field */
  sortBy?: "createdAt" | "modifiedAt" | "type" | "status" | "relevance";
  /** Sort order */
  sortOrder?: "asc" | "desc";
  
  // Pagination
  /** Limit results (default: 50, max: 1000) */
  limit?: number;
  /** Offset for pagination (default: 0) */
  offset?: number;
}

/**
 * Advanced search options for full-text search.
 */
export interface SearchOptions {
  /** Search query string */
  query: string;
  /** Fields to search (default: all text fields) */
  fields?: string[];
  /** Search operator (default: "AND") */
  operator?: "AND" | "OR";
  /** Enable fuzzy matching (default: false) */
  fuzzy?: boolean;
  /** Case-sensitive search (default: false) */
  caseSensitive?: boolean;
}

/**
 * Result of a node query.
 */
export interface NodeQueryResult {
  /** Matching nodes */
  nodes: AnyNode[];
  /** Total count (before pagination) */
  total: number;
  /** Applied limit */
  limit: number;
  /** Applied offset */
  offset: number;
  /** Whether more results exist */
  hasMore: boolean;
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
