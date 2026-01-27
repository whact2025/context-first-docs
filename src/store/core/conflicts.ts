import { AnyNode, NodeId } from "../../types/node.js";
import { ConflictDetectionResult, MergeResult, ProposalConflict } from "../../types/conflicts.js";
import { Proposal } from "../../types/proposal.js";
import { isDeleteTextOperation } from "./updates.js";

export interface ConflictHelpers {
  keyOf: (id: NodeId) => string;
  getNodeByKey: (key: string) => AnyNode | null;
  getNode: (id: NodeId) => AnyNode | null;
}

export function detectConflictsForProposal(
  proposal: Proposal,
  openProposals: Proposal[],
  helpers: Pick<ConflictHelpers, "keyOf">
): ConflictDetectionResult {
  const { keyOf } = helpers;

  const conflicts: ProposalConflict[] = [];
  const mergeable: string[] = [];
  const needsResolution: string[] = [];

  const summarize = (p: Proposal) => {
    const map = new Map<
      string,
      { nodeId: NodeId; kinds: Set<string>; fields: Set<string> }
    >();

    for (const op of p.operations) {
      let nodeId: NodeId | null = null;
      let kind: string = op.type;
      let fields: string[] = [];

      if (op.type === "create" && "node" in op) {
        nodeId = op.node.id;
      } else if ("nodeId" in op) {
        nodeId = op.nodeId;
      } else if (op.type === "insert") {
        nodeId = op.sourceNodeId ?? null;
      } else if (isDeleteTextOperation(op)) {
        nodeId = op.sourceNodeId ?? null;
      }

      if (!nodeId) continue;

      if (op.type === "update") {
        kind = "update";
        fields = Object.keys(op.changes || {});
      } else if (op.type === "status-change") {
        kind = "status-change";
        fields = ["status"];
      } else if (op.type === "insert" || isDeleteTextOperation(op)) {
        kind = "content-edit";
        fields = ["content"];
      } else if (op.type === "move") {
        kind = "move";
        fields = ["relationships"];
      } else if (op.type === "delete") {
        kind = "delete";
      } else if (op.type === "create") {
        kind = "create";
      }

      const key = keyOf(nodeId);
      if (!map.has(key)) {
        map.set(key, { nodeId, kinds: new Set(), fields: new Set() });
      }
      const entry = map.get(key)!;
      entry.kinds.add(kind);
      for (const f of fields) entry.fields.add(f);
    }

    return map;
  };

  const a = summarize(proposal);

  for (const otherProposal of openProposals) {
    if (otherProposal.id === proposal.id) continue;

    const b = summarize(otherProposal);
    const sharedKeys = Array.from(a.keys()).filter((k) => b.has(k));
    if (sharedKeys.length === 0) {
      mergeable.push(otherProposal.id);
      continue;
    }

    const conflictingNodes: NodeId[] = [];
    const conflictingFields: Record<string, string[]> = {};

    let hardNodeConflict = false;
    let fieldConflict = false;

    for (const key of sharedKeys) {
      const left = a.get(key)!;
      const right = b.get(key)!;
      conflictingNodes.push(left.nodeId);

      const leftNonUpdate = Array.from(left.kinds).some((k) => k !== "update");
      const rightNonUpdate = Array.from(right.kinds).some((k) => k !== "update");
      if (leftNonUpdate || rightNonUpdate) {
        hardNodeConflict = true;
        continue;
      }

      // Both are updates: check overlapping fields
      const overlap = Array.from(left.fields).filter((f) => right.fields.has(f));
      if (overlap.length > 0) {
        fieldConflict = true;
        conflictingFields[key] = overlap;
      }
    }

    if (!hardNodeConflict && !fieldConflict) {
      mergeable.push(otherProposal.id);
      continue;
    }

    conflicts.push({
      proposals: [proposal.id, otherProposal.id],
      conflictingNodes,
      conflictingFields: Object.keys(conflictingFields).length ? conflictingFields : undefined,
      severity: hardNodeConflict ? "node" : "field",
      autoResolvable: false,
    });
    needsResolution.push(otherProposal.id);
  }

  return { conflicts, mergeable, needsResolution };
}

export function isProposalStale(
  proposal: Proposal,
  helpers: Pick<ConflictHelpers, "keyOf" | "getNode">
): boolean {
  const { keyOf, getNode } = helpers;

  // Prefer optimistic-locking baseVersions if provided
  if (proposal.metadata.baseVersions) {
    for (const operation of proposal.operations) {
      let nodeId: NodeId | null = null;

      if (operation.type === "create" && "node" in operation) {
        nodeId = operation.node.id;
      } else if ("nodeId" in operation) {
        nodeId = operation.nodeId;
      } else if (operation.type === "insert") {
        nodeId = operation.sourceNodeId ?? null;
      } else if (isDeleteTextOperation(operation)) {
        nodeId = operation.sourceNodeId ?? null;
      }

      if (!nodeId) continue;

      const key = keyOf(nodeId);
      const base =
        proposal.metadata.baseVersions[key] ??
        proposal.metadata.baseVersions[nodeId.id];

      if (base === undefined) continue;

      const node = getNode(nodeId);
      if (!node) return true;
      if (node.metadata.version !== base) return true;
    }
    return false;
  }

  // Fallback: modifiedAt comparison (coarse)
  for (const operation of proposal.operations) {
    let nodeId: NodeId | null = null;

    if (operation.type === "create" && "node" in operation) {
      nodeId = operation.node.id;
    } else if ("nodeId" in operation) {
      nodeId = operation.nodeId;
    } else if (operation.type === "insert") {
      nodeId = operation.sourceNodeId ?? null;
    } else if (isDeleteTextOperation(operation)) {
      nodeId = operation.sourceNodeId ?? null;
    }

    if (!nodeId) continue;
    const node = getNode(nodeId);
    if (!node) continue;

    const proposalCreatedAt = new Date(proposal.metadata.createdAt);
    const nodeModifiedAt = new Date(node.metadata.modifiedAt);
    if (nodeModifiedAt > proposalCreatedAt) return true;
  }

  return false;
}

export function mergeProposals(
  proposals: Proposal[],
  helpers: Pick<ConflictHelpers, "keyOf" | "getNodeByKey">
): MergeResult {
  const { keyOf, getNodeByKey } = helpers;

  if (proposals.length === 0) {
    return { merged: [], conflicts: [], autoMerged: [] };
  }

  const merged: Array<{ nodeId: NodeId; field: string; oldValue: unknown; newValue: unknown }> = [];
  const conflicts: Array<{ field: string; nodeId: NodeId; proposal1Value: unknown; proposal2Value: unknown }> = [];
  const autoMerged: Array<{ nodeId: NodeId; field: string; oldValue: unknown; newValue: unknown }> = [];

  const nodeChanges = new Map<string, Map<string, { proposalId: string; value: unknown; nodeId: NodeId }>>();

  for (const proposal of proposals) {
    for (const operation of proposal.operations) {
      if (operation.type === "update") {
        const nodeId = operation.nodeId;
        const nodeK = keyOf(nodeId);
        const changes = operation.changes as Record<string, unknown>;

        if (!nodeChanges.has(nodeK)) nodeChanges.set(nodeK, new Map());
        const fieldMap = nodeChanges.get(nodeK)!;

        for (const [field, value] of Object.entries(changes)) {
          if (fieldMap.has(field)) {
            const existing = fieldMap.get(field)!;
            conflicts.push({
              field,
              nodeId,
              proposal1Value: existing.value,
              proposal2Value: value,
            });
          } else {
            fieldMap.set(field, { proposalId: proposal.id, value, nodeId });
          }
        }
      } else if (operation.type === "status-change") {
        const nodeId = operation.nodeId;
        const nodeK = keyOf(nodeId);
        if (!nodeChanges.has(nodeK)) nodeChanges.set(nodeK, new Map());
        const fieldMap = nodeChanges.get(nodeK)!;
        const field = "status";
        const value = operation.newStatus;
        if (fieldMap.has(field)) {
          const existing = fieldMap.get(field)!;
          conflicts.push({
            field,
            nodeId,
            proposal1Value: existing.value,
            proposal2Value: value,
          });
        } else {
          fieldMap.set(field, { proposalId: proposal.id, value, nodeId });
        }
      }
    }
  }

  for (const [nodeK, fields] of nodeChanges.entries()) {
    const baseNode = getNodeByKey(nodeK);
    for (const [field, change] of fields.entries()) {
      const oldValue = baseNode ? (Reflect.get(baseNode, field) as unknown) : undefined;
      const record = { nodeId: change.nodeId, field, oldValue, newValue: change.value };
      merged.push(record);
      autoMerged.push(record);
    }
  }

  return { merged, conflicts, autoMerged };
}

