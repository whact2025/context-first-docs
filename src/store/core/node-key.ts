import { NodeId } from "../../types/node.js";

/**
 * Canonical key for a node ID across stores.
 * Keep this stable so indexes and caches can share keys.
 */
export function nodeKey(nodeId: NodeId): string {
  return nodeId.namespace ? `${nodeId.namespace}:${nodeId.id}` : nodeId.id;
}

