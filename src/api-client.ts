/**
 * HTTP client for the TruthLayer Rust server.
 * Implements ContextStore by calling the server API.
 * Verbs: GET (read), POST (create, actions), PATCH (partial update).
 * Requires the server to be running (e.g. cd server && cargo run).
 *
 * Transport:
 * - Production: the server runs HTTP/3 (QUIC, decision-038). Chromium-based
 *   clients (VS Code fork webview) connect natively via HTTP/3.
 * - Development: set TRUTHTLAYER_DEV_TCP=true on the server to enable a
 *   plain TCP/HTTP/1.1 listener on the same port. Node.js `fetch()` does
 *   not yet support HTTP/3, so the dev TCP bridge is required for
 *   integration tests, smoke scripts, and extension host code.
 *
 * When OTEL is enabled, each request is wrapped in a span (HTTP {method}) and
 * W3C trace context is injected so the server continues the same trace.
 */

import { trace, context, metrics } from "@opentelemetry/api";
import { injectTraceHeaders } from "./telemetry.js";
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

/** Server response for GET /proposals (paginated). */
interface ProposalListResponse {
  proposals: Proposal[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

function getBase(): string {
  return typeof process !== "undefined" && process.env?.TRUTHTLAYER_SERVER_URL
    ? process.env.TRUTHTLAYER_SERVER_URL
    : DEFAULT_BASE;
}

/** Auth token from environment or explicit configuration. */
function getAuthToken(): string | undefined {
  return typeof process !== "undefined" ? process.env?.TRUTHLAYER_AUTH_TOKEN : undefined;
}

const tracer = trace.getTracer("truthlayer-client", "1.0.0");
const meter = metrics.getMeter("truthlayer-client", "1.0.0");
const clientRequestCount = meter.createCounter("http.client.request.count", {
  description: "Total HTTP client requests",
});
const clientRequestDuration = meter.createHistogram(
  "http.client.request.duration",
  { description: "HTTP client request duration", unit: "s" }
);

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const span = tracer.startSpan(`HTTP ${method}`, {
    attributes: {
      "http.method": method,
      "http.url": url,
    },
  });
  const start = performance.now();
  let recorded = false;
  function recordMetrics(statusCode: number): void {
    if (recorded) return;
    recorded = true;
    const durationSec = (performance.now() - start) / 1000;
    clientRequestCount.add(1, {
      "http.method": method,
      "http.status_code": statusCode,
    });
    clientRequestDuration.record(durationSec, {
      "http.method": method,
      "http.status_code": statusCode,
    });
  }
  try {
    return await context.with(trace.setSpan(context.active(), span), async () => {
      const traceHeaders = await injectTraceHeaders();
      const authToken = getAuthToken();
      const res = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...traceHeaders,
          ...init?.headers,
        },
      });
      recordMetrics(res.status);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error?: string }).error ?? res.statusText);
      }
      return res.json() as Promise<T>;
    });
  } catch (e) {
    recordMetrics(0);
    throw e;
  } finally {
    span.end();
  }
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
    const params = new URLSearchParams();
    if (query.limit != null) params.set("limit", String(query.limit));
    if (query.offset != null) params.set("offset", String(query.offset));
    const qs = params.toString();
    const url = qs ? `${this.base}/proposals?${qs}` : `${this.base}/proposals`;
    const result = await fetchJson<ProposalListResponse>(url);
    let out = result.proposals;
    if (query.status?.length) {
      out = out.filter((p) => query.status!.includes(p.status));
    }
    return out;
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

  async applyProposal(
    proposalId: string,
    options?: { appliedBy?: string }
  ): Promise<void> {
    const body =
      options?.appliedBy != null
        ? JSON.stringify({ appliedBy: options.appliedBy })
        : undefined;
    await fetchJson(`${this.base}/proposals/${encodeURIComponent(proposalId)}/apply`, {
      method: "POST",
      ...(body != null ? { body } : {}),
    });
  }

  async withdrawProposal(proposalId: string): Promise<void> {
    await fetchJson(
      `${this.base}/proposals/${encodeURIComponent(proposalId)}/withdraw`,
      { method: "POST" }
    );
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

  // --- Real-time events (SSE) ---------------------------------------------------

  /**
   * Subscribe to server-sent events (SSE) for real-time notifications.
   *
   * Transport note: SSE works over both HTTP/3 (production, via Chromium) and
   * HTTP/1.1 (dev TCP bridge, via Node.js). The same `/events` endpoint is used.
   *
   * @param workspaceId - optional workspace filter; only events for this workspace are delivered
   * @param onEvent     - callback invoked for each ServerEvent
   * @param onError     - optional error callback; called when the stream drops
   * @returns AbortController that can be used to close the SSE stream
   */
  subscribeToEvents(
    workspaceId: string | undefined,
    onEvent: (event: ServerEvent) => void,
    onError?: (error: Error) => void,
  ): AbortController {
    const controller = new AbortController();
    const params = workspaceId ? `?workspace=${encodeURIComponent(workspaceId)}` : "";
    const url = `${this.base}/events${params}`;

    const connect = async () => {
      try {
        const authToken = getAuthToken();
        const traceHeaders = await injectTraceHeaders();
        const res = await fetch(url, {
          headers: {
            Accept: "text/event-stream",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            ...traceHeaders,
          },
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`SSE connection failed: ${res.status} ${res.statusText}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let currentData = "";
          for (const line of lines) {
            if (line.startsWith("data:")) {
              currentData += line.slice(5).trim();
            } else if (line === "" && currentData) {
              try {
                const event = JSON.parse(currentData) as ServerEvent;
                onEvent(event);
              } catch {
                // skip malformed events
              }
              currentData = "";
            }
          }
        }
      } catch (e) {
        if (controller.signal.aborted) return; // intentional close
        if (onError && e instanceof Error) onError(e);
      }
    };

    connect();
    return controller;
  }
}

/** Server-sent event payload from GET /events. */
export interface ServerEvent {
  eventType: string;
  workspaceId?: string;
  resourceId: string;
  actorId: string;
  timestamp: string;
  data?: unknown;
}

/**
 * Create a ContextStore that talks to the Rust server.
 * Use TRUTHTLAYER_SERVER_URL to override the default (http://127.0.0.1:3080).
 *
 * Transport: the server defaults to HTTP/3 (QUIC). For Node.js development,
 * set TRUTHTLAYER_DEV_TCP=true on the server to enable a TCP bridge (same port).
 */
export function createRustServerClient(baseUrl?: string): RustServerClient {
  return new RustServerClient(baseUrl);
}
