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
  CommentQuery,
  ProposalQuery,
  RelationshipType,
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
import { NodeType } from "../types/node.js";
import { Comment, Proposal, Review } from "../types/proposal.js";
import {
  ConflictDetectionResult,
  MergeResult,
} from "../types/conflicts.js";
import { IssueCreationResult } from "../types/issues.js";
import { nodeKey as coreNodeKey } from "./core/node-key.js";
import {
  buildEdgeIndex,
  getAncestors,
  getDependencies,
  getDependents,
  getDescendants,
  traverseRelatedKeys,
} from "./core/graph.js";
import { applyAcceptedProposalToNodeMap } from "./core/apply-proposal.js";
import {
  detectConflictsForProposal,
  isProposalStale as isProposalStaleCore,
  mergeProposals as mergeProposalsCore,
} from "./core/conflicts.js";

export class InMemoryStore implements ContextStore {
  private nodes: Map<string, AnyNode> = new Map();
  private proposals: Map<string, Proposal> = new Map();
  private reviews: Map<string, Review[]> = new Map();

  private nodeKey(nodeId: NodeId): string {
    return coreNodeKey(nodeId);
  }

  private getNodeByKey(key: string): AnyNode | null {
    return this.nodes.get(key) || null;
  }
  // Validation + update-application logic is extracted to `src/store/core/updates.ts`.

  async getNode(nodeId: NodeId): Promise<AnyNode | null> {
    const key = this.nodeKey(nodeId);
    return this.nodes.get(key) || null;
  }

  async queryNodes(query: NodeQuery): Promise<NodeQueryResult> {
    let results = Array.from(this.nodes.values());

    // Default to accepted nodes only (for agent safety)
    const statusFilter = query.status || ["accepted"];
    const relevanceScores = new Map<string, number>();

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

    // Search filtering (+ relevance scoring)
    if (query.search) {
      const searchOpts =
        typeof query.search === "string"
          ? { query: query.search }
          : query.search;

      const caseSensitive = searchOpts.caseSensitive || false;
      const operator = searchOpts.operator || "AND";
      const fuzzy = searchOpts.fuzzy || false;
      const rawQuery = searchOpts.query.trim();

      const normalize = (s: string) => (caseSensitive ? s : s.toLowerCase());
      const needle = normalize(rawQuery);
      const terms =
        rawQuery.includes(" ") || rawQuery.includes("\t")
          ? rawQuery.split(/\s+/).filter(Boolean).map(normalize)
          : [needle];

      const levenshtein = (a: string, b: string): number => {
        if (a === b) return 0;
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const dp: number[] = new Array(b.length + 1);
        for (let j = 0; j <= b.length; j++) dp[j] = j;
        for (let i = 1; i <= a.length; i++) {
          let prev = dp[0];
          dp[0] = i;
          for (let j = 1; j <= b.length; j++) {
            const tmp = dp[j];
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
            prev = tmp;
          }
        }
        return dp[b.length];
      };

      const getSearchTexts = (node: AnyNode): Array<{ field: string; text: string }> => {
        const all: Array<{ field: string; text: string }> = [
          ...(typeof node.title === "string" ? [{ field: "title", text: node.title }] : []),
          ...(typeof node.description === "string"
            ? [{ field: "description", text: node.description }]
            : []),
          { field: "content", text: node.content },
        ];

        if (node.type === "decision") {
          if ("decision" in node && typeof node.decision === "string") {
            all.push({ field: "decision", text: node.decision });
          }
          if ("rationale" in node && typeof node.rationale === "string") {
            all.push({ field: "rationale", text: node.rationale });
          }
          if (
            "alternatives" in node &&
            Array.isArray(node.alternatives) &&
            node.alternatives.every((x) => typeof x === "string") &&
            node.alternatives.length > 0
          ) {
            all.push({ field: "alternatives", text: node.alternatives.join(" ") });
          }
        }
        if (node.type === "constraint") {
          if ("constraint" in node && typeof node.constraint === "string") {
            all.push({ field: "constraint", text: node.constraint });
          }
          if ("reason" in node && typeof node.reason === "string") {
            all.push({ field: "reason", text: node.reason });
          }
        }
        if (node.type === "question") {
          if ("question" in node && typeof node.question === "string") {
            all.push({ field: "question", text: node.question });
          }
          if ("answer" in node && typeof node.answer === "string") {
            all.push({ field: "answer", text: node.answer });
          }
        }

        // Field filter (if specified)
        if (Array.isArray(searchOpts.fields) && searchOpts.fields.length > 0) {
          const allowed = new Set(searchOpts.fields);
          return all.filter((f) => allowed.has(f.field));
        }

        return all;
      };

      const matchTerm = (hay: string, term: string): { matched: boolean; score: number } => {
        if (!term) return { matched: true, score: 0 };
        const idx = hay.indexOf(term);
        if (idx >= 0) {
          // Score: count of occurrences
          let count = 0;
          for (
            let at = hay.indexOf(term, 0);
            at !== -1;
            at = hay.indexOf(term, at + Math.max(1, term.length))
          ) {
            count++;
          }
          return { matched: true, score: count };
        }
        if (!fuzzy) return { matched: false, score: 0 };

        // Very small fuzzy: allow <=1 edit distance against tokens
        const tokens = hay.split(/\s+/).filter(Boolean);
        for (const t of tokens) {
          if (levenshtein(t, term) <= 1) {
            return { matched: true, score: 0.5 };
          }
        }
        return { matched: false, score: 0 };
      };

      results = results.filter((node) => {
        const texts = getSearchTexts(node).map((f) => ({
          field: f.field,
          text: normalize(f.text),
        }));

        const termMatches = terms.map((term) => {
          let best: { matched: boolean; score: number } = { matched: false, score: 0 };
          for (const t of texts) {
            const r = matchTerm(t.text, term);
            if (r.matched && r.score > best.score) best = r;
            if (best.matched && best.score >= 1) break;
          }
          return best;
        });

        const matched =
          operator === "OR"
            ? termMatches.some((m) => m.matched)
            : termMatches.every((m) => m.matched);

        if (!matched) return false;

        const score = termMatches.reduce((sum, m) => sum + (m.matched ? m.score : 0), 0);
        relevanceScores.set(this.nodeKey(node.id), score);
        return true;
      });
    }

    // Relationship filtering (relatedTo + relationshipTypes + depth + direction)
    const needsEdgeIndex =
      Boolean(query.relatedTo) ||
      (query.relationshipTypes && query.relationshipTypes.length > 0) ||
      Boolean(query.hasRelationship?.direction && query.hasRelationship.direction !== "outgoing");

    const edgeIndex = needsEdgeIndex
      ? buildEdgeIndex(this.nodes.values(), (id) => this.nodeKey(id))
      : null;

    if (query.relatedTo) {
      const depth = query.depth ?? 1;
      const direction = query.direction ?? "both";
      const allowedTypes =
        query.relationshipTypes && query.relationshipTypes.length > 0
          ? new Set(query.relationshipTypes)
          : null;

      const relatedKeys = traverseRelatedKeys(
        query.relatedTo,
        depth,
        direction,
        edgeIndex!,
        allowedTypes,
        (id) => this.nodeKey(id)
      );

      results = results.filter((node) => relatedKeys.has(this.nodeKey(node.id)));
    } else if (query.relationshipTypes && query.relationshipTypes.length > 0) {
      const direction = query.direction ?? "outgoing";
      const allowedTypes = new Set(query.relationshipTypes);
      results = results.filter((node) => {
        const key = this.nodeKey(node.id);
        const outHas = (edgeIndex!.outgoing.get(key) || []).some((e) =>
          allowedTypes.has(e.type)
        );
        const inHas = (edgeIndex!.incoming.get(key) || []).some((e) =>
          allowedTypes.has(e.type)
        );
        if (direction === "incoming") return inHas;
        if (direction === "both") return inHas || outHas;
        return outHas;
      });
    }

    // Hierarchical queries
    if (query.descendantsOf) {
      const descendants = getDescendants(
        (key) => this.getNodeByKey(key),
        query.descendantsOf,
        query.relationshipType || "parent-child",
        (id) => this.nodeKey(id)
      );
      const descendantKeys = new Set(descendants.map((n) => this.nodeKey(n.id)));
      results = results.filter((node) => descendantKeys.has(this.nodeKey(node.id)));
    }

    if (query.ancestorsOf) {
      const ancestors = getAncestors(
        this.nodes.values(),
        query.ancestorsOf,
        query.relationshipType || "parent-child",
        (id) => this.nodeKey(id)
      );
      const ancestorKeys = new Set(ancestors.map((n) => this.nodeKey(n.id)));
      results = results.filter((node) => ancestorKeys.has(this.nodeKey(node.id)));
    }

    // Dependency queries
    if (query.dependenciesOf) {
      const dependencies = getDependencies(
        (key) => this.getNodeByKey(key),
        query.dependenciesOf,
        (id) => this.nodeKey(id)
      );
      const depKeys = new Set(dependencies.map((n) => this.nodeKey(n.id)));
      results = results.filter((node) => depKeys.has(this.nodeKey(node.id)));
    }

    if (query.dependentsOf) {
      const dependents = getDependents(
        this.nodes.values(),
        query.dependentsOf,
        (id) => this.nodeKey(id)
      );
      const depKeys = new Set(dependents.map((n) => this.nodeKey(n.id)));
      results = results.filter((node) => depKeys.has(this.nodeKey(node.id)));
    }

    // Relationship existence filtering (supports direction)
    if (query.hasRelationship) {
      const relFilter = query.hasRelationship;
      const direction = relFilter.direction ?? "outgoing";
      const typeFilter = relFilter.type ? new Set([relFilter.type]) : null;

      results = results.filter((node) => {
        const key = this.nodeKey(node.id);

        const matchesOutgoing = (): boolean => {
          if (!node.relationships || node.relationships.length === 0) return false;
          return node.relationships.some((rel) => {
            if (typeFilter && !typeFilter.has(rel.type)) return false;
            if (relFilter.targetType) {
              const targetNode = this.getNodeByKey(this.nodeKey(rel.target));
              return Boolean(targetNode && relFilter.targetType!.includes(targetNode.type));
            }
            return true;
          });
        };

        const matchesIncoming = (): boolean => {
          if (!edgeIndex) return false;
          const incoming = edgeIndex.incoming.get(key) || [];
          if (incoming.length === 0) return false;
          return incoming.some((rel) => {
            if (typeFilter && !typeFilter.has(rel.type)) return false;
            if (relFilter.targetType) {
              const sourceNode = this.getNodeByKey(rel.fromKey);
              return Boolean(sourceNode && relFilter.targetType!.includes(sourceNode.type));
            }
            return true;
          });
        };

        if (direction === "incoming") return matchesIncoming();
        if (direction === "both") return matchesOutgoing() || matchesIncoming();
        return matchesOutgoing();
      });
    }

    // Sorting
    const sortBy = query.sortBy || "createdAt";
    const sortOrder = query.sortOrder || "desc";
    results.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "relevance": {
          const aScore = relevanceScores.get(this.nodeKey(a.id)) || 0;
          const bScore = relevanceScores.get(this.nodeKey(b.id)) || 0;
          comparison = aScore - bScore;
          if (comparison === 0) {
            comparison =
              new Date(a.metadata.createdAt).getTime() -
              new Date(b.metadata.createdAt).getTime();
          }
          break;
        }
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
    // Enforce Google-Docs-style review mode:
    // - proposals are "suggestions"
    // - accepting/rejecting is only allowed via submitReview()
    if (
      typeof updates.status === "string" &&
      updates.status !== existing.status &&
      updates.status !== "withdrawn"
    ) {
      throw new Error(
        `Cannot set proposal ${proposalId} status to "${updates.status}" via updateProposal(); use submitReview()`
      );
    }

    // Only allow withdrawing an open proposal (basic invariant; auth is out of scope here).
    if (updates.status === "withdrawn" && existing.status !== "open") {
      throw new Error(
        `Cannot withdraw proposal ${proposalId} because it is "${existing.status}"`
      );
    }

    this.proposals.set(proposalId, { ...existing, ...updates });
  }

  async submitReview(review: Review): Promise<void> {
    const proposal = await this.getProposal(review.proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${review.proposalId} not found`);
    }

    // Update proposal status based on review (the only supported path to accept/reject).
    if (proposal.status !== "open") {
      throw new Error(
        `Cannot review proposal ${review.proposalId}: status is "${proposal.status}"`
      );
    }

    if (review.action === "accept") {
      this.proposals.set(review.proposalId, {
        ...proposal,
        status: "accepted",
        metadata: {
          ...proposal.metadata,
          modifiedAt: review.reviewedAt,
          modifiedBy: review.reviewer,
        },
      });
    } else if (review.action === "reject") {
      this.proposals.set(review.proposalId, {
        ...proposal,
        status: "rejected",
        metadata: {
          ...proposal.metadata,
          modifiedAt: review.reviewedAt,
          modifiedBy: review.reviewer,
        },
      });
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
    applyAcceptedProposalToNodeMap(this.nodes, proposal, {
      keyOf: (id) => this.nodeKey(id),
    });
  }

  async getReviewHistory(proposalId: string): Promise<Review[]> {
    return this.reviews.get(proposalId) || [];
  }

  async getProposalComments(proposalId: string): Promise<Comment[]> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }
    return proposal.comments || [];
  }

  async addProposalComment(proposalId: string, comment: Comment): Promise<void> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    const comments = [...(proposal.comments || []), comment];
    this.proposals.set(proposalId, {
      ...proposal,
      comments,
      metadata: {
        ...proposal.metadata,
        // Treat comments as a form of modification for auditability.
        modifiedAt: comment.createdAt,
        modifiedBy: comment.author,
      },
    });
  }

  async queryComments(query: CommentQuery): Promise<Comment[]> {
    const flatten = (c: Comment): Comment[] => {
      const replies = Array.isArray(c.replies) ? c.replies.flatMap(flatten) : [];
      return [c, ...replies];
    };

    let results: Comment[] = [];

    // Proposal-attached comments
    for (const proposal of this.proposals.values()) {
      if (query.proposalId && proposal.id !== query.proposalId) continue;
      const comments = (proposal.comments || []).flatMap(flatten);
      results.push(...comments);
    }

    // Review-attached comments (anchored reviewer feedback)
    for (const reviews of this.reviews.values()) {
      for (const r of reviews) {
        if (query.proposalId && r.proposalId !== query.proposalId) continue;
        if (Array.isArray(r.comments) && r.comments.length > 0) {
          results.push(...r.comments.flatMap(flatten));
        }
      }
    }

    if (query.nodeId) {
      const target = this.nodeKey(query.nodeId);
      results = results.filter((c) => {
        const anchored = c.anchor?.nodeId ? this.nodeKey(c.anchor.nodeId) : null;
        return anchored === target;
      });
    }

    if (query.author) {
      results = results.filter((c) => c.author === query.author);
    }

    if (Array.isArray(query.status) && query.status.length > 0) {
      const allowed = new Set(query.status);
      results = results.filter((c) => (c.status ? allowed.has(c.status) : allowed.has("open")));
    }

    // Stable sort by createdAt if present
    results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const offset = query.offset || 0;
    const limit = query.limit ?? results.length;
    return results.slice(offset, offset + limit);
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
    void nodeId;
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
    const openProposals = await this.getOpenProposals();
    return detectConflictsForProposal(proposal, openProposals, {
      keyOf: (id) => this.nodeKey(id),
    });
  }

  async isProposalStale(proposalId: string): Promise<boolean> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) {
      return true;
    }
    return isProposalStaleCore(proposal, {
      keyOf: (id) => this.nodeKey(id),
      getNode: (id) => this.nodes.get(this.nodeKey(id)) || null,
    });
  }

  async mergeProposals(proposalIds: string[]): Promise<MergeResult> {
    const proposals = await Promise.all(
      proposalIds.map((id) => this.getProposal(id))
    );

    const validProposals = proposals.filter(
      (p): p is Proposal => p !== null
    );
    return mergeProposalsCore(validProposals, {
      keyOf: (id) => this.nodeKey(id),
      getNodeByKey: (key) => this.getNodeByKey(key),
    });
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
      codeProjection?: import("../types/issues.js").CodebaseProjection;
    }> = [];

    for (const operation of proposal.operations) {
      if (operation.type === "create" && "node" in operation) {
        const node = operation.node;
        if (node.type === "task") {
          issues.push({
            id: `issue-${proposalId}-${operation.order}`,
            proposalId,
            reviewId,
            description: `Implement: ${node.title ?? node.content}`,
            type: "implementation",
            state: "open",
            createdAt: new Date().toISOString(),
            createdBy: proposal.metadata.createdBy,
            codeProjection: proposal.metadata.codeProjection,
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
    const accumulatedContext: ContextChainResult["accumulatedContext"] = {};
    const reasoningPath: ReasoningStep[] = [];

    // Follow each relationship type in sequence
    let current: AnyNode | null = start;

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
    }

    // Accumulate context by type
    type ContextBucket = keyof ContextChainResult["accumulatedContext"];
    const bucketByType: Record<NodeType, ContextBucket | undefined> = {
      goal: "goals",
      decision: "decisions",
      task: "tasks",
      risk: "risks",
      constraint: "constraints",
      question: "questions",
      context: undefined,
      plan: undefined,
      note: undefined,
    };

    for (const chain of chains) {
      for (const node of chain.nodes) {
        const bucket = bucketByType[node.type];
        if (!bucket) continue;
        if (!accumulatedContext[bucket]) accumulatedContext[bucket] = [];
        accumulatedContext[bucket].push(node);
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

  // graph helpers extracted to `src/store/core/graph.ts`
}
