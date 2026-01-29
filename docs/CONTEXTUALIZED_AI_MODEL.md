# Using the Context Store to Create a Contextualized AI Model

This document describes **how the context store is used to create a contextualized enterprise AI model** — a model that reasons and answers using your organization’s approved goals, decisions, constraints, and risks without leaking that IP outside your infrastructure.

**Audience:** architects, ML/platform leads, security/compliance, and implementers.

**Related:** `docs/WHITEPAPER.md` section 7.1 (Enterprise IP and contextualized AI models), `docs/AGENT_API.md` (query and decision/rationale traversal APIs), `CONTEXT.md` (self-hosting constraint).

---

## Position in architecture: the Contextualize module

**Contextualize** is a **first-class module** in the ACAL architecture. It packages everything needed to turn the context store into a substrate for RAG, fine-tuning, and structured prompting, with **policy-as-code for prompt leakage** as a named, auditable component.

| Layer | What it is | Status |
|-------|------------|--------|
| **Contextualize module** | Thin wrapper over the store: retrieval, prompt building, export for fine-tuning, optional vector index. Sits between the context store and any LLM (self-hosted or vendor). | Designed and documented here; implementation roadmap in PLAN Phase 5. |
| **Prompt-leakage policy layer** | Policy-as-code for what may leave the perimeter: **sensitivity labels** on nodes/namespaces, a **retrieval policy module** (allow/deny by destination, e.g. vendor_llm vs internal_only), and **logging of node IDs** included in each prompt sent to a vendor LLM. Wraps retrieval and prompt building; store stays agnostic. | Same design doc; implementation is "thin wrapper v0" in PLAN Phase 5. |

Even at v0, the **prompt-leakage policy layer** is the formal hook security and compliance can point to: labels + policy module + logging = auditable, enforceable control over prompt leakage. See §3.3 (operational controls) and §3.4 (policy interface) below.

---

## Contextualized enterprise AI model: how enterprise IP benefits

Enterprises hold valuable IP in goals, decisions, constraints, risks, and rationale. Sending that context to external AI services creates leakage and compliance risk. The context store enables **building a contextualized enterprise AI model** — one that reasons using your approved context — while keeping that IP inside your organization.

| Benefit | What it means |
|--------|----------------|
| **Single source of truth** | Retrieval, export for training, and prompting all use **accepted** context only (`status: ["accepted"]`). Drafts and rejected ideas are not treated as fact. Any model you contextualize is grounded in reviewable, approved content. |
| **No context leakage** | Retrieval (RAG) and export for fine-tuning run **inside your perimeter** against the store. You do not send raw context to an external service to "contextualize" a model; you read from the store and build prompts or training datasets on your infrastructure. |
| **Auditability and provenance** | The store keeps proposals, reviews, and acceptance history. You can record which context version was used for a given export or retrieval, so you can trace how a contextualized model or answer was produced (compliance and internal audit). |
| **Structured, reviewable training data** | Exported context is typed (goals, decisions, risks, constraints) and linked. You can restrict export to accepted-only, by namespace, or by type so sensitive or obsolete context is excluded. |
| **Choice of inference location** | With a **self-hosted or private-VPC LLM**, the full flow (store → retrieval → prompt → inference) stays in-house. With a vendor LLM, only the prompt is sent; you control what is included and can use vendor DPAs and data-residency options. |

Accepted-only retrieval is the same safety contract that prevents agent hallucinations in collaboration; we reuse it to prevent data poisoning in training/prompting.

**Implementation paths:** RAG at inference (§2.1), export for fine-tuning (§2.2), structured prompting (§2.3). All run against the store on your infrastructure; training and inference can stay on-prem or in a private cloud. See also `docs/WHITEPAPER.md` section 7.1.

---

## 1. Overview

### 1.1 What “contextualized AI model” means

A **contextualized AI model** is one that:

- **Uses your organization’s durable context** (goals, decisions, constraints, risks, rationale) as the basis for answers and suggestions.
- **Respects accepted truth** — only approved, reviewable context is used; drafts and rejected alternatives are not treated as truth.
- **Keeps IP in-house** — context and any derived training data or embeddings stay within your infrastructure (self-hosted store, optional self-hosted or air-gapped model training and inference).

The **context store** is the canonical source of that context: a typed graph of nodes and relationships with explicit status (accepted / proposed / rejected) and review-mode semantics (see `docs/REVIEW_MODE.md`). It does **not** become the model; it is the **substrate** you use to contextualize a model in three ways: **RAG at inference**, **export for fine-tuning**, and **structured prompting**.

### 1.2 Why the context store fits

- **Explicit status:** You retrieve only `status: ["accepted"]` by default, so training or retrieval does not mix in drafts or rejected ideas as truth (see `src/store/core/query-nodes.ts`: `query.status || ["accepted"]`).
- **Structured graph:** Nodes have type, relationships, and deterministic text (`title`, `description`, derived `content`), so you can export or format them consistently for prompts or training (see `src/types/node.ts`, `src/utils/node-text.ts`).
- **Decision/rationale traversal (provenance chains):** APIs such as `traverseReasoningChain`, `buildContextChain`, `followDecisionReasoning`, and `queryWithReasoning` perform **typed relationship traversal** (e.g. goal → decision → risk → task) — graph traversal of rationale and provenance, not LLM chain-of-thought. They let you build ordered, relevant context for injection into prompts or training examples (see `src/types/context-store.ts`, `src/store/in-memory-store.ts`).
- **Self-hosting:** The store is designed to run within your organization; no context need leave your perimeter for core retrieval or export (see `CONTEXT.md` constraint-005, `DECISIONS.md` decision-005).

---

## 2. Three implementation paths

### 2.1 Path A: RAG at inference (contextualize every request)

**Idea:** For each user or agent request, retrieve accepted context from the store and inject it into the model’s context window. The model (base or fine-tuned) stays generic; “contextualization” is the retrieved block. No training required.

**Data flow:**

1. User/agent sends a question or task.
2. **Retrieve:** Query the store (and optionally a vector index built from the store) to get relevant accepted nodes.
3. **Format:** Turn nodes into a single context string (e.g. type, id, title, description, relationships).
4. **Prompt:** Build a prompt with system/context = retrieved context, user = question.
5. **Infer:** Call your LLM (self-hosted or API) with that prompt; return the answer.

**APIs and code (existing):**

- `store.queryNodes(query)` — filter by `status: ["accepted"]`, `type`, `search`, `relatedTo`, `descendantsOf`, `dependenciesOf`, etc. (`src/types/context-store.ts`, `src/store/core/query-nodes.ts`).
- `store.getAcceptedNodes()` — all accepted nodes.
- `store.traverseReasoningChain(startNodeId, options)` — follow relationship paths from a node (`src/store/in-memory-store.ts`).
- `store.buildContextChain(startNodeId, options)` — build a progressive context chain.
- `store.queryWithReasoning(options)` — run a query and attach provenance chains (typed relationship paths) to each result.
- `projectToMarkdown(store, options)` — deterministic Markdown of accepted nodes (`src/markdown/projection.ts`); can be used as a “full context document” for the model.

**Implementation steps:**

| Step | Description | Where / how |
|------|-------------|-------------|
| 1 | **Retrieval module** | New module (e.g. `src/contextualize/retrieve.ts`). Input: query string and optional `startNodeId`. Use `queryNodes({ status: ["accepted"], search: query, limit })` and/or `traverseReasoningChain(startNodeId, ...)`. Output: list of nodes or a single formatted string. |
| 2 | **Prompt builder** | New module (e.g. `src/contextualize/prompt.ts`). Takes retrieved context string + user message; returns system + user messages (or a single prompt) for the LLM. |
| 3 | **LLM integration** | In API or playground: on each request, call retrieve → prompt builder → call LLM. All runs inside your infra if the store and LLM are self-hosted. |
| 4 | **(Optional) Vector index** | Periodically (or on write): take accepted nodes’ `content` (or title+description), compute embeddings, store in a self-hosted vector DB. At inference: embed query, retrieve top-k, then optionally expand with `traverseReasoningChain` from those nodes. Keeps retrieval scalable while still using the store as the source of truth. |

**Enterprise IP:** Context never leaves your perimeter. Retrieval and prompt construction run against your store; if the LLM is also self-hosted or in a private VPC, the full pipeline stays in-house.

---

### 2.2 Path B: Export for fine-tuning (contextualize the model’s weights)

**Idea:** Export accepted, structured context from the store into a dataset, then fine-tune or instruction-tune a model so it internalizes your project’s decisions, constraints, and language. The resulting model is “contextualized” to your org without needing to retrieve at inference time (though you can still use RAG for freshness).

**Data flow:**

1. **Export:** Read all accepted nodes (and optionally provenance chains from decision/rationale traversal) from the store; serialize to a canonical format (e.g. JSONL or instruction/response pairs).
2. **Training format:** Convert to the format your training stack expects (e.g. `{"instruction": "...", "output": "..."}` or completion pairs).
3. **Train:** Run fine-tuning or instruction-tuning (e.g. Axolotl, LLaMA-Factory, or vendor API) on your infrastructure.
4. **Deploy:** Use the fine-tuned model for inference; optionally still use RAG over the store for up-to-date context.

**APIs and code (existing):**

- `store.getAcceptedNodes()` or `store.queryNodes({ status: ["accepted"], limit })`.
- Node shape: `id`, `type`, `title`, `description`, `content`, `relationships`, `metadata` (`src/types/node.ts`).
- `store.followDecisionReasoning(decisionId, options)` — get goal, alternatives, implementations, risks, constraints for a decision; useful for rich training examples.

**Implementation steps:**

| Step | Description | Where / how |
|------|-------------|-------------|
| 1 | **Export pipeline** | New module (e.g. `src/contextualize/export.ts`). Call `getAcceptedNodes()` (or paginate with `queryNodes`). For each node, output type, id, title, description, relationship targets. Optionally for each decision call `followDecisionReasoning` and export one example per decision (context + summary). Write JSONL or JSON. |
| 2 | **Training format** | Map exported records to instruction/response or completion format. E.g. “Given this project context: [nodes]. What is the decision on X?” → “Decision: … Rationale: …”. Preserve only accepted status so the model never sees drafts/rejected as truth. |
| 3 | **Versioning** | Attach metadata (e.g. export timestamp, store snapshot id if available) so you know which context version a fine-tuned model was trained on. Enables reproducibility and audit. |
| 4 | **Train** | Run training on your infra (e.g. on-prem GPU cluster or private cloud). No need to send raw context to a third-party training API if you keep training in-house. |

**Enterprise IP:** Export runs inside your perimeter. Training can be fully on-prem or in a private cloud; fine-tuned weights and datasets remain under your control. You can enforce that no context or derived data is sent to external training services.

---

### 2.3 Path C: Structured prompting (contextualize via system context)

**Idea:** Don’t train a new model; build a “context document” from the store and feed it as system (or long user) context so the model always reasons within that context. Easiest to implement; works with any LLM.

**Data flow:**

1. On each request (or per session): build a context document from the store.
2. Option A: Full project — `projectToMarkdown(store, { includeProposed: false })` and use the result as system context.
3. Option B: Focused — use `queryWithReasoning({ query: { search: topic, status: ["accepted"] }, ... })` and format the returned nodes + chains into a structured section (e.g. “Relevant goals”, “Decisions”, “Risks”).
4. Send that context + user message to the LLM.

**APIs and code (existing):**

- `projectToMarkdown(store, options)` — deterministic Markdown of accepted nodes (`src/markdown/projection.ts`).
- `queryWithReasoning(options)` — query plus reasoning chains from results (`src/store/in-memory-store.ts`).
- `traverseReasoningChain`, `buildContextChain` — for focused context around a given node.

**Implementation steps:**

| Step | Description | Where / how |
|------|-------------|-------------|
| 1 | **Context document builder** | Thin wrapper: call `projectToMarkdown(store)` for full context, or `queryWithReasoning` for topic-focused context. Output a string. |
| 2 | **Wire into app** | In playground, API, or agent loop: before calling the LLM, get context document, then pass it as system message or first user message. |

**Enterprise IP:** All context assembly happens from your store inside your infra. If the LLM is self-hosted, end-to-end flow stays in-house; if you use a vendor API, only the prompt (context + question) is sent — you can still control sensitivity via what you include and vendor agreements.

---

## 3. Data flows and security (enterprise IP)

### 3.1 Where data lives

| Component | Data | Location (intended) |
|-----------|------|---------------------|
| Context store | Nodes, proposals, reviews, relationships | Self-hosted (in-memory today; file-based or MongoDB planned). See `docs/STORAGE_IMPLEMENTATION_PLAN.md`. |
| Retrieval / export / prompt builder | Reads from store; produces context strings or files | Same host or same network as store; no external call required. |
| Vector index (optional) | Embeddings of accepted nodes’ text | Self-hosted vector DB; populated from store. |
| Fine-tuning dataset | Exported accepted context (and optionally formatted pairs) | Your object storage or training cluster; not sent to third parties if you train on-prem. |
| Fine-tuned model | Weights derived from your context | Your registry / deployment env. |
| LLM inference | Prompt = context + user message | Self-hosted model: fully in-house. Vendor API: context + query leave your perimeter to vendor; choose what to include and review vendor DPA/terms. |

### 3.2 Keeping enterprise IP inside the organization

- **Store and retrieval:** The context store and all retrieval logic (query, decision/rationale traversal, projection) run inside your infrastructure. No need to send raw context to an external service for “contextualization” — you do it by reading from the store and building prompts or export files.
- **Training:** If you export and fine-tune on your own cluster (or in a private cloud with strict access control), your context and the resulting model never leave your control. You can enforce “no context or derived data to external training APIs” as policy.
- **Inference:** With a self-hosted or private-VPC LLM, inference stays in-house. If you use a **vendor LLM**, the prompt (retrieved context + user message) leaves your perimeter; you control what is included. Use the patterns in §3.3 to **minimize prompt leakage** and stay within compliance.
- **Auditability:** The store keeps proposals, reviews, and acceptance history. You can record which context was used for which export or which retrieval (e.g. snapshot id, query params), so you can trace how a contextualized model or answer was produced.

### 3.3 Minimize prompt leakage (vendor LLM): actionable patterns

When the prompt is sent to a vendor LLM, every byte of context you include is exposed. The following patterns are **operational controls** you can implement on top of the store and retrieval layer to keep prompts minimal and within policy.

| Pattern | What it does | How to implement |
|--------|----------------|------------------|
| **Topic-scoped retrieval defaults** | Never send "all accepted context" by default; always scope retrieval to the user's topic or task. | Default retrieval to `queryNodes({ status: ["accepted"], search: userTopic, limit: N })` or `queryWithReasoning({ query: { search: userTopic, status: ["accepted"], limit }, ... })`. Use a small default `limit` (e.g. 10–20 nodes). Only expand to full-project context when explicitly requested and allowed by policy. |
| **Namespace / type allowlists** | Restrict which namespaces and node types may be included in prompts sent to the vendor. | Before building the prompt, filter retrieved nodes: allow only `namespace` in an allowlist (e.g. `["product", "public"]`) and only `type` in an allowlist (e.g. `["goal", "decision"]`); exclude `constraint` or `risk` if they are sensitive. Use `queryNodes({ status: ["accepted"], namespace: allowedNamespace, type: allowedTypes, ... })` or filter results after query. |
| **Redaction rules** | Strip or mask sensitive fields or patterns before the prompt is sent. | After retrieval, apply redaction: e.g. remove or truncate `description` for nodes with a certain tag; mask PII or internal IDs in text; omit `metadata.createdBy` / `modifiedBy` if identity is sensitive. Implement as a pipeline step: `retrieved nodes → redact(nodes, rules) → format for prompt`. |
| **Max context budget + sensitivity labels** | Cap total context size and forbid (or require extra approval for) high-sensitivity content in vendor prompts. | Define a **max context budget** (e.g. 4K or 8K tokens) for vendor LLM calls. Label nodes or namespaces by sensitivity (e.g. `public`, `internal`, `confidential`). Policy: when using a vendor LLM, never include nodes above a given sensitivity in the prompt, or require that the total prompt size stay under the budget and that high-sensitivity content be excluded or summarized. Enforce in the prompt builder: if the formatted context exceeds the budget or includes disallowed labels, truncate or filter before sending. |

**Putting it together:** In your retrieval + prompt pipeline for a vendor LLM, apply in order: (1) **topic-scoped retrieval** with a small default limit, (2) **namespace/type allowlist** filter, (3) **redaction** pass, (4) **context budget** check and **sensitivity label** filter. Log what was included (e.g. node IDs, namespace, size) for audit. The store's `queryNodes` and `queryWithReasoning` already support `namespace`, `type`, `search`, and `limit`; the rest is policy and a thin orchestration layer.

### 3.4 Prompt-leakage policy layer (policy interface)

The patterns above are operational; security and compliance need an **operational hook** — a formal **policy layer** that makes prompt leakage controls auditable and enforceable. The **Contextualize** module’s **prompt-leakage policy layer** is that component: policy-as-code for what may leave the perimeter. A minimal **policy interface** has three elements:

| Element | Purpose | Operational hook |
|--------|---------|-------------------|
| **Sensitivity labels on nodes/namespaces** | Mark what may or may not leave the perimeter. | Attach a label to each node or namespace (e.g. `public`, `internal`, `confidential`). Labels can live in node metadata (e.g. `metadata.tags` or a dedicated `sensitivity` field) or in a separate policy store keyed by node ID/namespace. The retrieval pipeline consults labels before including a node in a vendor prompt: e.g. "for vendor LLM, only include nodes with sensitivity in [public, internal]." |
| **Retrieval policy module with allow/deny rules** | Central place to enforce what can be sent where. | A thin **retrieval policy** module: input = (candidate nodes, destination e.g. "vendor_llm" | "internal_only"), output = (allowed nodes, optional deny reason per node). Rules can be config (e.g. allow only `namespace` in allowlist and `type` in allowlist for vendor; deny `type: risk` or `sensitivity: confidential` for vendor) or code. The pipeline calls this module after retrieval and before formatting the prompt; any node not allowed is dropped or redacted. |
| **Logging of node IDs included in prompts** | Audit trail for what was sent. | For every prompt sent to a vendor LLM (and optionally for every retrieval used for a prompt), log **which node IDs** were included (and optionally namespace, type, sensitivity, token count). That gives compliance an audit trail: "this request included nodes g1, d1, t1" so you can verify that only allowed context was sent and investigate if a sensitive node ever appears. |

**Interface in practice:** Before calling the vendor LLM, the pipeline (1) retrieves candidates, (2) runs them through the **retrieval policy** (allow/deny by sensitivity, namespace, type), (3) applies redaction and budget, (4) **logs** the list of node IDs (and metadata) included in the prompt, (5) sends the prompt. The store does not need to implement labels or policy; they live in the **Contextualize** module’s **prompt-leakage policy layer** (config + thin module) that wraps retrieval and prompt building. That layer is the named, first-class component: sensitivity labels + policy module + logging = policy-as-code for prompt leakage.

---

## 4. Summary: implementation choice by goal

| Goal | Recommended path | Effort | IP / compliance note |
|------|------------------|--------|----------------------|
| Contextualize every request without training | RAG at inference (Path A) or structured prompting (Path C) | Low–medium | Context stays in-house; inference in-house if LLM is self-hosted. |
| Model that “knows” our decisions and constraints | Export for fine-tuning (Path B) | Higher | Export and training on-prem keep IP and weights in-house. |
| Scalable retrieval over large context | Path A + optional vector index over store | Medium | Index built from store; store remains source of truth. |
| Easiest first step | Path C (structured prompting with `projectToMarkdown` or `queryWithReasoning`) | Low | No new infra; wire store → context string → LLM. |

---

## 5. References

- **Architecture (Contextualize as first-class module):** `docs/ARCHITECTURE.md` — System Components §4 (Contextualize module).
- **Whitepaper (contextualized enterprise AI model, enterprise IP benefits):** `docs/WHITEPAPER.md` — section 7 (Security, privacy, and governance) and **section 7.1 (Enterprise IP and contextualized AI models)**.
- **Query and decision/rationale traversal APIs:** `docs/AGENT_API.md`; `src/types/context-store.ts` (`queryNodes`, `traverseReasoningChain`, `buildContextChain`, `followDecisionReasoning`, `queryWithReasoning` — these perform typed relationship traversal / provenance chains, not LLM chain-of-thought).
- **Projection:** `src/markdown/projection.ts` (`projectToMarkdown`).
- **Self-hosting and IP:** `CONTEXT.md` (constraint-005), `DECISIONS.md` (decision-005).
