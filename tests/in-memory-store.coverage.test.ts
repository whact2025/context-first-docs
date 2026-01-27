/**
 * Targeted tests to improve InMemoryStore code coverage.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { InMemoryStore } from "../src/store/in-memory-store.js";
import {
  AnyNode,
  GoalNode,
  DecisionNode,
  TaskNode,
  RiskNode,
  ConstraintNode,
  NodeId,
} from "../src/types/node.js";
import {
  Proposal,
  CreateOperation,
  UpdateOperation,
} from "../src/types/proposal.js";

function meta(
  createdAt: string,
  createdBy = "user",
  modifiedAt = createdAt,
  modifiedBy = createdBy,
  version = 1
) {
  return { createdAt, createdBy, modifiedAt, modifiedBy, version };
}

async function createAndApply(store: InMemoryStore, proposalId: string, node: AnyNode) {
  const proposal: Proposal = {
    id: proposalId,
    status: "accepted",
    operations: [
      {
        id: `op-${proposalId}`,
        type: "create",
        order: 1,
        node,
      } as CreateOperation,
    ],
    metadata: meta(node.metadata.createdAt, node.metadata.createdBy, node.metadata.modifiedAt, node.metadata.modifiedBy),
  };
  await store.createProposal(proposal);
  await store.applyProposal(proposalId);
}

describe("InMemoryStore (coverage)", () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it("queryNodes should support advanced search options", async () => {
    const node: GoalNode = {
      id: { id: "goal-search-001" },
      type: "goal",
      status: "accepted",
      content: "Hello World",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    await createAndApply(store, "proposal-goal-search", node);

    const insensitive = await store.queryNodes({ search: { query: "hello" } });
    expect(insensitive.nodes.map((n) => n.id.id)).toContain("goal-search-001");

    const sensitiveMiss = await store.queryNodes({
      search: { query: "hello", caseSensitive: true },
    });
    expect(sensitiveMiss.nodes).toHaveLength(0);
  });

  it("queryNodes string search should match DecisionNode.decision field", async () => {
    const decision: DecisionNode = {
      id: { id: "decision-search-001" },
      type: "decision",
      status: "accepted",
      content: "Short content",
      decision: "Use PostgreSQL",
      rationale: "Reliability",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    await createAndApply(store, "proposal-decision-search", decision);

    const res = await store.queryNodes({ search: "postgresql" });
    expect(res.nodes.map((n) => n.id.id)).toContain("decision-search-001");
  });

  it("queryNodes should filter by namespace, modifiedBy, and modifiedAfter", async () => {
    const node: GoalNode = {
      id: { id: "goal-ns-001", namespace: "arch" },
      type: "goal",
      status: "accepted",
      content: "Namespaced",
      metadata: meta("2026-01-01T00:00:00Z", "u1", "2026-01-02T00:00:00Z", "u2"),
    };
    await createAndApply(store, "proposal-goal-ns", node);

    const res = await store.queryNodes({
      namespace: "arch",
      modifiedBy: "u2",
      modifiedAfter: "2026-01-01T12:00:00Z",
    });
    expect(res.nodes).toHaveLength(1);
    expect(res.nodes[0].id.namespace).toBe("arch");
  });

  it("queryNodes should support descendantsOf and ancestorsOf via parent-child relationships", async () => {
    const parent: GoalNode = {
      id: { id: "goal-parent" },
      type: "goal",
      status: "accepted",
      content: "Parent goal",
      metadata: meta("2026-01-01T00:00:00Z"),
      relationships: [{ type: "parent-child", target: { id: "goal-child" } }],
    };
    const child: GoalNode = {
      id: { id: "goal-child" },
      type: "goal",
      status: "accepted",
      content: "Child goal",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    await createAndApply(store, "proposal-goal-child", child);
    await createAndApply(store, "proposal-goal-parent", parent);

    const descendants = await store.queryNodes({ descendantsOf: { id: "goal-parent" } });
    expect(descendants.nodes.map((n) => n.id.id)).toContain("goal-child");

    const ancestors = await store.queryNodes({ ancestorsOf: { id: "goal-child" } });
    expect(ancestors.nodes.map((n) => n.id.id)).toContain("goal-parent");
  });

  it("queryNodes should support dependenciesOf and dependentsOf via depends-on relationships", async () => {
    const taskB: TaskNode = {
      id: { id: "task-b" },
      type: "task",
      status: "accepted",
      state: "open",
      content: "B",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    const taskA: TaskNode = {
      id: { id: "task-a" },
      type: "task",
      status: "accepted",
      state: "open",
      content: "A",
      metadata: meta("2026-01-01T00:00:00Z"),
      relationships: [{ type: "depends-on", target: { id: "task-b" } }],
    };
    await createAndApply(store, "proposal-task-b", taskB);
    await createAndApply(store, "proposal-task-a", taskA);

    const deps = await store.queryNodes({ dependenciesOf: { id: "task-a" } });
    expect(deps.nodes.map((n) => n.id.id)).toContain("task-b");

    const dependents = await store.queryNodes({ dependentsOf: { id: "task-b" } });
    expect(dependents.nodes.map((n) => n.id.id)).toContain("task-a");
  });

  it("queryNodes should support hasRelationship with targetType filtering", async () => {
    const goal: GoalNode = {
      id: { id: "goal-rel" },
      type: "goal",
      status: "accepted",
      content: "G",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    const task: TaskNode = {
      id: { id: "task-rel" },
      type: "task",
      status: "accepted",
      state: "open",
      content: "T",
      metadata: meta("2026-01-01T00:00:00Z"),
      relationships: [{ type: "implements", target: { id: "goal-rel" } }],
    };
    await createAndApply(store, "proposal-goal-rel", goal);
    await createAndApply(store, "proposal-task-rel", task);

    const res = await store.queryNodes({
      hasRelationship: { type: "implements", targetType: ["goal"] },
    });
    expect(res.nodes.map((n) => n.id.id)).toContain("task-rel");
  });

  it("queryNodes should sort by type and status", async () => {
    const a: GoalNode = {
      id: { id: "a" },
      type: "goal",
      status: "accepted",
      content: "a",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    const b: RiskNode = {
      id: { id: "b" },
      type: "risk",
      status: "proposed",
      content: "b",
      severity: "low",
      likelihood: "unlikely",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    await createAndApply(store, "proposal-a", a);
    // proposed nodes are excluded by default; include status in query
    await createAndApply(store, "proposal-b", b);

    const byType = await store.queryNodes({ status: ["accepted", "proposed"], sortBy: "type", sortOrder: "asc" });
    expect(byType.nodes.map((n) => n.type)).toEqual(["goal", "risk"]);

    const byStatus = await store.queryNodes({ status: ["accepted", "proposed"], sortBy: "status", sortOrder: "asc" });
    expect(byStatus.nodes[0].status).toBe("accepted");
  });

  it("queryProposals should filter by createdBy and nodeId", async () => {
    const node: ConstraintNode = {
      id: { id: "constraint-001" },
      type: "constraint",
      status: "accepted",
      content: "C",
      constraint: "Must be offline",
      metadata: meta("2026-01-01T00:00:00Z", "alice"),
    };

    const proposal: Proposal = {
      id: "proposal-constraint-001",
      status: "open",
      operations: [
        { id: "op-1", type: "create", order: 1, node } as CreateOperation,
      ],
      metadata: meta("2026-01-01T00:00:00Z", "alice"),
    };
    await store.createProposal(proposal);

    const byCreator = await store.queryProposals({ createdBy: "alice" });
    expect(byCreator.map((p) => p.id)).toContain("proposal-constraint-001");

    const byNode = await store.queryProposals({ nodeId: { id: "constraint-001" } });
    expect(byNode.map((p) => p.id)).toContain("proposal-constraint-001");
  });

  it("should throw on updateProposal/submitReview/applyProposal when proposal does not exist", async () => {
    await expect(store.updateProposal("missing", { status: "accepted" })).rejects.toThrow(
      /not found/i
    );

    await expect(
      store.submitReview({
        id: "review-missing",
        proposalId: "missing",
        reviewer: "u",
        reviewedAt: "2026-01-01T00:00:00Z",
        action: "accept",
      })
    ).rejects.toThrow(/not found/i);

    await expect(store.applyProposal("missing")).rejects.toThrow(/not found/i);
  });

  it("applyProposal should throw if accepted proposal updates a missing node", async () => {
    const proposal: Proposal = {
      id: "proposal-update-missing-node",
      status: "accepted",
      operations: [
        {
          id: "op-update",
          type: "update",
          order: 1,
          nodeId: { id: "does-not-exist" },
          changes: { content: "x" },
        } as UpdateOperation,
      ],
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    await store.createProposal(proposal);
    await expect(store.applyProposal("proposal-update-missing-node")).rejects.toThrow(/not found/i);
  });

  it("mergeProposals should auto-merge non-conflicting fields and report conflicts for same field", async () => {
    const goal: GoalNode = {
      id: { id: "goal-merge" },
      type: "goal",
      status: "accepted",
      content: "Original",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    await createAndApply(store, "proposal-goal-merge-create", goal);

    const p1: Proposal = {
      id: "proposal-merge-1",
      status: "open",
      operations: [
        {
          id: "op-1",
          type: "update",
          order: 1,
          nodeId: { id: "goal-merge" },
          changes: { content: "A" },
        } as UpdateOperation,
      ],
      metadata: meta("2026-01-02T00:00:00Z", "u1"),
    };

    const p2: Proposal = {
      id: "proposal-merge-2",
      status: "open",
      operations: [
        {
          id: "op-2",
          type: "update",
          order: 1,
          nodeId: { id: "goal-merge" },
          changes: { content: "B", foo: 123 },
        } as UpdateOperation,
      ],
      metadata: meta("2026-01-02T00:00:00Z", "u2"),
    };

    await store.createProposal(p1);
    await store.createProposal(p2);

    const result = await store.mergeProposals(["proposal-merge-1", "proposal-merge-2"]);
    expect(result.conflicts.some((c) => c.field === "content")).toBe(true);
    expect(result.autoMerged.some((m) => m.field === "foo")).toBe(true);
  });

  it("createIssuesFromProposal should return an error when proposal is missing", async () => {
    const result = await store.createIssuesFromProposal("missing", "review-1");
    expect(result.issues).toEqual([]);
    expect(result.errors?.[0]).toMatch(/not found/i);
  });

  it("traverseReasoningChain should handle missing start node and targetType filtering", async () => {
    const missing = await store.traverseReasoningChain({ id: "missing" }, { path: [{ relationshipType: "implements" }] });
    expect(missing.nodes).toEqual([]);
    expect(missing.path).toEqual([]);

    // Build incoming "implements": decision -> goal
    const goal: GoalNode = {
      id: { id: "goal-traverse" },
      type: "goal",
      status: "accepted",
      content: "Goal",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    const decision: DecisionNode = {
      id: { id: "decision-traverse" },
      type: "decision",
      status: "accepted",
      content: "Decision",
      decision: "Do it",
      rationale: "Because",
      metadata: meta("2026-01-01T00:00:00Z"),
      relationships: [{ type: "implements", target: { id: "goal-traverse" } }],
    };
    await createAndApply(store, "proposal-goal-traverse", goal);
    await createAndApply(store, "proposal-decision-traverse", decision);

    const chain = await store.traverseReasoningChain(
      { id: "goal-traverse" },
      { path: [{ relationshipType: "implements" }], maxDepth: 2 }
    );
    expect(chain.nodes.map((n) => n.id.id)).toContain("decision-traverse");
    expect(chain.path.length).toBeGreaterThan(0);

    const filtered = await store.traverseReasoningChain(
      { id: "goal-traverse" },
      { path: [{ relationshipType: "implements", targetType: ["task"] }], maxDepth: 2 }
    );
    expect(filtered.path).toHaveLength(0);
    expect(filtered.nodes).toHaveLength(1);
  });

  it("buildContextChain should throw when start node is missing", async () => {
    await expect(
      store.buildContextChain({ id: "missing" }, { relationshipSequence: ["implements"] })
    ).rejects.toThrow(/not found/i);
  });

  it("discoverRelatedReasoning should return related nodes and similarity scores", async () => {
    const base: GoalNode = {
      id: { id: "goal-base" },
      type: "goal",
      status: "accepted",
      content: "build scalable system",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    const related: GoalNode = {
      id: { id: "goal-related" },
      type: "goal",
      status: "accepted",
      content: "scalable system performance",
      metadata: meta("2026-01-01T00:00:00Z"),
      // discoverRelatedReasoning uses queryNodes({ relatedTo: baseId }) which finds
      // nodes that reference the start node (incoming relationships).
      relationships: [{ type: "related-to", target: { id: "goal-base" } }],
    };
    await createAndApply(store, "proposal-goal-related", related);
    await createAndApply(store, "proposal-goal-base", base);

    const res = await store.discoverRelatedReasoning(
      { id: "goal-base" },
      {
        relationshipTypes: ["related-to"],
        buildReasoningChain: true,
        includeSemanticallySimilar: true,
        maxDepth: 2,
      }
    );
    expect(res.relatedNodes.length).toBeGreaterThan(0);
    expect(res.reasoningChains?.length).toBeGreaterThan(0);
    expect(res.similarityScores?.length).toBeGreaterThan(0);
  });
});

