/**
 * Targeted tests to improve InMemoryStore code coverage.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { InMemoryStore } from "../src/store/in-memory-store.js";
import {
  AnyNode,
  ContextNode,
  GoalNode,
  DecisionNode,
  TaskNode,
  RiskNode,
  ConstraintNode,
  PlanNode,
  QuestionNode,
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

async function updateAndApply(
  store: InMemoryStore,
  proposalId: string,
  nodeId: NodeId,
  changes: UpdateOperation["changes"]
) {
  const proposal: Proposal = {
    id: proposalId,
    status: "accepted",
    operations: [
      {
        id: `op-${proposalId}`,
        type: "update",
        order: 1,
        nodeId,
        changes,
      } as UpdateOperation,
    ],
    metadata: meta("2026-01-10T00:00:00Z", "upd", "2026-01-10T00:00:00Z", "upd"),
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

  it("queryNodes should support relationshipTypes without relatedTo (direction aware)", async () => {
    const goal: GoalNode = {
      id: { id: "goal-rt-001" },
      type: "goal",
      status: "accepted",
      content: "Goal",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    const task: TaskNode = {
      id: { id: "task-rt-001" },
      type: "task",
      status: "accepted",
      state: "open",
      content: "Task implements goal",
      metadata: meta("2026-01-01T00:00:00Z"),
      relationships: [{ type: "implements", target: { id: "goal-rt-001" } }],
    };
    await createAndApply(store, "proposal-goal-rt-001", goal);
    await createAndApply(store, "proposal-task-rt-001", task);

    const outgoing = await store.queryNodes({
      status: ["accepted"],
      relationshipTypes: ["implements"],
      direction: "outgoing",
    });
    expect(outgoing.nodes.map((n) => n.id.id)).toContain("task-rt-001");

    const incoming = await store.queryNodes({
      status: ["accepted"],
      relationshipTypes: ["implements"],
      direction: "incoming",
    });
    expect(incoming.nodes.map((n) => n.id.id)).toContain("goal-rt-001");
  });

  it("queryNodes should support OR + fuzzy search + field filters + relevance sorting", async () => {
    const n1: GoalNode = {
      id: { id: "goal-search-a" },
      type: "goal",
      status: "accepted",
      title: "Alpha",
      description: "Hello world",
      content: "placeholder",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    const n2: GoalNode = {
      id: { id: "goal-search-b" },
      type: "goal",
      status: "accepted",
      title: "Beta",
      description: "Hello there",
      content: "placeholder",
      metadata: meta("2026-01-01T00:00:01Z"),
    };
    await createAndApply(store, "p-goal-search-a", n1);
    await createAndApply(store, "p-goal-search-b", n2);

    const orRes = await store.queryNodes({
      search: { query: "world beta", operator: "OR", fields: ["description", "title"] },
    });
    expect(orRes.nodes.map((n) => n.id.id)).toEqual(expect.arrayContaining(["goal-search-a", "goal-search-b"]));

    const fuzzyMiss = await store.queryNodes({ search: { query: "worle", fuzzy: false } });
    expect(fuzzyMiss.nodes).toHaveLength(0);

    const fuzzyHit = await store.queryNodes({ search: { query: "worle", fuzzy: true } });
    expect(fuzzyHit.nodes.map((n) => n.id.id)).toContain("goal-search-a");

    // Relevance: "hello" appears in both, but we can bump one via duplicate word
    await updateAndApply(store, "p-bump", { id: "goal-search-b" }, { description: "hello hello there" });
    const rel = await store.queryNodes({ search: "hello", sortBy: "relevance", sortOrder: "desc" });
    expect(rel.nodes[0].id.id).toBe("goal-search-b");
  });

  it("queryNodes should cover typed search fields + modifiedBefore + modifiedAt sorting", async () => {
    const decision: DecisionNode = {
      id: { id: "decision-typed" },
      type: "decision",
      status: "accepted",
      content: "Decision body",
      decision: "Use PostgreSQL",
      rationale: "Durability",
      alternatives: ["Use SQLite"],
      metadata: meta("2026-01-01T00:00:00Z", "u1", "2026-01-03T00:00:00Z", "u1"),
    };
    const constraint: ConstraintNode = {
      id: { id: "constraint-typed" },
      type: "constraint",
      status: "accepted",
      content: "Constraint body",
      constraint: "Must be offline",
      reason: "Customer requirement",
      metadata: meta("2026-01-01T00:00:00Z", "u1", "2026-01-02T00:00:00Z", "u1"),
    };
    const question: QuestionNode = {
      id: { id: "question-typed" },
      type: "question",
      status: "accepted",
      content: "Question body",
      question: "Why?",
      answer: "Because.",
      metadata: meta("2026-01-01T00:00:00Z", "u1", "2026-01-02T12:00:00Z", "u1"),
    };
    await createAndApply(store, "p-decision-typed", decision);
    await createAndApply(store, "p-constraint-typed", constraint);
    await createAndApply(store, "p-question-typed", question);

    const alt = await store.queryNodes({ search: { query: "sqlite", fields: ["alternatives"] } });
    expect(alt.nodes.map((n) => n.id.id)).toContain("decision-typed");

    const reason = await store.queryNodes({ search: { query: "customer", fields: ["reason"] } });
    expect(reason.nodes.map((n) => n.id.id)).toContain("constraint-typed");

    const ans = await store.queryNodes({ search: { query: "because", fields: ["answer"] } });
    expect(ans.nodes.map((n) => n.id.id)).toContain("question-typed");

    const before = await store.queryNodes({ modifiedBefore: "2026-01-02T23:59:59Z" });
    expect(before.nodes.map((n) => n.id.id)).toEqual(expect.arrayContaining(["constraint-typed", "question-typed"]));
    expect(before.nodes.map((n) => n.id.id)).not.toContain("decision-typed");

    const sortModified = await store.queryNodes({
      sortBy: "modifiedAt",
      sortOrder: "asc",
      status: ["accepted"],
    });
    expect(sortModified.nodes.length).toBeGreaterThan(0);
  });

  it("queryNodes relevance tie-breaker + default sort branch", async () => {
    const a: GoalNode = {
      id: { id: "goal-tie-a" },
      type: "goal",
      status: "accepted",
      content: "foo",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    const b: GoalNode = {
      id: { id: "goal-tie-b" },
      type: "goal",
      status: "accepted",
      content: "foo",
      metadata: meta("2026-01-02T00:00:00Z"),
    };
    await createAndApply(store, "p-goal-tie-a", a);
    await createAndApply(store, "p-goal-tie-b", b);

    const rel = await store.queryNodes({ search: "foo", sortBy: "relevance", sortOrder: "asc" });
    expect(rel.nodes[0].id.id).toBe("goal-tie-a");

    const unknownSort = await store.queryNodes({ status: ["accepted"], sortBy: "unknown" as any, sortOrder: "asc" });
    expect(unknownSort.nodes.length).toBeGreaterThan(0);
  });

  it("hasRelationship should support incoming and both directions", async () => {
    const goal: GoalNode = {
      id: { id: "goal-hasrel" },
      type: "goal",
      status: "accepted",
      content: "G",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    const task: TaskNode = {
      id: { id: "task-hasrel" },
      type: "task",
      status: "accepted",
      state: "open",
      content: "T",
      metadata: meta("2026-01-01T00:00:00Z"),
      relationships: [{ type: "implements", target: { id: "goal-hasrel" } }],
    };
    await createAndApply(store, "p-goal-hasrel", goal);
    await createAndApply(store, "p-task-hasrel", task);

    const incoming = await store.queryNodes({
      hasRelationship: { type: "implements", direction: "incoming" },
    });
    expect(incoming.nodes.map((n) => n.id.id)).toContain("goal-hasrel");

    const both = await store.queryNodes({
      status: ["accepted"],
      hasRelationship: { type: "implements", direction: "both" },
    });
    expect(both.nodes.map((n) => n.id.id)).toEqual(expect.arrayContaining(["goal-hasrel", "task-hasrel"]));
  });

  it("review mode: should allow withdrawing open proposals and reject invalid review/apply operations", async () => {
    const p: Proposal = {
      id: "proposal-open-1",
      status: "open",
      operations: [],
      metadata: meta("2026-01-01T00:00:00Z", "alice"),
    };
    await store.createProposal(p);

    await store.updateProposal("proposal-open-1", { status: "withdrawn" });
    expect((await store.getProposal("proposal-open-1"))?.status).toBe("withdrawn");

    // Cannot apply non-accepted proposal
    const p2: Proposal = { ...p, id: "proposal-open-2", status: "open" };
    await store.createProposal(p2);
    await expect(store.applyProposal("proposal-open-2")).rejects.toThrow(/not accepted/i);

    // Cannot review non-open proposal
    const p3: Proposal = { ...p, id: "proposal-open-3", status: "open" };
    await store.createProposal(p3);
    await store.submitReview({
      id: "r1",
      proposalId: "proposal-open-3",
      reviewer: "bob",
      reviewedAt: "2026-01-02T00:00:00Z",
      action: "accept",
    });
    await expect(
      store.submitReview({
        id: "r2",
        proposalId: "proposal-open-3",
        reviewer: "bob",
        reviewedAt: "2026-01-02T00:00:01Z",
        action: "reject",
      })
    ).rejects.toThrow(/status is/i);

    // Withdrawing a non-open proposal should fail.
    await expect(store.updateProposal("proposal-open-3", { status: "withdrawn" })).rejects.toThrow(/cannot withdraw/i);
  });

  it("createIssuesFromProposal should copy proposal codeProjection onto created issues", async () => {
    const task: TaskNode = {
      id: { id: "task-issue-proj" },
      type: "task",
      status: "accepted",
      state: "open",
      title: "Implement X",
      description: "Do the work",
      content: "placeholder",
      metadata: meta("2026-01-01T00:00:00Z", "alice"),
    };
    const proposal: Proposal = {
      id: "proposal-issue-proj",
      status: "open",
      operations: [{ id: "op1", type: "create", order: 1, node: task } as CreateOperation],
      metadata: {
        ...meta("2026-01-01T00:00:00Z", "alice"),
        codeProjection: { kind: "branch", ref: "feature/x", generatedAt: "2026-01-01T00:00:00Z" },
      },
    };
    await store.createProposal(proposal);
    const result = await store.createIssuesFromProposal("proposal-issue-proj", "review-1");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].codeProjection?.kind).toBe("branch");
  });

  it("buildContextChain and queryWithReasoning should produce accumulated context and reasoning steps", async () => {
    const goal: GoalNode = {
      id: { id: "goal-ctx" },
      type: "goal",
      status: "accepted",
      content: "Goal",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    const decision: DecisionNode = {
      id: { id: "decision-ctx" },
      type: "decision",
      status: "accepted",
      content: "Decision",
      decision: "Decide",
      rationale: "Because",
      metadata: meta("2026-01-01T00:00:00Z"),
      relationships: [{ type: "references", target: { id: "goal-ctx" } }],
    };
    const task: TaskNode = {
      id: { id: "task-ctx" },
      type: "task",
      status: "accepted",
      state: "open",
      content: "Task",
      metadata: meta("2026-01-01T00:00:00Z"),
      relationships: [{ type: "implements", target: { id: "decision-ctx" } }],
    };
    await createAndApply(store, "p-goal-ctx", goal);
    await createAndApply(store, "p-decision-ctx", decision);
    await createAndApply(store, "p-task-ctx", task);

    const chain = await store.buildContextChain({ id: "task-ctx" }, {
      relationshipSequence: ["implements", "references"],
      maxDepth: 1,
      includeReasoning: true,
      accumulate: true,
    });
    expect(chain.accumulatedContext.decisions?.map((n) => n.id.id)).toContain("decision-ctx");
    expect(chain.accumulatedContext.goals?.map((n) => n.id.id)).toContain("goal-ctx");

    const withReasoning = await store.queryWithReasoning({
      query: { search: "goal", status: ["accepted"] },
      reasoning: { enabled: true, followRelationships: ["references"], includeRationale: true, maxDepth: 1 },
    });
    expect(withReasoning.reasoningChains.length).toBeGreaterThan(0);
    expect(withReasoning.reasoningPath.length).toBeGreaterThan(0);
  });

  it("queryProposals nodeId filter should match update/status-change/delete ops too", async () => {
    const nodeId: NodeId = { id: "n-prop" };
    const pUpdate: Proposal = {
      id: "p-node-update",
      status: "open",
      operations: [{ id: "op", type: "update", order: 1, nodeId, changes: { description: "x" } } as any],
      metadata: meta("2026-01-01T00:00:00Z", "alice"),
    };
    const pStatus: Proposal = {
      id: "p-node-status",
      status: "open",
      operations: [
        { id: "op", type: "status-change", order: 1, nodeId, oldStatus: "accepted", newStatus: "rejected" } as any,
      ],
      metadata: meta("2026-01-01T00:00:00Z", "alice"),
    };
    const pDelete: Proposal = {
      id: "p-node-delete",
      status: "open",
      operations: [{ id: "op", type: "delete", order: 1, nodeId } as any],
      metadata: meta("2026-01-01T00:00:00Z", "alice"),
    };
    await store.createProposal(pUpdate);
    await store.createProposal(pStatus);
    await store.createProposal(pDelete);

    const res = await store.queryProposals({ nodeId });
    expect(res.map((p) => p.id)).toEqual(expect.arrayContaining(["p-node-update", "p-node-status", "p-node-delete"]));
  });

  it("should cover small convenience APIs (accepted/open/rejected/conflicts/stale/no-op)", async () => {
    const node: GoalNode = {
      id: { id: "goal-acc" },
      type: "goal",
      status: "accepted",
      content: "x",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    await createAndApply(store, "p-goal-acc", node);

    const accepted = await store.getAcceptedNodes();
    expect(accepted.map((n) => n.id.id)).toContain("goal-acc");

    const open: Proposal = { id: "p-open", status: "open", operations: [], metadata: meta("2026-01-01T00:00:00Z") };
    await store.createProposal(open);
    expect((await store.getOpenProposals()).map((p) => p.id)).toContain("p-open");

    await store.submitReview({
      id: "r-reject",
      proposalId: "p-open",
      reviewer: "bob",
      reviewedAt: "2026-01-02T00:00:00Z",
      action: "reject",
    });
    expect((await store.getRejectedProposals()).map((p) => p.id)).toContain("p-open");

    // detectConflicts on missing should return empty sets
    const conflicts = await store.detectConflicts("missing");
    expect(conflicts.conflicts).toEqual([]);

    // stale on missing proposalId should be true
    expect(await store.isProposalStale("missing")).toBe(true);

    // no-op call
    await expect(store.updateReferencingNodes({ id: "any" })).resolves.toBeUndefined();
  });

  it("queryNodes relatedTo should honor depth and direction", async () => {
    const a: GoalNode = {
      id: { id: "rel-a" },
      type: "goal",
      status: "accepted",
      content: "A",
      metadata: meta("2026-01-01T00:00:00Z"),
      relationships: [{ type: "related-to", target: { id: "rel-b" } }],
    };
    const b: GoalNode = {
      id: { id: "rel-b" },
      type: "goal",
      status: "accepted",
      content: "B",
      metadata: meta("2026-01-01T00:00:00Z"),
      relationships: [{ type: "related-to", target: { id: "rel-c" } }],
    };
    const c: GoalNode = {
      id: { id: "rel-c" },
      type: "goal",
      status: "accepted",
      content: "C",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    await createAndApply(store, "proposal-rel-c", c);
    await createAndApply(store, "proposal-rel-b", b);
    await createAndApply(store, "proposal-rel-a", a);

    const depth1 = await store.queryNodes({
      status: ["accepted"],
      relatedTo: { id: "rel-a" },
      relationshipTypes: ["related-to"],
      direction: "outgoing",
      depth: 1,
    });
    expect(depth1.nodes.map((n) => n.id.id)).toEqual(["rel-b"]);

    const depth2 = await store.queryNodes({
      status: ["accepted"],
      relatedTo: { id: "rel-a" },
      relationshipTypes: ["related-to"],
      direction: "outgoing",
      depth: 2,
      sortBy: "type",
      sortOrder: "asc",
    });
    const ids = depth2.nodes.map((n) => n.id.id).sort();
    expect(ids).toEqual(["rel-b", "rel-c"]);

    // Incoming should be able to find rel-a when starting from rel-b
    const incoming = await store.queryNodes({
      status: ["accepted"],
      relatedTo: { id: "rel-b" },
      relationshipTypes: ["related-to"],
      direction: "incoming",
      depth: 1,
    });
    expect(incoming.nodes.map((n) => n.id.id)).toContain("rel-a");
  });

  it("queryNodes should support hasRelationship with incoming direction", async () => {
    const goal: GoalNode = {
      id: { id: "goal-in-001" },
      type: "goal",
      status: "accepted",
      content: "G",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    const task: TaskNode = {
      id: { id: "task-in-001" },
      type: "task",
      status: "accepted",
      state: "open",
      content: "T",
      metadata: meta("2026-01-01T00:00:00Z"),
      relationships: [{ type: "implements", target: { id: "goal-in-001" } }],
    };
    await createAndApply(store, "proposal-goal-in-001", goal);
    await createAndApply(store, "proposal-task-in-001", task);

    const res = await store.queryNodes({
      status: ["accepted"],
      hasRelationship: { type: "implements", direction: "incoming", targetType: ["task"] },
    });
    expect(res.nodes.map((n) => n.id.id)).toContain("goal-in-001");
  });

  it("queryNodes should sort by relevance when requested", async () => {
    const n1: GoalNode = {
      id: { id: "rel-score-1" },
      type: "goal",
      status: "accepted",
      content: "foo foo bar",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    const n2: GoalNode = {
      id: { id: "rel-score-2" },
      type: "goal",
      status: "accepted",
      content: "foo bar",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    await createAndApply(store, "proposal-rel-score-1", n1);
    await createAndApply(store, "proposal-rel-score-2", n2);

    const res = await store.queryNodes({
      status: ["accepted"],
      search: "foo",
      sortBy: "relevance",
      sortOrder: "desc",
    });
    expect(res.nodes[0].id.id).toBe("rel-score-1");
  });

  it("advanced search should support fields/operator/fuzzy", async () => {
    const decision: DecisionNode = {
      id: { id: "decision-adv-001" },
      type: "decision",
      status: "accepted",
      content: "content does not mention db",
      decision: "Use PostgreSQL",
      rationale: "durability",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    await createAndApply(store, "proposal-decision-adv-001", decision);

    const fieldsOnly = await store.queryNodes({
      status: ["accepted"],
      search: { query: "postgresql", fields: ["decision"] },
    });
    expect(fieldsOnly.nodes.map((n) => n.id.id)).toContain("decision-adv-001");

    const orQuery = await store.queryNodes({
      status: ["accepted"],
      search: { query: "missing postgresql", operator: "OR", fields: ["decision"] },
    });
    expect(orQuery.nodes.map((n) => n.id.id)).toContain("decision-adv-001");

    const fuzzyQuery = await store.queryNodes({
      status: ["accepted"],
      search: { query: "postgrexql", fuzzy: true, fields: ["decision"] },
    });
    expect(fuzzyQuery.nodes.map((n) => n.id.id)).toContain("decision-adv-001");
  });

  it("detectConflicts should mark disjoint updates as mergeable, overlapping updates as conflicts, and create/update as node conflicts", async () => {
    const goal: GoalNode = {
      id: { id: "goal-conf-001" },
      type: "goal",
      status: "accepted",
      content: "Original",
      metadata: meta("2026-01-01T00:00:00Z"),
    };
    await createAndApply(store, "proposal-goal-conf-001", goal);

    const disjoint1: Proposal = {
      id: "proposal-disjoint-1",
      status: "open",
      operations: [
        { id: "op-1", type: "update", order: 1, nodeId: { id: "goal-conf-001" }, changes: { content: "A" } } as UpdateOperation,
      ],
      metadata: meta("2026-01-02T00:00:00Z", "u1"),
    };
    const disjoint2: Proposal = {
      id: "proposal-disjoint-2",
      status: "open",
      operations: [
        { id: "op-2", type: "update", order: 1, nodeId: { id: "goal-conf-001" }, changes: { foo: 1 } } as UpdateOperation,
      ],
      metadata: meta("2026-01-02T00:00:00Z", "u2"),
    };
    await store.createProposal(disjoint1);
    await store.createProposal(disjoint2);

    const mergeable = await store.detectConflicts("proposal-disjoint-1");
    expect(mergeable.mergeable).toContain("proposal-disjoint-2");
    expect(mergeable.needsResolution).not.toContain("proposal-disjoint-2");

    const overlap: Proposal = {
      id: "proposal-overlap",
      status: "open",
      operations: [
        { id: "op-3", type: "update", order: 1, nodeId: { id: "goal-conf-001" }, changes: { content: "B" } } as UpdateOperation,
      ],
      metadata: meta("2026-01-02T00:00:00Z", "u3"),
    };
    await store.createProposal(overlap);

    const conflicts = await store.detectConflicts("proposal-overlap");
    expect(conflicts.needsResolution.length).toBeGreaterThan(0);
    expect(conflicts.conflicts.length).toBeGreaterThan(0);

    const createProposal: Proposal = {
      id: "proposal-create-same",
      status: "open",
      operations: [
        { id: "op-create", type: "create", order: 1, node: goal } as CreateOperation,
      ],
      metadata: meta("2026-01-02T00:00:00Z", "u4"),
    };
    await store.createProposal(createProposal);
    const nodeConf = await store.detectConflicts("proposal-create-same");
    expect(nodeConf.needsResolution).toContain("proposal-disjoint-1");
  });

  it("isProposalStale should use baseVersions when provided", async () => {
    const goal: GoalNode = {
      id: { id: "goal-stale-bv" },
      type: "goal",
      status: "accepted",
      content: "v1",
      metadata: meta("2026-01-01T00:00:00Z", "u1", "2026-01-01T00:00:00Z", "u1", 1),
    };
    await createAndApply(store, "proposal-goal-stale-bv", goal);

    const baseVersionsProposal: Proposal = {
      id: "proposal-baseversions",
      status: "open",
      operations: [
        { id: "op", type: "update", order: 1, nodeId: { id: "goal-stale-bv" }, changes: { content: "v2" } } as UpdateOperation,
      ],
      metadata: {
        ...meta("2026-01-01T00:00:00Z", "u2", "2026-01-01T00:00:00Z", "u2"),
        baseVersions: { "goal-stale-bv": 1 },
      },
    };
    await store.createProposal(baseVersionsProposal);
    expect(await store.isProposalStale("proposal-baseversions")).toBe(false);

    // Apply an accepted update to bump version
    const bump: Proposal = {
      id: "proposal-bump",
      status: "accepted",
      operations: [
        { id: "opb", type: "update", order: 1, nodeId: { id: "goal-stale-bv" }, changes: { content: "v1b" } } as UpdateOperation,
      ],
      metadata: meta("2026-01-02T00:00:00Z", "u3"),
    };
    await store.createProposal(bump);
    await store.applyProposal("proposal-bump");

    expect(await store.isProposalStale("proposal-baseversions")).toBe(true);
  });

  it("applyProposal should support insert/delete text operations and move parent-child", async () => {
    const a: GoalNode = {
      id: { id: "apply-a" },
      type: "goal",
      status: "accepted",
      content: "HelloWorld",
      metadata: meta("2026-01-01T00:00:00Z", "u1"),
    };
    const p: GoalNode = {
      id: { id: "apply-parent" },
      type: "goal",
      status: "accepted",
      content: "Parent",
      metadata: meta("2026-01-01T00:00:00Z", "u1"),
    };
    await createAndApply(store, "proposal-apply-a", a);
    await createAndApply(store, "proposal-apply-parent", p);

    const insertProposal: Proposal = {
      id: "proposal-insert",
      status: "accepted",
      operations: [
        {
          id: "op-insert",
          type: "insert",
          order: 1,
          position: 5,
          text: " ",
          sourceNodeId: { id: "apply-a" },
        } as any,
      ],
      metadata: meta("2026-01-02T00:00:00Z", "u2"),
    };
    await store.createProposal(insertProposal);
    await store.applyProposal("proposal-insert");
    const afterInsert = await store.getNode({ id: "apply-a" });
    expect(afterInsert?.content).toBe("Hello World");

    const deleteProposal: Proposal = {
      id: "proposal-delete-text",
      status: "accepted",
      operations: [
        {
          id: "op-del",
          type: "delete",
          order: 1,
          start: 5,
          end: 6,
          sourceNodeId: { id: "apply-a" },
        } as any,
      ],
      metadata: meta("2026-01-03T00:00:00Z", "u3"),
    };
    await store.createProposal(deleteProposal);
    await store.applyProposal("proposal-delete-text");
    const afterDelete = await store.getNode({ id: "apply-a" });
    expect(afterDelete?.content).toBe("HelloWorld");

    const moveProposal: Proposal = {
      id: "proposal-move",
      status: "accepted",
      operations: [
        {
          id: "op-move",
          type: "move",
          order: 1,
          nodeId: { id: "apply-a" },
          target: { parentId: { id: "apply-parent" } },
        } as any,
      ],
      metadata: meta("2026-01-04T00:00:00Z", "u4"),
    };
    await store.createProposal(moveProposal);
    await store.applyProposal("proposal-move");

    const parentAfter = await store.getNode({ id: "apply-parent" });
    expect(parentAfter?.relationships?.some((r) => r.type === "parent-child" && r.target.id === "apply-a")).toBe(true);
  });

  it("applyProposal update should apply common fields, typed fields, and preserve unknown keys", async () => {
    const goal: GoalNode = {
      id: { id: "goal-update-001" },
      type: "goal",
      status: "accepted",
      content: "G0",
      metadata: meta("2026-01-01T00:00:00Z", "u1"),
    };
    const decision: DecisionNode = {
      id: { id: "decision-update-001" },
      type: "decision",
      status: "accepted",
      content: "D0",
      decision: "Use SQLite",
      rationale: "Local dev",
      metadata: meta("2026-01-01T00:00:00Z", "u1"),
    };
    const constraint: ConstraintNode = {
      id: { id: "constraint-update-001" },
      type: "constraint",
      status: "accepted",
      content: "C0",
      constraint: "Must be offline",
      metadata: meta("2026-01-01T00:00:00Z", "u1"),
    };
    const task: TaskNode = {
      id: { id: "task-update-001" },
      type: "task",
      status: "accepted",
      state: "open",
      content: "T0",
      metadata: meta("2026-01-01T00:00:00Z", "u1"),
    };
    const risk: RiskNode = {
      id: { id: "risk-update-001" },
      type: "risk",
      status: "accepted",
      content: "R0",
      severity: "low",
      likelihood: "unlikely",
      metadata: meta("2026-01-01T00:00:00Z", "u1"),
    };
    const question: QuestionNode = {
      id: { id: "question-update-001" },
      type: "question",
      status: "accepted",
      content: "Q0",
      question: "What is the plan?",
      metadata: meta("2026-01-01T00:00:00Z", "u1"),
    };
    const plan: PlanNode = {
      id: { id: "plan-update-001" },
      type: "plan",
      status: "accepted",
      content: "P0",
      metadata: meta("2026-01-01T00:00:00Z", "u1"),
    };
    const note: ContextNode = {
      id: { id: "note-update-001" },
      type: "note",
      status: "accepted",
      content: "N0",
      metadata: meta("2026-01-01T00:00:00Z", "u1"),
    };

    await createAndApply(store, "proposal-create-goal-update-001", goal);
    await createAndApply(store, "proposal-create-decision-update-001", decision);
    await createAndApply(store, "proposal-create-constraint-update-001", constraint);
    await createAndApply(store, "proposal-create-task-update-001", task);
    await createAndApply(store, "proposal-create-risk-update-001", risk);
    await createAndApply(store, "proposal-create-question-update-001", question);
    await createAndApply(store, "proposal-create-plan-update-001", plan);
    await createAndApply(store, "proposal-create-note-update-001", note);

    // Goal: common fields, typed field (criteria), and unknown key.
    await updateAndApply(store, "proposal-update-goal", { id: "goal-update-001" }, {
      content: "G1",
      status: "superseded",
      relationships: [{ type: "references", target: { id: "decision-update-001" } }],
      relations: [{ id: "constraint-update-001" }],
      referencedBy: [{ id: "task-update-001" }],
      sourceFiles: ["CONTEXT.md"],
      textRange: { start: 1, end: 2, source: "CONTEXT.md" },
      criteria: ["c1", "c2"],
      foo: 123,
    });

    const goalAfter = await store.getNode({ id: "goal-update-001" });
    expect(goalAfter?.content).toBe("G1");
    expect(goalAfter?.status).toBe("superseded");
    expect(goalAfter?.relationships?.[0].type).toBe("references");
    expect(goalAfter?.sourceFiles?.[0]).toBe("CONTEXT.md");
    expect(Reflect.get(goalAfter as object, "foo")).toBe(123);

    // Decision: typed fields (decision/rationale/alternatives) including a valid alternatives array.
    await updateAndApply(store, "proposal-update-decision", { id: "decision-update-001" }, {
      decision: "Use PostgreSQL",
      rationale: "Durability",
      alternatives: ["SQLite", "MySQL"],
      decidedAt: "2026-01-05T00:00:00Z",
    });
    const decisionAfter = await store.getNode({ id: "decision-update-001" });
    expect(Reflect.get(decisionAfter as object, "decision")).toBe("Use PostgreSQL");
    expect(Reflect.get(decisionAfter as object, "rationale")).toBe("Durability");

    // Constraint: update constraint/reason
    await updateAndApply(store, "proposal-update-constraint", { id: "constraint-update-001" }, {
      constraint: "Must be offline-first",
      reason: "Privacy",
    });
    const constraintAfter = await store.getNode({ id: "constraint-update-001" });
    expect(Reflect.get(constraintAfter as object, "constraint")).toBe("Must be offline-first");
    expect(Reflect.get(constraintAfter as object, "reason")).toBe("Privacy");

    // Task: invalid state should be ignored; valid assignee/dependencies should apply
    await updateAndApply(store, "proposal-update-task", { id: "task-update-001" }, {
      state: "not-a-real-state",
      assignee: "alice",
      dependencies: [{ id: "task-update-001" }],
    });
    const taskAfter = await store.getNode({ id: "task-update-001" });
    expect(Reflect.get(taskAfter as object, "state")).toBe("open");
    expect(Reflect.get(taskAfter as object, "assignee")).toBe("alice");

    // Risk: invalid severity ignored; valid mitigation applied
    await updateAndApply(store, "proposal-update-risk", { id: "risk-update-001" }, {
      severity: "extreme",
      mitigation: "Monitor",
    });
    const riskAfter = await store.getNode({ id: "risk-update-001" });
    expect(Reflect.get(riskAfter as object, "severity")).toBe("low");
    expect(Reflect.get(riskAfter as object, "mitigation")).toBe("Monitor");

    // Question: typed fields applied
    await updateAndApply(store, "proposal-update-question", { id: "question-update-001" }, {
      answer: "The plan is to test everything.",
      answeredAt: "2026-01-06T00:00:00Z",
    });
    const questionAfter = await store.getNode({ id: "question-update-001" });
    expect(Reflect.get(questionAfter as object, "answer")).toBe("The plan is to test everything.");

    // Plan: steps applied
    await updateAndApply(store, "proposal-update-plan", { id: "plan-update-001" }, {
      steps: [{ description: "Step 1", order: 1, references: [{ id: "goal-update-001" }] }],
    });
    const planAfter = await store.getNode({ id: "plan-update-001" });
    expect(Array.isArray(Reflect.get(planAfter as object, "steps"))).toBe(true);

    // Default type: still applies content and unknown fields
    await updateAndApply(store, "proposal-update-note", { id: "note-update-001" }, {
      content: "N1",
      bar: "baz",
    });
    const noteAfter = await store.getNode({ id: "note-update-001" });
    expect(noteAfter?.content).toBe("N1");
    expect(Reflect.get(noteAfter as object, "bar")).toBe("baz");
  });
});

