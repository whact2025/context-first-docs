import { AnyNode, NodeId, RelationshipType } from "../../types/node.js";
import { nodeKey as defaultNodeKey } from "./node-key.js";

export type TraversalDirection = "outgoing" | "incoming" | "both";

export interface EdgeIndex {
  outgoing: Map<string, Array<{ type: RelationshipType; toKey: string }>>;
  incoming: Map<string, Array<{ type: RelationshipType; fromKey: string }>>;
}

export function buildEdgeIndex(
  nodes: Iterable<AnyNode>,
  keyOf: (id: NodeId) => string = defaultNodeKey
): EdgeIndex {
  const outgoing = new Map<string, Array<{ type: RelationshipType; toKey: string }>>();
  const incoming = new Map<string, Array<{ type: RelationshipType; fromKey: string }>>();

  for (const node of nodes) {
    const fromKey = keyOf(node.id);
    const rels = node.relationships || [];
    if (rels.length === 0) continue;

    for (const rel of rels) {
      const toKey = keyOf(rel.target);
      if (!outgoing.has(fromKey)) outgoing.set(fromKey, []);
      outgoing.get(fromKey)!.push({ type: rel.type, toKey });

      if (!incoming.has(toKey)) incoming.set(toKey, []);
      incoming.get(toKey)!.push({ type: rel.type, fromKey });
    }
  }

  return { outgoing, incoming };
}

export function traverseRelatedKeys(
  startNode: NodeId,
  depth: number,
  direction: TraversalDirection,
  edgeIndex: EdgeIndex,
  allowedTypes: Set<RelationshipType> | null,
  keyOf: (id: NodeId) => string = defaultNodeKey
): Set<string> {
  const startKey = keyOf(startNode);
  const maxDepth = Math.max(0, depth);

  const visited = new Set<string>([startKey]);
  const result = new Set<string>();
  const queue: Array<{ key: string; d: number }> = [{ key: startKey, d: 0 }];

  const allow = (t: RelationshipType) => (allowedTypes ? allowedTypes.has(t) : true);

  while (queue.length > 0) {
    const { key, d } = queue.shift()!;
    if (d >= maxDepth) continue;

    if (direction === "outgoing" || direction === "both") {
      const outs = edgeIndex.outgoing.get(key) || [];
      for (const e of outs) {
        if (!allow(e.type)) continue;
        if (visited.has(e.toKey)) continue;
        visited.add(e.toKey);
        result.add(e.toKey);
        queue.push({ key: e.toKey, d: d + 1 });
      }
    }

    if (direction === "incoming" || direction === "both") {
      const ins = edgeIndex.incoming.get(key) || [];
      for (const e of ins) {
        if (!allow(e.type)) continue;
        if (visited.has(e.fromKey)) continue;
        visited.add(e.fromKey);
        result.add(e.fromKey);
        queue.push({ key: e.fromKey, d: d + 1 });
      }
    }
  }

  return result;
}

export function getDescendants(
  nodesByKey: (key: string) => AnyNode | null,
  startNode: NodeId,
  relationshipType: RelationshipType,
  keyOf: (id: NodeId) => string = defaultNodeKey
): AnyNode[] {
  const descendants: AnyNode[] = [];
  const visited = new Set<string>();
  const toVisit: AnyNode[] = [];

  const start = nodesByKey(keyOf(startNode));
  if (!start) return descendants;

  toVisit.push(start);

  while (toVisit.length > 0) {
    const current = toVisit.shift()!;
    const currentKey = keyOf(current.id);

    if (visited.has(currentKey)) continue;
    visited.add(currentKey);

    const children = current.relationships?.filter((rel) => rel.type === relationshipType);
    if (!children) continue;

    for (const rel of children) {
      const child = nodesByKey(keyOf(rel.target));
      if (child && !visited.has(keyOf(child.id))) {
        descendants.push(child);
        toVisit.push(child);
      }
    }
  }

  return descendants;
}

export function getAncestors(
  nodes: Iterable<AnyNode>,
  startNode: NodeId,
  relationshipType: RelationshipType,
  keyOf: (id: NodeId) => string = defaultNodeKey
): AnyNode[] {
  const ancestors: AnyNode[] = [];
  const visited = new Set<string>();
  const toVisitKeys: string[] = [];

  const startKey = keyOf(startNode);
  toVisitKeys.push(startKey);

  while (toVisitKeys.length > 0) {
    const currentKey = toVisitKeys.shift()!;
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);

    // Find nodes that have this node as a child
    for (const node of nodes) {
      if (
        node.relationships?.some(
          (rel) => rel.type === relationshipType && keyOf(rel.target) === currentKey
        )
      ) {
        const nodeK = keyOf(node.id);
        if (!visited.has(nodeK)) {
          ancestors.push(node);
          toVisitKeys.push(nodeK);
        }
      }
    }
  }

  return ancestors;
}

export function getDependencies(
  nodesByKey: (key: string) => AnyNode | null,
  nodeId: NodeId,
  keyOf: (id: NodeId) => string = defaultNodeKey
): AnyNode[] {
  const node = nodesByKey(keyOf(nodeId));
  if (!node) return [];

  const dependencies: AnyNode[] = [];
  const depRels = node.relationships?.filter((rel) => rel.type === "depends-on");
  if (!depRels) return dependencies;

  for (const rel of depRels) {
    const dep = nodesByKey(keyOf(rel.target));
    if (dep) dependencies.push(dep);
  }

  return dependencies;
}

export function getDependents(
  nodes: Iterable<AnyNode>,
  nodeId: NodeId,
  keyOf: (id: NodeId) => string = defaultNodeKey
): AnyNode[] {
  const targetKey = keyOf(nodeId);
  const dependents: AnyNode[] = [];

  for (const node of nodes) {
    if (
      node.relationships?.some(
        (rel) => rel.type === "depends-on" && keyOf(rel.target) === targetKey
      )
    ) {
      dependents.push(node);
    }
  }

  return dependents;
}

