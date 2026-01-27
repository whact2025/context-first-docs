/**
 * In-memory implementation of the context store.
 * Useful for testing and development.
 */

import {
  ContextStore,
  AnyNode,
  NodeId,
  NodeRelationship,
  NodeQuery,
  NodeQueryResult,
  ProposalQuery,
  RelationshipType,
  NodeType,
  ReasoningChainOptions,
  ReasoningChainResult,
  ReasoningStep,
  ContextChainOptions,
  ContextChainResult,
  DecisionReasoningOptions,
  DecisionReasoningResult,
  RelatedReasoningOptions,
  RelatedReasoningResult,
  ReasoningQueryOptions,
  ReasoningQueryResult,
} from "../types/index.js";
import { Proposal, Review } from "../types/proposal.js";
import {
  ConflictDetectionResult,
  MergeResult,
  ProposalConflict,
} from "../types/conflicts.js";
import { IssueCreationResult } from "../types/issues.js";

export class InMemoryStore implements ContextStore {
  private nodes: Map<string, AnyNode> = new Map();
  private proposals: Map<string, Proposal> = new Map();
  private reviews: Map<string, Review[]> = new Map();

  private nodeKey(nodeId: NodeId): string {
    return nodeId.namespace ? `${nodeId.namespace}:${nodeId.id}` : nodeId.id;
  }

  private getNodeByKey(key: string): AnyNode | null {
    return this.nodes.get(key) || null;
  }

  async getNode(nodeId: NodeId): Promise<AnyNode | null> {
    const key = this.nodeKey(nodeId);
    return this.nodes.get(key) || null;
  }

  async queryNodes(query: NodeQuery): Promise<NodeQueryResult> {
    let results = Array.from(this.nodes.values());

    // Default to accepted nodes only (for agent safety)
    const statusFilter = query.status || ["accepted"];

    // Type filtering
    if (query.type && query.type.length > 0) {
      results = results.filter((node) => query.type!.includes(node.type));
    }

    // Status filtering
    if (statusFilter.length > 0) {
      results = results.filter((node) => statusFilter.includes(node.status));
    }

    // Tag filtering
    if (query.tags && query.tags.length > 0) {
      results = results.filter(
        (node) =>
          node.metadata.tags &&
          query.tags!.every((tag) => node.metadata.tags!.includes(tag))
      );
    }

    // Creator filtering
    if (query.createdBy) {
      results = results.filter(
        (node) => node.metadata.createdBy === query.createdBy
      );
    }

    // Modifier filtering
    if (query.modifiedBy) {
      results = results.filter(
        (node) => node.metadata.modifiedBy === query.modifiedBy
      );
    }

    // Namespace filtering
    if (query.namespace) {
      results = results.filter(
        (node) => node.id.namespace === query.namespace
      );
    }

    // Date range filtering
    if (query.createdAfter) {
      const afterDate = new Date(query.createdAfter);
      results = results.filter(
        (node) => new Date(node.metadata.createdAt) >= afterDate
      );
    }

    if (query.createdBefore) {
      const beforeDate = new Date(query.createdBefore);
      results = results.filter(
        (node) => new Date(node.metadata.createdAt) <= beforeDate
      );
    }

    if (query.modifiedAfter) {
      const afterDate = new Date(query.modifiedAfter);
      results = results.filter(
        (node) => new Date(node.metadata.modifiedAt) >= afterDate
      );
    }

    if (query.modifiedBefore) {
      const beforeDate = new Date(query.modifiedBefore);
      results = results.filter(
        (node) => new Date(node.metadata.modifiedAt) <= beforeDate
      );
    }

    // Search filtering
    if (query.search) {
      if (typeof query.search === "string") {
        const searchLower = query.search.toLowerCase();
        results = results.filter(
          (node) =>
            node.content.toLowerCase().includes(searchLower) ||
            (node.type === "decision" &&
              "decision" in node &&
              (node as any).decision?.toLowerCase().includes(searchLower))
        );
      } else {
        // Advanced search options
        const searchOpts = query.search;
        const searchLower = searchOpts.query.toLowerCase();
        const caseSensitive = searchOpts.caseSensitive || false;
        const searchText = caseSensitive ? searchOpts.query : searchLower;

        results = results.filter((node) => {
          const content = caseSensitive ? node.content : node.content.toLowerCase();
          return content.includes(searchText);
        });
      }
    }

    // Relationship filtering
    if (query.relatedTo) {
      const targetKey = this.nodeKey(query.relatedTo);
      results = results.filter((node) =>
        node.relationships?.some(
          (rel) => this.nodeKey(rel.target) === targetKey
        )
      );
    }

    // Hierarchical queries
    if (query.descendantsOf) {
      const descendants = this.getDescendants(query.descendantsOf, query.relationshipType || "parent-child");
      const descendantKeys = new Set(descendants.map((n) => this.nodeKey(n.id)));
      results = results.filter((node) => descendantKeys.has(this.nodeKey(node.id)));
    }

    if (query.ancestorsOf) {
      const ancestors = this.getAncestors(query.ancestorsOf, query.relationshipType || "parent-child");
      const ancestorKeys = new Set(ancestors.map((n) => this.nodeKey(n.id)));
      results = results.filter((node) => ancestorKeys.has(this.nodeKey(node.id)));
    }

    // Dependency queries
    if (query.dependenciesOf) {
      const dependencies = this.getDependencies(query.dependenciesOf);
      const depKeys = new Set(dependencies.map((n) => this.nodeKey(n.id)));
      results = results.filter((node) => depKeys.has(this.nodeKey(node.id)));
    }

    if (query.dependentsOf) {
      const dependents = this.getDependents(query.dependentsOf);
      const depKeys = new Set(dependents.map((n) => this.nodeKey(n.id)));
      results = results.filter((node) => depKeys.has(this.nodeKey(node.id)));
    }

    // Relationship existence filtering
    if (query.hasRelationship) {
      const relFilter = query.hasRelationship;
      results = results.filter((node) => {
        if (!node.relationships || node.relationships.length === 0) {
          return false;
        }
        return node.relationships.some((rel) => {
          if (relFilter.type && rel.type !== relFilter.type) {
            return false;
          }
          if (relFilter.targetType) {
            const targetNode = this.getNodeByKey(this.nodeKey(rel.target));
            if (!targetNode || !relFilter.targetType.includes(targetNode.type)) {
              return false;
            }
          }
          return true;
        });
      });
    }

    // Sorting
    const sortBy = query.sortBy || "createdAt";
    const sortOrder = query.sortOrder || "desc";
    results.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "createdAt":
          comparison =
            new Date(a.metadata.createdAt).getTime() -
            new Date(b.metadata.createdAt).getTime();
          break;
        case "modifiedAt":
          comparison =
            new Date(a.metadata.modifiedAt).getTime() -
            new Date(b.metadata.modifiedAt).getTime();
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    // Pagination
    const total = results.length;
    const offset = query.offset || 0;
    const limit = Math.min(query.limit || 50, 1000); // Max 1000
    const paginatedResults = results.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      nodes: paginatedResults,
      total,
      limit,
      offset,
      hasMore,
    };
  }

  async getProposal(proposalId: string): Promise<Proposal | null> {
    return this.proposals.get(proposalId) || null;
  }

  async queryProposals(query: ProposalQuery): Promise<Proposal[]> {
    let results = Array.from(this.proposals.values());

    if (query.status && query.status.length > 0) {
      results = results.filter((proposal) =>
        query.status!.includes(proposal.status)
      );
    }

    if (query.createdBy) {
      results = results.filter(
        (proposal) => proposal.metadata.createdBy === query.createdBy
      );
    }

    if (query.nodeId) {
      const nodeKey = this.nodeKey(query.nodeId);
      results = results.filter((proposal) =>
        proposal.operations.some((op) => {
          if (op.type === "create" && "node" in op) {
            return this.nodeKey(op.node.id) === nodeKey;
          }
          if (
            (op.type === "update" || op.type === "status-change") &&
            "nodeId" in op
          ) {
            return this.nodeKey(op.nodeId) === nodeKey;
          }
          if (op.type === "delete" && "nodeId" in op) {
            return this.nodeKey(op.nodeId) === nodeKey;
          }
          return false;
        })
      );
    }

    const offset = query.offset || 0;
    const limit = query.limit || results.length;
    results = results.slice(offset, offset + limit);

    return results;
  }

  async createProposal(proposal: Proposal): Promise<void> {
    this.proposals.set(proposal.id, proposal);
  }

  async updateProposal(
    proposalId: string,
    updates: Partial<Proposal>
  ): Promise<void> {
    const existing = this.proposals.get(proposalId);
    if (!existing) {
      throw new Error(`Proposal ${proposalId} not found`);
    }
    this.proposals.set(proposalId, { ...existing, ...updates });
  }

  async submitReview(review: Review): Promise<void> {
    const proposal = await this.getProposal(review.proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${review.proposalId} not found`);
    }

    // Update proposal status based on review
    if (review.action === "accept") {
      await this.updateProposal(review.proposalId, { status: "accepted" });
    } else if (review.action === "reject") {
      await this.updateProposal(review.proposalId, { status: "rejected" });
    }

    // Store review
    const reviews = this.reviews.get(review.proposalId) || [];
    reviews.push(review);
    this.reviews.set(review.proposalId, reviews);
  }

  async applyProposal(proposalId: string): Promise<void> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== "accepted") {
      throw new Error(`Cannot apply proposal ${proposalId}: not accepted`);
    }

    // Apply operations in order
    for (const operation of proposal.operations.sort((a, b) => a.order - b.order)) {
      if (operation.type === "create" && "node" in operation) {
        const key = this.nodeKey(operation.node.id);
        this.nodes.set(key, operation.node);
      } else if (operation.type === "update" && "nodeId" in operation) {
        const key = this.nodeKey(operation.nodeId);
        const existing = this.nodes.get(key);
        if (!existing) {
          throw new Error(`Node ${key} not found for update`);
        }
        const next = {
          ...existing,
          ...operation.changes,
          metadata: {
            ...existing.metadata,
            // Ensure we always track mutations for stale-detection/provenance
            modifiedAt: proposal.metadata.modifiedAt,
            modifiedBy: proposal.metadata.modifiedBy,
            version: (existing.metadata.version ?? 0) + 1,
          },
        } as AnyNode;
        this.nodes.set(key, next);
      } else if (operation.type === "delete" && "nodeId" in operation) {
        const key = this.nodeKey(operation.nodeId);
        const existing = this.nodes.get(key);
        if (existing) {
          // Mark as deleted, don't remove (for provenance)
          this.nodes.set(key, {
            ...existing,
            status: "rejected",
            metadata: {
              ...existing.metadata,
              modifiedAt: proposal.metadata.modifiedAt,
              modifiedBy: proposal.metadata.modifiedBy,
              version: (existing.metadata.version ?? 0) + 1,
            },
          } as AnyNode);
        }
      } else if (operation.type === "status-change" && "nodeId" in operation) {
        const key = this.nodeKey(operation.nodeId);
        const existing = this.nodes.get(key);
        if (!existing) {
          throw new Error(`Node ${key} not found for status change`);
        }
        this.nodes.set(key, {
          ...existing,
          status: operation.newStatus,
          metadata: {
            ...existing.metadata,
            modifiedAt: proposal.metadata.modifiedAt,
            modifiedBy: proposal.metadata.modifiedBy,
            version: (existing.metadata.version ?? 0) + 1,
          },
        } as AnyNode);
      }
    }
  }

  async getReviewHistory(proposalId: string): Promise<Review[]> {
    return this.reviews.get(proposalId) || [];
  }

  async getAcceptedNodes(): Promise<AnyNode[]> {
    const result = await this.queryNodes({ status: ["accepted"] });
    return result.nodes;
  }

  async getOpenProposals(): Promise<Proposal[]> {
    return this.queryProposals({ status: ["open"] });
  }

  async getRejectedProposals(): Promise<Proposal[]> {
    return this.queryProposals({ status: ["rejected"] });
  }

  async getReferencingNodes(nodeId: NodeId): Promise<AnyNode[]> {
    const targetKey = this.nodeKey(nodeId);
    const referencing: AnyNode[] = [];

    for (const node of this.nodes.values()) {
      if (
        node.relationships?.some(
          (rel) => this.nodeKey(rel.target) === targetKey
        )
      ) {
        referencing.push(node);
      }
    }

    return referencing;
  }

  async updateReferencingNodes(nodeId: NodeId): Promise<void> {
    // In-memory store: references are automatically up-to-date
    // This is a no-op for in-memory, but needed for file-based/MongoDB
    // where we might need to update reference metadata
  }

  async detectConflicts(proposalId: string): Promise<ConflictDetectionResult> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) {
      return {
        conflicts: [],
        mergeable: [],
        needsResolution: [],
      };
    }

    const conflicts: ProposalConflict[] = [];
    const mergeable: string[] = [];
    const needsResolution: string[] = [];

    // Find all open proposals
    const openProposals = await this.getOpenProposals();

    // Check for conflicts with other open proposals
    for (const otherProposal of openProposals) {
      if (otherProposal.id === proposalId) {
        continue;
      }

      const conflictingNodes: NodeId[] = [];

      // Check if proposals modify the same nodes
      for (const op1 of proposal.operations) {
        for (const op2 of otherProposal.operations) {
          let nodeId1: NodeId | null = null;
          let nodeId2: NodeId | null = null;

          if (op1.type === "create" && "node" in op1) {
            nodeId1 = op1.node.id;
          } else if ("nodeId" in op1) {
            nodeId1 = op1.nodeId;
          }

          if (op2.type === "create" && "node" in op2) {
            nodeId2 = op2.node.id;
          } else if ("nodeId" in op2) {
            nodeId2 = op2.nodeId;
          }

          if (
            nodeId1 &&
            nodeId2 &&
            this.nodeKey(nodeId1) === this.nodeKey(nodeId2)
          ) {
            if (
              !conflictingNodes.some(
                (n) => this.nodeKey(n) === this.nodeKey(nodeId1!)
              )
            ) {
              conflictingNodes.push(nodeId1);
            }
          }
        }
      }

      if (conflictingNodes.length > 0) {
        conflicts.push({
          proposals: [proposalId, otherProposal.id],
          conflictingNodes,
          conflictingFields: {},
          severity: "node",
          autoResolvable: false,
        });
        needsResolution.push(otherProposal.id);
      } else {
        mergeable.push(otherProposal.id);
      }
    }

    return {
      conflicts,
      mergeable,
      needsResolution,
    };
  }

  async isProposalStale(proposalId: string): Promise<boolean> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) {
      return true;
    }

    // Check if any nodes referenced in the proposal have been updated
    for (const operation of proposal.operations) {
      let nodeId: NodeId | null = null;

      if (operation.type === "create" && "node" in operation) {
        nodeId = operation.node.id;
      } else if ("nodeId" in operation) {
        nodeId = operation.nodeId;
      }

      if (nodeId) {
        const node = await this.getNode(nodeId);
        if (node) {
          // Check if node version has changed since proposal was created
          const proposalCreatedAt = new Date(proposal.metadata.createdAt);
          const nodeModifiedAt = new Date(node.metadata.modifiedAt);

          if (nodeModifiedAt > proposalCreatedAt) {
            return true; // Node was modified after proposal was created
          }
        }
      }
    }

    return false;
  }

  async mergeProposals(proposalIds: string[]): Promise<MergeResult> {
    const proposals = await Promise.all(
      proposalIds.map((id) => this.getProposal(id))
    );

    const validProposals = proposals.filter(
      (p): p is Proposal => p !== null
    );

    if (validProposals.length === 0) {
      return {
        merged: [],
        conflicts: [],
        autoMerged: [],
      };
    }

    const merged: Array<{
      nodeId: NodeId;
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }> = [];
    const conflicts: Array<{
      field: string;
      nodeId: NodeId;
      proposal1Value: unknown;
      proposal2Value: unknown;
    }> = [];
    const autoMerged: Array<{
      nodeId: NodeId;
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }> = [];

    // Simple merge: combine all operations, detect conflicts
    // This is a basic implementation - full field-level merging would be more complex
    const nodeChanges = new Map<
      string,
      Map<string, { proposalId: string; value: unknown }>
    >();

    for (const proposal of validProposals) {
      for (const operation of proposal.operations) {
        if (operation.type === "update" && "nodeId" in operation) {
          const nodeKey = this.nodeKey(operation.nodeId);
          const changes = operation.changes as Record<string, unknown>;

          if (!nodeChanges.has(nodeKey)) {
            nodeChanges.set(nodeKey, new Map());
          }

          const fieldMap = nodeChanges.get(nodeKey)!;

          for (const [field, value] of Object.entries(changes)) {
            if (fieldMap.has(field)) {
              // Conflict detected
              const existing = fieldMap.get(field)!;
              conflicts.push({
                field,
                nodeId: operation.nodeId,
                proposal1Value: existing.value,
                proposal2Value: value,
              });
            } else {
              // No conflict, can merge
              fieldMap.set(field, { proposalId: proposal.id, value });
              autoMerged.push({
                nodeId: operation.nodeId,
                field,
                oldValue: undefined,
                newValue: value,
              });
            }
          }
        }
      }
    }

    return {
      merged,
      conflicts,
      autoMerged,
    };
  }

  async createIssuesFromProposal(
    proposalId: string,
    reviewId: string
  ): Promise<IssueCreationResult> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) {
      return {
        issues: [],
        errors: [`Proposal ${proposalId} not found`],
      };
    }

    // Basic implementation: create task nodes for create operations
    const issues: Array<{
      id: string;
      proposalId: string;
      reviewId: string;
      description: string;
      type: "task" | "follow-up" | "implementation" | "review" | "custom";
      state: "open" | "in-progress" | "blocked" | "completed" | "cancelled";
      createdAt: string;
      createdBy: string;
    }> = [];

    for (const operation of proposal.operations) {
      if (operation.type === "create" && "node" in operation) {
        const node = operation.node;
        if (node.type === "task") {
          issues.push({
            id: `issue-${proposalId}-${operation.order}`,
            proposalId,
            reviewId,
            description: `Implement: ${node.content}`,
            type: "implementation",
            state: "open",
            createdAt: new Date().toISOString(),
            createdBy: proposal.metadata.createdBy,
          });
        }
      }
    }

    return {
      issues,
    };
  }

  async traverseReasoningChain(
    startNode: NodeId,
    options: ReasoningChainOptions
  ): Promise<ReasoningChainResult> {
    const start = await this.getNode(startNode);
    if (!start) {
      return {
        nodes: [],
        path: [],
      };
    }

    const visited = new Set<string>();
    const nodes: AnyNode[] = [start];
    const path: Array<{
      from: NodeId;
      to: NodeId;
      relationship: RelationshipType;
    }> = [];
    const reasoningSteps: ReasoningStep[] = [];
    const accumulatedContext: { [key: string]: AnyNode[] } = {};

    let current: AnyNode | null = start;
    let stepNumber = 1;
    const maxDepth = options.maxDepth || 10;

    // If only one relationship step is provided, follow it repeatedly up to maxDepth.
    const repeatSingleStep = options.path.length === 1;
    let sequenceIndex = 0;

    while (current && stepNumber <= maxDepth) {
      if (!repeatSingleStep && sequenceIndex >= options.path.length) {
        break;
      }

      const pathStep = options.path[repeatSingleStep ? 0 : sequenceIndex];

      const currentKey = this.nodeKey(current.id);
      if (visited.has(currentKey)) {
        break; // Cycle detected
      }
      visited.add(currentKey);

      // Prefer outgoing edges, but if none exist, fall back to incoming edges
      // (useful for relationships like "implements" where traversal often starts
      // from the target and finds implementations).
      const outgoing: NodeRelationship[] = (current.relationships || []).filter(
        (rel: NodeRelationship) => rel.type === pathStep.relationshipType
      );

      const outgoingCandidates: Array<{ next: AnyNode; relationship: RelationshipType }> =
        outgoing
        .map((rel) => ({
          next: this.getNodeByKey(this.nodeKey(rel.target)),
          relationship: rel.type,
        }))
        .filter(
          (
            c
          ): c is { next: AnyNode; relationship: RelationshipType } =>
            Boolean(c.next)
        );

      const incomingCandidates: Array<{ next: AnyNode; relationship: RelationshipType }> = [];
      if (outgoingCandidates.length === 0) {
        for (const node of this.nodes.values()) {
          for (const rel of node.relationships || []) {
            if (
              rel.type === pathStep.relationshipType &&
              this.nodeKey(rel.target) === this.nodeKey(current.id)
            ) {
              incomingCandidates.push({ next: node, relationship: rel.type });
            }
          }
        }
      }

      let candidates: Array<{ next: AnyNode; relationship: RelationshipType }> =
        outgoingCandidates.length > 0 ? outgoingCandidates : incomingCandidates;

      // Avoid revisiting nodes (cycle prevention / determinism)
      candidates = candidates.filter(
        (c) => !visited.has(this.nodeKey(c.next.id))
      );

      // Filter by target type if specified
      if (pathStep.targetType && pathStep.targetType.length > 0) {
        candidates = candidates.filter((c) =>
          pathStep.targetType!.includes(c.next.type)
        );
      }

      if (candidates.length === 0) {
        break;
      }

      const chosen: { next: AnyNode; relationship: RelationshipType } = candidates[0];
      const nextNode: AnyNode = chosen.next;

      nodes.push(nextNode);
      path.push({
        from: current.id,
        to: nextNode.id,
        relationship: chosen.relationship,
      });

      if (options.accumulateContext) {
        const typeKey = nextNode.type;
        if (!accumulatedContext[typeKey]) {
          accumulatedContext[typeKey] = [];
        }
        accumulatedContext[typeKey].push(nextNode);
      }

      if (options.includeRationale) {
        reasoningSteps.push({
          step: stepNumber,
          node: nextNode,
          relationship: {
            type: chosen.relationship,
            from: current.id,
            to: nextNode.id,
          },
          rationale: `Following ${chosen.relationship} relationship`,
          context: `Step ${stepNumber}: ${nextNode.type} "${nextNode.content.substring(0, 50)}..."`,
        });
      }

      current = nextNode;
      stepNumber++;
      if (!repeatSingleStep) {
        sequenceIndex++;
      }
    }

    return {
      nodes,
      path,
      accumulatedContext: options.accumulateContext ? accumulatedContext : undefined,
      reasoningSteps: options.includeRationale ? reasoningSteps : undefined,
    };
  }

  async buildContextChain(
    startNode: NodeId,
    options: ContextChainOptions
  ): Promise<ContextChainResult> {
    const start = await this.getNode(startNode);
    if (!start) {
      throw new Error(`Node ${this.nodeKey(startNode)} not found`);
    }

    const chains: ReasoningChainResult[] = [];
    const accumulatedContext: {
      goals?: AnyNode[];
      decisions?: AnyNode[];
      tasks?: AnyNode[];
      risks?: AnyNode[];
      constraints?: AnyNode[];
      questions?: AnyNode[];
    } = {};
    const reasoningPath: ReasoningStep[] = [];

    // Follow each relationship type in sequence
    let current: AnyNode | null = start;
    let stepNumber = 1;

    for (const relType of options.relationshipSequence) {
      if (!current) {
        break;
      }

      const chainResult = await this.traverseReasoningChain(current.id, {
        path: [{ relationshipType: relType }],
        maxDepth: options.maxDepth || 1,
        accumulateContext: options.accumulate,
        includeRationale: options.includeReasoning,
      });

      chains.push(chainResult);

      if (chainResult.nodes.length > 1) {
        current = chainResult.nodes[chainResult.nodes.length - 1];
      } else {
        break;
      }

      if (options.stopOn && current && options.stopOn.includes(current.type)) {
        break;
      }

      stepNumber++;
    }

    // Accumulate context by type
    for (const chain of chains) {
      for (const node of chain.nodes) {
        const typeKey = node.type as keyof typeof accumulatedContext;
        if (typeKey in accumulatedContext) {
          if (!accumulatedContext[typeKey]) {
            accumulatedContext[typeKey] = [];
          }
          (accumulatedContext[typeKey] as AnyNode[]).push(node);
        }
      }
    }

    return {
      startNode: start,
      chains,
      accumulatedContext,
      reasoningPath,
    };
  }

  async followDecisionReasoning(
    decisionId: NodeId,
    options: DecisionReasoningOptions
  ): Promise<DecisionReasoningResult> {
    const decision = await this.getNode(decisionId);
    if (!decision || decision.type !== "decision") {
      throw new Error(`Decision ${this.nodeKey(decisionId)} not found`);
    }

    const goals: AnyNode[] = [];
    const alternatives: AnyNode[] = [];
    const implementations: AnyNode[] = [];
    const risks: AnyNode[] = [];
    const constraints: AnyNode[] = [];
    const reasoningChain: ReasoningStep[] = [];

    const depth = options.depth || 1;

    // Find goals (decisions that reference this decision, or this decision references goals)
    if (options.includeGoals) {
      const goalNodes = await this.queryNodes({
        type: ["goal"],
        relatedTo: decisionId,
        depth,
      });
      goals.push(...goalNodes.nodes);
    }

    // Find implementations (tasks that implement this decision)
    if (options.includeImplementations) {
      const implNodes = await this.queryNodes({
        type: ["task"],
        relatedTo: decisionId,
        relationshipTypes: ["implements"],
        depth,
      });
      implementations.push(...implNodes.nodes);
    }

    // Find risks (risks that block or are related to this decision)
    if (options.includeRisks) {
      const riskNodes = await this.queryNodes({
        type: ["risk"],
        relatedTo: decisionId,
        relationshipTypes: ["blocks", "related-to"],
        depth,
      });
      risks.push(...riskNodes.nodes);
    }

    // Find constraints (constraints that apply to this decision)
    if (options.includeConstraints) {
      const constraintNodes = await this.queryNodes({
        type: ["constraint"],
        relatedTo: decisionId,
        depth,
      });
      constraints.push(...constraintNodes.nodes);
    }

    // Build reasoning chain
    let stepNumber = 1;
    if (goals.length > 0) {
      reasoningChain.push({
        step: stepNumber++,
        node: goals[0],
        relationship: {
          type: "references",
          from: decisionId,
          to: goals[0].id,
        },
        context: `Goal: ${goals[0].content.substring(0, 50)}...`,
      });
    }

    if (implementations.length > 0) {
      reasoningChain.push({
        step: stepNumber++,
        node: implementations[0],
        relationship: {
          type: "implements",
          from: implementations[0].id,
          to: decisionId,
        },
        context: `Implementation: ${implementations[0].content.substring(0, 50)}...`,
      });
    }

    return {
      decision,
      goals: options.includeGoals ? goals : undefined,
      alternatives: options.includeAlternatives ? alternatives : undefined,
      implementations: options.includeImplementations ? implementations : undefined,
      risks: options.includeRisks ? risks : undefined,
      constraints: options.includeConstraints ? constraints : undefined,
      reasoningChain,
    };
  }

  async discoverRelatedReasoning(
    nodeId: NodeId,
    options: RelatedReasoningOptions
  ): Promise<RelatedReasoningResult> {
    const startNode = await this.getNode(nodeId);
    if (!startNode) {
      throw new Error(`Node ${this.nodeKey(nodeId)} not found`);
    }

    const relatedNodes: AnyNode[] = [];
    const reasoningChains: ReasoningChainResult[] = [];
    const similarityScores: Array<{ node: AnyNode; score: number }> = [];

    const maxDepth = options.maxDepth || 2;

    // Find related nodes through specified relationship types
    for (const relType of options.relationshipTypes) {
      const related = await this.queryNodes({
        relatedTo: nodeId,
        relationshipTypes: [relType],
        depth: maxDepth,
      });
      relatedNodes.push(...related.nodes);
    }

    // Build reasoning chains if requested
    if (options.buildReasoningChain) {
      for (const relType of options.relationshipTypes) {
        const chain = await this.traverseReasoningChain(nodeId, {
          path: [{ relationshipType: relType }],
          maxDepth,
          accumulateContext: true,
          includeRationale: true,
        });
        reasoningChains.push(chain);
      }
    }

    // Semantic similarity (basic implementation)
    if (options.includeSemanticallySimilar) {
      const allNodes = Array.from(this.nodes.values());
      for (const node of allNodes) {
        if (this.nodeKey(node.id) === this.nodeKey(nodeId)) {
          continue;
        }

        // Simple similarity: shared words in content
        const startWords = new Set(
          startNode.content.toLowerCase().split(/\s+/)
        );
        const nodeWords = new Set(node.content.toLowerCase().split(/\s+/));
        const intersection = new Set(
          [...startWords].filter((x) => nodeWords.has(x))
        );
        const union = new Set([...startWords, ...nodeWords]);
        const score = intersection.size / union.size;

        if (score > 0.1) {
          // Threshold for similarity
          similarityScores.push({ node, score });
        }
      }

      similarityScores.sort((a, b) => b.score - a.score);
    }

    return {
      startNode,
      relatedNodes: Array.from(
        new Map(relatedNodes.map((n) => [this.nodeKey(n.id), n])).values()
      ), // Deduplicate
      reasoningChains: options.buildReasoningChain ? reasoningChains : undefined,
      similarityScores:
        options.includeSemanticallySimilar ? similarityScores : undefined,
    };
  }

  async queryWithReasoning(
    options: ReasoningQueryOptions
  ): Promise<ReasoningQueryResult> {
    // Execute base query
    const primaryResults = await this.queryNodes(options.query);

    const reasoningChains: ReasoningChainResult[] = [];
    const accumulatedContext: { [key: string]: AnyNode[] } = {};
    const reasoningPath: ReasoningStep[] = [];

    if (options.reasoning.enabled) {
      // For each result, follow reasoning chains
      for (const node of primaryResults.nodes) {
        const chain = await this.traverseReasoningChain(node.id, {
          path: options.reasoning.followRelationships.map((relType) => ({
            relationshipType: relType,
          })),
          maxDepth: options.reasoning.maxDepth || 3,
          accumulateContext: true,
          includeRationale: options.reasoning.includeRationale,
        });

        reasoningChains.push(chain);

        // Accumulate context
        if (chain.accumulatedContext) {
          for (const [type, nodes] of Object.entries(chain.accumulatedContext)) {
            if (!accumulatedContext[type]) {
              accumulatedContext[type] = [];
            }
            accumulatedContext[type].push(...nodes);
          }
        }

        if (chain.reasoningSteps) {
          reasoningPath.push(...chain.reasoningSteps);
        }
      }
    }

    return {
      primaryResults,
      reasoningChains,
      accumulatedContext,
      reasoningPath,
    };
  }

  // Helper methods for graph traversal

  private getDescendants(
    nodeId: NodeId,
    relationshipType: RelationshipType
  ): AnyNode[] {
    const descendants: AnyNode[] = [];
    const visited = new Set<string>();
    const toVisit: AnyNode[] = [];

    const start = this.getNodeByKey(this.nodeKey(nodeId));
    if (!start) {
      return descendants;
    }

    toVisit.push(start);

    while (toVisit.length > 0) {
      const current = toVisit.shift()!;
      const currentKey = this.nodeKey(current.id);

      if (visited.has(currentKey)) {
        continue;
      }
      visited.add(currentKey);

      const children = current.relationships?.filter(
        (rel) => rel.type === relationshipType
      );

      if (children) {
        for (const rel of children) {
          const child = this.getNodeByKey(this.nodeKey(rel.target));
          if (child && !visited.has(this.nodeKey(child.id))) {
            descendants.push(child);
            toVisit.push(child);
          }
        }
      }
    }

    return descendants;
  }

  private getAncestors(
    nodeId: NodeId,
    relationshipType: RelationshipType
  ): AnyNode[] {
    const ancestors: AnyNode[] = [];
    const visited = new Set<string>();
    const toVisit: AnyNode[] = [];

    const start = this.getNodeByKey(this.nodeKey(nodeId));
    if (!start) {
      return ancestors;
    }

    toVisit.push(start);

    while (toVisit.length > 0) {
      const current = toVisit.shift()!;
      const currentKey = this.nodeKey(current.id);

      if (visited.has(currentKey)) {
        continue;
      }
      visited.add(currentKey);

      // Find nodes that have this node as a child
      for (const node of this.nodes.values()) {
        if (
          node.relationships?.some(
            (rel) =>
              rel.type === relationshipType &&
              this.nodeKey(rel.target) === currentKey
          )
        ) {
          if (!visited.has(this.nodeKey(node.id))) {
            ancestors.push(node);
            toVisit.push(node);
          }
        }
      }
    }

    return ancestors;
  }

  private getDependencies(nodeId: NodeId): AnyNode[] {
    const node = this.getNodeByKey(this.nodeKey(nodeId));
    if (!node) {
      return [];
    }

    const dependencies: AnyNode[] = [];

    const depRels = node.relationships?.filter(
      (rel) => rel.type === "depends-on"
    );

    if (depRels) {
      for (const rel of depRels) {
        const dep = this.getNodeByKey(this.nodeKey(rel.target));
        if (dep) {
          dependencies.push(dep);
        }
      }
    }

    return dependencies;
  }

  private getDependents(nodeId: NodeId): AnyNode[] {
    const targetKey = this.nodeKey(nodeId);
    const dependents: AnyNode[] = [];

    for (const node of this.nodes.values()) {
      if (
        node.relationships?.some(
          (rel) =>
            rel.type === "depends-on" &&
            this.nodeKey(rel.target) === targetKey
        )
      ) {
        dependents.push(node);
      }
    }

    return dependents;
  }
}
