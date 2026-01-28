import { InMemoryStore } from "../store/in-memory-store.js";
import type { ContextStore, NodeQuery } from "../types/context-store.js";
import type {
  AnyNode,
  DecisionNode,
  GoalNode,
  NodeId,
  RiskNode,
  TaskNode,
  QuestionNode,
  ConstraintNode,
  PlanNode,
} from "../types/node.js";
import type { Proposal } from "../types/proposal.js";
import { generateReadmeFromAcceptedContext } from "./readme.js";
import {
  importFromMarkdown,
  mergeMarkdownWithContext,
  projectToMarkdown,
} from "../markdown/projection.js";

export interface ScenarioSummary {
  id: string;
  title: string;
  description: string;
}

export interface ScenarioStepResult {
  id: string;
  title: string;
  ok: boolean;
  output?: unknown;
  error?: string;
}

export interface ScenarioRunResult {
  scenario: ScenarioSummary;
  startedAt: string;
  finishedAt: string;
  steps: ScenarioStepResult[];
}

type StepRunner = (store: ContextStore) => Promise<unknown>;

interface ScenarioDefinition extends ScenarioSummary {
  steps: Array<{ id: string; title: string; run: StepRunner }>;
}

function iso(n: number): string {
  // Deterministic timestamps for repeatable demos
  const base = Date.parse("2026-01-01T00:00:00.000Z");
  return new Date(base + n * 60_000).toISOString();
}

function nodeId(id: string, namespace?: string): NodeId {
  return namespace ? { id, namespace } : { id };
}

function meta(createdAt: string, createdBy = "demo", version = 1) {
  return {
    createdAt,
    createdBy,
    modifiedAt: createdAt,
    modifiedBy: createdBy,
    version,
  };
}

function proposalMeta(
  createdAt: string,
  createdBy = "demo",
  extra?: Partial<Proposal["metadata"]>
) {
  return {
    createdAt,
    createdBy,
    modifiedAt: createdAt,
    modifiedBy: createdBy,
    ...(extra || {}),
  };
}

async function applyAccepted(store: ContextStore, proposal: Proposal): Promise<void> {
  await store.createProposal(proposal);
  await store.applyProposal(proposal.id);
}

async function seedGraph(store: ContextStore): Promise<void> {
  const g1: GoalNode = {
    id: nodeId("g1"),
    type: "goal",
    status: "accepted",
    title: "Ship scenario runner demo",
    description: `A deterministic playground that can demonstrate:

- query + traversal
- conflict detection + merging
- stale proposal detection
- Markdown projection / import round-trips

\`\`\`ts
// Example: query accepted tasks
await store.queryNodes({ type: ["task"], status: ["accepted"] });
\`\`\`
`,
    content: "Goal: Ship scenario runner demo",
    metadata: meta(iso(1)),
  };

  const d1: DecisionNode = {
    id: nodeId("d1"),
    type: "decision",
    status: "accepted",
    title: "Extract store core semantics",
    description: `We extracted provider-agnostic logic into \`src/store/core/*\` so future stores reuse the same semantics.

\`\`\`text
in-memory/file/mongo → same apply/query/conflict semantics
\`\`\`
`,
    content: "Decision: extract store core",
    decision: "Extract store semantics to src/store/core",
    rationale: "Reuse across providers and improve testability",
    metadata: meta(iso(2)),
    relationships: [{ type: "references", target: g1.id }],
  };

  const t1: TaskNode = {
    id: nodeId("t1"),
    type: "task",
    status: "accepted",
    title: "Build playground UI",
    // Keep this exact phrase in the body so the round-trip scenario’s string replace stays stable.
    description: `Task: build playground UI

Goal: a small, dependency-free UI for demos.`,
    content: "Task: build playground UI",
    state: "open",
    metadata: meta(iso(3)),
    relationships: [{ type: "implements", target: d1.id }],
  };

  const t2: TaskNode = {
    id: nodeId("t2"),
    type: "task",
    status: "accepted",
    title: "Add conflict scenarios",
    description: `Task: add conflict scenarios

Demonstrate field-level merge vs conflicting field edits.`,
    content: "Task: add conflict scenarios",
    state: "open",
    metadata: meta(iso(4)),
    relationships: [{ type: "depends-on", target: t1.id }],
  };

  const r1: RiskNode = {
    id: nodeId("r1"),
    type: "risk",
    status: "accepted",
    title: "Provider divergence risk",
    description: `If stores implement semantics separately, behavior can drift.

Mitigation: shared core semantics + tests.`,
    content: "Risk: divergence across providers",
    severity: "medium",
    likelihood: "possible",
    mitigation: "Shared core semantics + coverage tests",
    metadata: meta(iso(5)),
    relationships: [{ type: "blocks", target: t1.id }],
  };

  const pSeed: Proposal = {
    id: "p-seed",
    status: "accepted",
    operations: [
      { id: "op1", type: "create", order: 1, node: g1 },
      { id: "op2", type: "create", order: 2, node: d1 },
      { id: "op3", type: "create", order: 3, node: t1 },
      { id: "op4", type: "create", order: 4, node: t2 },
      { id: "op5", type: "create", order: 5, node: r1 },
    ],
    metadata: proposalMeta(iso(0)),
  };

  await applyAccepted(store, pSeed);
}

function nodeSummary(nodes: AnyNode[]) {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    status: n.status,
    content: n.content,
  }));
}

async function runQuery(store: ContextStore, query: NodeQuery) {
  const res = await store.queryNodes(query);
  return {
    query,
    total: res.total,
    limit: res.limit,
    offset: res.offset,
    hasMore: res.hasMore,
    nodes: nodeSummary(res.nodes),
  };
}

export function listScenarios(): ScenarioSummary[] {
  return SCENARIOS.map(({ steps: _steps, ...meta }) => meta);
}

export async function runScenario(scenarioId: string): Promise<ScenarioRunResult> {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }

  const store = new InMemoryStore();
  const startedAt = new Date().toISOString();
  const steps: ScenarioStepResult[] = [];

  for (const step of scenario.steps) {
    try {
      const output = await step.run(store);
      steps.push({ id: step.id, title: step.title, ok: true, output });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      steps.push({ id: step.id, title: step.title, ok: false, error: message });
      break;
    }
  }

  const finishedAt = new Date().toISOString();
  return { scenario, startedAt, finishedAt, steps };
}

const SCENARIOS: ScenarioDefinition[] = [
  {
    id: "query-and-traversal",
    title: "Query + traversal",
    description:
      "Seeds a small graph and runs relationship, dependency, and relatedTo queries.",
    steps: [
      {
        id: "seed",
        title: "Seed graph (accepted create proposal)",
        run: async (store) => {
          await seedGraph(store);
          const all = await store.queryNodes({ status: ["accepted"], limit: 50, offset: 0 });
          return { acceptedNodes: nodeSummary(all.nodes) };
        },
      },
      {
        id: "query-related-to",
        title: "Query tasks implementing decision d1 via relatedTo",
        run: async (store) =>
          await runQuery(store, {
            status: ["accepted"],
            type: ["task"],
            relatedTo: nodeId("d1"),
            relationshipTypes: ["implements"],
            depth: 1,
            direction: "both",
          }),
      },
      {
        id: "query-dependencies",
        title: "Query dependencies of task t2",
        run: async (store) =>
          await runQuery(store, {
            status: ["accepted"],
            dependenciesOf: nodeId("t2"),
          }),
      },
      {
        id: "query-dependents",
        title: "Query dependents of task t1",
        run: async (store) =>
          await runQuery(store, {
            status: ["accepted"],
            dependentsOf: nodeId("t1"),
          }),
      },
    ],
  },
  {
    id: "conflicts-and-merge",
    title: "Conflicts + merge",
    description:
      "Creates competing open proposals and demonstrates detectConflicts + mergeProposals behavior.",
    steps: [
      {
        id: "seed",
        title: "Seed graph (accepted create proposal)",
        run: async (store) => {
          await seedGraph(store);
          return { ok: true };
        },
      },
      {
        id: "create-proposals",
        title: "Create competing open proposals against node d1",
        run: async (store) => {
          const base = await store.getNode(nodeId("d1"));
          if (!base) throw new Error("missing base node d1");

          const p1: Proposal = {
            id: "p-update-decision",
            status: "open",
            operations: [
              {
                id: "op",
                type: "update",
                order: 1,
                nodeId: nodeId("d1"),
                changes: { decision: "Extract core store modules" },
              },
            ],
            metadata: proposalMeta(iso(10), "alice", {
              baseVersions: { d1: base.metadata.version },
            }),
          };

          const p2: Proposal = {
            id: "p-update-rationale",
            status: "open",
            operations: [
              {
                id: "op",
                type: "update",
                order: 1,
                nodeId: nodeId("d1"),
                changes: { rationale: "Reuse semantics across providers" },
              },
            ],
            metadata: proposalMeta(iso(11), "bob", {
              baseVersions: { d1: base.metadata.version },
            }),
          };

          const p3: Proposal = {
            id: "p-conflict-decision",
            status: "open",
            operations: [
              {
                id: "op",
                type: "update",
                order: 1,
                nodeId: nodeId("d1"),
                changes: { decision: "Keep everything in InMemoryStore" },
              },
            ],
            metadata: proposalMeta(iso(12), "carol", {
              baseVersions: { d1: base.metadata.version },
            }),
          };

          await store.createProposal(p1);
          await store.createProposal(p2);
          await store.createProposal(p3);
          return { created: ["p-update-decision", "p-update-rationale", "p-conflict-decision"] };
        },
      },
      {
        id: "detect-conflicts",
        title: "Detect conflicts for p-update-decision",
        run: async (store) => await store.detectConflicts("p-update-decision"),
      },
      {
        id: "merge-ok",
        title: "Merge p-update-decision + p-update-rationale (no conflict expected)",
        run: async (store) => await store.mergeProposals(["p-update-decision", "p-update-rationale"]),
      },
      {
        id: "merge-conflict",
        title: "Merge p-update-decision + p-conflict-decision (conflict expected)",
        run: async (store) => await store.mergeProposals(["p-update-decision", "p-conflict-decision"]),
      },
    ],
  },
  {
    id: "stale-proposal",
    title: "Stale proposal (optimistic locking)",
    description:
      "Shows isProposalStale using proposal.metadata.baseVersions vs current node metadata.version.",
    steps: [
      {
        id: "seed",
        title: "Seed graph (accepted create proposal)",
        run: async (store) => {
          await seedGraph(store);
          return { ok: true };
        },
      },
      {
        id: "bump-version",
        title: "Bump node d1 version via accepted update",
        run: async (store) => {
          const p: Proposal = {
            id: "p-bump",
            status: "accepted",
            operations: [
              {
                id: "op",
                type: "update",
                order: 1,
                nodeId: nodeId("d1"),
                changes: { content: "Decision: extract store core (updated)" },
              },
            ],
            metadata: proposalMeta(iso(20), "demo"),
          };
          await applyAccepted(store, p);
          const after = await store.getNode(nodeId("d1"));
          return { versionAfter: after?.metadata.version, modifiedAt: after?.metadata.modifiedAt };
        },
      },
      {
        id: "create-stale",
        title: "Create open proposal with stale baseVersions",
        run: async (store) => {
          const current = await store.getNode(nodeId("d1"));
          if (!current) throw new Error("missing node d1");
          const staleBase = Math.max(0, current.metadata.version - 1);

          const p: Proposal = {
            id: "p-stale",
            status: "open",
            operations: [
              {
                id: "op",
                type: "update",
                order: 1,
                nodeId: nodeId("d1"),
                changes: { rationale: "Stale edit" },
              },
            ],
            metadata: proposalMeta(iso(21), "demo", {
              baseVersions: { d1: staleBase },
            }),
          };
          await store.createProposal(p);
          return { baseVersions: p.metadata.baseVersions, currentVersion: current.metadata.version };
        },
      },
      {
        id: "check-stale",
        title: "isProposalStale(p-stale) should be true",
        run: async (store) => ({ stale: await store.isProposalStale("p-stale") }),
      },
    ],
  },
  {
    id: "apply-and-issues",
    title: "Apply proposal + create issues",
    description:
      "Applies a create+update sequence and demonstrates createIssuesFromProposal output for task creation.",
    steps: [
      {
        id: "create-task",
        title: "Create a task via accepted proposal",
        run: async (store) => {
          const task: TaskNode = {
            id: nodeId("demo-task"),
            type: "task",
            status: "accepted",
            content: "Demo task created by proposal",
            state: "open",
            metadata: meta(iso(30)),
          };

          const p: Proposal = {
            id: "p-create-task",
            status: "accepted",
            operations: [{ id: "op1", type: "create", order: 1, node: task }],
            metadata: proposalMeta(iso(30), "demo"),
          };

          await applyAccepted(store, p);
          const created = await store.getNode(task.id);
          return { created: created ? nodeSummary([created]) : [] };
        },
      },
      {
        id: "issues",
        title: "Create issues from proposal p-create-task",
        run: async (store) => await store.createIssuesFromProposal("p-create-task", "review-1"),
      },
      {
        id: "insert-delete-content",
        title: "Apply insert+delete(text) operations against demo-task",
        run: async (store) => {
          const p: Proposal = {
            id: "p-edit-text",
            status: "accepted",
            operations: [
              { id: "op1", type: "insert", order: 1, position: 0, text: "[PREFIX] ", sourceNodeId: nodeId("demo-task") },
              { id: "op2", type: "delete", order: 2, start: 0, end: 9, sourceNodeId: nodeId("demo-task") },
            ],
            metadata: proposalMeta(iso(31), "demo"),
          };
          await applyAccepted(store, p);
          const after = await store.getNode(nodeId("demo-task"));
          return { contentAfter: after?.content, versionAfter: after?.metadata.version };
        },
      },
    ],
  },
  {
    id: "markdown-projection-roundtrip",
    title: "Markdown projection + round-trip import",
    description:
      "Generates Markdown (ctx blocks) from accepted truth, edits it, imports as proposals, applies them, then merges stale Markdown back to truth.",
    steps: [
      {
        id: "seed",
        title: "Seed graph (accepted create proposal)",
        run: async (store) => {
          await seedGraph(store);
          return { ok: true };
        },
      },
      {
        id: "project",
        title: "Project store to Markdown (ctx blocks)",
        run: async (store) => {
          const markdown = await projectToMarkdown(store);
          return { markdown };
        },
      },
      {
        id: "edit-and-import",
        title: "Edit Markdown and import changes as proposals",
        run: async (store) => {
          const original = await projectToMarkdown(store);

          // Simulate a human editing the content of an existing ctx block.
          // (Projection uses node.content, so editing content is the simplest round-trip demo.)
          const edited = original.replace(
            "Task: build playground UI",
            "Task: build playground UI (edited in Markdown)"
          );

          const proposals = await importFromMarkdown(store, edited, "demo", "PLAYGROUND.md");

          return {
            editedMarkdown: edited,
            proposals: proposals.map((p) => ({
              id: p.id,
              status: p.status,
              operations: p.operations.map((op) => ({
                type: op.type,
                order: op.order,
                ...(op.type === "create" && "node" in op ? { nodeId: op.node.id } : {}),
                ...("nodeId" in op ? { nodeId: op.nodeId } : {}),
              })),
            })),
          };
        },
      },
      {
        id: "apply-imported",
        title: "Accept + apply imported proposals, then re-project to Markdown",
        run: async (store) => {
          const original = await projectToMarkdown(store);
          const edited = original.replace(
            "Task: build playground UI",
            "Task: build playground UI (edited in Markdown)"
          );

          const proposals = await importFromMarkdown(store, edited, "demo", "PLAYGROUND.md");
          for (const p of proposals) {
            await store.createProposal(p);
            await store.submitReview({
              id: `review-${p.id}`,
              proposalId: p.id,
              reviewer: "demo-reviewer",
              reviewedAt: new Date().toISOString(),
              action: "accept",
            });
            await store.applyProposal(p.id);
          }

          const after = await projectToMarkdown(store);
          return { appliedProposalIds: proposals.map((p) => p.id), markdownAfter: after };
        },
      },
      {
        id: "merge-stale",
        title: "Merge stale Markdown with context (rewrites blocks back to accepted truth)",
        run: async (store) => {
          const truth = await projectToMarkdown(store);
          const stale = truth.replace(
            "Task: build playground UI",
            "Task: build playground UI (STALE LOCAL EDIT)"
          );

          const merged = await mergeMarkdownWithContext(stale, store);
          return { staleMarkdown: stale, mergedMarkdown: merged };
        },
      },
    ],
  },
  {
    id: "readme-from-accepted-context",
    title: "Generate README from accepted context",
    description:
      "Seeds a small accepted graph and generates a README-style Markdown summary from accepted nodes.",
    steps: [
      {
        id: "seed",
        title: "Seed graph (accepted create proposal)",
        run: async (store) => {
          await seedGraph(store);

          // Add a couple more accepted nodes to make the README richer without affecting other scenarios.
          const q1: QuestionNode = {
            id: nodeId("q1"),
            type: "question",
            status: "accepted",
            content: "Question: How do we demo store behavior quickly?",
            question: "How do we demo store behavior quickly?",
            answer: "Use a deterministic scenario runner UI that exercises the store end-to-end.",
            answeredAt: iso(6),
            metadata: meta(iso(6)),
          };

          const c1: ConstraintNode = {
            id: nodeId("c1"),
            type: "constraint",
            status: "accepted",
            content: "Constraint: keep demos deterministic",
            constraint: "Demos must be deterministic and repeatable.",
            reason: "Enables reliable presentations and regression checking.",
            metadata: meta(iso(7)),
          };

          const p: Proposal = {
            id: "p-seed-readme-extras",
            status: "accepted",
            operations: [
              { id: "op1", type: "create", order: 1, node: q1 },
              { id: "op2", type: "create", order: 2, node: c1 },
            ],
            metadata: proposalMeta(iso(7), "demo"),
          };

          await applyAccepted(store, p);
          return { ok: true };
        },
      },
      {
        id: "generate",
        title: "Generate README Markdown from accepted nodes",
        run: async (store) => {
          const readmeMarkdown = await generateReadmeFromAcceptedContext(store);
          return { readmeMarkdown };
        },
      },
    ],
  },
];

