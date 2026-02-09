import http from "node:http";

import MarkdownIt from "markdown-it";

import { createRustServerClient } from "../api-client.js";
import { initTelemetry } from "../telemetry.js";
import type { ContextStore } from "../types/context-store.js";
import { projectToMarkdown } from "../markdown/projection.js";
import { ctxRenderPlugin } from "../markdown/ctx-render-plugin.js";
import { buildEdgeIndex, traverseRelatedKeys } from "../store/core/graph.js";
import { applyAcceptedProposalToNodeMap } from "../store/core/apply-proposal.js";
import { PreviewStore } from "../store/preview-store.js";
import { nodeKey as coreNodeKey } from "../store/core/node-key.js";
import { listScenarios, runScenario } from "./scenarios.js";
import { getGuidedScenario, listGuidedScenarios } from "./guided.js";
import type {
  AnyNode,
  NodeId,
  RelationshipType,
  DecisionNode,
  QuestionNode,
  ConstraintNode,
} from "../types/node.js";
import type { Comment, Proposal, Review } from "../types/proposal.js";

const md = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
});
// @ts-expect-error - markdown-it has .use() at runtime; types may not expose it
md.use(ctxRenderPlugin);

type GuidedSession = {
  id: string;
  scenarioId: string;
  store: ContextStore;
  stepIndex: number;
  inputs: Record<string, string>;
  history: Array<{ id: string; title: string; ok: boolean; output?: unknown; error?: string }>;
};

const guidedSessions = new Map<string, GuidedSession>();

// ---- ACAL mock UI backing store (Rust server, seeded) ----

let acalStoreInit: Promise<ContextStore> | null = null;
let acalStore: ContextStore | null = null;

function nodeKey(id: NodeId): string {
  return id.namespace ? `${id.namespace}:${id.id}` : id.id;
}

function iso(n: number): string {
  const base = Date.parse("2026-01-01T00:00:00.000Z");
  return new Date(base + n * 60_000).toISOString();
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

async function ensureAcalStore(): Promise<ContextStore> {
  if (acalStore) return acalStore;
  if (!acalStoreInit) {
    acalStoreInit = (async () => {
      const store = createRustServerClient();

      // Seed accepted truth via an accepted proposal that is applied.
      const seedProposal: Proposal = {
        id: "p-seed-ui",
        status: "accepted",
        operations: [
          {
            id: "op-1",
            type: "create",
            order: 1,
            node: {
              id: { id: "goal-001", namespace: "ui" },
              type: "goal",
              status: "accepted",
              title: "Ship ACAL UI MVP",
              description:
                "Build a navigable UI that makes review-mode invariants obvious (Propose → Review → Apply).",
              content: "Ship ACAL UI MVP",
              metadata: meta(iso(1)),
            },
          },
          {
            id: "op-2",
            type: "create",
            order: 2,
            node: {
              id: { id: "decision-001", namespace: "ui" },
              type: "decision",
              status: "accepted",
              title: "Accepted truth is read-only",
              description:
                "UIs must never directly edit accepted nodes; all writes are proposals; reviews accept/reject; apply is explicit.",
              content: "Accepted truth is read-only",
              decision: "Enforce review-mode semantics in the API",
              rationale: "Multi-client collaboration requires a single source of truth with explicit governance.",
              alternatives: ["Allow direct edits (rejected)", "Rely on client enforcement only (rejected)"],
              metadata: meta(iso(2)),
              relationships: [{ type: "references", target: { id: "goal-001", namespace: "ui" } }],
            },
          },
          {
            id: "op-3",
            type: "create",
            order: 3,
            node: {
              id: { id: "task-001", namespace: "ui" },
              type: "task",
              status: "accepted",
              title: "Implement proposal composer",
              description:
                "Provide a structured proposal composer that previews node/field diffs before submit.",
              content: "Implement proposal composer",
              state: "open",
              metadata: meta(iso(3)),
              relationships: [
                { type: "implements", target: { id: "decision-001", namespace: "ui" } },
                { type: "references", target: { id: "goal-001", namespace: "ui" } },
              ],
            },
          },
          {
            id: "op-4",
            type: "create",
            order: 4,
            node: {
              id: { id: "risk-001", namespace: "ui" },
              type: "risk",
              status: "accepted",
              title: "Accepted vs Applied confusion",
              description:
                "If the UI conflates review acceptance with apply, users will be confused about what changed.",
              content: "Accepted vs Applied confusion",
              severity: "medium",
              likelihood: "likely",
              mitigation:
                "Show proposal state clearly and represent applied explicitly (roadmap).",
              metadata: meta(iso(4)),
              relationships: [{ type: "blocks", target: { id: "task-001", namespace: "ui" } }],
            },
          },
          {
            id: "op-5",
            type: "create",
            order: 5,
            node: {
              id: { id: "question-001", namespace: "ui" },
              type: "question",
              status: "accepted",
              title: "What is the workspace boundary?",
              description:
                "Decide whether workspace maps to store instance, namespace partition, or an explicit workspaceId on all entities.",
              content: "What is the workspace boundary?",
              question: "What is the workspace boundary?",
              metadata: meta(iso(5)),
              relationships: [{ type: "references", target: { id: "goal-001", namespace: "ui" } }],
            },
          },
        ],
        metadata: proposalMeta(iso(0)),
      };

      await store.createProposal(seedProposal);
      await store.applyProposal(seedProposal.id);

      // Seed a couple open proposals for the UI to review/apply.
      const decisionId: NodeId = { id: "decision-001", namespace: "ui" };
      const decisionNode = await store.getNode(decisionId);
      const baseVersion = decisionNode?.metadata.version ?? 1;

      const p1: Proposal = {
        id: "p-open-001",
        status: "open",
        operations: [
          {
            id: "op-1",
            type: "update",
            order: 1,
            nodeId: decisionId,
            changes: {
              description:
                "UIs must never directly edit accepted nodes. All edits are proposals; reviews accept/reject; apply is explicit and recorded for audit.",
            },
          },
        ],
        metadata: proposalMeta(iso(10), "alice", {
          rationale: "Clarify Accepted vs Applied semantics for UI implementers.",
          baseVersions: { [nodeKey(decisionId)]: baseVersion },
        }),
      };

      const p2: Proposal = {
        id: "p-open-002",
        status: "open",
        operations: [
          {
            id: "op-1",
            type: "create",
            order: 1,
            node: {
              id: { id: "task-002", namespace: "ui" },
              type: "task",
              status: "proposed",
              title: "Add Projections viewer",
              description:
                "Add a projections screen that renders Markdown generated from accepted truth and labels it non-canonical.",
              content: "Add Projections viewer",
              state: "open",
              metadata: meta(iso(11), "alice"),
              relationships: [{ type: "implements", target: { id: "goal-001", namespace: "ui" } }],
            },
          },
        ],
        metadata: proposalMeta(iso(11), "alice", {
          rationale: "Expose deterministic projections in the UI.",
        }),
      };

      await store.createProposal(p1);
      await store.createProposal(p2);

      acalStore = store;
      return store;
    })();
  }
  return acalStoreInit;
}

function newCommentId(): string {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function appendReply(
  comments: Comment[],
  parentId: string,
  reply: Comment
): { ok: boolean; comments: Comment[] } {
  const walk = (items: Comment[]): { ok: boolean; out: Comment[] } => {
    let changed = false;
    const out: Comment[] = items.map((c) => {
      if (c.id === parentId) {
        changed = true;
        const replies = Array.isArray(c.replies) ? c.replies : [];
        return { ...c, replies: [...replies, reply] };
      }
      if (Array.isArray(c.replies) && c.replies.length > 0) {
        const rec = walk(c.replies);
        if (rec.ok) {
          changed = true;
          return { ...c, replies: rec.out };
        }
      }
      return c;
    });
    return { ok: changed, out };
  };

  const rec = walk(comments);
  return { ok: rec.ok, comments: rec.out };
}

async function buildPreviewMarkdown(proposalId: string): Promise<string> {
  const store = await ensureAcalStore();
  const proposal = await store.getProposal(proposalId);
  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found`);
  }

  const accepted = await store.queryNodes({ status: ["accepted"], limit: 2000, offset: 0 });
  const nodes = new Map<string, AnyNode>();
  for (const n of accepted.nodes) {
    nodes.set(coreNodeKey(n.id), { ...n, status: "accepted" });
  }
  const pApply: Proposal = {
    ...proposal,
    status: "accepted",
    metadata: {
      ...proposal.metadata,
      modifiedAt: new Date().toISOString(),
      modifiedBy: "preview",
    },
  };
  applyAcceptedProposalToNodeMap(nodes, pApply, { keyOf: coreNodeKey });
  const previewStore = new PreviewStore(nodes);
  return await projectToMarkdown(previewStore as unknown as ContextStore, { includeProposed: true });
}

function nodeLabel(n: AnyNode): string {
  if (typeof n.title === "string" && n.title.trim().length > 0) return n.title.trim();
  const d = (n as DecisionNode).decision;
  if (typeof d === "string" && d.trim().length > 0) return d.trim();
  const q = (n as QuestionNode).question;
  if (typeof q === "string" && q.trim().length > 0) return q.trim();
  const c = (n as ConstraintNode).constraint;
  if (typeof c === "string" && c.trim().length > 0) return c.trim();
  return String(n.content || nodeKey(n.id));
}

function idToKey(id: NodeId): string {
  return nodeKey(id);
}

function sortNodes(nodes: AnyNode[]): AnyNode[] {
  return [...nodes].sort((a, b) => idToKey(a.id).localeCompare(idToKey(b.id)));
}

function allowedRelationshipTypesForChain(): Set<RelationshipType> {
  return new Set<RelationshipType>([
    "references",
    "implements",
    "depends-on",
    "blocks",
    "mitigates",
    "parent-child",
    "related-to",
    "supersedes",
  ]);
}

async function collectChainNodesForFocus(
  store: ContextStore,
  focus: NodeId[],
  options: { includeProposed: boolean; depth: number }
): Promise<{ nodes: AnyNode[]; missingFocus: string[] }> {
  const status = options.includeProposed ? (["accepted", "proposed"] as any) : (["accepted"] as any);
  const all = await store.queryNodes({ status, limit: 5000, offset: 0 });
  const nodes = all.nodes as AnyNode[];
  const byKey = new Map<string, AnyNode>();
  for (const n of nodes) byKey.set(idToKey(n.id), n);

  const edgeIndex = buildEdgeIndex(nodes, idToKey);
  const allowed = allowedRelationshipTypesForChain();

  const keys = new Set<string>();
  const missingFocus: string[] = [];

  for (const f of focus) {
    const fk = idToKey(f);
    if (!byKey.has(fk)) {
      missingFocus.push(fk);
      continue;
    }
    keys.add(fk);
    const related = traverseRelatedKeys(
      f,
      options.depth,
      "both",
      edgeIndex,
      allowed,
      idToKey
    );
    for (const k of related) keys.add(k);
  }

  const subset = nodes.filter((n) => keys.has(idToKey(n.id)));
  return { nodes: subset, missingFocus };
}

function renderChainMapMarkdown(nodes: AnyNode[], focus: NodeId[]): string {
  const byKey = new Map<string, AnyNode>();
  for (const n of nodes) byKey.set(idToKey(n.id), n);
  const edgeIndex = buildEdgeIndex(nodes, idToKey);
  const allowed = allowedRelationshipTypesForChain();

  const lines: string[] = [];
  lines.push("## Chain map");
  lines.push("");
  lines.push("This is a readable, graph-derived outline (not canonical truth).");
  lines.push("");

  const maxDepth = 4;

  const renderFrom = (start: NodeId) => {
    const sk = idToKey(start);
    const startNode = byKey.get(sk);
    if (!startNode) return;
    lines.push(`- **${nodeLabel(startNode)}** \`${sk}\``);

    // BFS with indentation, both directions for “chain” completeness
    const queue: Array<{ key: string; d: number; indent: string }> = [{ key: sk, d: 0, indent: "  " }];
    const visited = new Set<string>([sk]);

    while (queue.length > 0) {
      const { key, d, indent } = queue.shift()!;
      if (d >= maxDepth) continue;
      const outs = edgeIndex.outgoing.get(key) || [];
      for (const e of outs) {
        if (!allowed.has(e.type)) continue;
        const to = byKey.get(e.toKey);
        if (!to) continue;
        lines.push(`${indent}- _${e.type}_ → **${nodeLabel(to)}** \`${e.toKey}\``);
        if (!visited.has(e.toKey)) {
          visited.add(e.toKey);
          queue.push({ key: e.toKey, d: d + 1, indent: indent + "  " });
        }
      }

      const ins = edgeIndex.incoming.get(key) || [];
      for (const e of ins) {
        if (!allowed.has(e.type)) continue;
        const from = byKey.get(e.fromKey);
        if (!from) continue;
        lines.push(`${indent}- _${e.type}_ ← **${nodeLabel(from)}** \`${e.fromKey}\``);
        if (!visited.has(e.fromKey)) {
          visited.add(e.fromKey);
          queue.push({ key: e.fromKey, d: d + 1, indent: indent + "  " });
        }
      }
    }
  };

  for (const f of focus) renderFrom(f);

  lines.push("");
  return lines.join("\n");
}

function renderDocumentMarkdown(
  title: string,
  nodes: AnyNode[],
  missingFocus: string[],
  focus: NodeId[]
): string {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(
    "This view is intended to be read like a document. It is generated deterministically from the current store state and relationships."
  );
  lines.push("");

  if (missingFocus.length > 0) {
    lines.push("## Missing focus nodes");
    lines.push("");
    lines.push(
      "These nodes are touched by the proposal operations but do not exist in this snapshot (typically created nodes that are not yet applied)."
    );
    lines.push("");
    for (const k of missingFocus) lines.push(`- \`${k}\``);
    lines.push("");
  }

  // Chain map at top to preserve “chain of thought” readability.
  lines.push(renderChainMapMarkdown(nodes, focus));

  const byType: Record<string, AnyNode[]> = {};
  for (const n of nodes) {
    byType[n.type] = byType[n.type] || [];
    byType[n.type].push(n);
  }

  const sectionOrder: Array<{ type: AnyNode["type"]; label: string }> = [
    { type: "goal", label: "Goals" },
    { type: "decision", label: "Decisions" },
    { type: "task", label: "Tasks" },
    { type: "risk", label: "Risks" },
    { type: "question", label: "Questions" },
    { type: "constraint", label: "Constraints" },
    { type: "plan", label: "Plans" },
    { type: "note", label: "Notes" },
    { type: "context", label: "Context" },
  ];

  for (const { type, label } of sectionOrder) {
    const list = byType[type] || [];
    if (list.length === 0) continue;
    lines.push(`## ${label}`);
    lines.push("");
    for (const n of sortNodes(list)) {
      lines.push(`### ${nodeLabel(n)}`);
      lines.push("");
      // Render the authored Markdown body, not the derived index.
      const body = (n.description ?? "") as string;
      if (body.trim().length > 0) {
        lines.push(body);
      } else {
        lines.push(String(n.content || "").trim() || "_(no description)_");
      }
      lines.push("");
    }
  }

  return lines.join("\n").trim() + "\n";
}

function collectTouchedNodeIds(proposal: Proposal): NodeId[] {
  const out: NodeId[] = [];
  const seen = new Set<string>();

  const add = (id?: NodeId | null) => {
    if (!id) return;
    const k = nodeKey(id);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(id);
  };

  for (const op of proposal.operations) {
    if (op.type === "create" && "node" in op) {
      add(op.node.id);
      continue;
    }
    if ("nodeId" in op && op.nodeId) {
      add(op.nodeId);
      continue;
    }
    if (op.type === "insert" && "sourceNodeId" in op) {
      add(op.sourceNodeId ?? null);
      continue;
    }
    if (op.type === "delete" && "nodeId" in op) {
      add(op.nodeId);
      continue;
    }
    // deleteText is typed as "delete" in our proposal model; it carries sourceNodeId + start/end.
    if (op.type === "delete" && "sourceNodeId" in op) {
      add(op.sourceNodeId ?? null);
      continue;
    }
  }

  return out;
}

function newSessionId(): string {
  return `gs-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => {
      if (chunks.length === 0) return resolve(undefined);
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

function sendHtml(res: http.ServerResponse, html: string): void {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(html);
}

function htmlPage(): string {
  // Intentionally tiny “demo UI”. No build tooling required.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>TruthLayer – Scenario Runner</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #0b0d12;
        --panel: #121826;
        --text: #e6e8ee;
        --muted: #a8b0c2;
        --ok: #38c172;
        --bad: #ef4444;
        --border: rgba(255,255,255,0.12);
      }
      body { margin: 0; font-family: ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial; background: var(--bg); color: var(--text); }
      header { padding: 16px 18px; border-bottom: 1px solid var(--border); }
      h1 { margin: 0; font-size: 16px; font-weight: 600; }
      main { display: grid; grid-template-columns: 360px 1fr; gap: 16px; padding: 16px; max-width: 1400px; margin: 0 auto; }
      .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 14px; min-width: 0; }
      label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
      select, button { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); background: transparent; color: var(--text); }
      button { cursor: pointer; font-weight: 600; }
      button[disabled] { opacity: 0.6; cursor: not-allowed; }
      .desc { margin-top: 10px; font-size: 12px; color: var(--muted); line-height: 1.35; }
      .steps { display: flex; flex-direction: column; gap: 10px; }
      .step { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
      .stepHeader { padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); }
      .badge { font-size: 12px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); }
      .badge.ok { color: var(--ok); border-color: rgba(56,193,114,0.4); }
      .badge.bad { color: var(--bad); border-color: rgba(239,68,68,0.4); }
      pre { margin: 0; padding: 12px; overflow: auto; font-size: 12px; line-height: 1.35; max-width: 100%; }
      .meta { display: flex; gap: 10px; font-size: 12px; color: var(--muted); margin-bottom: 10px; }
      a { color: var(--text); }
      .viewer { margin-top: 14px; border-top: 1px solid var(--border); padding-top: 14px; }
      .guided { margin-top: 14px; border-top: 1px solid var(--border); padding-top: 14px; }
      .viewerGrid { display: grid; grid-template-columns: 1fr 120px; gap: 10px; }
      .guidedGrid { display: grid; grid-template-columns: 1fr 120px; gap: 10px; }
      .formGrid { display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 10px; }
      textarea { width: 100%; min-height: 140px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); background: transparent; color: var(--text); resize: vertical; }
      input[type="text"] { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); background: transparent; color: var(--text); }
      .mdView { margin-top: 10px; border: 1px solid var(--border); border-radius: 10px; padding: 12px; overflow: auto; max-height: 460px; background: rgba(0,0,0,0.12); }
      .mdView h1,.mdView h2,.mdView h3 { margin: 12px 0 8px; }
      .mdView h1 { font-size: 18px; }
      .mdView h2 { font-size: 16px; }
      .mdView h3 { font-size: 14px; }
      .mdView p, .mdView ul, .mdView ol { color: var(--text); }
      .mdView code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size: 12px; }
      .mdView pre { border: 1px solid var(--border); border-radius: 10px; background: rgba(0,0,0,0.18); }
      @media (max-width: 980px) {
        main { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Scenario Runner (Rust server)</h1>
    </header>
    <main>
      <section class="panel">
        <label for="scenario">Scenario</label>
        <select id="scenario"></select>
        <button id="run" style="margin-top: 10px;">Run</button>
        <div id="desc" class="desc"></div>
        <div class="desc" style="margin-top: 12px;">
          Tip: scenarios run against a fresh in-memory store each time, so results are deterministic.
        </div>

        <div class="guided">
          <label for="guidedScenario">Guided scenario</label>
          <select id="guidedScenario"></select>
          <div class="guidedGrid" style="margin-top: 10px;">
            <button id="guidedStart">Start</button>
            <button id="guidedNext" disabled>Next</button>
          </div>
          <div id="guidedDesc" class="desc"></div>
          <div id="guidedForm" class="formGrid"></div>
        </div>
      </section>

      <section class="panel">
        <div id="runMeta" class="meta"></div>
        <div id="steps" class="steps"></div>
        <div class="viewer">
          <label for="mdPick">Markdown viewer</label>
          <div class="viewerGrid">
            <select id="mdPick"></select>
            <button id="mdRender">Render</button>
          </div>
          <div id="mdInfo" class="desc"></div>
          <div id="mdView" class="mdView"></div>
        </div>
      </section>
    </main>

    <script>
      const $ = (id) => document.getElementById(id);
      const scenarioSel = $("scenario");
      const runBtn = $("run");
      const descEl = $("desc");
      const guidedSel = $("guidedScenario");
      const guidedStart = $("guidedStart");
      const guidedNext = $("guidedNext");
      const guidedDesc = $("guidedDesc");
      const guidedForm = $("guidedForm");
      const runMetaEl = $("runMeta");
      const stepsEl = $("steps");
      const mdPick = $("mdPick");
      const mdRender = $("mdRender");
      const mdView = $("mdView");
      const mdInfo = $("mdInfo");

      let scenarios = [];
      let mdItems = [];
      let guidedScenarios = [];
      let guidedSessionId = null;
      let guidedPendingFields = [];

      function setDesc() {
        const id = scenarioSel.value;
        const s = scenarios.find((x) => x.id === id);
        descEl.textContent = s ? s.description : "";
      }

      function setGuidedDesc() {
        const id = guidedSel.value;
        const s = guidedScenarios.find((x) => x.id === id);
        guidedDesc.textContent = s ? s.description : "";
      }

      function collectMarkdownStrings(value, path, out) {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) collectMarkdownStrings(value[i], path + "[" + i + "]", out);
          return;
        }
        for (const key of Object.keys(value)) {
          const v = value[key];
          const p = path ? (path + "." + key) : key;
          if (typeof v === "string" && key.toLowerCase().includes("markdown")) {
            out.push({ label: p, markdown: v });
          } else if (v && typeof v === "object") {
            collectMarkdownStrings(v, p, out);
          }
        }
      }

      function refreshMarkdownPicker(items) {
        mdItems = items;
        mdPick.textContent = "";
        if (!mdItems.length) {
          const opt = document.createElement("option");
          opt.value = "";
          opt.textContent = "(no markdown outputs in this run)";
          mdPick.appendChild(opt);
          mdPick.disabled = true;
          mdRender.disabled = true;
          mdView.textContent = "";
          mdInfo.textContent = "";
          return;
        }
        for (let i = 0; i < mdItems.length; i++) {
          const opt = document.createElement("option");
          opt.value = String(i);
          opt.textContent = mdItems[i].label.split(".").slice(-1)[0];
          opt.title = mdItems[i].label;
          mdPick.appendChild(opt);
        }
        mdPick.disabled = false;
        mdRender.disabled = false;
        mdInfo.textContent = "Pick a markdown field from the run output to render.";
        mdView.textContent = "";

        // For demo scenarios like "Generate README...", there's typically exactly one markdown output.
        // Auto-select and auto-render it so the viewer "just works".
        if (mdItems.length === 1) {
          mdPick.value = "0";
          renderSelectedMarkdown();
        }
      }

      async function renderSelectedMarkdown() {
        const idx = Number(mdPick.value);
        const item = mdItems[idx];
        if (!item) return;
        mdRender.disabled = true;
        mdRender.textContent = "Rendering…";
        try {
          const res = await fetch("/api/renderMarkdown", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ markdown: item.markdown }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Render failed");
          mdView.innerHTML = data.html;
          mdInfo.textContent = "Rendered from: " + item.label;
        } catch (e) {
          mdView.textContent = String(e && e.message ? e.message : e);
        } finally {
          mdRender.disabled = false;
          mdRender.textContent = "Render";
        }
      }

      function renderRun(result) {
        runMetaEl.textContent = "";
        stepsEl.textContent = "";

        const metaBits = [
          ["Scenario", result.scenario.title],
          ["Started", result.startedAt],
          ["Finished", result.finishedAt],
        ];
        for (const [k,v] of metaBits) {
          const span = document.createElement("span");
          span.textContent = k + ": " + v;
          runMetaEl.appendChild(span);
        }

        for (const step of result.steps) {
          const wrap = document.createElement("div");
          wrap.className = "step";

          const header = document.createElement("div");
          header.className = "stepHeader";

          const title = document.createElement("div");
          title.textContent = step.title;

          const badge = document.createElement("span");
          badge.className = "badge " + (step.ok ? "ok" : "bad");
          badge.textContent = step.ok ? "OK" : "ERROR";

          header.appendChild(title);
          header.appendChild(badge);
          wrap.appendChild(header);

          const pre = document.createElement("pre");
          const payload = step.ok ? step.output : { error: step.error };
          pre.textContent = JSON.stringify(payload, null, 2);
          wrap.appendChild(pre);

          stepsEl.appendChild(wrap);
        }

        // Populate markdown viewer options from this run
        const items = [];
        for (let i = 0; i < result.steps.length; i++) {
          const step = result.steps[i];
          if (!step.ok) continue;
          collectMarkdownStrings(step.output, "steps[" + i + "].output", items);
        }
        refreshMarkdownPicker(items);
      }

      async function loadScenarios() {
        const res = await fetch("/api/scenarios");
        scenarios = await res.json();
        scenarioSel.textContent = "";
        for (const s of scenarios) {
          const opt = document.createElement("option");
          opt.value = s.id;
          opt.textContent = s.title;
          scenarioSel.appendChild(opt);
        }
        setDesc();
      }

      async function loadGuidedScenarios() {
        const res = await fetch("/api/guided/scenarios");
        guidedScenarios = await res.json();
        guidedSel.textContent = "";
        for (const s of guidedScenarios) {
          const opt = document.createElement("option");
          opt.value = s.id;
          opt.textContent = s.title;
          guidedSel.appendChild(opt);
        }
        setGuidedDesc();
      }

      function clearGuidedForm() {
        guidedForm.textContent = "";
        guidedPendingFields = [];
      }

      function renderGuidedForm(fields) {
        clearGuidedForm();
        guidedPendingFields = fields || [];
        for (const f of guidedPendingFields) {
          const wrap = document.createElement("div");
          const label = document.createElement("label");
          label.textContent = f.label + (f.required ? " *" : "");
          wrap.appendChild(label);

          if (f.type === "textarea") {
            const el = document.createElement("textarea");
            el.id = "guided-field-" + f.id;
            el.value = (f.defaultValue || "");
            wrap.appendChild(el);
          } else {
            const el = document.createElement("input");
            el.type = "text";
            el.id = "guided-field-" + f.id;
            el.value = (f.defaultValue || "");
            wrap.appendChild(el);
          }

          guidedForm.appendChild(wrap);
        }
      }

      function collectGuidedInput() {
        const input = {};
        for (const f of guidedPendingFields) {
          const el = document.getElementById("guided-field-" + f.id);
          const v = el ? el.value : "";
          input[f.id] = v;
        }
        return input;
      }

      async function startGuided() {
        guidedStart.disabled = true;
        guidedNext.disabled = true;
        guidedStart.textContent = "Starting…";
        clearGuidedForm();
        try {
          const res = await fetch("/api/guided/start", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ scenarioId: guidedSel.value }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Failed to start guided scenario");

          guidedSessionId = data.sessionId;
          renderRun({ scenario: { title: data.scenarioTitle }, startedAt: data.startedAt, finishedAt: "", steps: data.history });

          if (data.next && data.next.kind === "form") {
            renderGuidedForm(data.next.fields);
            guidedNext.disabled = false;
          } else {
            guidedNext.disabled = false;
          }
        } catch (e) {
          guidedDesc.textContent = String(e && e.message ? e.message : e);
        } finally {
          guidedStart.disabled = false;
          guidedStart.textContent = "Start";
        }
      }

      async function nextGuided() {
        if (!guidedSessionId) return;
        guidedNext.disabled = true;
        guidedNext.textContent = "Next…";
        try {
          const payload = { sessionId: guidedSessionId, input: collectGuidedInput() };
          const res = await fetch("/api/guided/next", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Failed to advance guided scenario");

          renderRun({ scenario: { title: data.scenarioTitle }, startedAt: data.startedAt, finishedAt: data.finishedAt || "", steps: data.history });

          clearGuidedForm();
          if (data.done) {
            guidedSessionId = null;
            guidedNext.disabled = true;
          } else if (data.next && data.next.kind === "form") {
            renderGuidedForm(data.next.fields);
            guidedNext.disabled = false;
          } else {
            guidedNext.disabled = false;
          }
        } catch (e) {
          guidedDesc.textContent = String(e && e.message ? e.message : e);
          guidedNext.disabled = false;
        } finally {
          guidedNext.textContent = "Next";
        }
      }

      scenarioSel.addEventListener("change", setDesc);
      guidedSel.addEventListener("change", setGuidedDesc);
      mdRender.addEventListener("click", renderSelectedMarkdown);
      guidedStart.addEventListener("click", startGuided);
      guidedNext.addEventListener("click", nextGuided);

      runBtn.addEventListener("click", async () => {
        runBtn.disabled = true;
        runBtn.textContent = "Running…";
        stepsEl.textContent = "";
        runMetaEl.textContent = "";

        try {
          const res = await fetch("/api/run", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ scenarioId: scenarioSel.value }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Run failed");
          renderRun(data);
        } catch (e) {
          stepsEl.textContent = "";
          const pre = document.createElement("pre");
          pre.textContent = String(e && e.message ? e.message : e);
          stepsEl.appendChild(pre);
        } finally {
          runBtn.disabled = false;
          runBtn.textContent = "Run";
        }
      });

      loadScenarios().catch((e) => {
        descEl.textContent = "Failed to load scenarios: " + String(e);
      });
      loadGuidedScenarios().catch((e) => {
        guidedDesc.textContent = "Failed to load guided scenarios: " + String(e);
      });
    </script>
  </body>
</html>`;
}

function homePage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>TruthLayer – Playground</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #0b0d12;
        --panel: #121826;
        --text: #e6e8ee;
        --muted: #a8b0c2;
        --border: rgba(255,255,255,0.12);
        --link: #9ad0ff;
        --ok: #38c172;
      }
      body { margin: 0; font-family: ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial; background: var(--bg); color: var(--text); }
      header { padding: 18px 18px; border-bottom: 1px solid var(--border); }
      h1 { margin: 0; font-size: 16px; font-weight: 800; }
      .muted { color: var(--muted); font-size: 12px; line-height: 1.35; margin-top: 8px; }
      main { padding: 18px; max-width: 1100px; margin: 0 auto; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
      .card h2 { margin: 0 0 8px; font-size: 14px; }
      .card p { margin: 0 0 12px; color: var(--muted); font-size: 12px; line-height: 1.45; }
      a.btn { display: inline-block; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--border); color: var(--text); text-decoration: none; font-weight: 800; }
      a.btn:hover { border-color: rgba(154,208,255,0.5); }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size: 12px; }
      .pill { display: inline-block; font-size: 12px; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); }
      .pill.ok { color: var(--ok); border-color: rgba(56,193,114,0.4); }
      @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <header>
      <h1>Playground</h1>
      <div class="muted">
        Reference demo for local walkthroughs. Agentic-first v1: primary interface = agent; required UI = minimal review/apply (list proposals → Accept/Reject/Apply). This playground provides Scenario Runner + optional full ACAL Web UI.
      </div>
    </header>
    <main>
      <div class="grid">
        <section class="card">
          <div class="pill ok">Stable</div>
          <h2 style="margin-top:10px;">Scenario Runner</h2>
          <p>
            Run deterministic scenarios against the Rust server (reset before each run) to demonstrate proposal/review/apply and projections.
          </p>
          <a class="btn" href="/scenarios">Open Scenario Runner</a>
        </section>

        <section class="card">
          <div class="pill ok">Required surface</div>
          <h2 style="margin-top:10px;">Proposals &amp; Review</h2>
          <p>
            Minimal review/apply surface (agentic-first required): list proposals, open, Accept / Reject / Apply. See <code>docs/UI_SPEC.md</code> §6.4, §6.5.
          </p>
          <a class="btn" href="/acal/proposals">Open Proposals</a>
        </section>

        <section class="card">
          <div class="pill ok">Optional full UI</div>
          <h2 style="margin-top:10px;">ACAL Full Web UI</h2>
          <p>
            Optional full mock UI: Explore (graph), Nodes, Proposals, Reviews, Projections, Conflicts, Policy. Aligned to <code>docs/UI_SPEC.md</code>.
          </p>
          <a class="btn" href="/acal/graph">Open Full ACAL UI</a>
        </section>
      </div>

      <div class="muted" style="margin-top:14px;">
        Tip: if you see <code>EADDRINUSE</code>, another instance is already running on this port.
      </div>
    </main>
  </body>
</html>`;
}

function acalHtmlPage(): string {
  // Lightweight, navigable mock UI for early UX exploration. No build tooling required.
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>ACAL Playground UI</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #0b0d12;
        --panel: #121826;
        --text: #e6e8ee;
        --muted: #a8b0c2;
        --ok: #38c172;
        --bad: #ef4444;
        --warn: #fbbf24;
        --border: rgba(255,255,255,0.12);
        --link: #9ad0ff;
      }
      body { margin: 0; font-family: ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial; background: var(--bg); color: var(--text); }
      header { padding: 14px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      header .title { font-size: 14px; font-weight: 700; }
      header .meta { font-size: 12px; color: var(--muted); display: flex; gap: 12px; }
      main { display: grid; grid-template-columns: 260px 1fr; gap: 12px; padding: 12px; max-width: 1400px; margin: 0 auto; }
      nav { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 10px; }
      nav a { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 10px; border-radius: 8px; color: var(--text); text-decoration: none; border: 1px solid transparent; }
      nav a.active { border-color: var(--border); background: rgba(255,255,255,0.04); }
      nav .badge { font-size: 12px; color: var(--muted); border: 1px solid var(--border); padding: 1px 8px; border-radius: 999px; }
      .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 12px; min-width: 0; }
      .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .row > * { min-width: 0; }
      .muted { color: var(--muted); }
      .pill { font-size: 12px; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); }
      .pill.ok { color: var(--ok); border-color: rgba(56,193,114,0.4); }
      .pill.bad { color: var(--bad); border-color: rgba(239,68,68,0.4); }
      .pill.warn { color: var(--warn); border-color: rgba(251,191,36,0.4); }
      h2 { margin: 0 0 10px; font-size: 14px; }
      h3 { margin: 14px 0 8px; font-size: 13px; }
      a { color: var(--link); }
      button { padding: 9px 12px; border-radius: 8px; border: 1px solid var(--border); background: transparent; color: var(--text); font-weight: 700; cursor: pointer; }
      button[disabled] { opacity: 0.6; cursor: not-allowed; }
      input[type="text"], textarea, select { width: 100%; padding: 9px 10px; border-radius: 8px; border: 1px solid var(--border); background: transparent; color: var(--text); }
      textarea { min-height: 140px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--border); font-size: 12px; vertical-align: top; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      pre { margin: 0; padding: 10px; border: 1px solid var(--border); border-radius: 10px; overflow: auto; font-size: 12px; line-height: 1.35; background: rgba(0,0,0,0.12); }
      .banner { border: 1px solid var(--border); border-radius: 10px; padding: 10px; background: rgba(0,0,0,0.10); }
      .banner.lock { border-color: rgba(154,208,255,0.35); }
      .banner.lock strong { color: var(--link); }
      .previewPane { height: 520px; overflow: auto; }
      .diffPane { height: 520px; overflow: auto; background: rgba(0,0,0,0.10); border: 1px solid var(--border); border-radius: 10px; }
      .diffTable { width: 100%; border-collapse: collapse; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size: 12px; line-height: 1.35; }
      .diffTable td { border-bottom: 1px solid rgba(255,255,255,0.08); padding: 4px 8px; vertical-align: top; white-space: pre; }
      .ln { width: 52px; color: var(--muted); text-align: right; user-select: none; }
      .diffDel { background: rgba(239,68,68,0.12); }
      .diffAdd { background: rgba(56,193,114,0.12); }
      .diffEq { background: transparent; }
      .diffEmpty { background: rgba(255,255,255,0.02); }
      @media (max-width: 980px) { main { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <header>
      <div class="title">ACAL Playground UI <span class="muted" style="font-weight:400; font-size:12px;">(reference demo; Proposals + Reviews = required surface, rest optional — see docs/UI_SPEC.md)</span></div>
      <div class="meta">
        <span>Workspace: <span id="wsName">demo</span></span>
        <button id="resetBtn" title="Reset demo store">Reset</button>
        <a href="/" title="Playground home">Home</a>
        <a href="/scenarios" title="Scenario runner">Scenarios</a>
      </div>
    </header>
    <main>
      <nav id="nav"></nav>
      <section class="panel">
        <div id="content"></div>
      </section>
    </main>

    <script>
      const $ = (id) => document.getElementById(id);
      const navEl = $("nav");
      const contentEl = $("content");
      const resetBtn = $("resetBtn");

      const routes = [
        { key: "graph", label: "Explore (Graph)", path: "/acal/graph" },
        { key: "nodes", label: "Nodes", path: "/acal/nodes" },
        { key: "proposals", label: "Proposals", path: "/acal/proposals" },
        { key: "reviews", label: "Reviews (My queue)", path: "/acal/reviews" },
        { key: "projections", label: "Projections", path: "/acal/projections" },
        { key: "conflicts", label: "Conflicts", path: "/acal/conflicts" },
        { key: "policy", label: "Policy / Roles", path: "/acal/policy" },
      ];

      async function api(path, opts) {
        const res = await fetch(path, Object.assign({ headers: { "content-type": "application/json" } }, opts || {}));
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data && data.error ? data.error : ("HTTP " + res.status));
        return data;
      }

      function link(href, label) {
        return '<a href="' + href + '" data-link="1">' + label + '</a>';
      }

      function navRow(activePath, counts) {
        navEl.innerHTML = routes.map((r) => {
          const active =
            activePath.startsWith(r.path) ||
            (r.key === "nodes" && activePath.startsWith("/acal/node")) ||
            (r.key === "proposals" && activePath.startsWith("/acal/proposal"))
              ? "active"
              : "";
          const count = counts && counts[r.key] != null ? String(counts[r.key]) : "";
          const badge = count ? ('<span class="badge">' + count + '</span>') : '<span class="badge"> </span>';
          return '<a class="' + active + '" href="' + r.path + '" data-link="1"><span>' + r.label + '</span>' + badge + '</a>';
        }).join("");
      }

      function parseQuery() {
        const q = {};
        const usp = new URLSearchParams(location.search || "");
        for (const [k,v] of usp.entries()) q[k] = v;
        return q;
      }

      function push(path) {
        history.pushState({}, "", path);
        render().catch((e) => { contentEl.innerHTML = '<pre>' + String(e && e.message ? e.message : e) + '</pre>'; });
      }

      document.addEventListener("click", (e) => {
        const a = e.target && e.target.closest ? e.target.closest("a[data-link]") : null;
        if (a) {
          e.preventDefault();
          push(a.getAttribute("href"));
        }
      });
      window.addEventListener("popstate", () => render().catch(() => {}));

      resetBtn.addEventListener("click", async () => {
        resetBtn.disabled = true;
        resetBtn.textContent = "Resetting…";
        try {
          await api("/api/acal/reset", { method: "POST", body: "{}" });
          push("/acal/graph");
        } finally {
          resetBtn.disabled = false;
          resetBtn.textContent = "Reset";
        }
      });

      function pill(text, kind) {
        return '<span class="pill ' + (kind || "") + '">' + text + '</span>';
      }

      function escapeHtml(s) {
        const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
        return String(s).replace(/[&<>"']/g, (c) => map[c] || c);
      }

      async function renderGraph() {
        const nodes = await api("/api/acal/nodes?status=accepted&limit=200");
        contentEl.innerHTML = [
          '<h2>Explore (Graph)</h2>',
          '<div class="banner lock"><strong>Accepted truth is read-only.</strong> Use <em>Propose</em> to suggest changes.</div>',
          '<h3>Accepted nodes</h3>',
          '<table><thead><tr><th>Node</th><th>Type</th><th>Status</th><th>Links</th></tr></thead><tbody>',
          nodes.nodes.map((n) => (
            '<tr>' +
              '<td>' + escapeHtml((n.title || n.content || n.id?.id || "").slice(0, 80)) + '</td>' +
              '<td>' + escapeHtml(n.type) + '</td>' +
              '<td>' + escapeHtml(n.status) + '</td>' +
              '<td>' + link('/acal/node?id=' + encodeURIComponent(n.id.id) + (n.id.namespace ? ('&namespace=' + encodeURIComponent(n.id.namespace)) : ''), 'Open') + '</td>' +
            '</tr>'
          )).join("") +
          '</tbody></table>',
          '<div class="muted" style="margin-top:10px;">Mock UI note: this view is a list/outline (graph canvas comes later). Use Node detail to traverse related nodes.</div>'
        ].join("");
      }

      async function renderNodes() {
        const q = parseQuery();
        const status = q.status || "accepted";
        const nodes = await api("/api/acal/nodes?status=" + encodeURIComponent(status) + "&limit=200");
        contentEl.innerHTML = [
          '<div class="row" style="justify-content:space-between;">',
            '<h2 style="margin:0;">Nodes</h2>',
            '<div class="row" style="gap:8px;">',
              '<span class="muted">Status:</span>',
              '<a href="/acal/nodes?status=accepted" data-link="1">' + (status === "accepted" ? "<strong>accepted</strong>" : "accepted") + '</a>',
              '<a href="/acal/nodes?status=proposed" data-link="1">' + (status === "proposed" ? "<strong>proposed</strong>" : "proposed") + '</a>',
              '<a href="/acal/nodes?status=rejected" data-link="1">' + (status === "rejected" ? "<strong>rejected</strong>" : "rejected") + '</a>',
              '<a href="/acal/nodes?status=superseded" data-link="1">' + (status === "superseded" ? "<strong>superseded</strong>" : "superseded") + '</a>',
            '</div>',
          '</div>',
          '<div class="muted" style="margin:8px 0 10px;">Loaded: <strong>' + escapeHtml(String(nodes.total || 0)) + '</strong></div>',
          (String(status) === "proposed"
            ? '<div class="banner" style="margin-bottom:10px;"><strong>Note:</strong> “Proposed” nodes only appear in the node store after a proposal is <em>applied</em>. To see pending suggestions, use <a href="/acal/proposals?status=open" data-link="1">Proposals</a>.</div>'
            : ''),
          '<table><thead><tr><th>ID</th><th>Type</th><th>Title</th><th></th></tr></thead><tbody>',
          (Array.isArray(nodes.nodes) && nodes.nodes.length > 0
            ? nodes.nodes.map((n) => (
                '<tr>' +
                  '<td><code>' + escapeHtml((n.id.namespace ? (n.id.namespace + ":") : "") + n.id.id) + '</code></td>' +
                  '<td>' + escapeHtml(n.type) + '</td>' +
                  '<td>' + escapeHtml((n.title || n.content || "").slice(0, 80)) + '</td>' +
                  '<td>' + link('/acal/node?id=' + encodeURIComponent(n.id.id) + (n.id.namespace ? ('&namespace=' + encodeURIComponent(n.id.namespace)) : ''), 'Open') + '</td>' +
                '</tr>'
              )).join("")
            : '<tr><td colspan="4" class="muted">(no nodes found for this filter)</td></tr>') +
          '</tbody></table>',
        ].join("");
      }

      async function renderNodeDetail() {
        const q = parseQuery();
        const id = q.id;
        const namespace = q.namespace;
        if (!id) return contentEl.innerHTML = "<pre>Missing node id</pre>";
        const node = await api("/api/acal/node?id=" + encodeURIComponent(id) + (namespace ? ("&namespace=" + encodeURIComponent(namespace)) : ""));
        const related = await api("/api/acal/related?id=" + encodeURIComponent(id) + (namespace ? ("&namespace=" + encodeURIComponent(namespace)) : ""));

        const isAccepted = node.status === "accepted";
        const banner = isAccepted
          ? '<div class="banner lock"><strong>🔒 Accepted (Read-only)</strong> — use <em>Propose change</em>.</div>'
          : '<div class="banner"><strong>Non-accepted node</strong> — still propose changes via proposals.</div>';

        contentEl.innerHTML = [
          '<h2>Node</h2>',
          banner,
          '<div class="row" style="margin-top:10px;">',
            '<span class="pill">' + escapeHtml(node.type) + '</span>',
            '<span class="pill">' + escapeHtml(node.status) + '</span>',
            '<span class="pill">v' + escapeHtml(String(node.metadata && node.metadata.version != null ? node.metadata.version : "?")) + '</span>',
            '<span class="muted"><code>' + escapeHtml((node.id.namespace ? (node.id.namespace + ":") : "") + node.id.id) + '</code></span>',
          '</div>',
          '<h3>Title</h3>',
          '<div>' + escapeHtml(node.title || "(none)") + '</div>',
          '<h3>Description</h3>',
          '<div id="nodeDescRendered" class="banner previewPane"></div>',
          '<div class="row">',
            '<button id="proposeBtn">Propose change</button>',
            '<span class="muted">Creates an <strong>open</strong> proposal (structured update operation).</span>',
          '</div>',
          '<div id="composer" style="display:none; margin-top:12px;"></div>',
          '<h3>Related (1 hop)</h3>',
          related.nodes && related.nodes.length
            ? ('<ul>' + related.nodes.map((n) => (
                '<li>' +
                  escapeHtml(n.type) + ' — ' + link('/acal/node?id=' + encodeURIComponent(n.id.id) + (n.id.namespace ? ('&namespace=' + encodeURIComponent(n.id.namespace)) : ''), escapeHtml(n.title || n.content || n.id.id)) +
                '</li>'
              )).join("") + '</ul>')
            : '<div class="muted">(none)</div>',
        ].join("");

        const proposeBtn = document.getElementById("proposeBtn");
        const composer = document.getElementById("composer");
        const nodeDescRendered = document.getElementById("nodeDescRendered");

        // Render node description as Markdown (no raw markdown shown).
        (async () => {
          const markdown = (node.description || "");
          if (!markdown.trim()) {
            nodeDescRendered.textContent = "(none)";
            return;
          }
          const rendered = await api("/api/renderMarkdown", {
            method: "POST",
            body: JSON.stringify({ markdown }),
          });
          nodeDescRendered.innerHTML = rendered.html || "";
        })().catch(() => {
          nodeDescRendered.textContent = "(failed to render markdown)";
        });

        proposeBtn.addEventListener("click", () => {
          composer.style.display = "block";
          composer.innerHTML = [
            '<h3>Proposal composer (mock)</h3>',
            '<div class="grid2">',
              '<div><label class="muted">Rationale (required)</label><input id="rationale" type="text" /></div>',
              '<div><label class="muted">Edit field</label><select id="field"><option value="description">description</option><option value="title">title</option></select></div>',
            '</div>',
            '<div style="margin-top:10px;"><label class="muted">New value</label><textarea id="newValue"></textarea></div>',
            '<div class="row" style="margin-top:10px;">',
              '<button id="submitProp">Submit proposal</button>',
              '<span class="muted">Creates proposal → does not change truth.</span>',
            '</div>',
          ].join("");
          document.getElementById("newValue").value = (node.description || "");
          document.getElementById("submitProp").addEventListener("click", async () => {
            const rationale = document.getElementById("rationale").value || "";
            const field = document.getElementById("field").value;
            const newValue = document.getElementById("newValue").value || "";
            if (!rationale.trim()) return alert("Rationale is required.");
            const created = await api("/api/acal/proposeUpdate", {
              method: "POST",
              body: JSON.stringify({
                nodeId: node.id,
                field,
                value: newValue,
                rationale,
              }),
            });
            push("/acal/proposal?id=" + encodeURIComponent(created.proposalId));
          });
        });
      }

      async function renderProposals() {
        const q = parseQuery();
        const status = q.status || "open";
        const props = await api("/api/acal/proposals?status=" + encodeURIComponent(status));
        contentEl.innerHTML = [
          '<div class="row" style="justify-content:space-between;">',
            '<h2 style="margin:0;">Proposals</h2>',
            '<div class="row" style="gap:8px;">',
              '<span class="muted">Status:</span>',
              '<a href="/acal/proposals?status=open" data-link="1">' + (status === "open" ? "<strong>open</strong>" : "open") + '</a>',
              '<a href="/acal/proposals?status=accepted" data-link="1">' + (status === "accepted" ? "<strong>accepted</strong>" : "accepted") + '</a>',
              '<a href="/acal/proposals?status=rejected" data-link="1">' + (status === "rejected" ? "<strong>rejected</strong>" : "rejected") + '</a>',
              '<a href="/acal/proposals?status=withdrawn" data-link="1">' + (status === "withdrawn" ? "<strong>withdrawn</strong>" : "withdrawn") + '</a>',
            '</div>',
          '</div>',
          '<div class="muted" style="margin:8px 0 10px;">Loaded: <strong>' + escapeHtml(String((Array.isArray(props) ? props.length : 0))) + '</strong></div>',
          '<table><thead><tr><th>ID</th><th>Status</th><th>Created by</th><th>Rationale</th><th></th></tr></thead><tbody>',
          (Array.isArray(props) && props.length > 0
            ? props.map((p) => (
                '<tr>' +
                  '<td><code>' + escapeHtml(p.id) + '</code></td>' +
                  '<td>' + escapeHtml(p.status) + '</td>' +
                  '<td>' + escapeHtml((p.metadata && p.metadata.createdBy) || "") + '</td>' +
                  '<td>' + escapeHtml(((p.metadata && p.metadata.rationale) || "").slice(0, 80)) + '</td>' +
                  '<td>' + link('/acal/proposal?id=' + encodeURIComponent(p.id), 'Open') + '</td>' +
                '</tr>'
              )).join("")
            : '<tr><td colspan="5" class="muted">(no proposals found for this filter)</td></tr>') +
          '</tbody></table>',
        ].join("");
      }

      async function renderProposalDetail() {
        const q = parseQuery();
        const id = q.id;
        if (!id) return contentEl.innerHTML = "<pre>Missing proposal id</pre>";
        const p = await api("/api/acal/proposal?id=" + encodeURIComponent(id));
        const reviews = await api("/api/acal/reviews?proposalId=" + encodeURIComponent(id));
        const conflicts = await api("/api/acal/conflicts?proposalId=" + encodeURIComponent(id));
        const stale = await api("/api/acal/stale?proposalId=" + encodeURIComponent(id));
        const commentsTree = await api("/api/acal/commentsTree?proposalId=" + encodeURIComponent(id));

        const canReview = p.status === "open";
        const canApply = p.status === "accepted";

        contentEl.innerHTML = [
          '<h2>Proposal</h2>',
          '<div class="row">',
            pill('status: ' + p.status, p.status === "accepted" ? "ok" : p.status === "rejected" ? "bad" : "warn"),
            stale.isStale ? pill("stale", "warn") : pill("not stale", "ok"),
            (conflicts.conflicts && conflicts.conflicts.length) ? pill("conflicts", "warn") : pill("no conflicts", "ok"),
            '<span class="muted"><code>' + escapeHtml(p.id) + '</code></span>',
          '</div>',
          '<h3>Rationale</h3>',
          '<div>' + escapeHtml((p.metadata && p.metadata.rationale) || "(none)") + '</div>',
          '<h3>Operations</h3>',
          '<pre>' + escapeHtml(JSON.stringify(p.operations, null, 2)) + '</pre>',

          '<h3>Context document (current vs proposed)</h3>',
          '<div class="banner">Both panes are document views built from the <strong>chain of thought</strong> around nodes touched by this proposal (including linked questions/risks/constraints when present). They are projections (views), not canonical truth.</div>',
          '<div class="row" style="margin-top:10px;">',
            '<button id="viewDoc" class="pill ok">Document</button>',
            '<button id="viewDiff" class="pill">Diff</button>',
            '<span class="muted">Diff view is line-based, like Git, computed from the two projected documents.</span>',
          '</div>',
          '<div class="grid2" style="margin-top:12px;">',
            '<div>',
              '<div class="muted" style="margin-bottom:6px;">Current truth</div>',
              '<div id="docCurrent" class="banner previewPane"></div>',
            '</div>',
            '<div>',
              '<div class="muted" style="margin-bottom:6px;">Proposed truth (preview)</div>',
              '<div id="docProposed" class="banner previewPane"></div>',
            '</div>',
          '</div>',
          '<div id="diffWrap" style="display:none; margin-top:12px;">',
            '<div class="grid2">',
              '<div>',
                '<div class="muted" style="margin-bottom:6px;">Current truth (diff)</div>',
                '<div id="diffLeft" class="diffPane"></div>',
              '</div>',
              '<div>',
                '<div class="muted" style="margin-bottom:6px;">Proposed truth (diff)</div>',
                '<div id="diffRight" class="diffPane"></div>',
              '</div>',
            '</div>',
          '</div>',
          '<h3>Reviews</h3>',
          reviews.length
            ? '<pre>' + escapeHtml(JSON.stringify(reviews, null, 2)) + '</pre>'
            : '<div class="muted">(no reviews yet)</div>',
          '<h3>Comments (threaded)</h3>',
          '<div class="muted">These are proposal-attached discussion threads (root comments + replies). Reviewer-anchored feedback can also be attached to reviews (roadmap in the mock).</div>',
          '<div class="row" style="margin-top:10px;">',
            '<button id="addRootComment">Add comment</button>',
          '</div>',
          '<div id="commentsWrap" style="margin-top:10px;"></div>',
          '<div class="row" style="margin-top:10px;">',
            '<button id="acceptBtn" ' + (canReview ? "" : "disabled") + '>Accept</button>',
            '<button id="rejectBtn" ' + (canReview ? "" : "disabled") + '>Reject</button>',
            '<button id="applyBtn" ' + (canApply ? "" : "disabled") + '>Apply</button>',
            '<span class="muted">Accept/Reject via review; Apply mutates truth.</span>',
          '</div>',
          '<div id="reviewMsg" class="muted" style="margin-top:10px;"></div>',
          '<h3>Conflicts</h3>',
          '<pre>' + escapeHtml(JSON.stringify(conflicts, null, 2)) + '</pre>',
        ].join("");

        const reviewMsg = document.getElementById("reviewMsg");
        const acceptBtn = document.getElementById("acceptBtn");
        const rejectBtn = document.getElementById("rejectBtn");
        const applyBtn = document.getElementById("applyBtn");

        // Side-by-side document rendering (current vs proposed)
        const docCurrent = document.getElementById("docCurrent");
        const docProposed = document.getElementById("docProposed");
        const diffWrap = document.getElementById("diffWrap");
        const diffLeft = document.getElementById("diffLeft");
        const diffRight = document.getElementById("diffRight");
        const viewDoc = document.getElementById("viewDoc");
        const viewDiff = document.getElementById("viewDiff");

        async function renderDocInto(el, markdown) {
          const rendered = await api("/api/renderMarkdown", {
            method: "POST",
            body: JSON.stringify({ markdown }),
          });
          el.innerHTML = rendered.html || "";
        }

        (async () => {
          const [currentDoc, proposedDoc] = await Promise.all([
            api("/api/acal/projection/currentForProposal?proposalId=" + encodeURIComponent(p.id)),
            api("/api/acal/projection/previewForProposal?proposalId=" + encodeURIComponent(p.id)),
          ]);

          // Default: document view
          setMode("doc");

          await Promise.all([
            renderDocInto(docCurrent, currentDoc.markdown || ""),
            renderDocInto(docProposed, proposedDoc.markdown || ""),
          ]);

          // Precompute diff so the Diff toggle is instant.
          renderDiffTables(currentDoc.markdown || "", proposedDoc.markdown || "");
        })().catch((e) => {
          const msg = String(e && e.message ? e.message : e);
          docCurrent.textContent = msg;
          docProposed.textContent = msg;
        });

        // Git-style diff (split view) for the two document projections
        function lcsDiff(aLines, bLines) {
          const n = aLines.length;
          const m = bLines.length;
          const dp = new Array(n + 1);
          for (let i = 0; i <= n; i++) dp[i] = new Array(m + 1).fill(0);
          for (let i = n - 1; i >= 0; i--) {
            for (let j = m - 1; j >= 0; j--) {
              dp[i][j] = (aLines[i] === bLines[j]) ? (dp[i + 1][j + 1] + 1) : Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
          }
          let i = 0, j = 0;
          const ops = [];
          while (i < n && j < m) {
            if (aLines[i] === bLines[j]) {
              ops.push({ t: "eq", a: aLines[i], b: bLines[j] });
              i++; j++;
            } else if (dp[i + 1][j] >= dp[i][j + 1]) {
              ops.push({ t: "del", a: aLines[i], b: "" });
              i++;
            } else {
              ops.push({ t: "add", a: "", b: bLines[j] });
              j++;
            }
          }
          while (i < n) { ops.push({ t: "del", a: aLines[i], b: "" }); i++; }
          while (j < m) { ops.push({ t: "add", a: "", b: bLines[j] }); j++; }
          return ops;
        }

        function renderDiffTables(currentMd, proposedMd) {
          const a = String(currentMd || "").split("\\n");
          const b = String(proposedMd || "").split("\\n");
          const ops = lcsDiff(a, b);
          let lnA = 1, lnB = 1;
          const leftRows = [];
          const rightRows = [];
          for (const op of ops) {
            const cls = op.t === "eq" ? "diffEq" : (op.t === "del" ? "diffDel" : "diffAdd");
            const aLine = op.a;
            const bLine = op.b;
            const aNum = (op.t === "add") ? "" : String(lnA++);
            const bNum = (op.t === "del") ? "" : String(lnB++);
            leftRows.push('<tr class="' + (op.t === "add" ? "diffEmpty" : cls) + '"><td class="ln">' + aNum + '</td><td>' + escapeHtml(aLine) + '</td></tr>');
            rightRows.push('<tr class="' + (op.t === "del" ? "diffEmpty" : cls) + '"><td class="ln">' + bNum + '</td><td>' + escapeHtml(bLine) + '</td></tr>');
          }
          diffLeft.innerHTML = '<table class="diffTable"><tbody>' + leftRows.join("") + '</tbody></table>';
          diffRight.innerHTML = '<table class="diffTable"><tbody>' + rightRows.join("") + '</tbody></table>';
        }

        function installScrollSync(leftEl, rightEl) {
          let syncing = false;

          function sync(fromEl, toEl) {
            if (syncing) return;
            syncing = true;
            try {
              const fromMaxY = Math.max(0, fromEl.scrollHeight - fromEl.clientHeight);
              const toMaxY = Math.max(0, toEl.scrollHeight - toEl.clientHeight);
              const fromMaxX = Math.max(0, fromEl.scrollWidth - fromEl.clientWidth);
              const toMaxX = Math.max(0, toEl.scrollWidth - toEl.clientWidth);

              if (fromMaxY === 0 || toMaxY === 0) {
                toEl.scrollTop = fromEl.scrollTop;
              } else {
                toEl.scrollTop = Math.round((fromEl.scrollTop / fromMaxY) * toMaxY);
              }

              if (fromMaxX === 0 || toMaxX === 0) {
                toEl.scrollLeft = fromEl.scrollLeft;
              } else {
                toEl.scrollLeft = Math.round((fromEl.scrollLeft / fromMaxX) * toMaxX);
              }
            } finally {
              syncing = false;
            }
          }

          leftEl.addEventListener("scroll", () => sync(leftEl, rightEl), { passive: true });
          rightEl.addEventListener("scroll", () => sync(rightEl, leftEl), { passive: true });
        }

        // Keep split diff panes aligned, Git-style.
        installScrollSync(diffLeft, diffRight);

        function setMode(mode) {
          if (mode === "diff") {
            diffWrap.style.display = "block";
            docCurrent.parentElement.parentElement.style.display = "none";
            viewDiff.className = "pill ok";
            viewDoc.className = "pill";
          } else {
            diffWrap.style.display = "none";
            docCurrent.parentElement.parentElement.style.display = "";
            viewDoc.className = "pill ok";
            viewDiff.className = "pill";
          }
        }

        viewDoc.addEventListener("click", () => setMode("doc"));
        viewDiff.addEventListener("click", () => setMode("diff"));

        // Threaded comments rendering + actions
        const commentsWrap = document.getElementById("commentsWrap");
        const addRootComment = document.getElementById("addRootComment");

        function renderCommentItem(c, depth) {
          const pad = depth * 14;
          const header = '<div class="row" style="justify-content:space-between;">' +
            '<div><strong>' + escapeHtml(c.author || "unknown") + '</strong> <span class="muted">(' + escapeHtml(c.createdAt || "") + ')</span></div>' +
            '<div class="row" style="gap:8px;">' +
              '<span class="pill">' + escapeHtml(c.status || "open") + '</span>' +
              '<button data-reply="' + escapeHtml(c.id) + '">Reply</button>' +
            '</div>' +
          '</div>';

          const body = '<div style="margin-top:6px; white-space:pre-wrap;">' + escapeHtml(c.content || "") + '</div>';

          const anchored = c.anchor && c.anchor.nodeId
            ? ('<div class="muted" style="margin-top:6px;">Anchor: <code>' +
                escapeHtml((c.anchor.nodeId.namespace ? (c.anchor.nodeId.namespace + ":") : "") + c.anchor.nodeId.id) +
              '</code>' +
              (c.anchor.field ? (' · field: <code>' + escapeHtml(c.anchor.field) + '</code>') : '') +
              '</div>')
            : '';

          const wrap = '<div class="banner" style="margin-left:' + pad + 'px; margin-top:10px;">' +
            header + body + anchored +
          '</div>';

          const replies = Array.isArray(c.replies) && c.replies.length
            ? c.replies.map((r) => renderCommentItem(r, depth + 1)).join("")
            : "";

          return wrap + replies;
        }

        function renderThreads(tree) {
          if (!Array.isArray(tree) || tree.length === 0) {
            commentsWrap.innerHTML = '<div class="muted">(no comments yet)</div>';
            return;
          }
          commentsWrap.innerHTML = tree.map((c) => renderCommentItem(c, 0)).join("");
        }

        renderThreads(commentsTree);

        commentsWrap.addEventListener("click", async (e) => {
          const btn = e.target && e.target.closest ? e.target.closest("button[data-reply]") : null;
          if (!btn) return;
          const parentId = btn.getAttribute("data-reply");
          const content = prompt("Reply:", "");
          if (content == null || !content.trim()) return;
          try {
            await api("/api/acal/comment", {
              method: "POST",
              body: JSON.stringify({ proposalId: p.id, content, author: "reviewer-1", parentId }),
            });
            const refreshed = await api("/api/acal/commentsTree?proposalId=" + encodeURIComponent(p.id));
            renderThreads(refreshed);
          } catch (err) {
            reviewMsg.textContent = String(err && err.message ? err.message : err);
          }
        });

        addRootComment.addEventListener("click", async () => {
          const content = prompt("Comment:", "");
          if (content == null || !content.trim()) return;
          try {
            await api("/api/acal/comment", {
              method: "POST",
              body: JSON.stringify({ proposalId: p.id, content, author: "reviewer-1" }),
            });
            const refreshed = await api("/api/acal/commentsTree?proposalId=" + encodeURIComponent(p.id));
            renderThreads(refreshed);
          } catch (err) {
            reviewMsg.textContent = String(err && err.message ? err.message : err);
          }
        });

        acceptBtn.addEventListener("click", async () => {
          acceptBtn.disabled = true;
          try {
            await api("/api/acal/review", { method: "POST", body: JSON.stringify({ proposalId: p.id, action: "accept" }) });
            push("/acal/proposal?id=" + encodeURIComponent(p.id));
          } catch (e) {
            reviewMsg.textContent = String(e && e.message ? e.message : e);
          } finally {
            acceptBtn.disabled = false;
          }
        });

        rejectBtn.addEventListener("click", async () => {
          const reason = prompt("Reject reason (required):", "Not acceptable as-is");
          if (reason == null) return;
          rejectBtn.disabled = true;
          try {
            await api("/api/acal/review", { method: "POST", body: JSON.stringify({ proposalId: p.id, action: "reject", comment: reason }) });
            push("/acal/proposal?id=" + encodeURIComponent(p.id));
          } catch (e) {
            reviewMsg.textContent = String(e && e.message ? e.message : e);
          } finally {
            rejectBtn.disabled = false;
          }
        });

        applyBtn.addEventListener("click", async () => {
          applyBtn.disabled = true;
          try {
            await api("/api/acal/apply", { method: "POST", body: JSON.stringify({ proposalId: p.id }) });
            push("/acal/graph");
          } catch (e) {
            reviewMsg.textContent = String(e && e.message ? e.message : e);
          } finally {
            applyBtn.disabled = false;
          }
        });
      }

      async function renderReviewsQueue() {
        const props = await api("/api/acal/proposals?status=open");
        contentEl.innerHTML = [
          '<h2>Reviews (My queue)</h2>',
          '<div class="muted">Mock queue: all open proposals.</div>',
          '<table><thead><tr><th>Proposal</th><th>Created by</th><th>Rationale</th><th></th></tr></thead><tbody>',
          props.map((p) => (
            '<tr>' +
              '<td><code>' + escapeHtml(p.id) + '</code></td>' +
              '<td>' + escapeHtml((p.metadata && p.metadata.createdBy) || "") + '</td>' +
              '<td>' + escapeHtml(((p.metadata && p.metadata.rationale) || "").slice(0, 80)) + '</td>' +
              '<td>' + link('/acal/proposal?id=' + encodeURIComponent(p.id), 'Review') + '</td>' +
            '</tr>'
          )).join("") +
          '</tbody></table>',
        ].join("");
      }

      async function renderProjections() {
        const md = await api("/api/acal/projection/markdown");
        contentEl.innerHTML = [
          '<h2>Projections</h2>',
          '<div class="banner"><strong>Projection</strong> — derived view; non-canonical.</div>',
          '<div class="grid2" style="margin-top:12px;">',
            '<div>',
              '<h3>Raw Markdown (from accepted truth)</h3>',
              '<pre class="previewPane">' + escapeHtml(md.markdown) + '</pre>',
            '</div>',
            '<div>',
              '<h3>Rendered</h3>',
              '<div id="rendered" class="banner previewPane"></div>',
            '</div>',
          '</div>',
        ].join("");
        const html = await api("/api/renderMarkdown", { method: "POST", body: JSON.stringify({ markdown: md.markdown }) });
        document.getElementById("rendered").innerHTML = html.html;
      }

      async function renderConflicts() {
        const props = await api("/api/acal/proposals?status=open");
        const rows = [];
        for (const p of props) {
          const c = await api("/api/acal/conflicts?proposalId=" + encodeURIComponent(p.id));
          const s = await api("/api/acal/stale?proposalId=" + encodeURIComponent(p.id));
          rows.push({ id: p.id, conflicts: (c.conflicts || []).length, needsResolution: (c.needsResolution || []).length, isStale: !!s.isStale });
        }
        contentEl.innerHTML = [
          '<h2>Conflicts & staleness</h2>',
          '<div class="muted">Mock view: shows conflict/stale signals per open proposal.</div>',
          '<table><thead><tr><th>Proposal</th><th>Conflicts</th><th>Needs resolution</th><th>Stale</th><th></th></tr></thead><tbody>',
          rows.map((r) => (
            '<tr>' +
              '<td><code>' + escapeHtml(r.id) + '</code></td>' +
              '<td>' + escapeHtml(String(r.conflicts)) + '</td>' +
              '<td>' + escapeHtml(String(r.needsResolution)) + '</td>' +
              '<td>' + (r.isStale ? pill("stale", "warn") : pill("ok", "ok")) + '</td>' +
              '<td>' + link('/acal/proposal?id=' + encodeURIComponent(r.id), 'Open') + '</td>' +
            '</tr>'
          )).join("") +
          '</tbody></table>',
        ].join("");
      }

      async function renderPolicy() {
        contentEl.innerHTML = [
          '<h2>Policy / Roles</h2>',
          '<div class="banner">',
            '<strong>Roadmap stub</strong>: server-enforced enterprise approval policies are part of the target-state, but this playground mock does not enforce RBAC/quorum.',
          '</div>',
          '<h3>What the UI must make obvious</h3>',
          '<ul>',
            '<li>Accepted truth is read-only; propose changes instead.</li>',
            '<li>Only reviews accept/reject proposals; apply is explicit.</li>',
            '<li>Policy evaluation should be server-side, returned to all clients.</li>',
          '</ul>',
          '<h3>Next</h3>',
          '<div class="muted">See <code>docs/UI_SPEC.md</code> and the whitepaper section on enterprise approval policies.</div>',
        ].join("");
      }

      async function render() {
        // Normalize base route
        if (location.pathname === "/acal" || location.pathname === "/acal/") {
          history.replaceState({}, "", "/acal/graph");
        }

        const path = location.pathname.endsWith("/") && location.pathname !== "/"
          ? location.pathname.slice(0, -1)
          : location.pathname;

        const counts = await api("/api/acal/summary");
        navRow(path, counts);

        // Detail routes (exact path match to avoid "/acal/nodes" matching "/acal/node")
        if (path === "/acal/node") return renderNodeDetail();
        if (path === "/acal/proposal") return renderProposalDetail();

        if (path === "/acal/graph") return renderGraph();
        if (path === "/acal/nodes") return renderNodes();
        if (path === "/acal/proposals") return renderProposals();
        if (path === "/acal/reviews") return renderReviewsQueue();
        if (path === "/acal/projections") return renderProjections();
        if (path === "/acal/conflicts") return renderConflicts();
        if (path === "/acal/policy") return renderPolicy();

        contentEl.innerHTML = '<pre>Unknown route: ' + escapeHtml(path) + '</pre>';
      }

      render().catch((e) => { contentEl.innerHTML = '<pre>' + escapeHtml(String(e && e.message ? e.message : e)) + '</pre>'; });
    </script>
  </body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/") {
      return sendHtml(res, homePage());
    }

    if (req.method === "GET" && url.pathname === "/scenarios") {
      return sendHtml(res, htmlPage());
    }

    if (req.method === "GET" && (url.pathname === "/acal" || url.pathname.startsWith("/acal/"))) {
      return sendHtml(res, acalHtmlPage());
    }

    if (req.method === "GET" && url.pathname === "/api/scenarios") {
      return sendJson(res, 200, listScenarios());
    }

    if (req.method === "GET" && url.pathname === "/api/guided/scenarios") {
      return sendJson(res, 200, listGuidedScenarios());
    }

    if (req.method === "POST" && url.pathname === "/api/guided/start") {
      const body = await readJsonBody(req);
      const scenarioId =
        body && typeof body === "object" && "scenarioId" in body
          ? /** @type {any} */ (body).scenarioId
          : undefined;

      if (typeof scenarioId !== "string" || scenarioId.length === 0) {
        return sendJson(res, 400, { error: "Missing scenarioId" });
      }

      const scenario = getGuidedScenario(scenarioId);
      if (!scenario) {
        return sendJson(res, 404, { error: `Unknown guided scenario: ${scenarioId}` });
      }

      const sessionId = newSessionId();
      const session: GuidedSession = {
        id: sessionId,
        scenarioId,
        store: await ensureAcalStore(),
        stepIndex: 0,
        inputs: {},
        history: [],
      };
      guidedSessions.set(sessionId, session);

      const first = scenario.steps[0];
      return sendJson(res, 200, {
        sessionId,
        scenarioTitle: scenario.title,
        startedAt: new Date().toISOString(),
        history: session.history,
        next: first && first.kind === "form" ? { kind: "form", fields: first.fields } : first ? { kind: "auto" } : null,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/guided/next") {
      const body = await readJsonBody(req);
      const sessionId =
        body && typeof body === "object" && "sessionId" in body
          ? /** @type {any} */ (body).sessionId
          : undefined;

      const input =
        body && typeof body === "object" && "input" in body
          ? /** @type {any} */ (body).input
          : undefined;

      if (typeof sessionId !== "string" || sessionId.length === 0) {
        return sendJson(res, 400, { error: "Missing sessionId" });
      }

      const session = guidedSessions.get(sessionId);
      if (!session) {
        return sendJson(res, 404, { error: "Unknown or expired session" });
      }

      const scenario = getGuidedScenario(session.scenarioId);
      if (!scenario) {
        guidedSessions.delete(sessionId);
        return sendJson(res, 404, { error: "Scenario no longer exists" });
      }

      // If current step is form, validate + capture input and advance.
      const current = scenario.steps[session.stepIndex];
      if (!current) {
        guidedSessions.delete(sessionId);
        return sendJson(res, 200, {
          scenarioTitle: scenario.title,
          startedAt: "",
          finishedAt: new Date().toISOString(),
          history: session.history,
          done: true,
        });
      }

      if (current.kind === "form") {
        const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
        for (const field of current.fields) {
          const v = obj[field.id];
          const s = typeof v === "string" ? v : "";
          if (field.required && s.trim().length === 0) {
            return sendJson(res, 400, { error: `Missing required field: ${field.label}` });
          }
          session.inputs[field.id] = s;
        }
        session.history.push({ id: current.id, title: current.title, ok: true, output: { input: session.inputs } });
        session.stepIndex++;
      }

      // Run auto steps until next form or end
      while (true) {
        const step = scenario.steps[session.stepIndex];
        if (!step) break;
        if (step.kind === "form") break;

        try {
          const out = await step.run({ store: session.store, inputs: session.inputs });
          session.history.push({ id: step.id, title: step.title, ok: true, output: out });
          session.stepIndex++;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          session.history.push({ id: step.id, title: step.title, ok: false, error: message });
          session.stepIndex++;
          break;
        }
      }

      const next = scenario.steps[session.stepIndex];
      const done = !next;
      if (done) guidedSessions.delete(sessionId);

      return sendJson(res, 200, {
        scenarioTitle: scenario.title,
        startedAt: "",
        finishedAt: done ? new Date().toISOString() : undefined,
        history: session.history,
        done,
        next: next && next.kind === "form" ? { kind: "form", fields: next.fields } : next ? { kind: "auto" } : null,
      });
    }

    if (req.method === "POST" && url.pathname === "/api/run") {
      const body = await readJsonBody(req);
      const scenarioId = (body && typeof body === "object" && "scenarioId" in body)
        ? /** @type {any} */ (body).scenarioId
        : undefined;

      if (typeof scenarioId !== "string" || scenarioId.length === 0) {
        return sendJson(res, 400, { error: "Missing scenarioId" });
      }

      const result = await runScenario(scenarioId);
      return sendJson(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/api/renderMarkdown") {
      const body = await readJsonBody(req);
      const markdown = (body && typeof body === "object" && "markdown" in body)
        ? /** @type {any} */ (body).markdown
        : undefined;

      if (typeof markdown !== "string") {
        return sendJson(res, 400, { error: "Missing markdown string" });
      }

      // markdown-it is configured with html=false, so returned HTML is safe to inject locally.
      const html = md.render(markdown);
      return sendJson(res, 200, { html });
    }

    // ---- ACAL mock API ----

    if (req.method === "POST" && url.pathname === "/api/acal/reset") {
      // Reset by clearing cached store and re-seeding on next access
      acalStore = null;
      acalStoreInit = null;
      await ensureAcalStore();
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/acal/summary") {
      const store = await ensureAcalStore();
      const accepted = await store.queryNodes({ status: ["accepted"], limit: 1000, offset: 0 });
      const proposalsOpen = await store.queryProposals({ status: ["open"], limit: 1000, offset: 0 });
      const proposalsAccepted = await store.queryProposals({ status: ["accepted"], limit: 1000, offset: 0 });
      return sendJson(res, 200, {
        graph: accepted.total,
        nodes: accepted.total,
        proposals: proposalsOpen.length,
        reviews: proposalsOpen.length,
        projections: 1,
        conflicts: proposalsOpen.length,
        policy: 1,
        _acceptedProposals: proposalsAccepted.length,
      });
    }

    if (req.method === "GET" && url.pathname === "/api/acal/nodes") {
      const store = await ensureAcalStore();
      const status = url.searchParams.get("status") || "accepted";
      const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") || 200)));
      const resNodes = await store.queryNodes({ status: [status as any], limit, offset: 0 });
      return sendJson(res, 200, resNodes);
    }

    if (req.method === "GET" && url.pathname === "/api/acal/node") {
      const store = await ensureAcalStore();
      const id = url.searchParams.get("id");
      const namespace = url.searchParams.get("namespace") || undefined;
      if (!id) return sendJson(res, 400, { error: "Missing id" });
      const node = await store.getNode(namespace ? { id, namespace } : { id });
      if (!node) return sendJson(res, 404, { error: "Node not found" });
      return sendJson(res, 200, node);
    }

    if (req.method === "GET" && url.pathname === "/api/acal/related") {
      const store = await ensureAcalStore();
      const id = url.searchParams.get("id");
      const namespace = url.searchParams.get("namespace") || undefined;
      if (!id) return sendJson(res, 400, { error: "Missing id" });
      const resNodes = await store.queryNodes({
        relatedTo: namespace ? { id, namespace } : { id },
        depth: 1,
        direction: "both",
        status: ["accepted"],
        limit: 50,
        offset: 0,
      });
      return sendJson(res, 200, resNodes);
    }

    if (req.method === "GET" && url.pathname === "/api/acal/proposals") {
      const store = await ensureAcalStore();
      const status = url.searchParams.get("status") || "open";
      const proposals = await store.queryProposals({ status: [status], limit: 1000, offset: 0 } as any);
      return sendJson(res, 200, proposals);
    }

    if (req.method === "GET" && url.pathname === "/api/acal/proposal") {
      const store = await ensureAcalStore();
      const id = url.searchParams.get("id");
      if (!id) return sendJson(res, 400, { error: "Missing id" });
      const p = await store.getProposal(id);
      if (!p) return sendJson(res, 404, { error: "Proposal not found" });
      return sendJson(res, 200, p);
    }

    if (req.method === "GET" && url.pathname === "/api/acal/reviews") {
      const store = await ensureAcalStore();
      const proposalId = url.searchParams.get("proposalId");
      if (!proposalId) return sendJson(res, 400, { error: "Missing proposalId" });
      const history = await store.getReviewHistory(proposalId);
      return sendJson(res, 200, history);
    }

    if (req.method === "POST" && url.pathname === "/api/acal/review") {
      const store = await ensureAcalStore();
      const body = await readJsonBody(req);
      const proposalId =
        body && typeof body === "object" && "proposalId" in body
          ? /** @type {any} */ (body).proposalId
          : undefined;
      const action =
        body && typeof body === "object" && "action" in body
          ? /** @type {any} */ (body).action
          : undefined;
      const comment =
        body && typeof body === "object" && "comment" in body
          ? /** @type {any} */ (body).comment
          : undefined;

      if (typeof proposalId !== "string" || proposalId.length === 0) {
        return sendJson(res, 400, { error: "Missing proposalId" });
      }
      if (action !== "accept" && action !== "reject") {
        return sendJson(res, 400, { error: "action must be accept|reject" });
      }
      if (action === "reject" && typeof comment !== "string") {
        return sendJson(res, 400, { error: "Reject requires comment" });
      }

      const review: Review = {
        id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        proposalId,
        reviewer: "reviewer-1",
        reviewedAt: new Date().toISOString(),
        action,
        comment: typeof comment === "string" ? comment : undefined,
      };
      await store.submitReview(review);
      return sendJson(res, 200, { ok: true, reviewId: review.id });
    }

    if (req.method === "POST" && url.pathname === "/api/acal/apply") {
      const store = await ensureAcalStore();
      const body = await readJsonBody(req);
      const proposalId =
        body && typeof body === "object" && "proposalId" in body
          ? /** @type {any} */ (body).proposalId
          : undefined;
      if (typeof proposalId !== "string" || proposalId.length === 0) {
        return sendJson(res, 400, { error: "Missing proposalId" });
      }
      await store.applyProposal(proposalId);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/acal/conflicts") {
      const store = await ensureAcalStore();
      const proposalId = url.searchParams.get("proposalId");
      if (!proposalId) return sendJson(res, 400, { error: "Missing proposalId" });
      const out = await store.detectConflicts(proposalId);
      return sendJson(res, 200, out);
    }

    if (req.method === "GET" && url.pathname === "/api/acal/stale") {
      const store = await ensureAcalStore();
      const proposalId = url.searchParams.get("proposalId");
      if (!proposalId) return sendJson(res, 400, { error: "Missing proposalId" });
      const isStale = await store.isProposalStale(proposalId);
      return sendJson(res, 200, { isStale });
    }

    if (req.method === "GET" && url.pathname === "/api/acal/comments") {
      const store = await ensureAcalStore();
      const proposalId = url.searchParams.get("proposalId") || undefined;
      if (!proposalId) return sendJson(res, 400, { error: "Missing proposalId" });
      const comments = await store.queryComments({ proposalId, limit: 200, offset: 0 });
      return sendJson(res, 200, comments);
    }

    if (req.method === "GET" && url.pathname === "/api/acal/commentsTree") {
      const store = await ensureAcalStore();
      const proposalId = url.searchParams.get("proposalId") || undefined;
      if (!proposalId) return sendJson(res, 400, { error: "Missing proposalId" });
      const proposal = await store.getProposal(proposalId);
      if (!proposal) return sendJson(res, 404, { error: "Proposal not found" });
      return sendJson(res, 200, proposal.comments || []);
    }

    if (req.method === "POST" && url.pathname === "/api/acal/comment") {
      const store = await ensureAcalStore();
      const body = await readJsonBody(req);
      const proposalId =
        body && typeof body === "object" && "proposalId" in body
          ? /** @type {any} */ (body).proposalId
          : undefined;
      const content =
        body && typeof body === "object" && "content" in body
          ? /** @type {any} */ (body).content
          : undefined;
      const author =
        body && typeof body === "object" && "author" in body
          ? /** @type {any} */ (body).author
          : undefined;
      const parentId =
        body && typeof body === "object" && "parentId" in body
          ? /** @type {any} */ (body).parentId
          : undefined;

      if (typeof proposalId !== "string" || proposalId.length === 0) {
        return sendJson(res, 400, { error: "Missing proposalId" });
      }
      if (typeof content !== "string" || content.trim().length === 0) {
        return sendJson(res, 400, { error: "Missing content" });
      }
      const who = typeof author === "string" && author.length > 0 ? author : "anonymous";
      const now = new Date().toISOString();

      const proposal = await store.getProposal(proposalId);
      if (!proposal) return sendJson(res, 404, { error: "Proposal not found" });

      const c: Comment = {
        id: newCommentId(),
        content,
        author: who,
        createdAt: now,
        status: "open",
        replies: [],
      };

      if (typeof parentId === "string" && parentId.length > 0) {
        const existing = proposal.comments || [];
        const updated = appendReply(existing, parentId, c);
        if (!updated.ok) return sendJson(res, 404, { error: "Parent comment not found" });
        await store.updateProposal(proposalId, {
          comments: updated.comments,
          metadata: {
            ...proposal.metadata,
            modifiedAt: now,
            modifiedBy: who,
          },
        } as any);
      } else {
        await store.addProposalComment(proposalId, c);
      }

      return sendJson(res, 200, { ok: true, commentId: c.id });
    }

    if (req.method === "POST" && url.pathname === "/api/acal/proposeUpdate") {
      const store = await ensureAcalStore();
      const body = await readJsonBody(req);
      const nodeId =
        body && typeof body === "object" && "nodeId" in body
          ? /** @type {any} */ (body).nodeId
          : undefined;
      const field =
        body && typeof body === "object" && "field" in body
          ? /** @type {any} */ (body).field
          : undefined;
      const value =
        body && typeof body === "object" && "value" in body
          ? /** @type {any} */ (body).value
          : undefined;
      const rationale =
        body && typeof body === "object" && "rationale" in body
          ? /** @type {any} */ (body).rationale
          : undefined;

      if (!nodeId || typeof nodeId !== "object" || typeof (nodeId as any).id !== "string") {
        return sendJson(res, 400, { error: "Missing nodeId" });
      }
      if (field !== "title" && field !== "description") {
        return sendJson(res, 400, { error: "field must be title|description" });
      }
      if (typeof value !== "string") {
        return sendJson(res, 400, { error: "Missing value" });
      }
      if (typeof rationale !== "string" || rationale.trim().length === 0) {
        return sendJson(res, 400, { error: "Missing rationale" });
      }

      const id: NodeId = (nodeId as any).namespace
        ? { id: (nodeId as any).id, namespace: (nodeId as any).namespace }
        : { id: (nodeId as any).id };
      const current = await store.getNode(id);
      if (!current) return sendJson(res, 404, { error: "Node not found" });

      const proposalId = `p-ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const p: Proposal = {
        id: proposalId,
        status: "open",
        operations: [
          {
            id: "op-1",
            type: "update",
            order: 1,
            nodeId: id,
            changes: { [field]: value },
          } as any,
        ],
        metadata: proposalMeta(new Date().toISOString(), "ui-author", {
          rationale,
          baseVersions: { [nodeKey(id)]: current.metadata.version },
        }),
      };

      await store.createProposal(p);
      return sendJson(res, 200, { proposalId });
    }

    if (req.method === "GET" && url.pathname === "/api/acal/projection/markdown") {
      const store = await ensureAcalStore();
      const markdown = await projectToMarkdown(store);
      return sendJson(res, 200, { markdown });
    }

    if (req.method === "GET" && url.pathname === "/api/acal/projection/preview") {
      const proposalId = url.searchParams.get("proposalId");
      if (!proposalId) return sendJson(res, 400, { error: "Missing proposalId" });
      const markdown = await buildPreviewMarkdown(proposalId);
      return sendJson(res, 200, { markdown });
    }

    if (req.method === "GET" && url.pathname === "/api/acal/projection/currentForProposal") {
      const store = await ensureAcalStore();
      const proposalId = url.searchParams.get("proposalId");
      if (!proposalId) return sendJson(res, 400, { error: "Missing proposalId" });
      const proposal = await store.getProposal(proposalId);
      if (!proposal) return sendJson(res, 404, { error: "Proposal not found" });

      const focus = collectTouchedNodeIds(proposal);
      const { nodes, missingFocus } = await collectChainNodesForFocus(store, focus, {
        includeProposed: false,
        depth: 5,
      });
      const markdown = renderDocumentMarkdown(
        `Current truth (context document): ${proposalId}`,
        nodes,
        missingFocus,
        focus
      );
      return sendJson(res, 200, { markdown });
    }

    if (req.method === "GET" && url.pathname === "/api/acal/projection/previewForProposal") {
      const store = await ensureAcalStore();
      const proposalId = url.searchParams.get("proposalId");
      if (!proposalId) return sendJson(res, 400, { error: "Missing proposalId" });
      const proposal = await store.getProposal(proposalId);
      if (!proposal) return sendJson(res, 404, { error: "Proposal not found" });

      const focus = collectTouchedNodeIds(proposal);

      const accepted = await store.queryNodes({ status: ["accepted"], limit: 2000, offset: 0 });
      const nodes = new Map<string, AnyNode>();
      for (const n of accepted.nodes) nodes.set(coreNodeKey(n.id), { ...n, status: "accepted" });
      const pApply: Proposal = {
        ...proposal,
        status: "accepted",
        metadata: {
          ...proposal.metadata,
          modifiedAt: new Date().toISOString(),
          modifiedBy: "preview",
        },
      };
      applyAcceptedProposalToNodeMap(nodes, pApply, { keyOf: coreNodeKey });
      const tmp = new PreviewStore(nodes);

      const { nodes: chainNodes, missingFocus } = await collectChainNodesForFocus(
        tmp as unknown as ContextStore,
        focus,
        { includeProposed: true, depth: 5 }
      );
      const markdown = renderDocumentMarkdown(
        `Proposed truth (preview document): ${proposalId}`,
        chainNodes,
        missingFocus,
        focus
      );
      return sendJson(res, 200, { markdown });
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return sendJson(res, 500, { error: message });
  }
});

const port = Number(process.env.PORT || 4317);
initTelemetry().then(() => {
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Scenario runner listening on http://localhost:${port}`);
  });
});

