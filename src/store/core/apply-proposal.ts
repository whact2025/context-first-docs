import { AnyNode, NodeId, RelationshipType } from "../../types/node.js";
import {
  Proposal,
  InsertOperation,
  MoveOperation,
} from "../../types/proposal.js";
import { applyUpdateChanges, isDeleteNodeOperation, isDeleteTextOperation } from "./updates.js";

export interface ApplyProposalOptions {
  keyOf: (id: NodeId) => string;
}

/**
 * Apply an accepted proposal to an in-memory node map (used by InMemory + file-backed stores).
 * Mutates `nodes` in place.
 */
export function applyAcceptedProposalToNodeMap(
  nodes: Map<string, AnyNode>,
  proposal: Proposal,
  options: ApplyProposalOptions
): void {
  const { keyOf } = options;

  const touch = (node: AnyNode): AnyNode => {
    return {
      ...node,
      metadata: {
        ...node.metadata,
        modifiedAt: proposal.metadata.modifiedAt,
        modifiedBy: proposal.metadata.modifiedBy,
        version: (node.metadata.version ?? 0) + 1,
      },
    };
  };

  const setNode = (nodeId: NodeId, updater: (current: AnyNode) => AnyNode) => {
    const key = keyOf(nodeId);
    const existing = nodes.get(key);
    if (!existing) {
      throw new Error(`Node ${key} not found`);
    }
    nodes.set(key, updater(existing));
  };

  // Apply operations in order
  const ops = [...proposal.operations].sort((a, b) => a.order - b.order);
  for (const operation of ops) {
    if (operation.type === "create" && "node" in operation) {
      const key = keyOf(operation.node.id);
      nodes.set(key, operation.node);
      continue;
    }

    if (operation.type === "update") {
      setNode(operation.nodeId, (existing) =>
        touch(applyUpdateChanges(existing, operation.changes))
      );
      continue;
    }

    if (isDeleteNodeOperation(operation)) {
      setNode(operation.nodeId, (existing) => touch({ ...existing, status: "rejected" }));
      continue;
    }

    if (operation.type === "status-change") {
      setNode(operation.nodeId, (existing) =>
        touch({ ...existing, status: operation.newStatus })
      );
      continue;
    }

    if (operation.type === "insert") {
      const nodeId = (operation as InsertOperation).sourceNodeId;
      if (!nodeId) {
        throw new Error(`Insert operation ${operation.id} missing sourceNodeId`);
      }
      setNode(nodeId, (existing) => {
        const content = existing.content ?? "";
        const pos = (operation as InsertOperation).position;
        const text = (operation as InsertOperation).text;
        if (pos < 0 || pos > content.length) {
          throw new Error(`Insert position ${pos} out of bounds for node ${keyOf(nodeId)}`);
        }
        return touch({
          ...existing,
          content: content.slice(0, pos) + text + content.slice(pos),
        });
      });
      continue;
    }

    if (isDeleteTextOperation(operation)) {
      const nodeId = operation.sourceNodeId;
      if (!nodeId) {
        throw new Error(`DeleteText operation ${operation.id} missing sourceNodeId`);
      }
      setNode(nodeId, (existing) => {
        const content = existing.content ?? "";
        const start = operation.start;
        const end = operation.end;
        if (start < 0 || end < start || end > content.length) {
          throw new Error(`Delete range [${start}, ${end}) out of bounds for node ${keyOf(nodeId)}`);
        }
        return touch({
          ...existing,
          content: content.slice(0, start) + content.slice(end),
        });
      });
      continue;
    }

    if (operation.type === "move") {
      const nodeId = (operation as MoveOperation).nodeId;
      const target = (operation as MoveOperation).target;

      if (target?.parentId) {
        const newParentId = target.parentId;
        const newParentKey = keyOf(newParentId);
        const newParent = nodes.get(newParentKey);
        if (!newParent) {
          throw new Error(`Parent ${newParentKey} not found for move`);
        }

        // Remove any existing incoming parent-child edges to this node (single-parent semantics)
        for (const n of nodes.values()) {
          if (!n.relationships) continue;
          const nextRels = n.relationships.filter(
            (r) => !(r.type === "parent-child" && keyOf(r.target) === keyOf(nodeId))
          );
          if (nextRels.length !== n.relationships.length) {
            nodes.set(keyOf(n.id), touch({ ...n, relationships: nextRels }));
          }
        }

        // Add parent-child edge from new parent to nodeId if missing
        const existingRels = newParent.relationships || [];
        const has = existingRels.some(
          (r) => r.type === "parent-child" && keyOf(r.target) === keyOf(nodeId)
        );
        if (!has) {
          nodes.set(
            newParentKey,
            touch({
              ...newParent,
              relationships: [...existingRels, { type: "parent-child" as RelationshipType, target: nodeId }],
            })
          );
        }
      }

      // Position is currently a no-op (no ordering field in model). Still bump metadata.
      setNode(nodeId, (existing) => touch(existing));
      continue;
    }
  }
}

