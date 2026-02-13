# Contextualized AI Model

TruthLayer is designed to be the **context substrate** for agents: structured, governable truth that agents can read and propose against, without holding review/apply authority.

## Retrieval pipeline

- **Primary**: `queryNodes({ status: ["accepted"], type?, tags?, search?, limit, ... })` for scoped retrieval; default limit and max depth to avoid context overflow.
- **Traversal**: `traverseReasoningChain`, `buildContextChain`, `followDecisionReasoning`, `queryWithReasoning` to follow typed relationships (goal → decision → risk → task) and build provenance-aware context.
- **Optional vector index**: embed accepted nodes (or projections); self-hosted vector DB; at inference retrieve top-k, then optionally expand with traverseReasoningChain for related context. Use for large workspaces or semantic search beyond keyword.
- **Export for fine-tuning**: export accepted nodes (and optional snapshot) to JSONL/JSON; map to instruction/response format; training data stays in-house; attach snapshot for audit.

## Default: accepted-only context

Agents should be fed:

- **Accepted revision snapshots** (current accepted truth only unless explicitly loading a proposal for edit).
- **Scoped traversals** (bounded depth, relationship types, node type filters) to control context size.
- **Projections** derived from accepted truth (Markdown/DOCX) when human-readable context is needed.

**Safety**: Read endpoints default to `status: ["accepted"]`. Proposals are isolated; agents never receive review/apply capability.

## Avoiding leakage / prompt injection

- **No direct mutation**: external content and agent output never directly mutate accepted truth; all changes are proposals, reviewed and applied by humans.
- **Proposals isolate untrusted changes**: proposal content is not treated as truth until applied.
- **Policy engine (enforced)**: 6 configurable rule types (min_approvals, required_reviewer_role, change_window, agent_restriction, agent_proposal_limit, egress_control) detect risky operations and block or require additional approval. Returns 422 with violation details.
- **Prompt-leakage controls**: sensitivity labels (public/internal/confidential/restricted) enforced at the API layer — agents are redacted from nodes above their allowed sensitivity level (via `egress_control` policy rule). Per-workspace policies for allowed/forbidden node types, redaction rules for sensitive fields, maximum traversal depth; optional logging of node IDs and field names included in prompts (for vendor LLM audit).

## Context policies (per workspace)

- **Allowed node types** for agent read (e.g. goal, decision, task only).
- **Forbidden node types** (e.g. HR, confidential policy).
- **Redaction rules** for sensitive fields (e.g. strip PII from body before sending to model).
- **Maximum traversal depth** and **max context size** (token or node count) to cap prompt size.
- **Vendor vs self-hosted**: when using a vendor LLM, policy can restrict which nodes are sent and log what was included (prompt-leakage policy layer).

## Model-agnostic

TruthLayer does not require a specific model:

- Local/self-hosted models can propose; full context can stay on-prem.
- Cloud models can propose if policy allows; use context policies and redaction to minimize leakage.
- Acceptance remains human-governed in all cases.

## AI Compliance Gateway

The leakage controls and context policies above evolve from policy guidance to **infrastructure enforcement** with the AI Compliance Gateway. TruthLayer sits between agents/applications and external AI models, applying the full governance pipeline to every outbound request:

1. **Authentication + RBAC** — existing JWT auth and role checks
2. **EgressControl policy** — sensitivity gate (max egress level) + destination allowlist (which models/providers are permitted)
3. **Prompt inspection** — scan prompt content against node sensitivity labels; redact or block content above the workspace's egress threshold
4. **Model routing** — forward to the allowed model per workspace config (allowlist, regional constraints, rate/cost limits)
5. **Response filtering** — inspect model output for policy violations, hallucinated permissions, injection indicators
6. **Audit logging** — `ExternalModelCall` event: provider, model, prompt hash, response hash, sensitivity classification, cost, latency

**MCP gateway mode**: AI assistants (Cursor, Claude Desktop) call TruthLayer MCP tools that transparently route to external models through the compliance layer. TruthLayer can also retrieve relevant truth as context before forwarding — making it both the context source and the compliance enforcer.

**Effect on context policies**: Per-workspace context policies (allowed node types, redaction rules, max context size) become gateway-enforceable constraints. When the gateway is active, the policy engine enforces these before any content reaches an external model — not after.

See [Architecture](../core/ARCHITECTURE.md), [Security & Governance](../reference/SECURITY_GOVERNANCE.md), [Privacy and Data Protection](../reference/PRIVACY_AND_DATA_PROTECTION.md).

## Server-side agent loop (Cursor-pattern)

The TruthLayer agent extension follows the **Cursor-pattern architecture** (decision-034): the extension is a thin chat client that renders the conversation; the Rust server runs the full agent loop with compliance gateway interception. The extension never calls frontier models directly. Model configuration, credentials, and routing are all server-side.

### Streaming endpoint

`POST /agent/chat` (SSE stream) — the convergence point of the retrieval pipeline (above), prompt building (context policies), and the AI Compliance Gateway (above).

**Request**:
```json
{
  "message": "Draft a proposal to add a caching layer",
  "conversationHistory": [ ... previous turns ... ],
  "template": "draft_proposal",
  "context": { "nodeIds": ["decision-042", "task-015"] }
}
```

**SSE event stream**:
| Event | Payload | Description |
| --- | --- | --- |
| `token` | `{ text }` | Incremental text from model |
| `tool_call` | `{ name, arguments, callId }` | Model invokes a tool |
| `tool_result` | `{ callId, result }` | Tool execution result |
| `citation` | `{ nodeId, nodeType, title }` | Node reference |
| `confirm` | `{ action, payload }` | Request user confirmation (e.g. create proposal) |
| `error` | `{ message, code }` | Error |
| `done` | `{ sessionId, tokenCount }` | Turn complete |

### Agent loop flow (server-side)

1. **Receive** user message + conversation history + optional workflow template
2. **Retrieve** relevant context from ContextStore — using the retrieval pipeline (§1): `queryNodes`, `traverseReasoningChain`, bounded depth, sensitivity-filtered
3. **Build prompt** — system context + tool definitions + retrieved nodes + user message. Apply context policies (allowed node types, redaction rules, max context size)
4. **Call model** through **compliance gateway** (§5): prompt inspection → sensitivity enforcement → EgressControl → destination allowlist → model routing
5. **Receive response** through compliance gateway: response filtering → policy validation → injection detection
6. **Execute tool calls** — if model response contains tool calls (e.g. `query_nodes`, `create_proposal`), execute them in-process against ContextStore
7. **Confirm truth-changing actions** — if tool call modifies truth (create proposal), emit `confirm` event, wait for user confirmation
8. **Feed results back** — tool results go back to model (loop to step 4)
9. **Stream events** — all events (tokens, tool calls, citations) streamed as SSE to the extension
10. **Audit log** — full interaction logged: user identity, session ID, prompt hash, response hash, tool calls, sensitivity classification, cost

### Workflow templates

Pre-built templates execute server-side. Each template defines: system prompt, required context (nodes to fetch), tool definitions, output format.

| Template | Purpose | Context Retrieval |
| --- | --- | --- |
| `draft_proposal` | Draft a new proposal from user intent | Query related nodes, build context chain |
| `risk_assessment` | Assess risks for a proposed change | Traverse from target nodes to related risks |
| `impact_analysis` | Analyze impact of changing a node | Follow dependents, descendants, related-to |
| `compliance_check` | Check if a proposal meets policy | Evaluate policy rules, check sensitivity |
| `explain_decision` | Explain rationale for a decision | Follow reasoning chain from decision to goals |
| `review_assistant` | Help reviewer understand a proposal | Summarize operations, check conflicts, flag risks |

### Agent identity and restrictions

- Agent acts on behalf of authenticated user with `actor_type: "agent"` restrictions
- Cannot `submitReview` or `applyProposal` (server rejects — enforced)
- Proposal creation requires user confirmation before server commits
- All interactions attributed in audit log to human user + agent session ID

See [Architecture](../core/ARCHITECTURE.md) §9, [Extension Architecture](../engineering/ui/EXTENSION_ARCHITECTURE.md) §2.6, [Server API Requirements](../engineering/ui/SERVER_API_REQUIREMENTS.md) §4.5, PLAN.md task-112.

## Truth anchoring pipeline

The compliance gateway (above) prevents **bad things from leaving or entering** — it enforces sensitivity, blocks injection, audits interactions. The truth anchoring pipeline addresses a separate concern: **qualifying how well model output is grounded in verified organizational truth** (decision-037).

### Epistemological model

TruthLayer's epistemological model is strict:

- **Accepted truth** = nodes that have been ratified through the ACAL process (human review + human apply). High certainty. Immutable once accepted (changes require a new proposal cycle).
- **Proposed truth** = draft, submitted, or accepted-but-not-yet-applied proposals. Uncertain — under discussion. Explicitly isolated from accepted truth.
- **Model output** = ephemeral commentary produced by a frontier model. **Never truth.** Graded by how well it is anchored to accepted truth, but never enters the truth store without going through the full ACAL cycle.

The agent does not determine truth. The ACAL process does. The agent's role is to make the **grounding (or lack thereof)** of its output transparent, so humans can make informed decisions about what to ratify.

### Prompt construction (truth-marked)

The prompt sent to the frontier model is assembled in three layers:

**Layer 1 — System context and truth boundaries**

The system prompt establishes the agent's identity, constraints, and — critically — **truth boundaries**:

```
You are a TruthLayer governance agent. You assist with organizational
truth management. You have access to tools for querying accepted truth
and creating proposals.

IMPORTANT: The context provided below is ACCEPTED ORGANIZATIONAL TRUTH,
ratified through human review. When referencing this context, you MUST
cite the source node using [node:ID] syntax. Any claims about
organizational facts that you cannot cite are YOUR INFERENCE, not
established truth.

When you are uncertain, say so. When you infer beyond the provided
context, state that explicitly. Never present inference as established
fact.
```

**Layer 2 — Retrieved context with provenance metadata**

Each retrieved node is injected with full provenance annotations:

```
--- ACCEPTED TRUTH: node decision-042 ---
Type: decision | Status: accepted | Sensitivity: internal
Created by: alice@company.com | Reviewed by: bob@company.com
Accepted at revision: rev_23 | Last modified: 2026-02-10
Relationships: implements goal-007, mitigates risk-015
---
Title: Use Axum for HTTP framework
Content: The Rust server uses Axum as the HTTP framework...
--- END NODE ---
```

This metadata serves two purposes:
1. The model can cite specific nodes (`[node:decision-042]`) and the server can verify citations
2. The provenance (who created, who reviewed, which revision) gives the model signals about authority and recency

**Layer 3 — Tool definitions with grounding instructions**

Tool definitions include explicit grounding instructions:

```json
{
  "name": "query_nodes",
  "description": "Query accepted organizational truth. Results are verified facts. Cite node IDs when referencing results.",
  ...
}
```

The `create_proposal` tool definition includes: "You are proposing a change to accepted truth. This will require human review before it becomes accepted. State your reasoning and cite supporting nodes."

### Response processing (truth anchoring)

After the model produces a response, the server-side agent loop performs **grounding analysis** before streaming to the client:

**Step 1 — Citation extraction**

Parse the model's response for citation markers: `[node:decision-042]`, `[node:risk-015]`, etc. Build a citation map: `{ position, nodeId }`.

**Step 2 — Citation verification**

For each citation:
- Does the node exist in the workspace?
- Is the node's status `accepted`?
- Does the model's claim about the node's content approximately match the actual content? (Semantic similarity check — the model may paraphrase, but the meaning should align.)
- Verified citations → `citation` SSE event with `verified: true`
- Failed citations (node doesn't exist, wrong content) → `citation` SSE event with `verified: false, reason: "..."` + `grounding` event marking the segment as `ungrounded`

**Step 3 — Grounding classification**

Every response segment (sentence or paragraph level) is classified:

| Tier | Criteria | SSE Event | UI Indicator |
| --- | --- | --- | --- |
| **Grounded** | Contains a verified citation to an accepted node whose content supports the claim | `grounding: { tier: "grounded", nodeIds: [...], confidence: 0.9+ }` | Solid citation link, green indicator |
| **Derived** | References multiple verified citations; the claim is a logical inference from them | `grounding: { tier: "derived", nodeIds: [...], confidence: 0.6-0.9 }` | Citation links, amber indicator, "Inferred from..." |
| **Ungrounded** | No citations, or citations don't support the claim | `grounding: { tier: "ungrounded", confidence: < 0.6 }` | Dotted underline, warning: "Not anchored to accepted truth" |
| **Contradicted** | Claim conflicts with the content of a retrieved accepted node | `grounding: { tier: "contradicted", nodeIds: [...], conflict: "..." }` | Red flag, "Contradicts [node-042]" |

**Step 4 — Confidence scoring**

The confidence score is computed from:
- **Citation density**: what fraction of factual claims have verified citations?
- **Citation accuracy**: do the cited nodes actually support the claims?
- **Traversal depth**: is the claim 1 hop from an accepted node (high confidence) or derived through a long chain (lower confidence)?
- **Recency**: was the cited node recently reviewed/accepted (higher confidence) or from an old revision (lower)?

The score is a **signal, not a judgment**. It helps the human reviewer calibrate trust in the model's output. It does not determine truth.

**Step 5 — Aggregate response annotation**

The full response receives an aggregate grounding summary:

```json
{
  "event": "grounding_summary",
  "data": {
    "totalSegments": 8,
    "grounded": 5,
    "derived": 2,
    "ungrounded": 1,
    "contradicted": 0,
    "overallConfidence": 0.82,
    "citedNodes": ["decision-042", "goal-007", "risk-015", "task-023", "constraint-011"],
    "uncitedClaims": ["The migration should take approximately 2 weeks"]
  }
}
```

### How arbitrary output is handled

When a model produces a response that has no grounding in accepted truth (e.g. a creative suggestion, a novel architectural idea, an estimate), the pipeline classifies it transparently:

1. **Informational response** — the ungrounded segments are marked with the "ungrounded" tier. The UI shows these with a visual indicator. The user sees: "this is the model's opinion/analysis, not organizational fact." It lives in the conversation only; it never enters the truth store.

2. **Proposed truth change** — if the user asks the agent to act on an ungrounded idea (e.g. "create a proposal for that"), the `create_proposal` tool call is triggered. The proposal inherits the grounding metadata: `groundingTier: "ungrounded"`, `citedNodes: []`. When a human reviewer sees this proposal in the governance UI, they see that it originated from an ungrounded model suggestion — they apply their own judgment about whether to ratify it as truth.

3. **Contradicted output** — if the model's suggestion contradicts accepted truth, the contradiction is surfaced immediately in the SSE stream. The user sees: "This contradicts [node:decision-042]: 'We decided to use PostgreSQL'" before they can act on it. If they still want to proceed, the resulting proposal carries `groundingTier: "contradicted"` metadata, flagging it for heightened review.

The system never tries to make arbitrary model output "true." It makes the grounding status **visible and traceable**, forces proposed changes through the ACAL process, and preserves the human's role as the arbiter of organizational truth.

### Audit trail for grounding

Every agent interaction is logged with grounding metadata:

- **Prompt audit**: hash of assembled prompt, list of node IDs included as context, sensitivity classification, redactions applied
- **Response audit**: grounding summary (tiers, confidence, citations), any contradictions detected, any failed citation verifications
- **Action audit**: if the model's output led to a `create_proposal` tool call, the proposal is linked to the agent session and inherits the grounding metadata

This creates a full chain: which truth was provided as context → what the model produced → how well-grounded it was → what action (if any) was taken → whether the resulting proposal was reviewed and accepted.

See [Architecture](../core/ARCHITECTURE.md) §9, [Agent API](../core/AGENT_API.md), [Security & Governance](../reference/SECURITY_GOVERNANCE.md), PLAN.md task-125, task-126.
