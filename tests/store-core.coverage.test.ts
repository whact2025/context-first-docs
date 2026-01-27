import { describe, expect, it } from "@jest/globals";

import { applyAcceptedProposalToNodeMap } from "../src/store/core/apply-proposal.js";
import {
  detectConflictsForProposal,
  isProposalStale,
  mergeProposals,
} from "../src/store/core/conflicts.js";
import { queryNodesInMemory } from "../src/store/core/query-nodes.js";

import type { AnyNode, GoalNode, NodeId, DecisionNode } from "../src/types/node.js";
import type { Proposal } from "../src/types/proposal.js";

function meta(
  createdAt: string,
  createdBy = "user",
  modifiedAt = createdAt,
  modifiedBy = createdBy,
  version = 1
) {
  return { createdAt, createdBy, modifiedAt, modifiedBy, version };
}

function keyOf(id: NodeId): string {
  return id.namespace ? `${id.namespace}:${id.id}` : id.id;
}

function indexByKey(nodes: AnyNode[]) {
  const map = new Map<string, AnyNode>(nodes.map((n) => [keyOf(n.id), n]));
  return {
    map,
    getNodeByKey: (k: string) => map.get(k) || null,
  };
}

describe("store core (coverage)", () => {
  describe("applyAcceptedProposalToNodeMap", () => {
    it("should apply create/update/status-change/delete(node) operations", () => {
      const nodes = new Map<string, AnyNode>();

      const g1: GoalNode = {
        id: { id: "g1" },
        type: "goal",
        status: "accepted",
        content: "hello",
        metadata: meta("2026-01-01T00:00:00Z", "u1"),
      };

      const create: Proposal = {
        id: "p-create",
        status: "accepted",
        operations: [{ id: "op1", type: "create", order: 1, node: g1 }],
        metadata: meta("2026-01-01T00:00:00Z", "u1", "2026-01-02T00:00:00Z", "u1"),
      };

      applyAcceptedProposalToNodeMap(nodes, create, { keyOf });
      expect(nodes.get("g1")?.content).toBe("hello");

      const update: Proposal = {
        id: "p-update",
        status: "accepted",
        operations: [
          {
            id: "op1",
            type: "update",
            order: 1,
            nodeId: { id: "g1" },
            changes: { content: "hello2", criteria: ["c1"] },
          },
        ],
        metadata: meta("2026-01-03T00:00:00Z", "u2", "2026-01-03T00:00:00Z", "u2"),
      };
      applyAcceptedProposalToNodeMap(nodes, update, { keyOf });
      expect(nodes.get("g1")?.content).toBe("hello2");
      expect(Reflect.get(nodes.get("g1") as object, "criteria")).toEqual(["c1"]);

      const statusChange: Proposal = {
        id: "p-status",
        status: "accepted",
        operations: [
          {
            id: "op1",
            type: "status-change",
            order: 1,
            nodeId: { id: "g1" },
            oldStatus: "accepted",
            newStatus: "superseded",
          },
        ],
        metadata: meta("2026-01-04T00:00:00Z", "u3", "2026-01-04T00:00:00Z", "u3"),
      };
      applyAcceptedProposalToNodeMap(nodes, statusChange, { keyOf });
      expect(nodes.get("g1")?.status).toBe("superseded");

      const del: Proposal = {
        id: "p-del",
        status: "accepted",
        operations: [{ id: "op1", type: "delete", order: 1, nodeId: { id: "g1" } }],
        metadata: meta("2026-01-05T00:00:00Z", "u4", "2026-01-05T00:00:00Z", "u4"),
      };
      applyAcceptedProposalToNodeMap(nodes, del, { keyOf });
      expect(nodes.get("g1")?.status).toBe("rejected");
    });

    it("should apply insert/delete(text) operations and throw on invalid ranges", () => {
      const nodes = new Map<string, AnyNode>();
      const g1: GoalNode = {
        id: { id: "g1" },
        type: "goal",
        status: "accepted",
        content: "HelloWorld",
        metadata: meta("2026-01-01T00:00:00Z", "u1"),
      };
      nodes.set("g1", g1);

      const insert: Proposal = {
        id: "p-insert",
        status: "accepted",
        operations: [
          { id: "op1", type: "insert", order: 1, position: 5, text: " ", sourceNodeId: { id: "g1" } },
        ],
        metadata: meta("2026-01-02T00:00:00Z", "u2", "2026-01-02T00:00:00Z", "u2"),
      };
      applyAcceptedProposalToNodeMap(nodes, insert, { keyOf });
      expect(nodes.get("g1")?.content).toBe("Hello World");

      const delText: Proposal = {
        id: "p-deltext",
        status: "accepted",
        operations: [
          { id: "op1", type: "delete", order: 1, start: 5, end: 6, sourceNodeId: { id: "g1" } },
        ],
        metadata: meta("2026-01-03T00:00:00Z", "u3", "2026-01-03T00:00:00Z", "u3"),
      };
      applyAcceptedProposalToNodeMap(nodes, delText, { keyOf });
      expect(nodes.get("g1")?.content).toBe("HelloWorld");

      const badInsertMissing: Proposal = {
        id: "p-bad-insert",
        status: "accepted",
        operations: [{ id: "op1", type: "insert", order: 1, position: 0, text: "x" }],
        metadata: meta("2026-01-04T00:00:00Z", "u4", "2026-01-04T00:00:00Z", "u4"),
      };
      expect(() => applyAcceptedProposalToNodeMap(nodes, badInsertMissing, { keyOf })).toThrow(
        "missing sourceNodeId"
      );

      const badInsertBounds: Proposal = {
        id: "p-bad-insert-bounds",
        status: "accepted",
        operations: [{ id: "op1", type: "insert", order: 1, position: 999, text: "x", sourceNodeId: { id: "g1" } }],
        metadata: meta("2026-01-04T00:00:00Z", "u4", "2026-01-04T00:00:00Z", "u4"),
      };
      expect(() => applyAcceptedProposalToNodeMap(nodes, badInsertBounds, { keyOf })).toThrow(
        "out of bounds"
      );

      const badDeleteMissing: Proposal = {
        id: "p-bad-del-missing",
        status: "accepted",
        operations: [{ id: "op1", type: "delete", order: 1, start: 0, end: 1 }],
        metadata: meta("2026-01-05T00:00:00Z", "u5", "2026-01-05T00:00:00Z", "u5"),
      };
      expect(() => applyAcceptedProposalToNodeMap(nodes, badDeleteMissing, { keyOf })).toThrow(
        "missing sourceNodeId"
      );

      const badDeleteBounds: Proposal = {
        id: "p-bad-del-bounds",
        status: "accepted",
        operations: [{ id: "op1", type: "delete", order: 1, start: 0, end: 999, sourceNodeId: { id: "g1" } }],
        metadata: meta("2026-01-05T00:00:00Z", "u5", "2026-01-05T00:00:00Z", "u5"),
      };
      expect(() => applyAcceptedProposalToNodeMap(nodes, badDeleteBounds, { keyOf })).toThrow(
        "out of bounds"
      );
    });

    it("should apply move and remove prior parent-child edges; error when parent missing", () => {
      const nodes = new Map<string, AnyNode>();

      const child: GoalNode = {
        id: { id: "child" },
        type: "goal",
        status: "accepted",
        content: "child",
        metadata: meta("2026-01-01T00:00:00Z", "u1"),
      };
      const oldParent: GoalNode = {
        id: { id: "old-parent" },
        type: "goal",
        status: "accepted",
        content: "old",
        metadata: meta("2026-01-01T00:00:00Z", "u1"),
        relationships: [{ type: "parent-child", target: { id: "child" } }],
      };
      const newParent: GoalNode = {
        id: { id: "new-parent" },
        type: "goal",
        status: "accepted",
        content: "new",
        metadata: meta("2026-01-01T00:00:00Z", "u1"),
      };

      nodes.set("child", child);
      nodes.set("old-parent", oldParent);
      nodes.set("new-parent", newParent);

      const move: Proposal = {
        id: "p-move",
        status: "accepted",
        operations: [
          { id: "op1", type: "move", order: 1, nodeId: { id: "child" }, target: { parentId: { id: "new-parent" } } },
        ],
        metadata: meta("2026-01-02T00:00:00Z", "u2", "2026-01-02T00:00:00Z", "u2"),
      };

      applyAcceptedProposalToNodeMap(nodes, move, { keyOf });

      const oldAfter = nodes.get("old-parent")!;
      expect(oldAfter.relationships?.some((r) => r.type === "parent-child" && r.target.id === "child")).toBe(false);

      const newAfter = nodes.get("new-parent")!;
      expect(newAfter.relationships?.some((r) => r.type === "parent-child" && r.target.id === "child")).toBe(true);

      const badMove: Proposal = {
        id: "p-bad-move",
        status: "accepted",
        operations: [
          { id: "op1", type: "move", order: 1, nodeId: { id: "child" }, target: { parentId: { id: "missing" } } },
        ],
        metadata: meta("2026-01-03T00:00:00Z", "u3", "2026-01-03T00:00:00Z", "u3"),
      };
      expect(() => applyAcceptedProposalToNodeMap(nodes, badMove, { keyOf })).toThrow("Parent missing");
    });
  });

  describe("conflicts core", () => {
    it("detectConflictsForProposal should classify mergeable vs conflicts", () => {
      const base: Proposal = {
        id: "p1",
        status: "open",
        operations: [{ id: "op", type: "update", order: 1, nodeId: { id: "n1" }, changes: { content: "A" } }],
        metadata: meta("2026-01-01T00:00:00Z", "u1"),
      };
      const disjoint: Proposal = {
        id: "p2",
        status: "open",
        operations: [{ id: "op", type: "update", order: 1, nodeId: { id: "n1" }, changes: { foo: 1 } }],
        metadata: meta("2026-01-01T00:00:00Z", "u2"),
      };
      const overlap: Proposal = {
        id: "p3",
        status: "open",
        operations: [{ id: "op", type: "update", order: 1, nodeId: { id: "n1" }, changes: { content: "B" } }],
        metadata: meta("2026-01-01T00:00:00Z", "u3"),
      };
      const createOp: Proposal = {
        id: "p4",
        status: "open",
        operations: [
          {
            id: "op",
            type: "create",
            order: 1,
            node: {
              id: { id: "n1" },
              type: "goal",
              status: "accepted",
              content: "x",
              metadata: meta("2026-01-01T00:00:00Z"),
            },
          },
        ],
        metadata: meta("2026-01-01T00:00:00Z", "u4"),
      };

      const resDisjoint = detectConflictsForProposal(base, [base, disjoint], { keyOf });
      expect(resDisjoint.mergeable).toContain("p2");
      expect(resDisjoint.conflicts).toHaveLength(0);

      const resOverlap = detectConflictsForProposal(overlap, [base, overlap], { keyOf });
      expect(resOverlap.conflicts.length).toBeGreaterThan(0);
      expect(resOverlap.conflicts[0].severity).toBe("field");

      const resNode = detectConflictsForProposal(createOp, [base, createOp], { keyOf });
      expect(resNode.conflicts.length).toBeGreaterThan(0);
      expect(resNode.conflicts[0].severity).toBe("node");
    });

    it("detectConflictsForProposal should mark different-node proposals as mergeable", () => {
      const pA: Proposal = {
        id: "pa",
        status: "open",
        operations: [{ id: "op", type: "update", order: 1, nodeId: { id: "n1" }, changes: { content: "A" } }],
        metadata: meta("2026-01-01T00:00:00Z", "u1"),
      };
      const pB: Proposal = {
        id: "pb",
        status: "open",
        operations: [{ id: "op", type: "update", order: 1, nodeId: { id: "n2" }, changes: { content: "B" } }],
        metadata: meta("2026-01-01T00:00:00Z", "u2"),
      };

      const res = detectConflictsForProposal(pA, [pA, pB], { keyOf });
      expect(res.mergeable).toContain("pb");
      expect(res.conflicts).toHaveLength(0);
    });

    it("detectConflictsForProposal should treat non-update ops as node conflicts (insert/delete-text/move/delete)", () => {
      const pInsert: Proposal = {
        id: "p-insert",
        status: "open",
        operations: [{ id: "op", type: "insert", order: 1, position: 0, text: "x", sourceNodeId: { id: "n1" } }],
        metadata: meta("2026-01-01T00:00:00Z", "u1"),
      };
      const pDeleteText: Proposal = {
        id: "p-del-text",
        status: "open",
        operations: [{ id: "op", type: "delete", order: 1, start: 0, end: 1, sourceNodeId: { id: "n1" } }],
        metadata: meta("2026-01-01T00:00:00Z", "u2"),
      };
      const pMove: Proposal = {
        id: "p-move",
        status: "open",
        operations: [{ id: "op", type: "move", order: 1, nodeId: { id: "n1" }, target: { parentId: { id: "p" } } }],
        metadata: meta("2026-01-01T00:00:00Z", "u3"),
      };
      const pDeleteNode: Proposal = {
        id: "p-del-node",
        status: "open",
        operations: [{ id: "op", type: "delete", order: 1, nodeId: { id: "n1" } }],
        metadata: meta("2026-01-01T00:00:00Z", "u4"),
      };

      const res = detectConflictsForProposal(pInsert, [pInsert, pDeleteText, pMove, pDeleteNode], { keyOf });
      expect(res.conflicts.length).toBeGreaterThan(0);
      expect(res.conflicts.some((c) => c.severity === "node")).toBe(true);

      // Ensure we also cover the "no conflictingFields" case for node conflicts
      const nodeOnly = res.conflicts.find((c) => c.severity === "node");
      expect(nodeOnly?.conflictingFields).toBeUndefined();
    });

    it("isProposalStale should check baseVersions and fallback modifiedAt", () => {
      const node: GoalNode = {
        id: { id: "n1" },
        type: "goal",
        status: "accepted",
        content: "x",
        metadata: meta("2026-01-01T00:00:00Z", "u1", "2026-01-01T00:00:00Z", "u1", 2),
      };
      const nodeMap = new Map<string, AnyNode>([[keyOf(node.id), node]]);

      const withBase: Proposal = {
        id: "p",
        status: "open",
        operations: [{ id: "op", type: "update", order: 1, nodeId: { id: "n1" }, changes: { content: "y" } }],
        metadata: {
          ...meta("2026-01-02T00:00:00Z", "u2"),
          baseVersions: { n1: 2 },
        },
      };
      expect(
        isProposalStale(withBase, { keyOf, getNode: (id) => nodeMap.get(keyOf(id)) || null })
      ).toBe(false);

      const staleBase: Proposal = {
        ...withBase,
        metadata: { ...withBase.metadata, baseVersions: { n1: 1 } },
      };
      expect(
        isProposalStale(staleBase, { keyOf, getNode: (id) => nodeMap.get(keyOf(id)) || null })
      ).toBe(true);

      const fallbackOk: Proposal = {
        id: "p2",
        status: "open",
        operations: [{ id: "op", type: "update", order: 1, nodeId: { id: "n1" }, changes: { content: "y" } }],
        metadata: meta("2026-01-10T00:00:00Z", "u3"),
      };
      expect(
        isProposalStale(fallbackOk, { keyOf, getNode: (id) => nodeMap.get(keyOf(id)) || null })
      ).toBe(false);

      const fallbackStale: Proposal = {
        ...fallbackOk,
        metadata: meta("2025-12-31T00:00:00Z", "u3"),
      };
      expect(
        isProposalStale(fallbackStale, { keyOf, getNode: (id) => nodeMap.get(keyOf(id)) || null })
      ).toBe(true);
    });

    it("isProposalStale should skip baseVersions entries when missing and return true when node missing", () => {
      const node: GoalNode = {
        id: { id: "n1" },
        type: "goal",
        status: "accepted",
        content: "x",
        metadata: meta("2026-01-01T00:00:00Z", "u1", "2026-01-01T00:00:00Z", "u1", 1),
      };
      const nodeMap = new Map<string, AnyNode>([[keyOf(node.id), node]]);

      // baseVersions doesn't include n1 => should ignore and return false
      const missingBaseEntry: Proposal = {
        id: "p-missing-base",
        status: "open",
        operations: [{ id: "op", type: "update", order: 1, nodeId: { id: "n1" }, changes: { content: "y" } }],
        metadata: { ...meta("2026-01-02T00:00:00Z", "u2"), baseVersions: { other: 1 } },
      };
      expect(isProposalStale(missingBaseEntry, { keyOf, getNode: (id) => nodeMap.get(keyOf(id)) || null })).toBe(false);

      // baseVersions includes n1, but node missing => stale
      const nodeMissing: Proposal = {
        id: "p-node-missing",
        status: "open",
        operations: [{ id: "op", type: "update", order: 1, nodeId: { id: "missing" }, changes: { content: "y" } }],
        metadata: { ...meta("2026-01-02T00:00:00Z", "u2"), baseVersions: { missing: 1 } },
      };
      expect(isProposalStale(nodeMissing, { keyOf, getNode: () => null })).toBe(true);
    });

    it("isProposalStale should use namespaced baseVersions keys (keyOf) when present", () => {
      const node: GoalNode = {
        id: { id: "n1", namespace: "ns" },
        type: "goal",
        status: "accepted",
        content: "x",
        metadata: meta("2026-01-01T00:00:00Z", "u1", "2026-01-01T00:00:00Z", "u1", 7),
      };
      const nodeMap = new Map<string, AnyNode>([[keyOf(node.id), node]]);

      const p: Proposal = {
        id: "p-ns",
        status: "open",
        operations: [{ id: "op", type: "update", order: 1, nodeId: node.id, changes: { content: "y" } }],
        metadata: { ...meta("2026-01-02T00:00:00Z", "u2"), baseVersions: { [keyOf(node.id)]: 7 } },
      };
      expect(isProposalStale(p, { keyOf, getNode: (id) => nodeMap.get(keyOf(id)) || null })).toBe(false);
    });

    it("isProposalStale fallback should ignore missing nodes and still return false", () => {
      const p: Proposal = {
        id: "p-fallback-missing",
        status: "open",
        operations: [{ id: "op", type: "update", order: 1, nodeId: { id: "missing" }, changes: { content: "x" } }],
        metadata: meta("2026-01-02T00:00:00Z", "u1"),
      };
      expect(isProposalStale(p, { keyOf, getNode: () => null })).toBe(false);
    });

    it("mergeProposals should produce autoMerged and conflicts", () => {
      const baseNode: DecisionNode = {
        id: { id: "d1" },
        type: "decision",
        status: "accepted",
        content: "c",
        decision: "A",
        rationale: "R",
        metadata: meta("2026-01-01T00:00:00Z"),
      };
      const nodeMap = new Map<string, AnyNode>([[keyOf(baseNode.id), baseNode]]);

      const p1: Proposal = {
        id: "p1",
        status: "open",
        operations: [{ id: "op", type: "update", order: 1, nodeId: { id: "d1" }, changes: { decision: "B" } }],
        metadata: meta("2026-01-02T00:00:00Z", "u1"),
      };
      const p2: Proposal = {
        id: "p2",
        status: "open",
        operations: [{ id: "op", type: "update", order: 1, nodeId: { id: "d1" }, changes: { rationale: "R2" } }],
        metadata: meta("2026-01-02T00:00:00Z", "u2"),
      };
      const merged = mergeProposals([p1, p2], {
        keyOf,
        getNodeByKey: (k) => nodeMap.get(k) || null,
      });
      expect(merged.conflicts).toHaveLength(0);
      expect(merged.autoMerged.length).toBeGreaterThanOrEqual(2);

      const p3: Proposal = {
        id: "p3",
        status: "open",
        operations: [{ id: "op", type: "update", order: 1, nodeId: { id: "d1" }, changes: { decision: "C" } }],
        metadata: meta("2026-01-02T00:00:00Z", "u3"),
      };
      const merged2 = mergeProposals([p1, p3], {
        keyOf,
        getNodeByKey: (k) => nodeMap.get(k) || null,
      });
      expect(merged2.conflicts.length).toBeGreaterThan(0);
    });

    it("mergeProposals should detect status-change collisions", () => {
      const base: GoalNode = {
        id: { id: "g" },
        type: "goal",
        status: "accepted",
        content: "x",
        metadata: meta("2026-01-01T00:00:00Z"),
      };
      const nodeMap = new Map<string, AnyNode>([[keyOf(base.id), base]]);

      const p1: Proposal = {
        id: "p1",
        status: "open",
        operations: [
          { id: "op", type: "status-change", order: 1, nodeId: { id: "g" }, oldStatus: "accepted", newStatus: "rejected" },
        ],
        metadata: meta("2026-01-02T00:00:00Z", "u1"),
      };
      const p2: Proposal = {
        id: "p2",
        status: "open",
        operations: [
          { id: "op", type: "status-change", order: 1, nodeId: { id: "g" }, oldStatus: "accepted", newStatus: "superseded" },
        ],
        metadata: meta("2026-01-02T00:00:00Z", "u2"),
      };

      const res = mergeProposals([p1, p2], { keyOf, getNodeByKey: (k) => nodeMap.get(k) || null });
      expect(res.conflicts.length).toBeGreaterThan(0);
    });

    it("mergeProposals should return empty result when no proposals", () => {
      const res = mergeProposals([], { keyOf, getNodeByKey: () => null });
      expect(res.merged).toHaveLength(0);
      expect(res.conflicts).toHaveLength(0);
      expect(res.autoMerged).toHaveLength(0);
    });

    it("mergeProposals should set oldValue undefined when base node missing", () => {
      const p1: Proposal = {
        id: "p1",
        status: "open",
        operations: [{ id: "op", type: "update", order: 1, nodeId: { id: "missing" }, changes: { foo: 1 } }],
        metadata: meta("2026-01-02T00:00:00Z", "u1"),
      };

      const res = mergeProposals([p1], { keyOf, getNodeByKey: () => null });
      expect(res.autoMerged).toHaveLength(1);
      expect(res.autoMerged[0].oldValue).toBeUndefined();
    });

    it("mergeProposals should auto-merge a single status-change and report oldValue from base node", () => {
      const base: GoalNode = {
        id: { id: "g1" },
        type: "goal",
        status: "accepted",
        content: "x",
        metadata: meta("2026-01-01T00:00:00Z"),
      };
      const nodeMap = new Map<string, AnyNode>([[keyOf(base.id), base]]);

      const p: Proposal = {
        id: "p",
        status: "open",
        operations: [
          { id: "op", type: "status-change", order: 1, nodeId: { id: "g1" }, oldStatus: "accepted", newStatus: "rejected" },
        ],
        metadata: meta("2026-01-02T00:00:00Z", "u1"),
      };

      const res = mergeProposals([p], { keyOf, getNodeByKey: (k) => nodeMap.get(k) || null });
      expect(res.conflicts).toHaveLength(0);
      expect(res.autoMerged).toHaveLength(1);
      expect(res.autoMerged[0].field).toBe("status");
      expect(res.autoMerged[0].oldValue).toBe("accepted");
      expect(res.autoMerged[0].newValue).toBe("rejected");
    });
  });

  describe("queryNodesInMemory", () => {
    it("should support search + relevance sort + pagination", () => {
      const a: GoalNode = {
        id: { id: "a" },
        type: "goal",
        status: "accepted",
        content: "foo foo bar",
        metadata: meta("2026-01-01T00:00:00Z"),
      };
      const b: GoalNode = {
        id: { id: "b" },
        type: "goal",
        status: "accepted",
        content: "foo bar",
        metadata: meta("2026-01-01T00:00:00Z"),
      };

      const result = queryNodesInMemory(
        { search: "foo", sortBy: "relevance", sortOrder: "desc", limit: 1, offset: 0 },
        {
          nodes: [a, b],
          keyOf,
          getNodeByKey: () => null,
        }
      );
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id.id).toBe("a");
      expect(result.hasMore).toBe(true);
    });

    it("should support status/type/tag/namespace/date filters and sort fields", () => {
      const n1: GoalNode = {
        id: { id: "n1", namespace: "arch" },
        type: "goal",
        status: "accepted",
        content: "alpha",
        metadata: { ...meta("2026-01-01T00:00:00Z"), tags: ["t1", "t2"] },
      };
      const n2: GoalNode = {
        id: { id: "n2", namespace: "arch" },
        type: "goal",
        status: "proposed",
        content: "beta",
        metadata: { ...meta("2026-01-02T00:00:00Z", "u2", "2026-01-03T00:00:00Z", "u2"), tags: ["t1"] },
      };
      const n3: GoalNode = {
        id: { id: "n3", namespace: "other" },
        type: "goal",
        status: "accepted",
        content: "gamma",
        metadata: meta("2026-01-04T00:00:00Z", "u3", "2026-01-05T00:00:00Z", "u3"),
      };

      const { getNodeByKey } = indexByKey([n1, n2, n3]);

      // default status filter should exclude proposed
      const defaultStatus = queryNodesInMemory({ type: ["goal"] }, { nodes: [n1, n2, n3], keyOf, getNodeByKey });
      expect(defaultStatus.nodes.map((x) => x.id.id)).toEqual(expect.arrayContaining(["n1", "n3"]));
      expect(defaultStatus.nodes.map((x) => x.id.id)).not.toContain("n2");

      const filtered = queryNodesInMemory(
        {
          status: ["accepted", "proposed"],
          type: ["goal"],
          namespace: "arch",
          tags: ["t1"],
          createdAfter: "2026-01-01T00:00:00Z",
          createdBefore: "2026-01-03T00:00:00Z",
          sortBy: "createdAt",
          sortOrder: "asc",
        },
        { nodes: [n1, n2, n3], keyOf, getNodeByKey }
      );
      expect(filtered.nodes.map((x) => x.id.id)).toEqual(["n1", "n2"]);
    });

    it("should support advanced search fields/operator/fuzzy and relationship filters", () => {
      const goal: GoalNode = {
        id: { id: "goal-1" },
        type: "goal",
        status: "accepted",
        content: "Goal content",
        metadata: meta("2026-01-01T00:00:00Z"),
      };
      const decision: DecisionNode = {
        id: { id: "decision-1" },
        type: "decision",
        status: "accepted",
        content: "content does not mention db",
        decision: "Use PostgreSQL",
        rationale: "Durability",
        metadata: meta("2026-01-01T00:00:00Z"),
        relationships: [{ type: "references", target: { id: "goal-1" } }],
      };
      const task: AnyNode = {
        id: { id: "task-1" },
        type: "task",
        status: "accepted",
        content: "Implement it",
        state: "open",
        metadata: meta("2026-01-01T00:00:00Z"),
        relationships: [
          { type: "implements", target: { id: "goal-1" } },
          { type: "depends-on", target: { id: "task-2" } },
        ],
      } as AnyNode;
      const task2: AnyNode = {
        id: { id: "task-2" },
        type: "task",
        status: "accepted",
        content: "Dependency",
        state: "open",
        metadata: meta("2026-01-01T00:00:00Z"),
      } as AnyNode;

      const nodes = [goal, decision, task, task2];
      const { getNodeByKey } = indexByKey(nodes);

      const fieldsOnly = queryNodesInMemory(
        { status: ["accepted"], search: { query: "postgresql", fields: ["decision"] } },
        { nodes, keyOf, getNodeByKey }
      );
      expect(fieldsOnly.nodes.map((n) => n.id.id)).toContain("decision-1");

      const orQuery = queryNodesInMemory(
        { status: ["accepted"], search: { query: "missing postgresql", operator: "OR", fields: ["decision"] } },
        { nodes, keyOf, getNodeByKey }
      );
      expect(orQuery.nodes.map((n) => n.id.id)).toContain("decision-1");

      const fuzzy = queryNodesInMemory(
        { status: ["accepted"], search: { query: "postgrexql", fuzzy: true, fields: ["decision"] } },
        { nodes, keyOf, getNodeByKey }
      );
      expect(fuzzy.nodes.map((n) => n.id.id)).toContain("decision-1");

      // relationshipTypes filter: outgoing implements should include task-1
      const outgoingImplements = queryNodesInMemory(
        { status: ["accepted"], relationshipTypes: ["implements"], direction: "outgoing" },
        { nodes, keyOf, getNodeByKey }
      );
      expect(outgoingImplements.nodes.map((n) => n.id.id)).toContain("task-1");

      // relationshipTypes filter: incoming implements should include goal-1
      const incomingImplements = queryNodesInMemory(
        { status: ["accepted"], relationshipTypes: ["implements"], direction: "incoming" },
        { nodes, keyOf, getNodeByKey }
      );
      expect(incomingImplements.nodes.map((n) => n.id.id)).toContain("goal-1");

      // relatedTo traversal: from goal-1, both directions should see decision/task
      const relatedTo = queryNodesInMemory(
        { status: ["accepted"], relatedTo: { id: "goal-1" }, depth: 1, direction: "both" },
        { nodes, keyOf, getNodeByKey }
      );
      expect(relatedTo.nodes.map((n) => n.id.id)).toEqual(expect.arrayContaining(["decision-1", "task-1"]));

      // descendants/ancestors via parent-child
      const parent: GoalNode = {
        id: { id: "parent" },
        type: "goal",
        status: "accepted",
        content: "p",
        metadata: meta("2026-01-01T00:00:00Z"),
        relationships: [{ type: "parent-child", target: { id: "child" } }],
      };
      const child: GoalNode = {
        id: { id: "child" },
        type: "goal",
        status: "accepted",
        content: "c",
        metadata: meta("2026-01-01T00:00:00Z"),
      };
      const nodes2 = [...nodes, parent, child];
      const { getNodeByKey: get2 } = indexByKey(nodes2);

      const descendants = queryNodesInMemory(
        { status: ["accepted"], descendantsOf: { id: "parent" } },
        { nodes: nodes2, keyOf, getNodeByKey: get2 }
      );
      expect(descendants.nodes.map((n) => n.id.id)).toContain("child");

      const ancestors = queryNodesInMemory(
        { status: ["accepted"], ancestorsOf: { id: "child" } },
        { nodes: nodes2, keyOf, getNodeByKey: get2 }
      );
      expect(ancestors.nodes.map((n) => n.id.id)).toContain("parent");

      const dependencies = queryNodesInMemory(
        { status: ["accepted"], dependenciesOf: { id: "task-1" } },
        { nodes, keyOf, getNodeByKey }
      );
      expect(dependencies.nodes.map((n) => n.id.id)).toContain("task-2");

      const dependents = queryNodesInMemory(
        { status: ["accepted"], dependentsOf: { id: "task-2" } },
        { nodes, keyOf, getNodeByKey }
      );
      expect(dependents.nodes.map((n) => n.id.id)).toContain("task-1");

      const hasOutgoing = queryNodesInMemory(
        { status: ["accepted"], hasRelationship: { type: "implements", targetType: ["goal"], direction: "outgoing" } },
        { nodes, keyOf, getNodeByKey }
      );
      expect(hasOutgoing.nodes.map((n) => n.id.id)).toContain("task-1");

      const hasIncoming = queryNodesInMemory(
        { status: ["accepted"], hasRelationship: { type: "implements", targetType: ["task"], direction: "incoming" } },
        { nodes, keyOf, getNodeByKey }
      );
      expect(hasIncoming.nodes.map((n) => n.id.id)).toContain("goal-1");

      // sort by type/status and modifiedAt codepaths
      const sortType = queryNodesInMemory(
        { status: ["accepted"], sortBy: "type", sortOrder: "asc" },
        { nodes, keyOf, getNodeByKey }
      );
      expect(sortType.nodes.length).toBeGreaterThan(0);

      const sortStatus = queryNodesInMemory(
        { status: ["accepted"], sortBy: "status", sortOrder: "asc" },
        { nodes, keyOf, getNodeByKey }
      );
      expect(sortStatus.nodes.length).toBeGreaterThan(0);

      const sortModified = queryNodesInMemory(
        { status: ["accepted"], sortBy: "modifiedAt", sortOrder: "desc" },
        { nodes, keyOf, getNodeByKey }
      );
      expect(sortModified.nodes.length).toBeGreaterThan(0);
    });
  });
});

