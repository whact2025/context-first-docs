import http from "node:http";

import MarkdownIt from "markdown-it";

import { InMemoryStore } from "../store/in-memory-store.js";
import { listScenarios, runScenario } from "./scenarios.js";
import { getGuidedScenario, listGuidedScenarios } from "./guided.js";

const md = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
});

type GuidedSession = {
  id: string;
  scenarioId: string;
  store: InMemoryStore;
  stepIndex: number;
  inputs: Record<string, string>;
  history: Array<{ id: string; title: string; ok: boolean; output?: unknown; error?: string }>;
};

const guidedSessions = new Map<string, GuidedSession>();

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
    <title>Context-First Docs – Scenario Runner</title>
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
      <h1>Scenario Runner (InMemoryStore)</h1>
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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/") {
      return sendHtml(res, htmlPage());
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
        store: new InMemoryStore(),
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

    return sendJson(res, 404, { error: "Not found" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return sendJson(res, 500, { error: message });
  }
});

const port = Number(process.env.PORT || 4317);
server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Scenario runner listening on http://localhost:${port}`);
});

