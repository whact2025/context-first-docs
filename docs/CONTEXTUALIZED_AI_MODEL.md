# Using the Context Store to Create a Contextualized AI Model

This document describes **how the context store is used to create a contextualized enterprise AI model** — a model that reasons and answers using your organization’s approved goals, decisions, constraints, and risks without leaking that IP outside your infrastructure.

**Audience:** architects, ML/platform leads, security/compliance, and implementers.

**Related:** `docs/WHITEPAPER.md` section 7.1 (Enterprise IP and contextualized AI models), `docs/AGENT_API.md` (query and reasoning APIs), `CONTEXT.md` (self-hosting constraint).

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
- **Reasoning chains:** APIs such as `traverseReasoningChain`, `buildContextChain`, `followDecisionReasoning`, and `queryWithReasoning` (see `src/types/context-store.ts`, `src/store/in-memory-store.ts`) let you build ordered, relevant context (e.g. goal → decision → risks → tasks) for injection into prompts or training examples.
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
- `store.queryWithReasoning(options)` — run a query and attach reasoning chains to each result.
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

1. **Export:** Read all accepted nodes (and optionally reasoning chains) from the store; serialize to a canonical format (e.g. JSONL or instruction/response pairs).
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

- **Store and retrieval:** The context store and all retrieval logic (query, reasoning chains, projection) run inside your infrastructure. No need to send raw context to an external service for “contextualization” — you do it by reading from the store and building prompts or export files.
- **Training:** If you export and fine-tune on your own cluster (or in a private cloud with strict access control), your context and the resulting model never leave your control. You can enforce “no context or derived data to external training APIs” as policy.
- **Inference:** With a self-hosted or private-VPC LLM, inference stays in-house. If you use a vendor LLM, only the prompt (retrieved context + user message) is sent; you can minimize exposure by retrieving only what’s needed and by using vendor DPAs and data-residency options where available.
- **Auditability:** The store keeps proposals, reviews, and acceptance history. You can record which context was used for which export or which retrieval (e.g. snapshot id, query params), so you can trace how a contextualized model or answer was produced.

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

- **Whitepaper (contextualized enterprise AI model, enterprise IP benefits):** `docs/WHITEPAPER.md` — section 7 (Security, privacy, and governance) and **section 7.1 (Enterprise IP and contextualized AI models)**.
- **Query and reasoning APIs:** `docs/AGENT_API.md`; `src/types/context-store.ts` (`queryNodes`, `traverseReasoningChain`, `buildContextChain`, `followDecisionReasoning`, `queryWithReasoning`).
- **Projection:** `src/markdown/projection.ts` (`projectToMarkdown`).
- **Self-hosting and IP:** `CONTEXT.md` (constraint-005), `DECISIONS.md` (decision-005).
