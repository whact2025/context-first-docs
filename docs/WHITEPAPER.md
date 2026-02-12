# TruthLayer: Enterprise truth governance for humans and agents

## Problem

Organizations don’t suffer from a lack of documents—they suffer from **truth fragmentation**:

- the “real” decision lives in Slack
- the latest process lives in someone’s head
- rationale is lost after execution
- agents ingest stale or contradictory context

Traditional docs are not designed for:

- **governance** (who may change truth, and how)
- **auditability** (what changed, why, and by whom)
- **agent consumption** (stable, typed, provable context)

## What TruthLayer is

TruthLayer is a **governance-first truth system** (**governed truth, guarded AI**): a truth ledger and collaboration layer where humans **ratify** truth and **guardrails that apply to AI** enforce security and compliance. Agents read and propose within that model; they do not govern:

- **Canonical truth store**: typed nodes (goals, decisions, constraints, risks, tasks, questions, etc.) and relationships (depends-on, mitigates, references, implements). Truth lives in an immutable accepted revision; each apply produces a new revision. See [Architecture](core/ARCHITECTURE.md), [Data Model Reference](reference/DATA_MODEL_REFERENCE.md).
- **Review mode**: every change is a proposal (ordered operations: create/update/delete/move). Humans review (approve/reject with comments) and apply accepted proposals into a new accepted revision. See [Review Mode (ACAL)](core/REVIEW_MODE.md).
- **Projections**: Markdown, DOCX, or HTML views generated from truth—readable, versionable, shareable. Edits to projections can become proposals via change detection. See [Change Detection](appendix/CHANGE_DETECTION.md). **The Agent (we build it)**: an agent that reads accepted truth and creates/updates proposals; it cannot submit reviews or apply. One minimal governance UI is required for humans to govern. **The solution provides an MCP server** so AI assistants (Cursor, Claude Desktop, etc.) can use TruthLayer as a native tool—query truth, create proposals, traverse reasoning—from the IDE and other MCP clients. See [Agent API](core/AGENT_API.md), [UI Specification](core/UI_SPEC.md).

## The invariant: ACAL

ACAL (Accepted → Candidate → Accepted → Ledger)

- **Accepted**: immutable, queryable, safe for automation
- **Candidate**: proposed changes awaiting governance
- **Ledger**: every accepted change produces a new revision; history is retained

This yields:

- stable “source of truth” for humans and agents
- a clean boundary between drafting and truth
- auditable change governance for enterprise compliance

## What counts as “truth”

**How it works in practice:** Current truth is an **accepted revision** (e.g. rev_1). To change it, a human or agent **creates a proposal** (operations: create/update/delete/move). Reviewers approve or reject; when accepted, an authorized human **applies** it, producing the next revision (rev_2) and stamping the proposal. Projections are regenerated. Agents read and propose only—never review or apply. See [Architecture](core/ARCHITECTURE.md), [Review Mode (ACAL)](core/REVIEW_MODE.md).

TruthLayer is not limited to software.

Examples:

- Security policy updates
- Incident postmortems (facts + decisions + follow-ups)
- Procurement standards and exceptions
- Product requirements and rationale
- Architecture decisions and constraints
- Risk registers, mitigations, and owners

## Why a typed model (not just docs)

Docs are excellent projections, but poor truth primitives. TruthLayer stores:

- **Nodes**: decisions, goals, constraints, risks, tasks, questions, evidence
- **Relationships**: depends-on, mitigates, supersedes, owned-by, references
- **Status fields**: proposal states, review outcomes, applied metadata

Markdown/DOCX are generated projections so they can be:

- readable
- versionable
- shareable
  …but the truth remains structured and governable.

## Security & Compliance by design (guardrails that apply to AI)

The Rust server enforces governance at runtime — these are not aspirational but implemented:

- **Authentication**: JWT (HS256) with role-bearing tokens; every request is attributed to an actor
- **RBAC (enforced)**: hierarchical roles (Reader, Contributor, Reviewer, Applier, Admin) enforced on all routes; agents hard-blocked from review and apply
- **Policy engine (enforced)**: 6 configurable rule types from `policies.json` — min_approvals, required_reviewer_role, change_window, agent_restriction, agent_proposal_limit, egress_control; evaluated at create, review, and apply time
- **Audit log (enforced)**: immutable, append-only record of every state-changing action; queryable and exportable (JSON/CSV); survives store reset
- **Sensitivity labels (enforced)**: nodes classified as public/internal/confidential/restricted; agent reads above allowed level are redacted and audited; SHA-256 content fingerprint computed on apply
- **Data residency**: self-hostable with in-memory, file-based, or MongoDB storage; pluggable backends
- **LLM safety**: accepted-only context by default; proposals isolated — agents cannot accept, reject, or apply

See [Security & Governance](reference/SECURITY_GOVERNANCE.md), [Privacy and Data Protection](reference/PRIVACY_AND_DATA_PROTECTION.md).

## AI Compliance Gateway

TruthLayer's governance infrastructure — policy engine, sensitivity labels, RBAC, and audit log — is not limited to internal operations. The same enforcement layers that govern what agents can do inside TruthLayer extend naturally to control how any AI model interacts with organizational knowledge.

**The vision**: TruthLayer as a **compliance front-end for frontier and external AI models**. Every prompt to an external model passes through TruthLayer's governance pipeline before it leaves the organization. Every response is filtered before it reaches the caller.

How it works:

1. **Request arrives** (from an agent, MCP client, or application)
2. **Authentication + RBAC** — existing JWT auth and role checks
3. **Policy evaluation** — EgressControl (sensitivity gate + destination allowlist), rate limits, cost caps
4. **Prompt inspection** — scan content against sensitivity labels; redact Confidential/Restricted content before egress
5. **Model routing** — forward to the allowed model (per workspace policy, regional constraints)
6. **Response filtering** — inspect model output for policy violations, hallucinated permissions, injection indicators
7. **Audit logging** — immutable record: provider, model, prompt hash, response hash, sensitivity of egressed content, policy outcome, cost, latency

Steps 1–3 use the existing JWT auth, RBAC enforcement, and policy engine with EgressControl and sensitivity labels. The `EgressControl` policy type includes a `destinations` field for model allowlists. Steps 4–7 extend the pipeline to outbound model calls.

**MCP gateway mode**: AI assistants (Cursor, Claude Desktop) connect to TruthLayer's MCP server. When they need to call an external model, they call a TruthLayer gateway tool instead of the model directly. TruthLayer retrieves relevant truth as context, evaluates policy, forwards to the allowed model, filters the response, and returns — the assistant never needs direct model access.

This positions TruthLayer as a **governance-aware AI gateway** — not just governing its own truth store, but governing how any AI model interacts with organizational knowledge.

See [Architecture](core/ARCHITECTURE.md), [Security & Governance](reference/SECURITY_GOVERNANCE.md), [Privacy and Data Protection](reference/PRIVACY_AND_DATA_PROTECTION.md).

## Competitive positioning (high level)

- **Not RAG**: RAG retrieves text; TruthLayer governs truth.
- **Not a wiki**: wikis allow silent edits; TruthLayer requires review/apply.
- **Not Git diffs**: line diffs don’t represent semantic conflicts; TruthLayer merges at field and node semantics.

## What “enterprise foundation” means in practice

1. **Immutable accepted truth** — no direct mutation; all changes via proposal, review, apply.
2. **Permissioned governance (enforced)** — JWT auth, hierarchical RBAC on all routes, 6-rule policy engine, and agent guardrails. See [Security & Governance](reference/SECURITY_GOVERNANCE.md).
3. **Auditability (enforced)** — immutable audit log of every state-changing action; queryable via API, exportable as JSON/CSV; DSAR export and erasure endpoints.
4. **Deterministic projections** — same revision and template yield same output (Git-friendly).
5. **Reconciliation strategies** for concurrent work — field-level merge, conflict detection. See [Reconciliation Strategies](appendix/RECONCILIATION_STRATEGIES.md), [Conflict and Merge Scenario](scenarios/CONFLICT_AND_MERGE_SCENARIO.md).
6. **Clear agent boundary** — agents propose; humans accept. Accepted-only context by default; see [Contextualized AI Model](appendix/CONTEXTUALIZED_AI_MODEL.md).
7. **AI Compliance Gateway** — the same governance pipeline that controls internal operations extends to intercept and govern all external AI model interactions: prompt inspection, response filtering, destination enforcement, cost governance, and full audit trail. See [Architecture](core/ARCHITECTURE.md).

---

## Navigate the docs

**Full index:** [Full index](README.md)

**Core** — [Architecture](core/ARCHITECTURE.md) · [Review Mode (ACAL)](core/REVIEW_MODE.md) · [UI Specification](core/UI_SPEC.md) · [Agent API](core/AGENT_API.md) · [Usage](core/USAGE.md)

**Scenarios** — [Hello World Scenario](scenarios/HELLO_WORLD_SCENARIO.md) · [Conflict and Merge Scenario](scenarios/CONFLICT_AND_MERGE_SCENARIO.md) · [Business Policy Scenario](scenarios/BUSINESS_POLICY_SCENARIO.md)

**Reference** — [Data Model Reference](reference/DATA_MODEL_REFERENCE.md) · [Security & Governance](reference/SECURITY_GOVERNANCE.md) · [Operations](reference/OPERATIONS.md)

**Appendix** — [Self-Reference](appendix/SELF-REFERENCE.md) · [Optional Integrations](appendix/OPTIONAL_INTEGRATIONS.md) · [DOCX / Word / Excel Review Integration](appendix/DOCX_REVIEW_INTEGRATION.md) · [Change Detection](appendix/CHANGE_DETECTION.md) · [Reconciliation Strategies](appendix/RECONCILIATION_STRATEGIES.md) · [Contextualized AI Model](appendix/CONTEXTUALIZED_AI_MODEL.md)

**Engineering** — [Storage Architecture](engineering/storage/STORAGE_ARCHITECTURE.md) · [Storage Implementation Plan](engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md)

**Whitepaper appendix** — [Whitepaper Appendix](WHITEPAPER_APPENDIX.md) (glossary, design principles)
