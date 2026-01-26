/**
 * In-memory implementation of the context store.
 * Useful for testing and development.
 */

import {
  ContextStore,
  AnyNode,
  NodeId,
  NodeQuery,
  ProposalQuery,
} from "../types/index.js";
import { Proposal, Review } from "../types/proposal.js";

export class InMemoryStore implements ContextStore {
  private nodes: Map<string, AnyNode> = new Map();
  private proposals: Map<string, Proposal> = new Map();
  private reviews: Map<string, Review[]> = new Map();

  private nodeKey(nodeId: NodeId): string {
    return nodeId.namespace ? `${nodeId.namespace}:${nodeId.id}` : nodeId.id;
  }

  async getNode(nodeId: NodeId): Promise<AnyNode | null> {
    const key = this.nodeKey(nodeId);
    return this.nodes.get(key) || null;
  }

  async queryNodes(query: NodeQuery): Promise<AnyNode[]> {
    let results = Array.from(this.nodes.values());

    if (query.type && query.type.length > 0) {
      results = results.filter((node) => query.type!.includes(node.type));
    }

    if (query.status && query.status.length > 0) {
      results = results.filter((node) => query.status!.includes(node.status));
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter(
        (node) =>
          node.metadata.tags &&
          query.tags!.some((tag) => node.metadata.tags!.includes(tag))
      );
    }

    if (query.createdBy) {
      results = results.filter(
        (node) => node.metadata.createdBy === query.createdBy
      );
    }

    if (query.namespace) {
      results = results.filter(
        (node) => node.id.namespace === query.namespace
      );
    }

    if (query.search) {
      const searchLower = query.search.toLowerCase();
      results = results.filter(
        (node) =>
          node.content.toLowerCase().includes(searchLower) ||
          (node.type === "decision" &&
            "decision" in node &&
            (node as any).decision?.toLowerCase().includes(searchLower))
      );
    }

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || results.length;
    results = results.slice(offset, offset + limit);

    return results;
  }

  async getProposal(proposalId: string): Promise<Proposal | null> {
    return this.proposals.get(proposalId) || null;
  }

  async queryProposals(query: ProposalQuery): Promise<Proposal[]> {
    let results = Array.from(this.proposals.values());

    if (query.status && query.status.length > 0) {
      results = results.filter((proposal) =>
        query.status!.includes(proposal.status)
      );
    }

    if (query.createdBy) {
      results = results.filter(
        (proposal) => proposal.metadata.createdBy === query.createdBy
      );
    }

    if (query.nodeId) {
      const nodeKey = this.nodeKey(query.nodeId);
      results = results.filter((proposal) =>
        proposal.operations.some((op) => {
          if (op.type === "create" && "node" in op) {
            return this.nodeKey(op.node.id) === nodeKey;
          }
          if (
            (op.type === "update" || op.type === "delete" || op.type === "status-change") &&
            "nodeId" in op
          ) {
            return this.nodeKey(op.nodeId) === nodeKey;
          }
          return false;
        })
      );
    }

    const offset = query.offset || 0;
    const limit = query.limit || results.length;
    results = results.slice(offset, offset + limit);

    return results;
  }

  async createProposal(proposal: Proposal): Promise<void> {
    this.proposals.set(proposal.id, proposal);
  }

  async updateProposal(
    proposalId: string,
    updates: Partial<Proposal>
  ): Promise<void> {
    const existing = this.proposals.get(proposalId);
    if (!existing) {
      throw new Error(`Proposal ${proposalId} not found`);
    }
    this.proposals.set(proposalId, { ...existing, ...updates });
  }

  async submitReview(review: Review): Promise<void> {
    const proposal = await this.getProposal(review.proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${review.proposalId} not found`);
    }

    // Update proposal status based on review
    if (review.action === "accept") {
      await this.updateProposal(review.proposalId, { status: "accepted" });
    } else if (review.action === "reject") {
      await this.updateProposal(review.proposalId, { status: "rejected" });
    }

    // Store review
    const reviews = this.reviews.get(review.proposalId) || [];
    reviews.push(review);
    this.reviews.set(review.proposalId, reviews);
  }

  async applyProposal(proposalId: string): Promise<void> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== "accepted") {
      throw new Error(`Cannot apply proposal ${proposalId}: not accepted`);
    }

    // Apply operations in order
    for (const operation of proposal.operations.sort((a, b) => a.order - b.order)) {
      if (operation.type === "create" && "node" in operation) {
        const key = this.nodeKey(operation.node.id);
        this.nodes.set(key, operation.node);
      } else if (operation.type === "update" && "nodeId" in operation) {
        const key = this.nodeKey(operation.nodeId);
        const existing = this.nodes.get(key);
        if (!existing) {
          throw new Error(`Node ${key} not found for update`);
        }
        this.nodes.set(key, { ...existing, ...operation.changes } as AnyNode);
      } else if (operation.type === "delete" && "nodeId" in operation) {
        const key = this.nodeKey(operation.nodeId);
        const existing = this.nodes.get(key);
        if (existing) {
          // Mark as deleted, don't remove (for provenance)
          this.nodes.set(key, { ...existing, status: "rejected" } as AnyNode);
        }
      } else if (operation.type === "status-change" && "nodeId" in operation) {
        const key = this.nodeKey(operation.nodeId);
        const existing = this.nodes.get(key);
        if (!existing) {
          throw new Error(`Node ${key} not found for status change`);
        }
        this.nodes.set(key, { ...existing, status: operation.newStatus } as AnyNode);
      }
    }
  }

  async getReviewHistory(proposalId: string): Promise<Review[]> {
    return this.reviews.get(proposalId) || [];
  }

  async getAcceptedNodes(): Promise<AnyNode[]> {
    return this.queryNodes({ status: ["accepted"] });
  }

  async getOpenProposals(): Promise<Proposal[]> {
    return this.queryProposals({ status: ["open"] });
  }

  async getRejectedProposals(): Promise<Proposal[]> {
    return this.queryProposals({ status: ["rejected"] });
  }
}
