/**
 * Integration tests: RustServerClient against the real Rust server (in-memory store).
 * These tests do not mock fetch.
 *
 * Run with server started automatically:
 *   npm run test:integration
 * (Starts the Rust server, runs these tests, then stops the server.)
 *
 * Base URL: TRUTHTLAYER_SERVER_URL (default http://127.0.0.1:3080)
 */

import { describe, expect, it, beforeAll, afterAll } from "@jest/globals";
import { createRustServerClient } from "../src/api-client.js";
import type { Proposal } from "../src/types/index.js";

const BASE =
  typeof process !== "undefined" && process.env.TRUTHTLAYER_SERVER_URL
    ? process.env.TRUTHTLAYER_SERVER_URL
    : "http://127.0.0.1:3080";

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

describe("RustServerClient (integration – real server, in-memory store)", () => {
  const client = createRustServerClient(BASE);

  beforeAll(async () => {
    const up = await isServerUp();
    if (!up) {
      console.warn(
        "Integration tests skipped: server not reachable at",
        BASE,
        "\nStart with: npm run server"
      );
    }
  });

  async function skipIfServerDown(): Promise<boolean> {
    return isServerUp();
  }

  it("GET /health returns ok", async () => {
    if (!(await skipIfServerDown())) return;
    const res = await fetch(`${BASE.replace(/\/$/, "")}/health`);
    const data = (await res.json()) as { status?: string };
    expect(res.ok).toBe(true);
    expect(data.status).toBe("ok");
  });

  it("reset then query nodes returns empty or existing nodes", async () => {
    if (!(await skipIfServerDown())) return;
    await client.reset();
    const result = await client.queryNodes({ status: ["accepted"], limit: 10, offset: 0 });
    expect(result).toHaveProperty("nodes");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("hasMore");
    expect(Array.isArray(result.nodes)).toBe(true);
  });

  it("create proposal then get and list", async () => {
    if (!(await skipIfServerDown())) return;
    await client.reset();
    const proposal: Proposal = {
      id: "p-integration-1",
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
    const got = await client.getProposal("p-integration-1");
    expect(got).not.toBeNull();
    expect(got?.id).toBe("p-integration-1");
    expect(got?.status).toBe("open");
    const list = await client.getOpenProposals();
    expect(list.some((p) => p.id === "p-integration-1")).toBe(true);
  });

  it("update proposal (PATCH) then get", async () => {
    if (!(await skipIfServerDown())) return;
    await client.reset();
    const proposal: Proposal = {
      id: "p-integration-patch",
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
    await client.updateProposal("p-integration-patch", { status: "accepted" });
    const got = await client.getProposal("p-integration-patch");
    expect(got?.status).toBe("accepted");
  });

  it("withdraw proposal", async () => {
    if (!(await skipIfServerDown())) return;
    await client.reset();
    const proposal: Proposal = {
      id: "p-integration-withdraw",
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
    await client.withdrawProposal("p-integration-withdraw");
    const got = await client.getProposal("p-integration-withdraw");
    expect(got?.status).toBe("withdrawn");
  });

  it("queryProposals with limit and offset", async () => {
    if (!(await skipIfServerDown())) return;
    await client.reset();
    const list = await client.queryProposals({ limit: 5, offset: 0 });
    expect(Array.isArray(list)).toBe(true);
  });

  afterAll(async () => {
    if (await isServerUp()) {
      await client.reset();
    }
  });
});
