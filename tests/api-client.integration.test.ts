/**
 * Integration tests: RustServerClient against the real Rust server (in-memory store).
 * These tests do NOT mock fetch — they exercise the full HTTP path through the server.
 *
 * Run with server started automatically:
 *   npm run test:integration
 * (Starts the Rust server with TRUTHTLAYER_DEV_TCP=true, runs these tests, then stops the server.)
 *
 * Transport: Node.js fetch() connects via the dev TCP bridge (HTTP/1.1).
 * The production server uses HTTP/3 (QUIC), which Node.js does not yet support.
 *
 * Base URL: TRUTHTLAYER_SERVER_URL (default http://127.0.0.1:3080)
 */

import { describe, expect, it, beforeAll, afterAll } from "@jest/globals";
import { createRustServerClient, RustServerClient } from "../src/api-client.js";
import type { Proposal, Review } from "../src/types/index.js";

const BASE =
  typeof process !== "undefined" && process.env.TRUTHTLAYER_SERVER_URL
    ? process.env.TRUTHTLAYER_SERVER_URL
    : "http://127.0.0.1:3080";

let serverAvailable = false;

async function isServerUp(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE.replace(/\/$/, "")}/health`, {
      headers: { Accept: "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && (data as { status?: string }).status === "ok";
  } catch {
    return false;
  }
}

function skipOrRun(
  name: string,
  fn: () => Promise<void>
): void {
  it(name, async () => {
    if (!serverAvailable) return;
    await fn();
  });
}

describe("RustServerClient (integration – real server, in-memory store)", () => {
  const client = createRustServerClient(BASE);

  beforeAll(async () => {
    serverAvailable = await isServerUp();
    if (!serverAvailable) {
      console.warn(
        "Integration tests skipped: server not reachable at",
        BASE,
        "\nStart with: npm run server"
      );
    }
  });

  // ── Health ──────────────────────────────────────────────────────────

  skipOrRun("GET /health returns ok", async () => {
    const res = await fetch(`${BASE.replace(/\/$/, "")}/health`);
    const data = (await res.json()) as { status?: string };
    expect(res.ok).toBe(true);
    expect(data.status).toBe("ok");
  });

  // ── Reset ───────────────────────────────────────────────────────────

  skipOrRun("reset clears previous state", async () => {
    await client.reset();
    const result = await client.queryNodes({ status: ["accepted"], limit: 10, offset: 0 });
    expect(result.nodes).toEqual([]);
    expect(result.total).toBe(0);
  });

  // ── Proposals CRUD + pagination ─────────────────────────────────────

  skipOrRun("create proposal then get and list", async () => {
    await client.reset();
    const proposal: Proposal = {
      id: "p-int-1",
      status: "open",
      operations: [],
      metadata: {
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: "integration",
        modifiedAt: "2026-01-01T00:00:00Z",
        modifiedBy: "integration",
      },
    };
    await client.createProposal(proposal);
    const got = await client.getProposal("p-int-1");
    expect(got).not.toBeNull();
    expect(got?.id).toBe("p-int-1");
    expect(got?.status).toBe("open");

    const open = await client.getOpenProposals();
    expect(open.some((p) => p.id === "p-int-1")).toBe(true);
  });

  skipOrRun("update proposal (PATCH) then verify", async () => {
    await client.reset();
    const proposal: Proposal = {
      id: "p-int-patch",
      status: "open",
      operations: [],
      metadata: {
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: "integration",
        modifiedAt: "2026-01-01T00:00:00Z",
        modifiedBy: "integration",
      },
    };
    await client.createProposal(proposal);
    await client.updateProposal("p-int-patch", { status: "accepted" });
    const got = await client.getProposal("p-int-patch");
    expect(got?.status).toBe("accepted");
  });

  skipOrRun("queryProposals with limit and offset", async () => {
    await client.reset();
    // Create 3 proposals
    for (let i = 0; i < 3; i++) {
      await client.createProposal({
        id: `p-page-${i}`,
        status: "open",
        operations: [],
        metadata: {
          createdAt: "2026-01-01T00:00:00Z",
          createdBy: "integration",
          modifiedAt: "2026-01-01T00:00:00Z",
          modifiedBy: "integration",
        },
      });
    }
    const page1 = await client.queryProposals({ limit: 2, offset: 0 });
    expect(page1.length).toBeLessThanOrEqual(2);
    const page2 = await client.queryProposals({ limit: 2, offset: 2 });
    expect(page2.length).toBeLessThanOrEqual(2);
  });

  skipOrRun("getProposal returns null for missing", async () => {
    await client.reset();
    const result = await client.getProposal("non-existent");
    expect(result).toBeNull();
  });

  // ── Withdraw ────────────────────────────────────────────────────────

  skipOrRun("withdraw proposal sets status to withdrawn", async () => {
    await client.reset();
    await client.createProposal({
      id: "p-int-withdraw",
      status: "open",
      operations: [],
      metadata: {
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: "integration",
        modifiedAt: "2026-01-01T00:00:00Z",
        modifiedBy: "integration",
      },
    });
    await client.withdrawProposal("p-int-withdraw");
    const got = await client.getProposal("p-int-withdraw");
    expect(got?.status).toBe("withdrawn");
  });

  // ── Review ──────────────────────────────────────────────────────────

  skipOrRun("submitReview and getReviewHistory", async () => {
    await client.reset();
    await client.createProposal({
      id: "p-int-review",
      status: "open",
      operations: [],
      metadata: {
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: "integration",
        modifiedAt: "2026-01-01T00:00:00Z",
        modifiedBy: "integration",
      },
    });

    const review: Review = {
      id: "r-int-1",
      proposalId: "p-int-review",
      reviewer: "reviewer-int",
      reviewedAt: "2026-01-02T00:00:00Z",
      action: "accept",
    };
    await client.submitReview(review);

    const history = await client.getReviewHistory("p-int-review");
    expect(history.length).toBe(1);
    expect(history[0].reviewer).toBe("reviewer-int");
    expect(history[0].action).toBe("accept");
  });

  // ── Apply ───────────────────────────────────────────────────────────

  skipOrRun("apply proposal creates node and sets applied status", async () => {
    await client.reset();
    const proposal: Proposal = {
      id: "p-int-apply",
      status: "accepted",
      operations: [
        {
          id: "op1",
          type: "create",
          order: 1,
          node: {
            id: { id: "goal-applied" },
            type: "goal",
            status: "accepted",
            content: "An applied goal",
            metadata: {
              createdAt: "2026-01-01T00:00:00Z",
              createdBy: "u",
              modifiedAt: "2026-01-01T00:00:00Z",
              modifiedBy: "u",
              version: 1,
            },
          },
        },
      ],
      metadata: {
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: "u",
        modifiedAt: "2026-01-01T00:00:00Z",
        modifiedBy: "u",
      },
    };
    await client.createProposal(proposal);
    await client.applyProposal("p-int-apply", { appliedBy: "test-actor" });

    // Verify node was created
    const node = await client.getNode({ id: "goal-applied" });
    expect(node).not.toBeNull();
    expect(node?.content).toBe("An applied goal");
  });

  skipOrRun("apply proposal without body works", async () => {
    await client.reset();
    const proposal: Proposal = {
      id: "p-int-apply-no-body",
      status: "accepted",
      operations: [],
      metadata: {
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: "u",
        modifiedAt: "2026-01-01T00:00:00Z",
        modifiedBy: "u",
      },
    };
    await client.createProposal(proposal);
    await expect(client.applyProposal("p-int-apply-no-body")).resolves.toBeUndefined();
  });

  // ── Nodes query ─────────────────────────────────────────────────────

  skipOrRun("queryNodes with status filter returns matching nodes", async () => {
    await client.reset();
    // Create and apply a proposal to add a node
    const proposal: Proposal = {
      id: "p-int-query-node",
      status: "accepted",
      operations: [
        {
          id: "op1",
          type: "create",
          order: 1,
          node: {
            id: { id: "query-node-1" },
            type: "goal",
            status: "accepted",
            content: "Queryable node",
            metadata: {
              createdAt: "2026-01-01T00:00:00Z",
              createdBy: "u",
              modifiedAt: "2026-01-01T00:00:00Z",
              modifiedBy: "u",
              version: 1,
            },
          },
        },
      ],
      metadata: {
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: "u",
        modifiedAt: "2026-01-01T00:00:00Z",
        modifiedBy: "u",
      },
    };
    await client.createProposal(proposal);
    await client.applyProposal("p-int-query-node");

    const result = await client.queryNodes({ status: ["accepted"], limit: 50, offset: 0 });
    expect(result.nodes.length).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result).toHaveProperty("hasMore");
  });

  skipOrRun("getNode returns null for missing node", async () => {
    await client.reset();
    const node = await client.getNode({ id: "does-not-exist" });
    expect(node).toBeNull();
  });

  skipOrRun("getAcceptedNodes returns applied nodes", async () => {
    await client.reset();
    const proposal: Proposal = {
      id: "p-int-accepted",
      status: "accepted",
      operations: [
        {
          id: "op1",
          type: "create",
          order: 1,
          node: {
            id: { id: "accepted-node-1" },
            type: "goal",
            status: "accepted",
            content: "Accepted goal",
            metadata: {
              createdAt: "2026-01-01T00:00:00Z",
              createdBy: "u",
              modifiedAt: "2026-01-01T00:00:00Z",
              modifiedBy: "u",
              version: 1,
            },
          },
        },
      ],
      metadata: {
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: "u",
        modifiedAt: "2026-01-01T00:00:00Z",
        modifiedBy: "u",
      },
    };
    await client.createProposal(proposal);
    await client.applyProposal("p-int-accepted");

    const accepted = await client.getAcceptedNodes();
    expect(accepted.length).toBeGreaterThanOrEqual(1);
    expect(accepted.some((n) => n.id.id === "accepted-node-1")).toBe(true);
  });

  // ── Comments ────────────────────────────────────────────────────────

  skipOrRun("addProposalComment and getProposalComments", async () => {
    await client.reset();
    await client.createProposal({
      id: "p-int-comment",
      status: "open",
      operations: [],
      metadata: {
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: "integration",
        modifiedAt: "2026-01-01T00:00:00Z",
        modifiedBy: "integration",
      },
    });

    await client.addProposalComment("p-int-comment", {
      id: "c-1",
      author: "tester",
      content: "Looks good",
      createdAt: "2026-01-02T00:00:00Z",
    });

    const comments = await client.getProposalComments("p-int-comment");
    expect(comments.length).toBe(1);
    expect(comments[0].author).toBe("tester");
    expect(comments[0].content).toBe("Looks good");
  });

  // ── Provenance (direct HTTP) ────────────────────────────────────────

  skipOrRun("GET /nodes/:id/provenance returns audit trail", async () => {
    await client.reset();
    // Create and apply to generate audit events tied to a resource
    const proposal: Proposal = {
      id: "p-int-prov",
      status: "accepted",
      operations: [
        {
          id: "op1",
          type: "create",
          order: 1,
          node: {
            id: { id: "prov-node" },
            type: "goal",
            status: "accepted",
            content: "Provenance test",
            metadata: {
              createdAt: "2026-01-01T00:00:00Z",
              createdBy: "u",
              modifiedAt: "2026-01-01T00:00:00Z",
              modifiedBy: "u",
              version: 1,
            },
          },
        },
      ],
      metadata: {
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: "u",
        modifiedAt: "2026-01-01T00:00:00Z",
        modifiedBy: "u",
      },
    };
    await client.createProposal(proposal);

    // Query provenance for that resource
    const res = await fetch(`${BASE}/nodes/p-int-prov/provenance`, {
      headers: { "Content-Type": "application/json" },
    });
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { resourceId: string; events: unknown[] };
    expect(body.resourceId).toBe("p-int-prov");
    expect(body.events.length).toBeGreaterThanOrEqual(1);
  });

  // ── Audit endpoints (direct HTTP) ──────────────────────────────────

  skipOrRun("GET /audit returns audit events", async () => {
    await client.reset();
    // reset itself generates an audit event
    const res = await fetch(`${BASE}/audit`, {
      headers: { "Content-Type": "application/json" },
    });
    expect(res.ok).toBe(true);
    const events = (await res.json()) as unknown[];
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  skipOrRun("GET /audit/export?format=csv returns CSV", async () => {
    await client.reset();
    await client.createProposal({
      id: "p-int-csv",
      status: "open",
      operations: [],
      metadata: {
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: "u",
        modifiedAt: "2026-01-01T00:00:00Z",
        modifiedBy: "u",
      },
    });

    const res = await fetch(`${BASE}/audit/export?format=csv`, {
      headers: { "Content-Type": "application/json" },
    });
    expect(res.ok).toBe(true);
    const ct = res.headers.get("content-type") ?? "";
    expect(ct).toContain("text/csv");
    const text = await res.text();
    expect(text).toContain("event_id,timestamp,actor_id");
    const lines = text.trim().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(2); // header + data
  });

  skipOrRun("GET /audit/export defaults to JSON", async () => {
    await client.reset();
    await client.createProposal({
      id: "p-int-json-audit",
      status: "open",
      operations: [],
      metadata: {
        createdAt: "2026-01-01T00:00:00Z",
        createdBy: "u",
        modifiedAt: "2026-01-01T00:00:00Z",
        modifiedBy: "u",
      },
    });

    const res = await fetch(`${BASE}/audit/export`, {
      headers: { "Content-Type": "application/json" },
    });
    expect(res.ok).toBe(true);
    const events = (await res.json()) as unknown[];
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  // ── DSAR endpoints (direct HTTP) ───────────────────────────────────

  skipOrRun("GET /admin/dsar/export returns subject data", async () => {
    await client.reset();
    const res = await fetch(`${BASE}/admin/dsar/export?subject=dev`, {
      headers: { "Content-Type": "application/json" },
    });
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { subject: string; auditEvents: unknown[] };
    expect(body.subject).toBe("dev");
    expect(Array.isArray(body.auditEvents)).toBe(true);
  });

  skipOrRun("POST /admin/dsar/erase records erase event", async () => {
    await client.reset();
    const res = await fetch(`${BASE}/admin/dsar/erase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "user-to-erase" }),
    });
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { ok: boolean; message: string };
    expect(body.ok).toBe(true);
    expect(body.message).toContain("user-to-erase");
  });

  // ── Error paths ────────────────────────────────────────────────────

  skipOrRun("getNode with non-existent id returns null", async () => {
    await client.reset();
    const result = await client.getNode({ id: "totally-missing" });
    expect(result).toBeNull();
  });

  skipOrRun("addProposalComment on missing proposal throws", async () => {
    await client.reset();
    await expect(
      client.addProposalComment("no-such-proposal", {
        id: "c-fail",
        author: "tester",
        content: "Should fail",
        createdAt: "2026-01-01T00:00:00Z",
      })
    ).rejects.toThrow();
  });

  // ── getRejectedProposals ───────────────────────────────────────────

  skipOrRun("getRejectedProposals returns empty when none rejected", async () => {
    await client.reset();
    const rejected = await client.getRejectedProposals();
    expect(rejected).toEqual([]);
  });

  // ── Cleanup ─────────────────────────────────────────────────────────

  afterAll(async () => {
    if (serverAvailable) {
      await client.reset();
    }
  });
});
