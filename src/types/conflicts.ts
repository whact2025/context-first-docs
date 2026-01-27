/**
 * Conflict detection and resolution types.
 */

import { NodeId } from "./node.js";

/**
 * Conflict between two proposals.
 */
export interface ProposalConflict {
  /** The conflicting proposals */
  proposals: [string, string]; // Proposal IDs
  /** Nodes that both proposals modify */
  conflictingNodes: NodeId[];
  /** Fields that conflict (if field-level detection) */
  conflictingFields?: {
    [nodeId: string]: string[]; // Node ID -> field names
  };
  /** Severity of the conflict */
  severity: "field" | "node" | "critical";
  /** Whether conflict can be auto-resolved */
  autoResolvable: boolean;
}

/**
 * Field-level change in a proposal.
 */
export interface FieldChange {
  /** Node ID being changed */
  nodeId: NodeId;
  /** Field name */
  field: string;
  /** Old value */
  oldValue: unknown;
  /** New value */
  newValue: unknown;
}

/**
 * Result of field-level merge.
 */
export interface MergeResult {
  /** Successfully merged fields */
  merged: FieldChange[];
  /** Fields that conflict and need manual resolution */
  conflicts: {
    field: string;
    nodeId: NodeId;
    proposal1Value: unknown;
    proposal2Value: unknown;
  }[];
  /** Fields that were auto-merged */
  autoMerged: FieldChange[];
}

/**
 * Conflict detection result.
 */
export interface ConflictDetectionResult {
  /** Detected conflicts */
  conflicts: ProposalConflict[];
  /** Proposals that can be safely merged */
  mergeable: string[]; // Proposal IDs
  /** Proposals that need manual resolution */
  needsResolution: string[]; // Proposal IDs
}

/**
 * Conflict resolution strategy.
 */
export type ConflictStrategy =
  | "detect-only" // Just detect, don't auto-resolve
  | "field-level-merge" // Auto-merge non-conflicting fields
  | "manual-resolution" // Always require manual resolution
  | "last-write-wins" // Most recent approval wins
  | "first-write-wins" // First approval wins
  | "priority-based" // Use proposal priority
  | "supersede" // Use explicit superseding
  | "optimistic-lock"; // Reject stale proposals

/**
 * Configuration for conflict resolution.
 */
export interface ConflictConfiguration {
  /** Default strategy */
  defaultStrategy: ConflictStrategy;
  /** Per-node-type strategies */
  nodeTypeStrategies?: {
    [nodeType: string]: ConflictStrategy;
  };
  /** Whether to auto-merge field-level conflicts */
  autoMergeFields: boolean;
  /** Whether to require manual resolution for critical conflicts */
  requireManualResolution: boolean;
  /** Whether to use optimistic locking */
  useOptimisticLocking: boolean;
}
