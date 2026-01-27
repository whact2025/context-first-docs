import {
  AnyNode,
  NodeId,
  NodeQuery,
  NodeQueryResult,
} from "../../types/index.js";
import { buildEdgeIndex, traverseRelatedKeys } from "./graph.js";

export interface QueryNodesOptions {
  nodes: Iterable<AnyNode>;
  getNodeByKey: (key: string) => AnyNode | null;
  keyOf: (id: NodeId) => string;
}

/**
 * Canonical in-memory implementation of `ContextStore.queryNodes`.
 * Reused by `InMemoryStore` and intended for file-backed stores that load
 * graphs into memory.
 */
export function queryNodesInMemory(
  query: NodeQuery,
  opts: QueryNodesOptions
): NodeQueryResult {
  const { nodes, getNodeByKey, keyOf } = opts;

  const allNodes = Array.from(nodes);
  let results = allNodes;

  // Default to accepted nodes only (for agent safety)
  const statusFilter = query.status || ["accepted"];
  const relevanceScores = new Map<string, number>();

  // Type filtering
  if (query.type && query.type.length > 0) {
    results = results.filter((node) => query.type!.includes(node.type));
  }

  // Status filtering
  if (statusFilter.length > 0) {
    results = results.filter((node) => statusFilter.includes(node.status));
  }

  // Tag filtering
  if (query.tags && query.tags.length > 0) {
    results = results.filter(
      (node) =>
        node.metadata.tags &&
        query.tags!.every((tag) => node.metadata.tags!.includes(tag))
    );
  }

  // Creator filtering
  if (query.createdBy) {
    results = results.filter((node) => node.metadata.createdBy === query.createdBy);
  }

  // Modifier filtering
  if (query.modifiedBy) {
    results = results.filter((node) => node.metadata.modifiedBy === query.modifiedBy);
  }

  // Namespace filtering
  if (query.namespace) {
    results = results.filter((node) => node.id.namespace === query.namespace);
  }

  // Date range filtering
  if (query.createdAfter) {
    const afterDate = new Date(query.createdAfter);
    results = results.filter((node) => new Date(node.metadata.createdAt) >= afterDate);
  }
  if (query.createdBefore) {
    const beforeDate = new Date(query.createdBefore);
    results = results.filter((node) => new Date(node.metadata.createdAt) <= beforeDate);
  }
  if (query.modifiedAfter) {
    const afterDate = new Date(query.modifiedAfter);
    results = results.filter((node) => new Date(node.metadata.modifiedAt) >= afterDate);
  }
  if (query.modifiedBefore) {
    const beforeDate = new Date(query.modifiedBefore);
    results = results.filter((node) => new Date(node.metadata.modifiedAt) <= beforeDate);
  }

  // Search filtering (+ relevance scoring)
  if (query.search) {
    const searchOpts =
      typeof query.search === "string" ? { query: query.search } : query.search;

    const caseSensitive = searchOpts.caseSensitive || false;
    const operator = searchOpts.operator || "AND";
    const fuzzy = searchOpts.fuzzy || false;
    const rawQuery = searchOpts.query.trim();

    const normalize = (s: string) => (caseSensitive ? s : s.toLowerCase());
    const needle = normalize(rawQuery);
    const terms =
      rawQuery.includes(" ") || rawQuery.includes("\t")
        ? rawQuery.split(/\s+/).filter(Boolean).map(normalize)
        : [needle];

    const levenshtein = (a: string, b: string): number => {
      if (a === b) return 0;
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;
      const dp: number[] = new Array(b.length + 1);
      for (let j = 0; j <= b.length; j++) dp[j] = j;
      for (let i = 1; i <= a.length; i++) {
        let prev = dp[0];
        dp[0] = i;
        for (let j = 1; j <= b.length; j++) {
          const tmp = dp[j];
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
          prev = tmp;
        }
      }
      return dp[b.length];
    };

    const getSearchTexts = (node: AnyNode): Array<{ field: string; text: string }> => {
      const all: Array<{ field: string; text: string }> = [{ field: "content", text: node.content }];

      if (node.type === "decision") {
        if ("decision" in node && typeof node.decision === "string") {
          all.push({ field: "decision", text: node.decision });
        }
        if ("rationale" in node && typeof node.rationale === "string") {
          all.push({ field: "rationale", text: node.rationale });
        }
        if (
          "alternatives" in node &&
          Array.isArray(node.alternatives) &&
          node.alternatives.every((x) => typeof x === "string") &&
          node.alternatives.length > 0
        ) {
          all.push({ field: "alternatives", text: node.alternatives.join(" ") });
        }
      }
      if (node.type === "constraint") {
        if ("constraint" in node && typeof node.constraint === "string") {
          all.push({ field: "constraint", text: node.constraint });
        }
        if ("reason" in node && typeof node.reason === "string") {
          all.push({ field: "reason", text: node.reason });
        }
      }
      if (node.type === "question") {
        if ("question" in node && typeof node.question === "string") {
          all.push({ field: "question", text: node.question });
        }
        if ("answer" in node && typeof node.answer === "string") {
          all.push({ field: "answer", text: node.answer });
        }
      }

      // Field filter (if specified)
      if (Array.isArray(searchOpts.fields) && searchOpts.fields.length > 0) {
        const allowed = new Set(searchOpts.fields);
        return all.filter((f) => allowed.has(f.field));
      }

      return all;
    };

    const matchTerm = (hay: string, term: string): { matched: boolean; score: number } => {
      if (!term) return { matched: true, score: 0 };
      const idx = hay.indexOf(term);
      if (idx >= 0) {
        // Score: count of occurrences
        let count = 0;
        for (
          let at = hay.indexOf(term, 0);
          at !== -1;
          at = hay.indexOf(term, at + Math.max(1, term.length))
        ) {
          count++;
        }
        return { matched: true, score: count };
      }
      if (!fuzzy) return { matched: false, score: 0 };

      // Very small fuzzy: allow <=1 edit distance against tokens
      const tokens = hay.split(/\s+/).filter(Boolean);
      for (const t of tokens) {
        if (levenshtein(t, term) <= 1) {
          return { matched: true, score: 0.5 };
        }
      }
      return { matched: false, score: 0 };
    };

    results = results.filter((node) => {
      const texts = getSearchTexts(node).map((f) => ({ field: f.field, text: normalize(f.text) }));

      const termMatches = terms.map((term) => {
        let best: { matched: boolean; score: number } = { matched: false, score: 0 };
        for (const t of texts) {
          const r = matchTerm(t.text, term);
          if (r.matched && r.score > best.score) best = r;
          if (best.matched && best.score >= 1) break;
        }
        return best;
      });

      const matched =
        operator === "OR"
          ? termMatches.some((m) => m.matched)
          : termMatches.every((m) => m.matched);

      if (!matched) return false;

      const score = termMatches.reduce((sum, m) => sum + (m.matched ? m.score : 0), 0);
      relevanceScores.set(keyOf(node.id), score);
      return true;
    });
  }

  // Relationship filtering (relatedTo + relationshipTypes + depth + direction)
  const needsEdgeIndex =
    Boolean(query.relatedTo) ||
    (query.relationshipTypes && query.relationshipTypes.length > 0) ||
    Boolean(query.hasRelationship?.direction && query.hasRelationship.direction !== "outgoing");

  const edgeIndex = needsEdgeIndex ? buildEdgeIndex(allNodes, keyOf) : null;

  if (query.relatedTo) {
    const depth = query.depth ?? 1;
    const direction = query.direction ?? "both";
    const allowedTypes =
      query.relationshipTypes && query.relationshipTypes.length > 0
        ? new Set(query.relationshipTypes)
        : null;

    const relatedKeys = traverseRelatedKeys(
      query.relatedTo,
      depth,
      direction,
      edgeIndex!,
      allowedTypes,
      keyOf
    );

    results = results.filter((node) => relatedKeys.has(keyOf(node.id)));
  } else if (query.relationshipTypes && query.relationshipTypes.length > 0) {
    const direction = query.direction ?? "outgoing";
    const allowedTypes = new Set(query.relationshipTypes);
    results = results.filter((node) => {
      const key = keyOf(node.id);
      const outHas = (edgeIndex!.outgoing.get(key) || []).some((e) => allowedTypes.has(e.type));
      const inHas = (edgeIndex!.incoming.get(key) || []).some((e) => allowedTypes.has(e.type));
      if (direction === "incoming") return inHas;
      if (direction === "both") return inHas || outHas;
      return outHas;
    });
  }

  // Hierarchical queries
  if (query.descendantsOf) {
    const descendants = traverseRelatedKeys(
      query.descendantsOf,
      query.depth ?? 50,
      "outgoing",
      buildEdgeIndex(allNodes, keyOf),
      new Set([query.relationshipType || "parent-child"]),
      keyOf
    );
    results = results.filter((node) => descendants.has(keyOf(node.id)));
  }

  if (query.ancestorsOf) {
    const ancestors = traverseRelatedKeys(
      query.ancestorsOf,
      query.depth ?? 50,
      "incoming",
      buildEdgeIndex(allNodes, keyOf),
      new Set([query.relationshipType || "parent-child"]),
      keyOf
    );
    results = results.filter((node) => ancestors.has(keyOf(node.id)));
  }

  // Dependency queries
  if (query.dependenciesOf) {
    const deps = traverseRelatedKeys(
      query.dependenciesOf,
      query.depth ?? 50,
      "outgoing",
      buildEdgeIndex(allNodes, keyOf),
      new Set(["depends-on"]),
      keyOf
    );
    results = results.filter((node) => deps.has(keyOf(node.id)));
  }

  if (query.dependentsOf) {
    const deps = traverseRelatedKeys(
      query.dependentsOf,
      query.depth ?? 50,
      "incoming",
      buildEdgeIndex(allNodes, keyOf),
      new Set(["depends-on"]),
      keyOf
    );
    results = results.filter((node) => deps.has(keyOf(node.id)));
  }

  // Relationship existence filtering (supports direction)
  if (query.hasRelationship) {
    const relFilter = query.hasRelationship;
    const direction = relFilter.direction ?? "outgoing";
    const typeFilter = relFilter.type ? new Set([relFilter.type]) : null;

    const edgeIndexForHas = edgeIndex ?? buildEdgeIndex(allNodes, keyOf);

    results = results.filter((node) => {
      const key = keyOf(node.id);

      const matchesOutgoing = (): boolean => {
        if (!node.relationships || node.relationships.length === 0) return false;
        return node.relationships.some((rel) => {
          if (typeFilter && !typeFilter.has(rel.type)) return false;
          if (relFilter.targetType) {
            const targetNode = getNodeByKey(keyOf(rel.target));
            return Boolean(targetNode && relFilter.targetType!.includes(targetNode.type));
          }
          return true;
        });
      };

      const matchesIncoming = (): boolean => {
        const incoming = edgeIndexForHas.incoming.get(key) || [];
        if (incoming.length === 0) return false;
        return incoming.some((rel) => {
          if (typeFilter && !typeFilter.has(rel.type)) return false;
          if (relFilter.targetType) {
            const sourceNode = getNodeByKey(rel.fromKey);
            return Boolean(sourceNode && relFilter.targetType!.includes(sourceNode.type));
          }
          return true;
        });
      };

      if (direction === "incoming") return matchesIncoming();
      if (direction === "both") return matchesOutgoing() || matchesIncoming();
      return matchesOutgoing();
    });
  }

  // Sorting
  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder || "desc";

  results.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "relevance": {
        const aScore = relevanceScores.get(keyOf(a.id)) ?? 0;
        const bScore = relevanceScores.get(keyOf(b.id)) ?? 0;
        comparison = aScore - bScore;
        if (comparison === 0) {
          comparison =
            new Date(a.metadata.createdAt).getTime() -
            new Date(b.metadata.createdAt).getTime();
        }
        break;
      }
      case "createdAt":
        comparison =
          new Date(a.metadata.createdAt).getTime() -
          new Date(b.metadata.createdAt).getTime();
        break;
      case "modifiedAt":
        comparison =
          new Date(a.metadata.modifiedAt).getTime() -
          new Date(b.metadata.modifiedAt).getTime();
        break;
      case "type":
        comparison = a.type.localeCompare(b.type);
        break;
      case "status":
        comparison = a.status.localeCompare(b.status);
        break;
      default:
        comparison = 0;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  // Pagination
  const limit = Math.min(query.limit ?? 50, 1000);
  const offset = query.offset ?? 0;
  const total = results.length;
  const page = results.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  return {
    nodes: page,
    total,
    limit,
    offset,
    hasMore,
  };
}

