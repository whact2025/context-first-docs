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
import {
  NodeType,
  PlanStep,
  RiskNode,
  TaskNode,
  TextRange,
} from "../types/node.js";
import {
  Guard,
  isArrayOf,
  isNumber,
  isOptional,
  isRecord as isRecordGuard,
  isString,
  isOneOf,
} from "../utils/type-guards.js";
import {
  Proposal,
  Review,
  AnyOperation,
  UpdateOperation,
  DeleteTextOperation,
  DeleteOperation,
} from "../types/proposal.js";
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

  private isDeleteTextOperation(op: AnyOperation): op is DeleteTextOperation {
    return op.type === "delete" && "start" in op && "end" in op;
  }

  private isDeleteNodeOperation(op: AnyOperation): op is DeleteOperation {
    return op.type === "delete" && "nodeId" in op;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return isRecordGuard(value);
  }

  private isStringArray: Guard<string[]> = isArrayOf(isString);

  private isNodeId(value: unknown): value is NodeId {
    if (!this.isRecord(value)) return false;
    const id = value["id"];
    const namespace = value["namespace"];
    return (
      isString(id) &&
      isOptional(isString)(namespace)
    );
  }

  private isNodeIdArray(value: unknown): value is NodeId[] {
    return Array.isArray(value) && value.every((v) => this.isNodeId(v));
  }

  private isRelationshipType(value: unknown): value is RelationshipType {
    return isOneOf(
      [
        "parent-child",
        "depends-on",
        "references",
        "supersedes",
        "related-to",
        "implements",
        "blocks",
        "mitigates",
      ] as const
    )(value);
  }

  private isNodeRelationship(value: unknown): value is NodeRelationship {
    if (!this.isRecord(value)) return false;
    return (
      this.isRelationshipType(value["type"]) &&
      this.isNodeId(value["target"])
    );
  }

  private isNodeRelationshipArray(value: unknown): value is NodeRelationship[] {
    return Array.isArray(value) && value.every((v) => this.isNodeRelationship(v));
  }

  private isTextRange(value: unknown): value is TextRange {
    if (!this.isRecord(value)) return false;
    const start = value["start"];
    const end = value["end"];
    const source = value["source"];
    return (
      isNumber(start) &&
      isNumber(end) &&
      isOptional(isString)(source)
    );
  }

  private isPlanStep(value: unknown): value is PlanStep {
    if (!this.isRecord(value)) return false;
    const description = value["description"];
    const order = value["order"];
    const references = value["references"];
    return (
      isString(description) &&
      isNumber(order) &&
      (references === undefined || this.isNodeIdArray(references))
    );
  }

  private isPlanStepArray(value: unknown): value is PlanStep[] {
    return Array.isArray(value) && value.every((v) => this.isPlanStep(v));
  }

  private isTaskState(value: unknown): value is TaskNode["state"] {
    return isOneOf(
      ["open", "in-progress", "blocked", "completed", "cancelled"] as const
    )(value);
  }

  private isRiskSeverity(value: unknown): value is RiskNode["severity"] {
    return isOneOf(["low", "medium", "high", "critical"] as const)(value);
  }

  private isRiskLikelihood(value: unknown): value is RiskNode["likelihood"] {
    return isOneOf(["unlikely", "possible", "likely", "certain"] as const)(value);
  }

  private applyCommonNodeChanges<T extends AnyNode>(
    node: T,
    changes: UpdateOperation["changes"]
  ): T {
    let next: T = { ...node };

    if (typeof changes.content === "string") {
      next = { ...next, content: changes.content };
    }
    if (changes.status) {
      next = { ...next, status: changes.status };
    }

    const relationships = changes["relationships"];
    if (this.isNodeRelationshipArray(relationships)) {
      next = { ...next, relationships };
    }

    const relations = changes["relations"];
    if (this.isNodeIdArray(relations)) {
      next = { ...next, relations };
    }

    const referencedBy = changes["referencedBy"];
    if (this.isNodeIdArray(referencedBy)) {
      next = { ...next, referencedBy };
    }

    const sourceFiles = changes["sourceFiles"];
    if (this.isStringArray(sourceFiles)) {
      next = { ...next, sourceFiles };
    }

    const textRange = changes["textRange"];
    if (this.isTextRange(textRange)) {
      next = { ...next, textRange };
    }

    return next;
  }

  private applyUnknownChangeFields<T extends AnyNode>(
    node: T,
    changes: UpdateOperation["changes"],
    knownKeys: ReadonlySet<string>
  ): T {
    const next: T = { ...node };

    for (const [key, value] of Object.entries(changes)) {
      if (knownKeys.has(key)) continue;
      if (key === "id" || key === "type" || key === "metadata") continue;
      Reflect.set(next, key, value);
    }

    return next;
  }

  private applyUpdateChanges(existing: AnyNode, changes: UpdateOperation["changes"]): AnyNode {
    const commonKeys: readonly string[] = [
      "content",
      "status",
      "relationships",
      "relations",
      "referencedBy",
      "sourceFiles",
      "textRange",
    ];

    switch (existing.type) {
      case "goal": {
        const typeKeys: readonly string[] = ["criteria"];
        const knownKeys = new Set<string>([...commonKeys, ...typeKeys]);
        const next = this.applyCommonNodeChanges(existing, changes);
        const criteria = changes["criteria"];
        if (this.isStringArray(criteria)) Reflect.set(next, "criteria", criteria);
        return this.applyUnknownChangeFields(next, changes, knownKeys);
      }
      case "decision": {
        const typeKeys: readonly string[] = [
          "decision",
          "rationale",
          "alternatives",
          "decidedAt",
        ];
        const knownKeys = new Set<string>([...commonKeys, ...typeKeys]);
        const next = this.applyCommonNodeChanges(existing, changes);
        const decision = changes["decision"];
        if (typeof decision === "string") Reflect.set(next, "decision", decision);
        const rationale = changes["rationale"];
        if (typeof rationale === "string") Reflect.set(next, "rationale", rationale);
        const alternatives = changes["alternatives"];
        if (this.isStringArray(alternatives)) Reflect.set(next, "alternatives", alternatives);
        const decidedAt = changes["decidedAt"];
        if (typeof decidedAt === "string") Reflect.set(next, "decidedAt", decidedAt);
        return this.applyUnknownChangeFields(next, changes, knownKeys);
      }
      case "constraint": {
        const typeKeys: readonly string[] = ["constraint", "reason"];
        const knownKeys = new Set<string>([...commonKeys, ...typeKeys]);
        const next = this.applyCommonNodeChanges(existing, changes);
        const constraint = changes["constraint"];
        if (typeof constraint === "string") Reflect.set(next, "constraint", constraint);
        const reason = changes["reason"];
        if (typeof reason === "string") Reflect.set(next, "reason", reason);
        return this.applyUnknownChangeFields(next, changes, knownKeys);
      }
      case "task": {
        const typeKeys: readonly string[] = [
          "state",
          "assignee",
          "dueDate",
          "dependencies",
        ];
        const knownKeys = new Set<string>([...commonKeys, ...typeKeys]);
        const next = this.applyCommonNodeChanges(existing, changes);
        const state = changes["state"];
        if (this.isTaskState(state)) Reflect.set(next, "state", state);
        const assignee = changes["assignee"];
        if (typeof assignee === "string") Reflect.set(next, "assignee", assignee);
        const dueDate = changes["dueDate"];
        if (typeof dueDate === "string") Reflect.set(next, "dueDate", dueDate);
        const dependencies = changes["dependencies"];
        if (this.isNodeIdArray(dependencies)) Reflect.set(next, "dependencies", dependencies);
        return this.applyUnknownChangeFields(next, changes, knownKeys);
      }
      case "risk": {
        const typeKeys: readonly string[] = ["severity", "likelihood", "mitigation"];
        const knownKeys = new Set<string>([...commonKeys, ...typeKeys]);
        const next = this.applyCommonNodeChanges(existing, changes);
        const severity = changes["severity"];
        if (this.isRiskSeverity(severity)) Reflect.set(next, "severity", severity);
        const likelihood = changes["likelihood"];
        if (this.isRiskLikelihood(likelihood)) Reflect.set(next, "likelihood", likelihood);
        const mitigation = changes["mitigation"];
        if (typeof mitigation === "string") Reflect.set(next, "mitigation", mitigation);
        return this.applyUnknownChangeFields(next, changes, knownKeys);
      }
      case "question": {
        const typeKeys: readonly string[] = ["question", "answer", "answeredAt"];
        const knownKeys = new Set<string>([...commonKeys, ...typeKeys]);
        const next = this.applyCommonNodeChanges(existing, changes);
        const question = changes["question"];
        if (typeof question === "string") Reflect.set(next, "question", question);
        const answer = changes["answer"];
        if (typeof answer === "string") Reflect.set(next, "answer", answer);
        const answeredAt = changes["answeredAt"];
        if (typeof answeredAt === "string") Reflect.set(next, "answeredAt", answeredAt);
        return this.applyUnknownChangeFields(next, changes, knownKeys);
      }
      case "plan": {
        const typeKeys: readonly string[] = ["steps"];
        const knownKeys = new Set<string>([...commonKeys, ...typeKeys]);
        const next = this.applyCommonNodeChanges(existing, changes);
        const steps = changes["steps"];
        if (this.isPlanStepArray(steps)) Reflect.set(next, "steps", steps);
        return this.applyUnknownChangeFields(next, changes, knownKeys);
      }
      default: {
        const knownKeys = new Set<string>(commonKeys);
        const next = this.applyCommonNodeChanges(existing, changes);
        return this.applyUnknownChangeFields(next, changes, knownKeys);
      }
    }
  }

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

    const edgeIndex = needsEdgeIndex ? this.buildEdgeIndex() : null;

    if (query.relatedTo) {
      const depth = query.depth ?? 1;
      const direction = query.direction ?? "both";
      const allowedTypes =
        query.relationshipTypes && query.relationshipTypes.length > 0
          ? new Set(query.relationshipTypes)
          : null;

      const relatedKeys = this.traverseRelatedKeys(
        query.relatedTo,
        depth,
        direction,
        edgeIndex!,
        allowedTypes
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

    const touch = (node: AnyNode): AnyNode => {
      return {
        ...node,
        metadata: {
          ...node.metadata,
          modifiedAt: proposal.metadata.modifiedAt,
          modifiedBy: proposal.metadata.modifiedBy,
          version: (node.metadata.version ?? 0) + 1,
        },
      };
    };

    const setNode = (nodeId: NodeId, updater: (current: AnyNode) => AnyNode) => {
      const key = this.nodeKey(nodeId);
      const existing = this.nodes.get(key);
      if (!existing) {
        throw new Error(`Node ${key} not found`);
      }
      this.nodes.set(key, updater(existing));
    };

    // Apply operations in order
    for (const operation of proposal.operations.sort((a, b) => a.order - b.order)) {
      if (operation.type === "create" && "node" in operation) {
        const key = this.nodeKey(operation.node.id);
        this.nodes.set(key, operation.node);
      } else if (operation.type === "update") {
        setNode(operation.nodeId, (existing) =>
          touch(this.applyUpdateChanges(existing, operation.changes))
        );
      } else if (this.isDeleteNodeOperation(operation)) {
        // Mark as rejected, don't remove (provenance)
        setNode(operation.nodeId, (existing) =>
          touch({ ...existing, status: "rejected" })
        );
      } else if (operation.type === "status-change") {
        setNode(operation.nodeId, (existing) =>
          touch({ ...existing, status: operation.newStatus })
        );
      } else if (operation.type === "insert") {
        const nodeId = operation.sourceNodeId;
        if (!nodeId) {
          throw new Error(`Insert operation ${operation.id} missing sourceNodeId`);
        }
        setNode(nodeId, (existing) => {
          const content = existing.content ?? "";
          const pos = operation.position;
          const text = operation.text;
          if (pos < 0 || pos > content.length) {
            throw new Error(`Insert position ${pos} out of bounds for node ${this.nodeKey(nodeId)}`);
          }
          return touch({
            ...existing,
            content: content.slice(0, pos) + text + content.slice(pos),
          });
        });
      } else if (this.isDeleteTextOperation(operation)) {
        const nodeId = operation.sourceNodeId;
        if (!nodeId) {
          throw new Error(`DeleteText operation ${operation.id} missing sourceNodeId`);
        }
        setNode(nodeId, (existing) => {
          const content = existing.content ?? "";
          const start = operation.start;
          const end = operation.end;
          if (start < 0 || end < start || end > content.length) {
            throw new Error(
              `Delete range [${start}, ${end}) out of bounds for node ${this.nodeKey(nodeId)}`
            );
          }
          return touch({
            ...existing,
            content: content.slice(0, start) + content.slice(end),
          });
        });
      } else if (operation.type === "move") {
        const nodeId = operation.nodeId;
        const target = operation.target;
        if (target?.parentId) {
          const newParentId = target.parentId;
          const newParentKey = this.nodeKey(newParentId);
          const newParent = this.nodes.get(newParentKey);
          if (!newParent) {
            throw new Error(`Parent ${newParentKey} not found for move`);
          }

          // Remove any existing incoming parent-child edges to this node (single-parent semantics)
          for (const n of this.nodes.values()) {
            if (!n.relationships) continue;
            const nextRels = n.relationships.filter(
              (r) => !(r.type === "parent-child" && this.nodeKey(r.target) === this.nodeKey(nodeId))
            );
            if (nextRels.length !== n.relationships.length) {
              this.nodes.set(this.nodeKey(n.id), touch({ ...n, relationships: nextRels }));
            }
          }

          // Add parent-child edge from new parent to nodeId if missing
          const existingRels = newParent.relationships || [];
          const has = existingRels.some(
            (r) => r.type === "parent-child" && this.nodeKey(r.target) === this.nodeKey(nodeId)
          );
          if (!has) {
            this.nodes.set(
              newParentKey,
              touch({
                ...newParent,
                relationships: [...existingRels, { type: "parent-child", target: nodeId }],
              })
            );
          }
        }

        // Position is currently a no-op in memory store (no ordering field in model).
        // Still bump the moved node's metadata to record the change.
        setNode(nodeId, (existing) => touch(existing));
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

    const conflicts: ProposalConflict[] = [];
    const mergeable: string[] = [];
    const needsResolution: string[] = [];

    const summarize = (p: Proposal) => {
      const map = new Map<
        string,
        { nodeId: NodeId; kinds: Set<string>; fields: Set<string> }
      >();

      for (const op of p.operations) {
        let nodeId: NodeId | null = null;
        let kind: string = op.type;
        let fields: string[] = [];

        if (op.type === "create" && "node" in op) {
          nodeId = op.node.id;
        } else if ("nodeId" in op) {
          // update/status-change/move/delete(node)
          nodeId = op.nodeId;
        } else if (op.type === "insert") {
          nodeId = op.sourceNodeId ?? null;
        } else if (this.isDeleteTextOperation(op)) {
          nodeId = op.sourceNodeId ?? null;
        }

        if (!nodeId) continue;

        if (op.type === "update") {
          kind = "update";
          fields = Object.keys(op.changes || {});
        } else if (op.type === "status-change") {
          kind = "status-change";
          fields = ["status"];
        } else if (op.type === "insert" || this.isDeleteTextOperation(op)) {
          kind = "content-edit";
          fields = ["content"];
        } else if (op.type === "move") {
          kind = "move";
          fields = ["relationships"];
        } else if (this.isDeleteNodeOperation(op)) {
          kind = "delete";
        } else if (op.type === "create") {
          kind = "create";
        }

        const key = this.nodeKey(nodeId);
        if (!map.has(key)) {
          map.set(key, { nodeId, kinds: new Set(), fields: new Set() });
        }
        const entry = map.get(key)!;
        entry.kinds.add(kind);
        for (const f of fields) entry.fields.add(f);
      }

      return map;
    };

    const a = summarize(proposal);

    // Find all open proposals
    const openProposals = await this.getOpenProposals();

    for (const otherProposal of openProposals) {
      if (otherProposal.id === proposalId) continue;

      const b = summarize(otherProposal);
      const sharedKeys = Array.from(a.keys()).filter((k) => b.has(k));
      if (sharedKeys.length === 0) {
        mergeable.push(otherProposal.id);
        continue;
      }

      const conflictingNodes: NodeId[] = [];
      const conflictingFields: Record<string, string[]> = {};

      let hardNodeConflict = false;
      let fieldConflict = false;

      for (const key of sharedKeys) {
        const left = a.get(key)!;
        const right = b.get(key)!;
        conflictingNodes.push(left.nodeId);

        const leftNonUpdate = Array.from(left.kinds).some((k) => k !== "update");
        const rightNonUpdate = Array.from(right.kinds).some((k) => k !== "update");
        if (leftNonUpdate || rightNonUpdate) {
          hardNodeConflict = true;
          continue;
        }

        // Both are updates: check overlapping fields
        const overlap = Array.from(left.fields).filter((f) => right.fields.has(f));
        if (overlap.length > 0) {
          fieldConflict = true;
          conflictingFields[key] = overlap;
        }
      }

      if (!hardNodeConflict && !fieldConflict) {
        // Same nodes updated but disjoint fields => safe to merge
        mergeable.push(otherProposal.id);
        continue;
      }

      conflicts.push({
        proposals: [proposalId, otherProposal.id],
        conflictingNodes,
        conflictingFields: Object.keys(conflictingFields).length ? conflictingFields : undefined,
        severity: hardNodeConflict ? "node" : "field",
        autoResolvable: false,
      });
      needsResolution.push(otherProposal.id);
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

    // Prefer optimistic-locking baseVersions if provided
    if (proposal.metadata.baseVersions) {
      for (const operation of proposal.operations) {
        let nodeId: NodeId | null = null;

        if (operation.type === "create" && "node" in operation) {
          nodeId = operation.node.id;
        } else if ("nodeId" in operation) {
          nodeId = operation.nodeId;
        } else if (operation.type === "insert") {
          nodeId = operation.sourceNodeId ?? null;
        } else if (this.isDeleteTextOperation(operation)) {
          nodeId = operation.sourceNodeId ?? null;
        }

        if (!nodeId) continue;
        const key = this.nodeKey(nodeId);
        const base =
          proposal.metadata.baseVersions[key] ??
          proposal.metadata.baseVersions[nodeId.id];

        if (base === undefined) continue;

        const node = await this.getNode(nodeId);
        if (!node) return true;
        if (node.metadata.version !== base) return true;
      }
      return false;
    }

    // Check if any nodes referenced in the proposal have been updated
    for (const operation of proposal.operations) {
      let nodeId: NodeId | null = null;

      if (operation.type === "create" && "node" in operation) {
        nodeId = operation.node.id;
      } else if ("nodeId" in operation) {
        nodeId = operation.nodeId;
      } else if (operation.type === "insert") {
        nodeId = operation.sourceNodeId ?? null;
      } else if (this.isDeleteTextOperation(operation)) {
        nodeId = operation.sourceNodeId ?? null;
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

    // Field-level merge planning: combine updates and report collisions.
    const nodeChanges = new Map<
      string,
      Map<string, { proposalId: string; value: unknown; nodeId: NodeId }>
    >();

    for (const proposal of validProposals) {
      for (const operation of proposal.operations) {
        if (operation.type === "update") {
          const nodeId = operation.nodeId;
          const nodeKey = this.nodeKey(nodeId);
          const changes = operation.changes;

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
                nodeId,
                proposal1Value: existing.value,
                proposal2Value: value,
              });
            } else {
              fieldMap.set(field, { proposalId: proposal.id, value, nodeId });
            }
          }
        } else if (operation.type === "status-change") {
          const nodeId = operation.nodeId;
          const nodeKey = this.nodeKey(nodeId);
          if (!nodeChanges.has(nodeKey)) nodeChanges.set(nodeKey, new Map());
          const fieldMap = nodeChanges.get(nodeKey)!;
          const field = "status";
          const value = operation.newStatus;
          if (fieldMap.has(field)) {
            const existing = fieldMap.get(field)!;
            conflicts.push({
              field,
              nodeId,
              proposal1Value: existing.value,
              proposal2Value: value,
            });
          } else {
            fieldMap.set(field, { proposalId: proposal.id, value, nodeId });
          }
        }
      }
    }

    // Materialize non-conflicting field changes
    for (const [nodeKey, fields] of nodeChanges.entries()) {
      const baseNode = this.getNodeByKey(nodeKey);
      for (const [field, change] of fields.entries()) {
        const oldValue = baseNode ? (Reflect.get(baseNode, field) as unknown) : undefined;
        const record = {
          nodeId: change.nodeId,
          field,
          oldValue,
          newValue: change.value,
        };
        merged.push(record);
        autoMerged.push(record);
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

  private buildEdgeIndex(): {
    outgoing: Map<string, Array<{ type: RelationshipType; toKey: string }>>;
    incoming: Map<string, Array<{ type: RelationshipType; fromKey: string }>>;
  } {
    const outgoing = new Map<string, Array<{ type: RelationshipType; toKey: string }>>();
    const incoming = new Map<string, Array<{ type: RelationshipType; fromKey: string }>>();

    for (const node of this.nodes.values()) {
      const fromKey = this.nodeKey(node.id);
      const rels = node.relationships || [];
      if (rels.length === 0) continue;

      for (const rel of rels) {
        const toKey = this.nodeKey(rel.target);
        if (!outgoing.has(fromKey)) outgoing.set(fromKey, []);
        outgoing.get(fromKey)!.push({ type: rel.type, toKey });

        if (!incoming.has(toKey)) incoming.set(toKey, []);
        incoming.get(toKey)!.push({ type: rel.type, fromKey });
      }
    }

    return { outgoing, incoming };
  }

  private traverseRelatedKeys(
    startNode: NodeId,
    depth: number,
    direction: "outgoing" | "incoming" | "both",
    edgeIndex: {
      outgoing: Map<string, Array<{ type: RelationshipType; toKey: string }>>;
      incoming: Map<string, Array<{ type: RelationshipType; fromKey: string }>>;
    },
    allowedTypes: Set<RelationshipType> | null
  ): Set<string> {
    const startKey = this.nodeKey(startNode);
    const maxDepth = Math.max(0, depth);

    const visited = new Set<string>([startKey]);
    const result = new Set<string>();
    const queue: Array<{ key: string; d: number }> = [{ key: startKey, d: 0 }];

    const allow = (t: RelationshipType) => (allowedTypes ? allowedTypes.has(t) : true);

    while (queue.length > 0) {
      const { key, d } = queue.shift()!;
      if (d >= maxDepth) continue;

      if (direction === "outgoing" || direction === "both") {
        const outs = edgeIndex.outgoing.get(key) || [];
        for (const e of outs) {
          if (!allow(e.type)) continue;
          if (visited.has(e.toKey)) continue;
          visited.add(e.toKey);
          result.add(e.toKey);
          queue.push({ key: e.toKey, d: d + 1 });
        }
      }

      if (direction === "incoming" || direction === "both") {
        const ins = edgeIndex.incoming.get(key) || [];
        for (const e of ins) {
          if (!allow(e.type)) continue;
          if (visited.has(e.fromKey)) continue;
          visited.add(e.fromKey);
          result.add(e.fromKey);
          queue.push({ key: e.fromKey, d: d + 1 });
        }
      }
    }

    return result;
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
