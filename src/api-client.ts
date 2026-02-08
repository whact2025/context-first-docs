/**
 * HTTP client for the TruthLayer Rust server.
 * Implements ContextStore by calling the server API.
 * Verbs: GET (read), POST (create, actions), PATCH (partial update).
 * Requires the server to be running (e.g. cd server && cargo run).
 */

import type {
  AnyNode,
  NodeId,
  NodeQuery,
  NodeQueryResult,
  Proposal,
  ProposalQuery,
  Review,
  Comment,
  CommentQuery,
  ConflictDetectionResult,
  MergeResult,
  ReasoningChainOptions,
  ReasoningChainResult,
  ContextChainOptions,
  ContextChainResult,
  DecisionReasoningOptions,
  DecisionReasoningResult,
  RelatedReasoningOptions,
  RelatedReasoningResult,
  ReasoningQueryOptions,
  ReasoningQueryResult,
} from "./types/index.js";
import type { IssueCreationResult } from "./types/issues.js";

const DEFAULT_BASE = "http://127.0.0.1:3080";

function getBase(): string {
  return typeof process !== "undefined" && process.env?.TRUTHTLAYER_SERVER_URL
    ? process.env.TRUTHTLAYER_SERVER_URL
    : DEFAULT_BASE;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

function nodeKey(id: NodeId): string {
  return id.namespace ? `${id.namespace}:${id.id}` : id.id;
}

function queryString(query: NodeQuery): string {
  const params = new URLSearchParams();
  if (query.status?.length) params.set("status", query.status.join(","));
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.offset != null) params.set("offset", String(query.offset));
  return params.toString();
}

/**
 * ContextStore implementation that calls the Rust server API.
 */
export class RustServerClient {
  private base: string;

  constructor(baseUrl?: string) {
    this.base = baseUrl ?? getBase();
  }

  async getNode(nodeId: NodeId): Promise<AnyNode | null> {
    const key = encodeURIComponent(nodeKey(nodeId));
    try {
      const node = await fetchJson<AnyNode>(`${this.base}/nodes/${key}`);
      return node;
    } catch (e) {
      if (e instanceof Error && e.message.includes("not found")) return null;
      throw e;
    }
  }

  async queryNodes(query: NodeQuery): Promise<NodeQueryResult> {
    const qs = queryString(query);
    const url = qs ? `${this.base}/nodes?${qs}` : `${this.base}/nodes`;
    const result = await fetchJson<NodeQueryResult>(url);
    return result;
  }

  async getProposal(proposalId: string): Promise<Proposal | null> {
    try {
      const proposal = await fetchJson<Proposal>(`${this.base}/proposals/${encodeURIComponent(proposalId)}`);
      return proposal;
    } catch (e) {
      if (e instanceof Error && e.message.includes("not found")) return null;
      throw e;
    }
  }

  async queryProposals(query: ProposalQuery): Promise<Proposal[]> {
    const list = await fetchJson<Proposal[]>(`${this.base}/proposals`);
    let out = list;
    if (query.status?.length) {
      out = out.filter((p) => query.status!.includes(p.status));
    }
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    return out.slice(offset, offset + limit);
  }

  async createProposal(proposal: Proposal): Promise<void> {
    await fetchJson(`${this.base}/proposals`, {
      method: "POST",
      body: JSON.stringify(proposal),
    });
  }

  async updateProposal(proposalId: string, updates: Partial<Proposal>): Promise<void> {
    await fetchJson(`${this.base}/proposals/${encodeURIComponent(proposalId)}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async submitReview(review: Review): Promise<void> {
    await fetchJson(`${this.base}/proposals/${encodeURIComponent(review.proposalId)}/review`, {
      method: "POST",
      body: JSON.stringify(review),
    });
  }

  async applyProposal(proposalId: string): Promise<void> {
    await fetchJson(`${this.base}/proposals/${encodeURIComponent(proposalId)}/apply`, {
      method: "POST",
    });
  }

  async getReviewHistory(proposalId: string): Promise<Review[]> {
    const reviews = await fetchJson<Review[]>(
      `${this.base}/proposals/${encodeURIComponent(proposalId)}/reviews`
    );
    return reviews;
  }

  async getProposalComments(proposalId: string): Promise<Comment[]> {
    const proposal = await this.getProposal(proposalId);
    return proposal?.comments ?? [];
  }

  async addProposalComment(proposalId: string, comment: Comment): Promise<void> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
    const comments = [...(proposal.comments ?? []), comment];
    await fetchJson(`${this.base}/proposals/${encodeURIComponent(proposalId)}`, {
      method: "PATCH",
      body: JSON.stringify({ comments }),
    });
  }

  async getAcceptedNodes(): Promise<AnyNode[]> {
    const result = await this.queryNodes({ status: ["accepted"], limit: 10_000, offset: 0 });
    return result.nodes;
  }

  async getOpenProposals(): Promise<Proposal[]> {
    return this.queryProposals({ status: ["open"] });
  }

  async reset(): Promise<void> {
    await fetchJson(`${this.base}/reset`, { method: "POST" });
  }

  // --- Not implemented by Rust server; stub for interface compatibility ---

  async createIssuesFromProposal(_proposalId: string, _reviewId: string): Promise<IssueCreationResult> {
    throw new Error("Not implemented: createIssuesFromProposal (Rust server)");
  }

  async getRejectedProposals(): Promise<Proposal[]> {
    return this.queryProposals({ status: ["rejected"] });
  }

  async getReferencingNodes(_nodeId: NodeId): Promise<AnyNode[]> {
    return [];
  }

  async updateReferencingNodes(_nodeId: NodeId): Promise<void> {}

  async detectConflicts(_proposalId: string): Promise<ConflictDetectionResult> {
    throw new Error("Not implemented: detectConflicts (Rust server)");
  }

  async isProposalStale(_proposalId: string): Promise<boolean> {
    return false;
  }

  async mergeProposals(_proposalIds: string[]): Promise<MergeResult> {
    throw new Error("Not implemented: mergeProposals (Rust server)");
  }

  async traverseReasoningChain(
    _startNode: NodeId,
    _options: ReasoningChainOptions
  ): Promise<ReasoningChainResult> {
    throw new Error("Not implemented: traverseReasoningChain (Rust server)");
  }

  async buildContextChain(
    _startNode: NodeId,
    _options: ContextChainOptions
  ): Promise<ContextChainResult> {
    throw new Error("Not implemented: buildContextChain (Rust server)");
  }

  async followDecisionReasoning(
    _decisionId: NodeId,
    _options: DecisionReasoningOptions
  ): Promise<DecisionReasoningResult> {
    throw new Error("Not implemented: followDecisionReasoning (Rust server)");
  }

  async discoverRelatedReasoning(
    _nodeId: NodeId,
    _options: RelatedReasoningOptions
  ): Promise<RelatedReasoningResult> {
    throw new Error("Not implemented: discoverRelatedReasoning (Rust server)");
  }

  async queryWithReasoning(_options: ReasoningQueryOptions): Promise<ReasoningQueryResult> {
    throw new Error("Not implemented: queryWithReasoning (Rust server)");
  }

  async queryComments(_query: CommentQuery): Promise<Comment[]> {
    return [];
  }
}

/**
 * Create a ContextStore that talks to the Rust server.
 * Use TRUTHTLAYER_SERVER_URL to override the default (http://127.0.0.1:3080).
 */
export function createRustServerClient(baseUrl?: string): RustServerClient {
  return new RustServerClient(baseUrl);
}
