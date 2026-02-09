/**
 * Tests for RustServerClient (api-client.ts) using mocked fetch.
 */

import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import { RustServerClient, createRustServerClient } from "../src/api-client.js";
import type { Proposal, Review } from "../src/types/index.js";

const BASE = "http://127.0.0.1:3080";

function mockFetch(
  ok: boolean,
  data: unknown,
  status = ok ? 200 : 404
): ReturnType<typeof fetch> {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response);
}

describe("RustServerClient", () => {
  let client: RustServerClient;
  let fetchSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    client = new RustServerClient(BASE);
    fetchSpy = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("getNode", () => {
    it("returns node when found", async () => {
      const node = { id: { id: "goal-1" }, type: "goal", status: "accepted", content: "x", metadata: {} };
      fetchSpy.mockReturnValueOnce(mockFetch(true, node));
      const result = await client.getNode({ id: "goal-1" });
      expect(result).toEqual(node);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE}/nodes/goal-1`,
        expect.objectContaining({ headers: expect.objectContaining({ "Content-Type": "application/json" }) })
      );
    });

    it("returns null when not found", async () => {
      fetchSpy.mockReturnValueOnce(
        mockFetch(false, { error: "not found" }, 404)
      );
      const result = await client.getNode({ id: "missing" });
      expect(result).toBeNull();
    });
  });

  describe("queryNodes", () => {
    it("calls GET /nodes with query params", async () => {
      const result = { nodes: [], total: 0, limit: 50, offset: 0, hasMore: false };
      fetchSpy.mockReturnValueOnce(mockFetch(true, result));
      await client.queryNodes({ status: ["accepted"], limit: 10, offset: 0 });
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE}/nodes?status=accepted&limit=10&offset=0`,
        expect.any(Object)
      );
    });
  });

  describe("getProposal", () => {
    it("returns proposal when found", async () => {
      const proposal = { id: "p-1", status: "open", operations: [], metadata: {} };
      fetchSpy.mockReturnValueOnce(mockFetch(true, proposal));
      const result = await client.getProposal("p-1");
      expect(result).toEqual(proposal);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE}/proposals/p-1`,
        expect.any(Object)
      );
    });

    it("returns null when not found", async () => {
      fetchSpy.mockReturnValueOnce(mockFetch(false, { error: "not found" }, 404));
      const result = await client.getProposal("missing");
      expect(result).toBeNull();
    });
  });

  describe("createProposal", () => {
    it("POSTs proposal to /proposals", async () => {
      fetchSpy.mockReturnValueOnce(mockFetch(true, { ok: true }, 201));
      const proposal: Proposal = {
        id: "p-new",
        status: "open",
        operations: [],
        metadata: { createdAt: "", createdBy: "", modifiedAt: "", modifiedBy: "" },
      };
      await client.createProposal(proposal);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE}/proposals`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(proposal),
        })
      );
    });
  });

  describe("updateProposal", () => {
    it("PATCHes updates to /proposals/:id", async () => {
      fetchSpy.mockReturnValueOnce(mockFetch(true, { ok: true }));
      await client.updateProposal("p-1", { status: "accepted" });
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE}/proposals/p-1`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "accepted" }),
        })
      );
    });
  });

  describe("applyProposal", () => {
    it("POSTs to /proposals/:id/apply without body when no options", async () => {
      fetchSpy.mockReturnValueOnce(mockFetch(true, { ok: true }));
      await client.applyProposal("p-1");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE}/proposals/p-1/apply`,
        expect.objectContaining({
          method: "POST",
        })
      );
      const call = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(call.body).toBeUndefined();
    });

    it("POSTs with appliedBy body when options provided", async () => {
      fetchSpy.mockReturnValueOnce(mockFetch(true, { ok: true }));
      await client.applyProposal("p-1", { appliedBy: "actor-1" });
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE}/proposals/p-1/apply`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ appliedBy: "actor-1" }),
        })
      );
    });
  });

  describe("withdrawProposal", () => {
    it("POSTs to /proposals/:id/withdraw", async () => {
      fetchSpy.mockReturnValueOnce(mockFetch(true, { ok: true }));
      await client.withdrawProposal("p-1");
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE}/proposals/p-1/withdraw`,
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("submitReview", () => {
    it("POSTs review to /proposals/:id/review", async () => {
      fetchSpy.mockReturnValueOnce(mockFetch(true, { ok: true }));
      const review: Review = {
        id: "r-1",
        proposalId: "p-1",
        reviewer: "u1",
        reviewedAt: "2026-01-01T00:00:00Z",
        action: "accept",
      };
      await client.submitReview(review);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE}/proposals/p-1/review`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(review),
        })
      );
    });
  });

  describe("getReviewHistory", () => {
    it("GETs /proposals/:id/reviews", async () => {
      const reviews = [{ id: "r-1", proposalId: "p-1", reviewer: "u1", reviewedAt: "", action: "accept" }];
      fetchSpy.mockReturnValueOnce(mockFetch(true, reviews));
      const result = await client.getReviewHistory("p-1");
      expect(result).toEqual(reviews);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE}/proposals/p-1/reviews`,
        expect.any(Object)
      );
    });
  });

  describe("reset", () => {
    it("POSTs to /reset", async () => {
      fetchSpy.mockReturnValueOnce(mockFetch(true, { ok: true }));
      await client.reset();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE}/reset`,
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("queryProposals", () => {
    it("sends limit and offset as query params", async () => {
      fetchSpy.mockReturnValueOnce(
        mockFetch(true, { proposals: [], total: 0, limit: 10, offset: 5, hasMore: false })
      );
      await client.queryProposals({ limit: 10, offset: 5 });
      expect(fetchSpy).toHaveBeenCalledWith(
        `${BASE}/proposals?limit=10&offset=5`,
        expect.any(Object)
      );
    });
  });

  describe("getOpenProposals", () => {
    it("returns list from queryProposals with open status", async () => {
      const list = [{ id: "p-1", status: "open", operations: [], metadata: {} }];
      fetchSpy.mockReturnValueOnce(
        mockFetch(true, { proposals: list, total: 1, limit: 50, offset: 0, hasMore: false })
      );
      const result = await client.getOpenProposals();
      expect(result).toEqual(list);
    });
  });
});

describe("createRustServerClient", () => {
  it("returns client with default base when no arg", () => {
    const c = createRustServerClient();
    expect(c).toBeInstanceOf(RustServerClient);
  });

  it("returns client with custom base when provided", () => {
    const c = createRustServerClient("http://custom:4000");
    expect(c).toBeInstanceOf(RustServerClient);
  });
});
