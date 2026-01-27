import {
  AnyNode,
  NodeId,
  NodeRelationship,
  RelationshipType,
  RiskNode,
  TaskNode,
  TextRange,
  PlanStep,
} from "../../types/node.js";
import {
  AnyOperation,
  UpdateOperation,
} from "../../types/proposal.js";
import {
  Guard,
  isArrayOf,
  isNumber,
  isOptional,
  isRecord,
  isString,
  isOneOf,
} from "../../utils/type-guards.js";

const isStringArray: Guard<string[]> = isArrayOf(isString);

const isRelationshipType: Guard<RelationshipType> = isOneOf(
  [
    "parent-child",
    "depends-on",
    "references",
    "supersedes",
    "related-to",
    "implements",
    "blocks",
    "mitigates",
  ] as const
);

function isNodeId(value: unknown): value is NodeId {
  if (!isRecord(value)) return false;
  return isString(value["id"]) && isOptional(isString)(value["namespace"]);
}

function isNodeIdArray(value: unknown): value is NodeId[] {
  return Array.isArray(value) && value.every(isNodeId);
}

function isNodeRelationship(value: unknown): value is NodeRelationship {
  if (!isRecord(value)) return false;
  return isRelationshipType(value["type"]) && isNodeId(value["target"]);
}

function isNodeRelationshipArray(value: unknown): value is NodeRelationship[] {
  return Array.isArray(value) && value.every(isNodeRelationship);
}

function isTextRange(value: unknown): value is TextRange {
  if (!isRecord(value)) return false;
  return (
    isNumber(value["start"]) &&
    isNumber(value["end"]) &&
    isOptional(isString)(value["source"])
  );
}

function isPlanStep(value: unknown): value is PlanStep {
  if (!isRecord(value)) return false;
  const description = value["description"];
  const order = value["order"];
  const references = value["references"];
  return (
    isString(description) &&
    isNumber(order) &&
    (references === undefined || isNodeIdArray(references))
  );
}

function isPlanStepArray(value: unknown): value is PlanStep[] {
  return Array.isArray(value) && value.every(isPlanStep);
}

const isTaskState: Guard<TaskNode["state"]> = isOneOf(
  ["open", "in-progress", "blocked", "completed", "cancelled"] as const
);

const isRiskSeverity: Guard<RiskNode["severity"]> = isOneOf(
  ["low", "medium", "high", "critical"] as const
);

const isRiskLikelihood: Guard<RiskNode["likelihood"]> = isOneOf(
  ["unlikely", "possible", "likely", "certain"] as const
);

/**
 * Apply an UpdateOperation.changes object onto an existing node, with:
 * - explicit handling for common fields (content/status/relationships/etc)
 * - explicit handling for known typed fields per node type
 * - passthrough for unknown keys (stored for forward compatibility)
 */
export function applyUpdateChanges(
  existing: AnyNode,
  changes: UpdateOperation["changes"]
): AnyNode {
  const commonKeys: readonly string[] = [
    "content",
    "status",
    "relationships",
    "relations",
    "referencedBy",
    "sourceFiles",
    "textRange",
  ];

  const applyCommon = <T extends AnyNode>(node: T): T => {
    let next: T = { ...node };

    if (typeof changes.content === "string") {
      next = { ...next, content: changes.content };
    }
    if (changes.status) {
      next = { ...next, status: changes.status };
    }

    const relationships = changes["relationships"];
    if (isNodeRelationshipArray(relationships)) {
      next = { ...next, relationships };
    }

    const relations = changes["relations"];
    if (isNodeIdArray(relations)) {
      next = { ...next, relations };
    }

    const referencedBy = changes["referencedBy"];
    if (isNodeIdArray(referencedBy)) {
      next = { ...next, referencedBy };
    }

    const sourceFiles = changes["sourceFiles"];
    if (isStringArray(sourceFiles)) {
      next = { ...next, sourceFiles };
    }

    const textRange = changes["textRange"];
    if (isTextRange(textRange)) {
      next = { ...next, textRange };
    }

    return next;
  };

  const applyUnknown = <T extends AnyNode>(node: T, knownKeys: ReadonlySet<string>): T => {
    const next: T = { ...node };
    for (const [key, value] of Object.entries(changes)) {
      if (knownKeys.has(key)) continue;
      if (key === "id" || key === "type" || key === "metadata") continue;
      Reflect.set(next, key, value);
    }
    return next;
  };

  switch (existing.type) {
    case "goal": {
      const typeKeys: readonly string[] = ["criteria"];
      const knownKeys = new Set<string>([...commonKeys, ...typeKeys]);
      const next = applyCommon(existing);
      const criteria = changes["criteria"];
      if (isStringArray(criteria)) Reflect.set(next, "criteria", criteria);
      return applyUnknown(next, knownKeys);
    }
    case "decision": {
      const typeKeys: readonly string[] = ["decision", "rationale", "alternatives", "decidedAt"];
      const knownKeys = new Set<string>([...commonKeys, ...typeKeys]);
      const next = applyCommon(existing);
      const decision = changes["decision"];
      if (typeof decision === "string") Reflect.set(next, "decision", decision);
      const rationale = changes["rationale"];
      if (typeof rationale === "string") Reflect.set(next, "rationale", rationale);
      const alternatives = changes["alternatives"];
      if (isStringArray(alternatives)) Reflect.set(next, "alternatives", alternatives);
      const decidedAt = changes["decidedAt"];
      if (typeof decidedAt === "string") Reflect.set(next, "decidedAt", decidedAt);
      return applyUnknown(next, knownKeys);
    }
    case "constraint": {
      const typeKeys: readonly string[] = ["constraint", "reason"];
      const knownKeys = new Set<string>([...commonKeys, ...typeKeys]);
      const next = applyCommon(existing);
      const constraint = changes["constraint"];
      if (typeof constraint === "string") Reflect.set(next, "constraint", constraint);
      const reason = changes["reason"];
      if (typeof reason === "string") Reflect.set(next, "reason", reason);
      return applyUnknown(next, knownKeys);
    }
    case "task": {
      const typeKeys: readonly string[] = ["state", "assignee", "dueDate", "dependencies"];
      const knownKeys = new Set<string>([...commonKeys, ...typeKeys]);
      const next = applyCommon(existing);
      const state = changes["state"];
      if (isTaskState(state)) Reflect.set(next, "state", state);
      const assignee = changes["assignee"];
      if (typeof assignee === "string") Reflect.set(next, "assignee", assignee);
      const dueDate = changes["dueDate"];
      if (typeof dueDate === "string") Reflect.set(next, "dueDate", dueDate);
      const dependencies = changes["dependencies"];
      if (isNodeIdArray(dependencies)) Reflect.set(next, "dependencies", dependencies);
      return applyUnknown(next, knownKeys);
    }
    case "risk": {
      const typeKeys: readonly string[] = ["severity", "likelihood", "mitigation"];
      const knownKeys = new Set<string>([...commonKeys, ...typeKeys]);
      const next = applyCommon(existing);
      const severity = changes["severity"];
      if (isRiskSeverity(severity)) Reflect.set(next, "severity", severity);
      const likelihood = changes["likelihood"];
      if (isRiskLikelihood(likelihood)) Reflect.set(next, "likelihood", likelihood);
      const mitigation = changes["mitigation"];
      if (typeof mitigation === "string") Reflect.set(next, "mitigation", mitigation);
      return applyUnknown(next, knownKeys);
    }
    case "question": {
      const typeKeys: readonly string[] = ["question", "answer", "answeredAt"];
      const knownKeys = new Set<string>([...commonKeys, ...typeKeys]);
      const next = applyCommon(existing);
      const question = changes["question"];
      if (typeof question === "string") Reflect.set(next, "question", question);
      const answer = changes["answer"];
      if (typeof answer === "string") Reflect.set(next, "answer", answer);
      const answeredAt = changes["answeredAt"];
      if (typeof answeredAt === "string") Reflect.set(next, "answeredAt", answeredAt);
      return applyUnknown(next, knownKeys);
    }
    case "plan": {
      const typeKeys: readonly string[] = ["steps"];
      const knownKeys = new Set<string>([...commonKeys, ...typeKeys]);
      const next = applyCommon(existing);
      const steps = changes["steps"];
      if (isPlanStepArray(steps)) Reflect.set(next, "steps", steps);
      return applyUnknown(next, knownKeys);
    }
    default: {
      const knownKeys = new Set<string>(commonKeys);
      const next = applyCommon(existing);
      return applyUnknown(next, knownKeys);
    }
  }
}

export function isDeleteTextOperation(op: AnyOperation): op is Extract<AnyOperation, { type: "delete"; start: number; end: number }> {
  return op.type === "delete" && "start" in op && "end" in op;
}

export function isDeleteNodeOperation(op: AnyOperation): op is Extract<AnyOperation, { type: "delete"; nodeId: NodeId }> {
  return op.type === "delete" && "nodeId" in op;
}

