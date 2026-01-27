/**
 * Comprehensive tests for InMemoryStore implementation.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { InMemoryStore } from "../src/store/in-memory-store.js";
import {
  AnyNode,
  NodeId,
  GoalNode,
  DecisionNode,
  TaskNode,
  RiskNode,
} from "../src/types/node.js";
import { Proposal, CreateOperation, UpdateOperation } from "../src/types/proposal.js";

describe("InMemoryStore", () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  describe("Node Operations", () => {
    it("should create and retrieve a node", async () => {
      const node: GoalNode = {
        id: { id: "goal-001" },
        type: "goal",
        status: "accepted",
        content: "Build scalable system",
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
          version: 1,
        },
      };

      // Create via proposal
      const proposal: Proposal = {
        id: "proposal-001",
        status: "accepted",
        operations: [
          {
            id: "op-001",
            type: "create",
            order: 1,
            node,
          } as CreateOperation,
        ],
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
        },
      };

      await store.createProposal(proposal);
      await store.applyProposal("proposal-001");

      const retrieved = await store.getNode({ id: "goal-001" });
      expect(retrieved).not.toBeNull();
      expect(retrieved?.type).toBe("goal");
      expect(retrieved?.content).toBe("Build scalable system");
    });

    it("should return null for non-existent node", async () => {
      const result = await store.getNode({ id: "nonexistent" });
      expect(result).toBeNull();
    });

    it("should handle namespaced node IDs", async () => {
      const node: GoalNode = {
        id: { id: "goal-001", namespace: "architecture" },
        type: "goal",
        status: "accepted",
        content: "Build scalable system",
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
          version: 1,
        },
      };

      const proposal: Proposal = {
        id: "proposal-002",
        status: "accepted",
        operations: [
          {
            id: "op-001",
            type: "create",
            order: 1,
            node,
          } as CreateOperation,
        ],
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
        },
      };

      await store.createProposal(proposal);
      await store.applyProposal("proposal-002");

      const retrieved = await store.getNode({
        id: "goal-001",
        namespace: "architecture",
      });
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id.namespace).toBe("architecture");
    });
  });

  describe("Query Operations", () => {
    beforeEach(async () => {
      // Set up test data
      const nodes: AnyNode[] = [
        {
          id: { id: "goal-001" },
          type: "goal",
          status: "accepted",
          content: "Build scalable system",
          metadata: {
            createdAt: "2026-01-26T10:00:00Z",
            createdBy: "user1",
            modifiedAt: "2026-01-26T10:00:00Z",
            modifiedBy: "user1",
            version: 1,
          },
        },
        {
          id: { id: "decision-001" },
          type: "decision",
          status: "accepted",
          content: "Use TypeScript",
          decision: "Use TypeScript for type safety",
          rationale: "Type safety prevents errors",
          metadata: {
            createdAt: "2026-01-26T11:00:00Z",
            createdBy: "user1",
            modifiedAt: "2026-01-26T11:00:00Z",
            modifiedBy: "user1",
            version: 1,
          },
        },
        {
          id: { id: "task-001" },
          type: "task",
          status: "accepted",
          state: "open",
          content: "Set up TypeScript",
          metadata: {
            createdAt: "2026-01-26T12:00:00Z",
            createdBy: "user2",
            modifiedAt: "2026-01-26T12:00:00Z",
            modifiedBy: "user2",
            version: 1,
            tags: ["implementation", "typescript"],
          },
        },
        {
          id: { id: "risk-001" },
          type: "risk",
          status: "proposed",
          content: "TypeScript learning curve",
          severity: "medium",
          likelihood: "unlikely",
          metadata: {
            createdAt: "2026-01-26T13:00:00Z",
            createdBy: "user2",
            modifiedAt: "2026-01-26T13:00:00Z",
            modifiedBy: "user2",
            version: 1,
          },
        },
      ];

      for (const node of nodes) {
        const proposal: Proposal = {
          id: `proposal-${node.id.id}`,
          status: node.status === "accepted" ? "accepted" : "open",
          operations: [
            {
              id: `op-${node.id.id}`,
              type: "create",
              order: 1,
              node,
            } as CreateOperation,
          ],
          metadata: {
            createdAt: node.metadata.createdAt,
            createdBy: node.metadata.createdBy,
            modifiedAt: node.metadata.modifiedAt,
            modifiedBy: node.metadata.modifiedBy,
          },
        };

        await store.createProposal(proposal);
        if (proposal.status === "accepted") {
          await store.applyProposal(proposal.id);
        }
      }
    });

    it("should query nodes by type", async () => {
      const result = await store.queryNodes({ type: ["goal"] });
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe("goal");
      expect(result.total).toBe(1);
    });

    it("should query nodes by status", async () => {
      const result = await store.queryNodes({ status: ["accepted"] });
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.nodes.every((n) => n.status === "accepted")).toBe(true);
    });

    it("should default to accepted nodes only", async () => {
      const result = await store.queryNodes({});
      expect(result.nodes.every((n) => n.status === "accepted")).toBe(true);
    });

    it("should query nodes by creator", async () => {
      const result = await store.queryNodes({ createdBy: "user1" });
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(
        result.nodes.every((n) => n.metadata.createdBy === "user1")
      ).toBe(true);
    });

    it("should query nodes by tags", async () => {
      const result = await store.queryNodes({ tags: ["typescript"] });
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(
        result.nodes.every(
          (n) => n.metadata.tags?.includes("typescript") ?? false
        )
      ).toBe(true);
    });

    it("should search nodes by content", async () => {
      const result = await store.queryNodes({ search: "TypeScript" });
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(
        result.nodes.some(
          (n) =>
            n.content.toLowerCase().includes("typescript") ||
            (n.type === "decision" &&
              "decision" in n &&
              (n as DecisionNode).decision.toLowerCase().includes("typescript"))
        )
      ).toBe(true);
    });

    it("should paginate results", async () => {
      const result1 = await store.queryNodes({ limit: 2, offset: 0 });
      expect(result1.nodes).toHaveLength(2);
      expect(result1.hasMore).toBe(true);

      const result2 = await store.queryNodes({ limit: 2, offset: 2 });
      expect(result2.nodes.length).toBeGreaterThan(0);
      expect(result2.offset).toBe(2);
    });

    it("should sort results by creation date", async () => {
      const result = await store.queryNodes({
        sortBy: "createdAt",
        sortOrder: "asc",
      });
      expect(result.nodes.length).toBeGreaterThan(1);
      for (let i = 1; i < result.nodes.length; i++) {
        const prev = new Date(result.nodes[i - 1].metadata.createdAt);
        const curr = new Date(result.nodes[i].metadata.createdAt);
        expect(curr.getTime()).toBeGreaterThanOrEqual(prev.getTime());
      }
    });

    it("should filter by date range", async () => {
      const result = await store.queryNodes({
        createdAfter: "2026-01-26T11:00:00Z",
        createdBefore: "2026-01-26T13:00:00Z",
      });
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(
        result.nodes.every((n) => {
          const createdAt = new Date(n.metadata.createdAt);
          return (
            createdAt >= new Date("2026-01-26T11:00:00Z") &&
            createdAt <= new Date("2026-01-26T13:00:00Z")
          );
        })
      ).toBe(true);
    });
  });

  describe("Proposal Operations", () => {
    it("should create a proposal", async () => {
      const proposal: Proposal = {
        id: "proposal-001",
        status: "open",
        operations: [],
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
        },
      };

      await store.createProposal(proposal);
      const retrieved = await store.getProposal("proposal-001");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.status).toBe("open");
    });

    it("should update a proposal", async () => {
      const proposal: Proposal = {
        id: "proposal-002",
        status: "open",
        operations: [],
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
        },
      };

      await store.createProposal(proposal);
      await store.updateProposal("proposal-002", { status: "accepted" });

      const updated = await store.getProposal("proposal-002");
      expect(updated?.status).toBe("accepted");
    });

    it("should query proposals by status", async () => {
      const proposal1: Proposal = {
        id: "proposal-003",
        status: "open",
        operations: [],
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
        },
      };

      const proposal2: Proposal = {
        id: "proposal-004",
        status: "rejected",
        operations: [],
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
        },
      };

      await store.createProposal(proposal1);
      await store.createProposal(proposal2);

      const openProposals = await store.getOpenProposals();
      expect(openProposals.some((p) => p.id === "proposal-003")).toBe(true);
      expect(openProposals.every((p) => p.status === "open")).toBe(true);
    });
  });

  describe("Review Operations", () => {
    beforeEach(async () => {
      const proposal: Proposal = {
        id: "proposal-review-001",
        status: "open",
        operations: [],
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
        },
      };
      await store.createProposal(proposal);
    });

    it("should submit a review", async () => {
      const review = {
        id: "review-001",
        proposalId: "proposal-review-001",
        reviewer: "user2",
        reviewedAt: "2026-01-26T11:00:00Z",
        action: "accept" as const,
        comment: "Looks good",
      };

      await store.submitReview(review);
      const history = await store.getReviewHistory("proposal-review-001");
      expect(history).toHaveLength(1);
      expect(history[0].action).toBe("accept");
    });

    it("should update proposal status on accept", async () => {
      const review = {
        id: "review-002",
        proposalId: "proposal-review-001",
        reviewer: "user2",
        reviewedAt: "2026-01-26T11:00:00Z",
        action: "accept" as const,
      };

      await store.submitReview(review);
      const proposal = await store.getProposal("proposal-review-001");
      expect(proposal?.status).toBe("accepted");
    });

    it("should update proposal status on reject", async () => {
      const review = {
        id: "review-003",
        proposalId: "proposal-review-001",
        reviewer: "user2",
        reviewedAt: "2026-01-26T11:00:00Z",
        action: "reject" as const,
        comment: "Needs more work",
      };

      await store.submitReview(review);
      const proposal = await store.getProposal("proposal-review-001");
      expect(proposal?.status).toBe("rejected");
    });
  });

  describe("Proposal Application", () => {
    it("should apply a create operation", async () => {
      const node: GoalNode = {
        id: { id: "goal-apply-001" },
        type: "goal",
        status: "accepted",
        content: "Test goal",
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
          version: 1,
        },
      };

      const proposal: Proposal = {
        id: "proposal-apply-001",
        status: "accepted",
        operations: [
          {
            id: "op-001",
            type: "create",
            order: 1,
            node,
          } as CreateOperation,
        ],
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
        },
      };

      await store.createProposal(proposal);
      await store.applyProposal("proposal-apply-001");

      const applied = await store.getNode({ id: "goal-apply-001" });
      expect(applied).not.toBeNull();
      expect(applied?.content).toBe("Test goal");
    });

    it("should apply an update operation", async () => {
      // First create a node
      const node: GoalNode = {
        id: { id: "goal-update-001" },
        type: "goal",
        status: "accepted",
        content: "Original content",
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
          version: 1,
        },
      };

      const createProposal: Proposal = {
        id: "proposal-create-update",
        status: "accepted",
        operations: [
          {
            id: "op-create",
            type: "create",
            order: 1,
            node,
          } as CreateOperation,
        ],
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
        },
      };

      await store.createProposal(createProposal);
      await store.applyProposal("proposal-create-update");

      // Now update it
      const updateProposal: Proposal = {
        id: "proposal-update-001",
        status: "accepted",
        operations: [
          {
            id: "op-update",
            type: "update",
            order: 1,
            nodeId: { id: "goal-update-001" },
            changes: { content: "Updated content" },
          } as UpdateOperation,
        ],
        metadata: {
          createdAt: "2026-01-26T11:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T11:00:00Z",
          modifiedBy: "user1",
        },
      };

      await store.createProposal(updateProposal);
      await store.applyProposal("proposal-update-001");

      const updated = await store.getNode({ id: "goal-update-001" });
      expect(updated?.content).toBe("Updated content");
    });

    it("should throw error when applying non-accepted proposal", async () => {
      const proposal: Proposal = {
        id: "proposal-rejected",
        status: "rejected",
        operations: [],
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
        },
      };

      await store.createProposal(proposal);
      await expect(store.applyProposal("proposal-rejected")).rejects.toThrow();
    });
  });

  describe("Reference Tracking", () => {
    beforeEach(async () => {
      // Create nodes with relationships
      const goal: GoalNode = {
        id: { id: "goal-ref-001" },
        type: "goal",
        status: "accepted",
        content: "Build scalable system",
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
          version: 1,
        },
      };

      const decision: DecisionNode = {
        id: { id: "decision-ref-001" },
        type: "decision",
        status: "accepted",
        content: "Use TypeScript",
        decision: "Use TypeScript",
        rationale: "Type safety",
        metadata: {
          createdAt: "2026-01-26T11:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T11:00:00Z",
          modifiedBy: "user1",
          version: 1,
        },
        relationships: [
          {
            type: "implements",
            target: { id: "goal-ref-001" },
          },
        ],
      };

      const createGoal: Proposal = {
        id: "proposal-goal-ref",
        status: "accepted",
        operations: [
          {
            id: "op-goal",
            type: "create",
            order: 1,
            node: goal,
          } as CreateOperation,
        ],
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
        },
      };

      const createDecision: Proposal = {
        id: "proposal-decision-ref",
        status: "accepted",
        operations: [
          {
            id: "op-decision",
            type: "create",
            order: 1,
            node: decision,
          } as CreateOperation,
        ],
        metadata: {
          createdAt: "2026-01-26T11:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T11:00:00Z",
          modifiedBy: "user1",
        },
      };

      await store.createProposal(createGoal);
      await store.applyProposal("proposal-goal-ref");
      await store.createProposal(createDecision);
      await store.applyProposal("proposal-decision-ref");
    });

    it("should find nodes that reference a given node", async () => {
      const referencing = await store.getReferencingNodes({
        id: "goal-ref-001",
      });
      expect(referencing.length).toBeGreaterThan(0);
      expect(
        referencing.some((n) => n.id.id === "decision-ref-001")
      ).toBe(true);
    });
  });

  describe("Conflict Detection", () => {
    beforeEach(async () => {
      const node: GoalNode = {
        id: { id: "goal-conflict-001" },
        type: "goal",
        status: "accepted",
        content: "Original goal",
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
          version: 1,
        },
      };

      const createProposal: Proposal = {
        id: "proposal-create-conflict",
        status: "accepted",
        operations: [
          {
            id: "op-create",
            type: "create",
            order: 1,
            node,
          } as CreateOperation,
        ],
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
        },
      };

      await store.createProposal(createProposal);
      await store.applyProposal("proposal-create-conflict");
    });

    it("should detect conflicts between proposals", async () => {
      const proposal1: Proposal = {
        id: "proposal-conflict-1",
        status: "open",
        operations: [
          {
            id: "op-1",
            type: "update",
            order: 1,
            nodeId: { id: "goal-conflict-001" },
            changes: { content: "Updated by proposal 1" },
          } as UpdateOperation,
        ],
        metadata: {
          createdAt: "2026-01-26T11:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T11:00:00Z",
          modifiedBy: "user1",
        },
      };

      const proposal2: Proposal = {
        id: "proposal-conflict-2",
        status: "open",
        operations: [
          {
            id: "op-2",
            type: "update",
            order: 1,
            nodeId: { id: "goal-conflict-001" },
            changes: { content: "Updated by proposal 2" },
          } as UpdateOperation,
        ],
        metadata: {
          createdAt: "2026-01-26T11:00:00Z",
          createdBy: "user2",
          modifiedAt: "2026-01-26T11:00:00Z",
          modifiedBy: "user2",
        },
      };

      await store.createProposal(proposal1);
      await store.createProposal(proposal2);

      const conflicts = await store.detectConflicts("proposal-conflict-1");
      expect(conflicts.conflicts.length).toBeGreaterThan(0);
      expect(conflicts.needsResolution.length).toBeGreaterThan(0);
    });

    it("should detect stale proposals", async () => {
      const node: GoalNode = {
        id: { id: "goal-stale-001" },
        type: "goal",
        status: "accepted",
        content: "Original",
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
          version: 1,
        },
      };

      const createProposal: Proposal = {
        id: "proposal-create-stale",
        status: "accepted",
        operations: [
          {
            id: "op-create",
            type: "create",
            order: 1,
            node,
          } as CreateOperation,
        ],
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
        },
      };

      await store.createProposal(createProposal);
      await store.applyProposal("proposal-create-stale");

      // Create a proposal that modifies the node
      const updateProposal1: Proposal = {
        id: "proposal-update-stale-1",
        status: "accepted",
        operations: [
          {
            id: "op-update-1",
            type: "update",
            order: 1,
            nodeId: { id: "goal-stale-001" },
            changes: { content: "Updated 1" },
          } as UpdateOperation,
        ],
        metadata: {
          createdAt: "2026-01-26T11:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T11:00:00Z",
          modifiedBy: "user1",
        },
      };

      await store.createProposal(updateProposal1);
      await store.applyProposal("proposal-update-stale-1");

      // Create another proposal that tries to modify the same node
      const updateProposal2: Proposal = {
        id: "proposal-update-stale-2",
        status: "open",
        operations: [
          {
            id: "op-update-2",
            type: "update",
            order: 1,
            nodeId: { id: "goal-stale-001" },
            changes: { content: "Updated 2" },
          } as UpdateOperation,
        ],
        metadata: {
          createdAt: "2026-01-26T10:30:00Z", // Created before updateProposal1 was applied
          createdBy: "user2",
          modifiedAt: "2026-01-26T10:30:00Z",
          modifiedBy: "user2",
        },
      };

      await store.createProposal(updateProposal2);

      const isStale = await store.isProposalStale("proposal-update-stale-2");
      expect(isStale).toBe(true);
    });
  });

  describe("Chain-of-Thought Traversal", () => {
    beforeEach(async () => {
      // Create a chain: goal -> decision -> task
      const goal: GoalNode = {
        id: { id: "goal-chain-001" },
        type: "goal",
        status: "accepted",
        content: "Build scalable system",
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
          version: 1,
        },
      };

      const decision: DecisionNode = {
        id: { id: "decision-chain-001" },
        type: "decision",
        status: "accepted",
        content: "Use TypeScript",
        decision: "Use TypeScript",
        rationale: "Type safety",
        metadata: {
          createdAt: "2026-01-26T11:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T11:00:00Z",
          modifiedBy: "user1",
          version: 1,
        },
        relationships: [
          {
            type: "implements",
            target: { id: "goal-chain-001" },
          },
        ],
      };

      const task: TaskNode = {
        id: { id: "task-chain-001" },
        type: "task",
        status: "accepted",
        state: "open",
        content: "Set up TypeScript",
        metadata: {
          createdAt: "2026-01-26T12:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T12:00:00Z",
          modifiedBy: "user1",
          version: 1,
        },
        relationships: [
          {
            type: "implements",
            target: { id: "decision-chain-001" },
          },
        ],
      };

      const proposals = [
        {
          id: "proposal-goal-chain",
          status: "accepted" as const,
          operations: [
            {
              id: "op-goal",
              type: "create" as const,
              order: 1,
              node: goal,
            },
          ],
          metadata: {
            createdAt: "2026-01-26T10:00:00Z",
            createdBy: "user1",
            modifiedAt: "2026-01-26T10:00:00Z",
            modifiedBy: "user1",
          },
        },
        {
          id: "proposal-decision-chain",
          status: "accepted" as const,
          operations: [
            {
              id: "op-decision",
              type: "create" as const,
              order: 1,
              node: decision,
            },
          ],
          metadata: {
            createdAt: "2026-01-26T11:00:00Z",
            createdBy: "user1",
            modifiedAt: "2026-01-26T11:00:00Z",
            modifiedBy: "user1",
          },
        },
        {
          id: "proposal-task-chain",
          status: "accepted" as const,
          operations: [
            {
              id: "op-task",
              type: "create" as const,
              order: 1,
              node: task,
            },
          ],
          metadata: {
            createdAt: "2026-01-26T12:00:00Z",
            createdBy: "user1",
            modifiedAt: "2026-01-26T12:00:00Z",
            modifiedBy: "user1",
          },
        },
      ];

      for (const proposal of proposals) {
        await store.createProposal(proposal as Proposal);
        await store.applyProposal(proposal.id);
      }
    });

    it("should traverse reasoning chain", async () => {
      const result = await store.traverseReasoningChain(
        { id: "goal-chain-001" },
        {
          path: [{ relationshipType: "implements" }],
          maxDepth: 2,
          accumulateContext: true,
          includeRationale: true,
        }
      );

      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.path.length).toBeGreaterThan(0);
      expect(result.reasoningSteps).toBeDefined();
    });

    it("should follow decision reasoning", async () => {
      const result = await store.followDecisionReasoning(
        { id: "decision-chain-001" },
        {
          includeGoals: true,
          includeImplementations: true,
        }
      );

      expect(result.decision).not.toBeNull();
      expect(result.goals).toBeDefined();
      expect(result.implementations).toBeDefined();
    });

    it("should query with reasoning", async () => {
      const result = await store.queryWithReasoning({
        query: { type: ["goal"] },
        reasoning: {
          enabled: true,
          followRelationships: ["implements"],
          maxDepth: 2,
        },
      });

      expect(result.primaryResults.nodes.length).toBeGreaterThan(0);
      expect(result.reasoningChains.length).toBeGreaterThan(0);
    });
  });

  describe("Issue Creation", () => {
    it("should create issues from approved proposal", async () => {
      const task: TaskNode = {
        id: { id: "task-issue-001" },
        type: "task",
        status: "accepted",
        state: "open",
        content: "Implement feature X",
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
          version: 1,
        },
      };

      const proposal: Proposal = {
        id: "proposal-issue-001",
        status: "accepted",
        operations: [
          {
            id: "op-task",
            type: "create",
            order: 1,
            node: task,
          } as CreateOperation,
        ],
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
        },
      };

      await store.createProposal(proposal);
      await store.applyProposal("proposal-issue-001");

      const result = await store.createIssuesFromProposal(
        "proposal-issue-001",
        "review-issue-001"
      );

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].type).toBe("implementation");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty queries", async () => {
      const result = await store.queryNodes({});
      expect(result.nodes).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("should handle non-existent proposal in conflict detection", async () => {
      const result = await store.detectConflicts("nonexistent");
      expect(result.conflicts).toEqual([]);
    });

    it("should handle non-existent node in reference tracking", async () => {
      const result = await store.getReferencingNodes({ id: "nonexistent" });
      expect(result).toEqual([]);
    });

    it("should handle merge of single proposal", async () => {
      const proposal: Proposal = {
        id: "proposal-merge-single",
        status: "open",
        operations: [
          {
            id: "op-1",
            type: "update",
            order: 1,
            nodeId: { id: "test-node" },
            changes: { content: "Updated" },
          } as UpdateOperation,
        ],
        metadata: {
          createdAt: "2026-01-26T10:00:00Z",
          createdBy: "user1",
          modifiedAt: "2026-01-26T10:00:00Z",
          modifiedBy: "user1",
        },
      };

      await store.createProposal(proposal);
      const result = await store.mergeProposals(["proposal-merge-single"]);
      expect(result).toBeDefined();
    });
  });
});
