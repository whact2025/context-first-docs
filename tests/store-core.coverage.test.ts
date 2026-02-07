import { describe, expect, it } from "@jest/globals";

import { applyAcceptedProposalToNodeMap } from "../src/store/core/apply-proposal.js";
import {
  buildEdgeIndex,
  traverseRelatedKeys,
  getAncestors,
  getDescendants,
  getDependencies,
  getDependents,
} from "../src/store/core/graph.js";

import type { AnyNode, GoalNode, NodeId } from "../src/types/node.js";
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
            changes: { title: "T", content: "hello2", criteria: ["c1"] },
          },
        ],
        metadata: meta("2026-01-03T00:00:00Z", "u2", "2026-01-03T00:00:00Z", "u2"),
      };
      applyAcceptedProposalToNodeMap(nodes, update, { keyOf });
      expect(nodes.get("g1")?.content).toBe("T hello2");
      expect(nodes.get("g1")?.title).toBe("T");
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
        // pre-existing parent-child edge to cover "has" predicate branch in apply-proposal
        relationships: [
          { type: "parent-child", target: { id: "other-child" } },
          { type: "parent-child", target: { id: "child" } },
        ],
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
      const relCount =
        newAfter.relationships?.filter((r) => r.type === "parent-child" && r.target.id === "child").length ?? 0;
      expect(relCount).toBe(1);

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

  describe("graph core", () => {
    it("buildEdgeIndex + traverseRelatedKeys should support direction, allowed types, and depth", () => {
      const a: GoalNode = {
        id: { id: "a" },
        type: "goal",
        status: "accepted",
        content: "a",
        metadata: meta("2026-01-01T00:00:00Z"),
        relationships: [
          { type: "related-to", target: { id: "b" } },
          { type: "depends-on", target: { id: "c" } },
        ],
      };
      const b: GoalNode = {
        id: { id: "b" },
        type: "goal",
        status: "accepted",
        content: "b",
        metadata: meta("2026-01-01T00:00:00Z"),
        relationships: [{ type: "related-to", target: { id: "a" } }],
      };
      const c: GoalNode = {
        id: { id: "c" },
        type: "goal",
        status: "accepted",
        content: "c",
        metadata: meta("2026-01-01T00:00:00Z"),
      };

      // Use default keying (don't pass keyOf) to cover defaultNodeKey branch.
      const idx = buildEdgeIndex([a, b, c]);

      const depth0 = traverseRelatedKeys({ id: "a" }, 0, "both", idx, null);
      expect(Array.from(depth0)).toEqual([]); // depth 0 yields no related keys

      const onlyRelated = traverseRelatedKeys({ id: "a" }, 2, "outgoing", idx, new Set(["related-to"]));
      expect(onlyRelated.has("b")).toBe(true);
      expect(onlyRelated.has("c")).toBe(false);

      const incomingRelated = traverseRelatedKeys({ id: "a" }, 1, "incoming", idx, new Set(["related-to"]));
      expect(incomingRelated.has("b")).toBe(true);
    });

    it("getDescendants/getDependencies should handle missing starts and empty relationships", () => {
      const nodesByKey = new Map<string, AnyNode>();
      const getNodeByKey = (k: string) => nodesByKey.get(k) || null;

      const none = getDescendants(getNodeByKey, { id: "missing" }, "parent-child");
      expect(none).toEqual([]);

      const a: GoalNode = {
        id: { id: "a" },
        type: "goal",
        status: "accepted",
        content: "a",
        metadata: meta("2026-01-01T00:00:00Z"),
      };
      nodesByKey.set("a", a);
      expect(getDependencies(getNodeByKey, { id: "a" })).toEqual([]);
    });

    it("graph helpers should handle duplicates/cycles without infinite loops", () => {
      const a: GoalNode = {
        id: { id: "a" },
        type: "goal",
        status: "accepted",
        content: "a",
        metadata: meta("2026-01-01T00:00:00Z"),
        // duplicate edges
        relationships: [
          { type: "parent-child", target: { id: "b" } },
          { type: "parent-child", target: { id: "b" } },
        ],
      };
      const b: GoalNode = {
        id: { id: "b" },
        type: "goal",
        status: "accepted",
        content: "b",
        metadata: meta("2026-01-01T00:00:00Z"),
        // cycle back to a
        relationships: [
          { type: "parent-child", target: { id: "a" } },
          { type: "parent-child", target: { id: "a" } }, // duplicate incoming edge to hit visited check
        ],
      };
      const nodes = [a, b];
      const byKey = new Map(nodes.map((n) => [n.id.id, n]));
      const getNodeByKey = (k: string) => byKey.get(k) || null;

      const descendants = getDescendants(getNodeByKey, { id: "a" }, "parent-child");
      expect(descendants.map((n) => n.id.id)).toContain("b");

      const ancestors = getAncestors(nodes, { id: "a" }, "parent-child");
      expect(ancestors.map((n) => n.id.id)).toContain("b");

      const idx = buildEdgeIndex(nodes, (id) => id.id);
      const incoming = traverseRelatedKeys({ id: "a" }, 1, "incoming", idx, new Set(["parent-child"]), (id) => id.id);
      expect(incoming.has("b")).toBe(true);

      const dependents = getDependents(nodes, { id: "a" });
      expect(dependents).toEqual([]);
    });
  });
});
