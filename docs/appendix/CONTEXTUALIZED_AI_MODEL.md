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
