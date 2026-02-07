/**
 * Minimal store backed by a Map of nodes. Used for preview (apply proposal in memory, then project to Markdown).
 * Implements only getNode and queryNodes so projectToMarkdown works.
 */

import type { AnyNode, NodeId, NodeQuery, NodeQueryResult } from "../types/index.js";
import { nodeKey } from "./core/node-key.js";

export class PreviewStore {
  constructor(private nodes: Map<string, AnyNode>) {}

  async getNode(nodeId: NodeId): Promise<AnyNode | null> {
    const key = nodeKey(nodeId);
    return this.nodes.get(key) ?? null;
  }

  async queryNodes(query: NodeQuery): Promise<NodeQueryResult> {
    let list = Array.from(this.nodes.values());
    if (query.status?.length) {
      list = list.filter((n) => query.status!.includes(n.status));
    }
    if (query.type?.length) {
      list = list.filter((n) => query.type!.includes(n.type));
    }
    if (query.namespace) {
      list = list.filter((n) => n.id.namespace === query.namespace);
    }
    const total = list.length;
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const slice = list.slice(offset, offset + limit);
    return {
      nodes: slice,
      total,
      limit,
      offset,
      hasMore: offset + slice.length < total,
    };
  }
}
