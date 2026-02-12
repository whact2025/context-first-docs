# Development Plan

This document tracks the development roadmap and milestones for TruthLayer.

- **Source of truth for product/architecture:** [docs/](docs/README.md).
- **TruthLayer** = **governance-first truth system** (**governed truth, guarded AI**): truth ledger + collaboration layer. **ACAL** (Accepted → Candidate → Accepted → Ledger): humans ratify, guardrails that apply to AI enforce; minimal governance UI **required**.
- **The Agent** (we build it) uses the agent-safe API; deployment is optional (in-process or API). The solution **provides an MCP server** so AI assistants (Cursor, Claude Desktop, etc.) can use TruthLayer as a native tool. See `docs/core/ARCHITECTURE.md`, `docs/WHITEPAPER.md`, `docs/core/UI_SPEC.md`, `docs/core/AGENT_API.md`.
- **UI**: One **minimal governance UI** is required (list proposals, accept/reject/apply). Optional: full Web UI, VS Code, Word/Google. See `docs/core/UI_SPEC.md`.
- **Canonical walkthroughs**: [Hello World](docs/scenarios/HELLO_WORLD_SCENARIO.md) (proposal → review → apply) and [Conflict and Merge](docs/scenarios/CONFLICT_AND_MERGE_SCENARIO.md) — run via playground Scenario Runner (`npm run playground`).
- **The Agent / Contextualize**: Phase 5; design in `docs/appendix/CONTEXTUALIZED_AI_MODEL.md`, `docs/core/AGENT_API.md` (retrieval, prompt building, optional agent loop; prompt-leakage policy). Agent reads truth and creates proposals only; never review/apply.
- **Security & Compliance**: Guardrails by design per `docs/WHITEPAPER.md` (RBAC, audit logs, policy hooks, data residency, LLM safety). See `docs/reference/SECURITY_GOVERNANCE.md` for the security model and agent-behavior guardrails (personal data sensitivity, truth scope discipline, immutability with redaction, trade secret awareness, external model boundary, heightened review triggers, retention awareness, provenance and justification, workspace isolation, when in doubt propose don’t apply). See `docs/reference/PRIVACY_AND_DATA_PROTECTION.md` for GDPR-ready procurement/DPIA (controller/processor, DSAR, retention, redaction vs crypto-shredding, subprocessor/LLM egress, residency).
- **AI Compliance Gateway** (Phase 8): TruthLayer as a **compliance front-end for frontier and external AI models**. The same policy engine, sensitivity labels, RBAC, and audit log that govern internal operations extend to intercept, inspect, and control all external AI model interactions — prompt inspection, response filtering, destination enforcement, cost/rate governance, and full audit trail. See `docs/core/ARCHITECTURE.md`, `docs/reference/SECURITY_GOVERNANCE.md`.
- **Decisions**: Key decisions in `DECISIONS.md` (e.g. agent boundary, DOCX projection, Word/Google flow).
- **Doc suite**: TruthLayer does not replace doc suites; many orgs use both. See `docs/WHITEPAPER.md` (competitive positioning, “enterprise foundation”).
- **Word/Google review**: Optional bidirectional flow and context visualization: `docs/appendix/DOCX_REVIEW_INTEGRATION.md`.

**Current implementation (from code):** **Rust server** in `server/`: ContextStore trait with two backends (InMemoryStore and FileStore), config from server config root, Axum HTTP API with JWT auth (HS256), RBAC enforcement on all routes, configurable policy engine (6 rule types from `policies.json`), immutable audit log (queryable + exportable), sensitivity labels with agent egress control, IP protection (SHA-256 content hash, source attribution), DSAR endpoints (export queries audit log; erase records audit event but does not yet mutate store data), and retention engine (background task with config loading; enforcement stub -- logs audit events but does not yet delete/archive). 54 tests covering routes, auth, RBAC, policy, sensitivity, store, and telemetry. **TypeScript**: `src/api-client.ts` (RustServerClient with auth token injection), `src/store/core/` (apply-proposal, graph, node-key), `src/store/preview-store.ts` (Map-backed preview for projection), Markdown projection and ctx blocks in `src/markdown/`, playground and Scenario Runner in `src/playground/`. Playground uses the Rust server for ACAL store; scenarios call `store.reset()` before each run. MongoDB backend, full query/traversal/conflict in the server, GraphQL layer, and minimal governance UI are next per phases below and `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md`.

**Server and configuration:** Agent deployments use a **server component** (local or remote). All runtime configuration—storage backend and paths, RBAC provider, and other runtime settings—lives in a **predefined location relative to the server** (config root). No repo-scattered runtime config. See QUESTIONS.md question-038 (storage/workspace config), question-007 (RBAC provider abstraction). The Rust server in `server/` (see `server/README.md`) is the reference implementation with JWT auth, RBAC, policy engine, audit log, sensitivity labels, and file-based storage implemented; extend with MongoDB backend, full query/traversal/conflict.

```ctx
type: plan
id: plan-001
status: accepted
---
**Phase 1: Core Infrastructure** (Current)
1. ✅ Define node types and proposal system
2. ✅ Implement context store interface
3. ✅ Build Markdown projection system (ctx blocks); DOCX export for distribution (see `scripts/build-whitepaper-docx.js`, `scripts/README.md`)
4. ✅ Create import/export functionality
5. ✅ Implement in-memory store
6. ✅ Make project self-referential
7. ✅ Define graph model with typed relationships
8. ✅ Design comprehensive Agent API with decision/rationale traversal (provenance chains)

**Phase 2: Persistence & Storage Implementations**
1. ✅ Rust server provides InMemoryStore baseline (server/); TS retains apply-proposal + graph in `src/store/core/` for preview and tests; coverage tests in `tests/store-core.coverage.test.ts` (see `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md` Phase 1)
2. ✅ Storage abstraction layer - `ContextStore` trait (`store/context_store.rs`), `config.rs` loads from server config root (backend choice, paths, RBAC provider config; see question-038), `main.rs` selects backend (memory/file) at startup
3. ✅ File-based storage implementation - `FileStore` persists nodes, proposals, reviews, and audit log as JSON under server config root data directory; atomic writes (temp file + rename); activated via `TRUTHTLAYER_STORAGE=file` (see task-048)
4. MongoDB storage implementation - self-hosted MongoDB document database (for production/scaling); connection/config from server config root. See `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md` Phase 1 for schema, indexing, and transaction design.
5. GraphQL API layer - schema definition, resolvers, type validation; authentication/authorization via **RBAC provider abstraction** (question-007)
6. ✅ Conflict detection and resolution - `detectConflicts`, `isProposalStale`, `mergeProposals` implemented on InMemoryStore (programmatic store API; not yet exposed on HTTP routes). Manual resolution UI and proposal superseding remain open. Canonical walkthrough: [Conflict and Merge scenario](docs/scenarios/CONFLICT_AND_MERGE_SCENARIO.md).
7. ✅ Decision/rationale traversal (provenance chains) - typed relationship paths, context building, decision reasoning implemented (see task-052, task-059)
8. Issue creation system - create issues from approved proposals. When a proposal is applied, optionally generate issues (e.g. GitHub/GitLab issues or internal task nodes) for each operation or for the proposal as a whole. Requires: issue templates per node type, configurable issue target (GitHub API, GitLab API, or internal task nodes), and mapping from proposal operations to issue fields. See task-035, task-053.
9. Reference tracking - bidirectional references and automatic updates. When a node is updated or deleted, find all nodes that reference it (via edges or inline refs) and flag or update them. Requires: reference index (edges + inline `nodeId` mentions in content), stale-reference detection on apply, and optional cascading updates or warnings in the proposal validation step. See task-054.
10. Git integration - automatic commits for file-based storage (commit on apply with structured message including proposal ID and actor), periodic snapshots for MongoDB (dump to Git for audit/DR), and commit tracking (link code repository commits to proposals via commit-message conventions, Jira-style). Requires: Git CLI or libgit2 integration, configurable remote, commit-message template, and optional webhook for CI triggers. See task-055.
11. ✅ Governance infrastructure — JWT authentication (HS256), hierarchical RBAC (Reader/Contributor/Reviewer/Applier/Admin) on all routes, configurable policy engine (6 rule types from `policies.json`), immutable append-only audit log (queryable + exportable), sensitivity labels with agent egress control, IP protection (SHA-256 content hash, source attribution, provenance endpoint). DSAR endpoints (export implemented; erase stub) and retention engine (background task + config; enforcement stub). See task-031, task-034, `docs/reference/SECURITY_GOVERNANCE.md`.
12. ✅ OpenTelemetry observability — Correlated distributed tracing (TypeScript client + Rust server), W3C trace context propagation, OTLP export to Azure Monitor / Grafana, HTTP metrics on client and server. See `docs/OTEL_LOGGING.md`.

**See**: `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md` for detailed gap analysis, implementation tasks, and timeline

**Phase 3: Authoring & Review System**
1. Implement proposal authoring APIs and helpers
2. Add risk authoring tools and validation
3. Create authoring helpers for all node types (decisions, tasks, questions, etc.)
4. ✅ (server RBAC) / open (enterprise provider) — Server-side RBAC enforcement implemented (JWT auth, role hierarchy on all routes, agent blocking; see task-031, task-034). Enterprise RBAC **provider abstraction** (Git/GitLab, Azure AD, DLs, SSO/OIDC; question-007) is designed but not yet pluggable; current deployment uses JWT claims for roles. See task-078.
5. Add designated contributors and approvers support
6. Implement role-based authoring modes (read-only vs suggesting)
7. Implement bidirectional sync - proposals (optionally derived from Markdown ctx blocks) ↔ projections
8. Implement client/API change-capture workflows (client-side diffs or API-side structured edits), while enforcing review-mode invariants in the store
9. Implement hybrid reconciliation system:
   - Conflict detection at proposal creation
   - Field-level merging for non-conflicting fields
   - Optimistic locking with version tracking
   - Manual resolution for true conflicts
   - Proposal superseding support
10. Implement proposal review workflow with approval requirements
11. **Minimal governance UI (required)** — List proposals, Accept/Reject/Apply. The only required dedicated surface for truth-changing actions (agent cannot perform these). See `docs/core/UI_SPEC.md`.
12. Add issue creation on approval - automatically create issues when proposals are approved
13. Add **Docs-style comment threads** anchored to nodes/fields (not Markdown line numbers)
14. Support partial accept/reject
15. Build review history tracking
16. Support multi-approval workflows
17. ✅ **Audit export** (implemented): `GET /audit` with filters (actor, action, resource_id, date range, pagination); `GET /audit/export?format=json|csv` for full export. Admin role required. See `docs/reference/SECURITY_GOVERNANCE.md`.
18. **Bidirectional flow (Word/Google)** (optional): See `docs/appendix/DOCX_REVIEW_INTEGRATION.md`.
19. **Context relationship visualization** (optional): See `docs/appendix/DOCX_REVIEW_INTEGRATION.md`.
20. Projection engine — Implement Markdown/DOCX/HTML projection in the Rust server: projection templates, anchor maps (projection span → node/field anchor), deterministic output for same revision + template. Required for change detection (item 21) and bidirectional sync (item 7). See `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md` Phase 3, task-071.
21. Change detection from projections — Parse edited projection, map edits to anchors, emit proposal operations (create, update, delete, move, status-change, etc.). Validate operations against schema; optional policy findings. See `docs/appendix/CHANGE_DETECTION.md`, `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md` Phase 4, task-072.
22. Full NodeQuery on HTTP API — Implement remaining query filters on `GET /nodes`: full-text search, date range, relatedTo, relationshipTypes, depth, namespace, tags, to match comprehensive spec in `docs/core/AGENT_API.md`. Currently subset implemented. See task-073.
23. Expose conflict detection/merge on HTTP routes — Currently programmatic only (InMemoryStore API). Add `GET /proposals/:id/conflicts`, `POST /proposals/merge`, stale-proposal warnings on submit/review. See task-074, `docs/scenarios/CONFLICT_AND_MERGE_SCENARIO.md`.
24. Notification system — Notify contributors and approvers of new proposals, reviews, and apply events. Pluggable transport (email, webhook, in-app, GitHub/GitLab notifications). See question-017, task-083.

**Phase 4: Agent APIs** (power **The Agent** we build; agent uses these to read truth and create proposals only)
1. Implement comprehensive query API (type, status, keyword, relationships, pagination, sorting)
2. Implement decision/rationale traversal APIs (provenance chains; typed relationship traversal: goal → decision → risk → task):
   - traverseReasoningChain() - follow typed relationship paths
   - buildContextChain() - progressive context building
   - followDecisionReasoning() - understand decision rationale
   - discoverRelatedReasoning() - find related context
   - queryWithReasoning() - query with provenance chains attached to results
3. Implement graph traversal APIs (relationship queries, path finding, dependencies)
4. Implement proposal generation API
5. Add validation and safety checks (default to accepted only, explicit opt-in for proposals)
6. Create agent documentation (see `docs/core/AGENT_API.md`)
7. **MCP server** — Expose TruthLayer as an MCP (Model Context Protocol) server so AI assistants (Cursor, Claude Desktop, etc.) can use it as a native tool: query truth, create proposals, traverse reasoning chains; same agent-safe contract (no review/apply). Optional MCP resources for read-only context. See `docs/core/AGENT_API.md` (MCP exposure), `docs/core/ARCHITECTURE.md`, `docs/appendix/OPTIONAL_INTEGRATIONS.md`.

**Phase 5: Contextualize module + The Agent (we build it)**

Implement the **Contextualize** module and **The Agent** as in `docs/appendix/CONTEXTUALIZED_AI_MODEL.md` and `docs/core/AGENT_API.md`: retrieval, prompt building, optional in-process agent loop (LLM + store tools; agent cannot submitReview or applyProposal), export for fine-tuning, optional vector index; **prompt-leakage policy layer**. Store remains substrate; enterprise IP stays in-house. **The Agent** reads accepted truth and creates proposals only; deployment is optional (in-process or API). **Minimal governance UI** (list proposals, Accept/Reject/Apply) is required for humans to ratify; implement in Phase 3 or 5 so reviewers have a surface for truth-changing actions.

**Implementation language:** TypeScript for store-facing pieces (retrieval, prompt builder, export pipeline, policy layer in `src/contextualize/*`). **Python** where best suited: embeddings, vector index, fine-tuning pipelines. Integration contract in `docs/appendix/CONTEXTUALIZED_AI_MODEL.md`.

1. **Agent loop (optional)** — In-process loop: receive user task → retrieve context → call LLM with **tools** (query truth, create proposals; no submitReview or applyProposal) → execute tool calls → feed results back to LLM. Expose via API for thin clients. See `docs/core/AGENT_API.md`, `docs/appendix/CONTEXTUALIZED_AI_MODEL.md`.
2. **Retrieval module** — e.g. `src/contextualize/retrieve.ts`. Input: query string and optional `startNodeId`. Use `queryNodes`, `traverseReasoningChain`. Output: list of nodes or formatted string. Used by agent and by RAG path.
3. **Prompt builder** — Takes retrieved context + user message; returns system + user messages for the LLM. (Path A, C.)
4. **Context document builder (structured prompting)** — `projectToMarkdown(store)` or `queryWithReasoning` for topic-focused context. Wire into agent and API/playground.
5. **LLM integration** — retrieve → prompt builder → call LLM (and for agent: tool-calling loop). Self-hosted or vendor LLM; prompt-leakage policy when vendor.
6. **Export pipeline for fine-tuning** — e.g. `src/contextualize/export.ts`. `queryNodes({ status: ["accepted"] })`; output JSONL/JSON; attach snapshot for audit. (Path B.)
7. **Training format mapper** — Map export to instruction/response format; accepted-only. (Path B.)
8. **(Optional) Vector index** — Embed accepted nodes; self-hosted vector DB; at inference retrieve top-k, optionally expand with `traverseReasoningChain`. (Path A at scale.)
9. **Prompt leakage controls (policy interface)** — Sensitivity labels, retrieval policy module, logging of node IDs in prompts. See `docs/appendix/CONTEXTUALIZED_AI_MODEL.md`.
10. **Agent guardrail guidance** — Surface guardrail behavior from `docs/reference/SECURITY_GOVERNANCE.md` (personal data sensitivity, truth scope discipline, trade secret awareness, external model boundary, heightened review triggers, retention awareness, provenance and justification, workspace isolation, when in doubt propose don’t apply) in agent documentation, system prompts, or tool metadata so agents and proposers align with compliance by default. Agent hints are documented in `docs/core/AGENT_API.md` (personal data: detect/prefer anonymized/flag + heightened review; rewrite narrative into role-based refs and dedicated redactable fields; summarizing/exporting: default to abstraction, no unrequested sensitive restatement, redacted projection for broad audience; external model usage: policy-governed, assume no egress if policy unknown, avoid verbatim sensitive content; additional reviewers for legal/policy/security, IP-sensitive, identity/access, personal data/retention). See QUESTIONS.md question-039, question-040, question-041.

**Phase 6: Installation & Integration (rich UIs optional)**
1. Clean installation system - non-invasive setup for existing repositories
2. Self-hosted Git storage setup - configure storage service for self-hosted Git repository
3. Reverse engineering tools - extract historical context from existing merge requests/PRs
4. **Positioning and doc suite**: Document "when to use TruthLayer vs doc suite" (Office/Docs + Copilot/Gemini) for adopters; optional future: integration points. See `docs/WHITEPAPER.md`, decision-027.
5. **(Optional)** Word/Excel/Google integration (see `docs/appendix/DOCX_REVIEW_INTEGRATION.md`): Excel-based review; optional Word/Excel Add-in; optional DOCX round-trip later.
6. **(Optional)** VS Code/Cursor extension - in-editor review, context awareness, and proposal authoring/preview
7. **(Optional)** Extension features:
   - Client-side change capture (on save or real-time) that produces proposals (review mode enforced by store)
   - Proposal creation and management UI
   - Context awareness while coding
   - Role-based authoring modes (read-only vs suggesting)
8. **(Optional)** Pre-baked Cursor rules - AI-assisted proposal and risk authoring (for when VS Code extension is used)
9. GitHub/GitLab integration (for code repository, not context store)
10. Reverse engineering MRs/PRs - extract historical context from existing repositories
11. CLI tools for installation and management
12. CI/CD integration
13. Security/privacy validation - ensure zero IP leakage, all data in self-hosted Git

**Phase 7: Production Readiness & Operations**
1. Complete retention engine enforcement — Implement actual deletion/archiving in the retention background task (currently stub that logs audit events only). Requires queryable `created_at` timestamps on all entities. See task-075, question-043, `docs/reference/PRIVACY_AND_DATA_PROTECTION.md`.
2. Complete DSAR erase — Implement store mutation (anonymize/redact actor references across nodes, proposals, reviews, audit log) in `POST /admin/dsar/erase` (currently records audit event only). See task-076, question-042.
3. Multi-workspace support in server — Enforce workspace scoping on all read/write paths (nodes, proposals, reviews, comments, audit). Currently single-workspace. Prevent cross-workspace leakage. See task-077, task-062, risk-010, risk-020.
4. SSO/SAML/OIDC integration — Extend JWT auth to accept tokens from enterprise identity providers (Azure AD, Okta, Auth0). Map external claims to TruthLayer roles via RBAC provider abstraction (question-007). See task-078.
5. Production backup/restore — Implement backup and restore procedures for both storage backends. File-based: Git snapshots on apply. MongoDB: native backup + periodic Git export. Validate revision lineage preservation on restore. See task-079, `docs/reference/OPERATIONS.md`.
6. Schema evolution and migration tooling — Versioned schemas with migration scripts for both storage backends. Backward-compatible reads; forward migration on startup or via CLI. See task-080, question-023, question-048.
7. Load testing and performance benchmarks — Benchmark both storage backends under production workloads (concurrent proposals, large graphs, traversal queries). Establish baselines and scalability limits. Inform file-based → MongoDB migration guidance. See task-081, risk-003, risk-022.
8. Deployment automation — Docker images, docker-compose for local dev, Helm charts or ARM/Bicep templates for cloud deployment. CI/CD pipeline for automated testing and deployment. See task-084.
9. Encryption at rest — Backend-dependent encryption (file-based: OS-level or encrypted volumes; MongoDB: native encryption at rest). BYOK support for enterprise. See `docs/reference/PRIVACY_AND_DATA_PROTECTION.md`.
10. SCIM provisioning — Automated user/role provisioning from enterprise identity providers to reduce manual role management. See `docs/reference/PRIVACY_AND_DATA_PROTECTION.md`.
11. API versioning — Strategy for managing breaking HTTP API changes (URL-based versioning, deprecation headers, migration guides). See question-048.

**Phase 8: AI Compliance Gateway**

TruthLayer evolves from governing internal truth operations to acting as a **compliance front-end for frontier and external AI models**. The same policy engine, sensitivity labels, RBAC, and audit log that govern internal operations are extended to intercept, inspect, and control all AI model interactions — ensuring organizational truth never reaches an unauthorized model and model responses are filtered before entering the governance pipeline.

1. Implement gateway proxy middleware — HTTP middleware (Axum layer) that intercepts outbound requests to external LLM APIs (OpenAI, Anthropic, Google, Azure OpenAI, self-hosted). Inspect request payloads, apply policy before forwarding, capture responses. Configurable model routing table (model → endpoint, API key vault reference, region). See task-085, task-086.
2. Enforce `EgressControl.destinations` — Wire up the existing `destinations` field in the EgressControl policy type: allowlist/denylist of permitted external model providers and endpoints per workspace. Default: no egress (all external calls blocked until explicitly allowed). See task-086, `server/src/policy.rs`.
3. Prompt inspection and redaction — Before any request leaves the gateway: scan prompt content against node sensitivity labels, redact or block content above the workspace's allowed egress sensitivity, enforce `AgentProposalLimit` on prompt size, and log the inspection result. See task-087.
4. Response filtering and validation — Inspect responses from external models before returning to callers: detect policy violations, hallucinated permissions, or injection attempts. Optional: validate that response content does not introduce data above the caller's sensitivity clearance. See task-088.
5. External call audit logging — Extend the audit log with a new event type (`ExternalModelCall`): log provider, model, region, prompt hash (not verbatim for privacy), response hash, sensitivity classification of egressed content, policy evaluation result, timestamp, actor, and latency. Queryable and exportable like existing audit events. See task-089.
6. MCP gateway mode — Extend the MCP server (task-082) to operate as a gateway: MCP clients call TruthLayer tools that transparently route to external models through the compliance layer. AI assistants (Cursor, Claude Desktop) call TruthLayer MCP tools → TruthLayer evaluates policy → TruthLayer forwards to the allowed model → TruthLayer filters the response → TruthLayer returns to the client. No direct model access needed. See task-090.
7. Model routing configuration — Config file (`models.json` or workspace-level policy) defining: allowed models per workspace, per-model rate limits, cost caps, regional routing constraints (EU-only, US-only), fallback model chains, and API key references (vault or env var). See task-091.
8. Gateway observability — Extend OTEL instrumentation with gateway-specific spans: `gateway.model_call` (provider, model, latency, token count), `gateway.policy_check` (rules evaluated, outcome), `gateway.redaction` (fields redacted, sensitivity level). Dashboard-ready for compliance reporting. See task-092.
9. Cost and rate governance — Per-workspace and per-actor rate limiting and cost tracking for external model calls. Policy rules: max tokens/day per actor, max cost/month per workspace, burst limits. Violations logged in audit and optionally block the request. See task-093.
10. Gateway admin API — Admin endpoints: `GET /admin/gateway/config` (current routing/policy), `PUT /admin/gateway/config` (update model allowlist), `GET /admin/gateway/usage` (usage stats per workspace/actor/model), `GET /admin/gateway/audit` (gateway-specific audit trail). Admin role required. See task-094.
```

```ctx
type: task
id: task-001
status: completed
---
Implement core node type system with TypeScript interfaces.
```

```ctx
type: task
id: task-002
status: completed
---
Create proposal system for tracked changes.
```

```ctx
type: task
id: task-003
status: completed
---
Implement ctx block parser for Markdown.
```

```ctx
type: task
id: task-004
status: completed
---
Build in-memory context store implementation.
```

```ctx
type: task
id: task-005
status: completed
---
Make project self-referential - use own system to document itself.
```

```ctx
type: task
id: task-006
status: completed
---
Implement file-based storage layer for context store. FileStore persists nodes, proposals, reviews, and audit log as JSON under the server config root data directory with atomic writes (temp file + rename). Activated via `TRUTHTLAYER_STORAGE=file`.
```

```ctx
type: task
id: task-007
status: completed
---
Implement proposal review workflow with accept/reject.
```

```ctx
type: task
id: task-008
status: completed
---
Add Docs-style comment threading anchored to semantic nodes/fields (and optionally text ranges) for proposals and reviews.

Notes:
- Anchors should survive Markdown projection regeneration (anchor to `nodeId`/`field`, not file offsets).
- Include an optional quote/snippet to support best-effort re-anchoring when text changes.
```

```ctx
type: task
id: task-009
status: open
---
Create CLI tool for importing/exporting context.
```

```ctx
type: task
id: task-010
status: in-progress
---
Write comprehensive tests for all core functionality.
```

```ctx
type: task
id: task-011
status: open
---
Implement proposal authoring API - helper functions for creating proposals programmatically.
```

```ctx
type: task
id: task-012
status: open
---
Add risk authoring tools - validation, templates, and helpers for creating risk nodes.
```

```ctx
type: task
id: task-013
status: open
---
Create authoring helpers for all node types (decisions, tasks, questions, constraints, goals).
```

```ctx
type: task
id: task-014
status: open
---
Build CLI authoring commands for creating proposals and nodes interactively.
```

```ctx
type: task
id: task-015
status: open
---
Implement commit tracking - link code git commits to proposals/nodes when proposals are implemented (Jira-style checkin semantics).
```

```ctx
type: task
id: task-016
status: open
---
Add checkin semantics - parse commit messages for proposal references and track commit hashes.
```

```ctx
type: task
id: task-017
status: open
---
Ensure context store persistence is independent of git commits - proposals persist immediately in MongoDB upon creation. Git snapshots are periodic backups, not primary storage.
```

```ctx
type: task
id: task-018
status: open
---
Design clean installation process - minimal files, opt-in features, non-invasive setup.
```

```ctx
type: task
id: task-019
status: open
---
Create installation CLI - initialize `.context/` directory and optional setup files.
```

```ctx
type: task
id: task-020
status: open
---
Build reverse engineering tools - extract historical context from existing merge requests/PRs to create initial context nodes.
```

```ctx
type: task
id: task-021
status: open
---
Ensure backward compatibility - repositories work normally without the ACAL layer enabled/installed.
```

```ctx
type: task
id: task-022
status: open
---
Build VS Code/Cursor extension (optional) - in-editor review, proposal management, context awareness, and proposal authoring from editor changes (client-side capture; review mode enforced by store). V1 requires **The Agent** (we build it) + minimal governance UI (task-064).
```

```ctx
type: task
id: task-023
status: open
---
Implement extension features - ctx block highlighting, proposal creation, review UI, context queries, real-time change detection (on save or as you type), role-based editing modes.
```

```ctx
type: task
id: task-024
status: open
---
Create pre-baked Cursor rules for proposal authoring - guide AI to create proposals with proper structure and metadata.
```

```ctx
type: task
id: task-025
status: open
---
Create pre-baked Cursor rules for risk authoring - guide AI to create risks with severity, likelihood, and mitigation.
```

```ctx
type: task
id: task-026
status: open
---
Integrate Cursor rules into installation process - automatically install rules when initializing a repository.
```

```ctx
type: task
id: task-027
status: open
---
Build MR/PR reverse engineering - analyze existing merge requests and pull requests to extract proposals, decisions, and risks.
```

```ctx
type: task
id: task-028
status: open
---
Implement PR/MR comment analysis - extract decisions, rationale, and rejected alternatives from PR comments.
```

```ctx
type: task
id: task-029
status: open
---
Create reverse engineering from PR history - extract historical context from PRs/MRs to create initial context nodes and proposals.
```

```ctx
type: task
id: task-030
status: open
---
Build GitHub/GitLab API integration - access PR/MR data, comments, and commit history for reverse engineering.
```

```ctx
type: task
id: task-031
status: completed
---
Implement role and permission system - JWT authentication (HS256) with hierarchical RBAC (Reader, Contributor, Reviewer, Applier, Admin) enforced on all routes. Agents hard-blocked from review and apply. Policy engine (6 rule types) validates at create/review/apply time.
```

```ctx
type: task
id: task-032
status: open
---
Add designated contributors and approvers - configure who can create proposals and who can approve them.
```

```ctx
type: task
id: task-033
status: open
---
Implement approval requirements - support multi-approval workflows and required approvers per node type.
```

```ctx
type: task
id: task-034
status: completed
---
Add role validation - require_role() and reject_agent() extractors enforce permissions on all routes. Agents receive 403 on review/apply.
```

```ctx
type: task
id: task-035
status: open
---
Implement issue creation on approval - automatically create issues when proposals are approved.
```

```ctx
type: task
id: task-036
status: open
---
Build issue templates system - define reusable issue templates for different proposal types.
```

```ctx
type: task
id: task-037
status: open
---
Add issue configuration to proposals - allow proposals to specify what issues should be created on approval.
```

```ctx
type: task
id: task-038
status: open
---
Implement role-based Markdown editing modes - read-only for some roles, editable for others.
```

```ctx
type: task
id: task-039
status: open
---
Build bidirectional sync system - Markdown edits sync back to context store and update referencing nodes.
```

```ctx
type: task
id: task-040
status: open
---
Implement reference tracking - detect and update nodes that reference changed content.
```

```ctx
type: task
id: task-041
status: completed
---
Build conflict detection system - detect when multiple proposals modify the same node.
```

```ctx
type: task
id: task-042
status: completed
---
Implement field-level merging - auto-merge non-conflicting fields, flag conflicts.
```

```ctx
type: task
id: task-043
status: open
---
Create conflict resolution UI - side-by-side comparison and manual resolution interface.
```

```ctx
type: task
id: task-044
status: open
---
Implement optimistic locking - track node versions and reject stale proposals.
```

```ctx
type: task
id: task-045
status: completed
---
Implement graph model with typed relationships - parent-child, depends-on, references, implements, blocks, mitigates, related-to.
```

```ctx
type: task
id: task-046
status: completed
---
Complete InMemoryStore implementation - fix return types, align conflict typing, ensure apply updates node metadata (modifiedAt/modifiedBy/version), and make traversal/stale detection behavior deterministic (tests passing). Delivered via **Rust server** (server/) with in-memory store; playground and scenarios use Rust server API.
```

```ctx
type: task
id: task-058
status: completed
---
Extract reusable store core logic from InMemoryStore into `src/store/core/*` (query, conflicts/stale/merge, apply-proposal, graph traversal, node keying) and add targeted coverage tests to lock behavior. **Current state**: Store implementation lives in **Rust server** (server/); TS keeps apply-proposal, graph, node-key in src/store/core/ for preview and tests; conflicts/query removed from TS; coverage tests in tests/store-core.coverage.test.ts for apply + graph only.
```

```ctx
type: task
id: task-070
status: completed
---
Rust server first slice + playground migration: add server/ (ContextStore trait, InMemoryStore, config from config root, Axum API); add TS API client (RustServerClient); remove TS InMemoryStore and store/core query/conflicts; update playground and scenarios to use Rust server; add npm run server, npm run playground (both servers), and Full stack VS Code task.
```

```ctx
type: task
id: task-047
status: completed
---
Implement storage abstraction layer - `ContextStore` trait in `store/context_store.rs`, `config.rs` loads configuration from server config root (storage backend, paths, RBAC; see question-038), `main.rs` selects between memory and file backends at startup. MongoDB backend selection is stubbed (falls back to memory with a warning).
```

```ctx
type: task
id: task-048
status: completed
---
Implement file-based storage - FileStore class persists nodes, proposals, reviews, and audit log as JSON files under server config root data directory. Atomic writes (temp file + rename). Activated via `TRUTHTLAYER_STORAGE=file`.
```

```ctx
type: task
id: task-049
status: open
---
Implement MongoDB storage layer - MongoDBStore class, collections setup, indexes, ACID transactions, connection management.
```

```ctx
type: task
id: task-050
status: open
---
Design and implement GraphQL API layer - schema definition (in repo or server config), resolvers, type validation, authentication/authorization via **RBAC provider** (question-007; works with both storage backends).
```

```ctx
type: task
id: task-051
status: completed
---
Implement conflict detection and resolution - `detect_conflicts`, `is_proposal_stale`, and `merge_proposals` implemented on InMemoryStore (programmatic ContextStore API). Not yet exposed on HTTP routes. Manual resolution UI, proposal superseding, and optimistic locking enforcement remain open (see task-043, task-044).
```

```ctx
type: task
id: task-052
status: completed
---
Implement decision/rationale traversal (provenance chains) - typed relationship path traversal, context chain building, decision reasoning following, semantic similarity. Not LLM chain-of-thought.
```

```ctx
type: task
id: task-053
status: open
---
Implement issue creation system - create issues from approved proposals, issue templates, issue configuration, issue lifecycle.
```

```ctx
type: task
id: task-054
status: open
---
Implement reference tracking - bidirectional reference tracking, automatic reference updates, reference validation.
```

```ctx
type: task
id: task-055
status: open
---
Implement Git integration - automatic Git commits for file-based storage, Git snapshot system for MongoDB, commit tracking (Jira-style checkin semantics).
```

```ctx
type: task
id: task-059
status: completed
---
Implement decision/rationale traversal APIs (provenance chains) - traverseReasoningChain, buildContextChain, followDecisionReasoning, discoverRelatedReasoning, queryWithReasoning.
```

```ctx
type: task
id: task-060
status: completed
---
Ensure clean review-mode semantics: Markdown/ctx blocks are treated as a projection format (repo or client), and all concurrent edits are proposals accepted/rejected into truth (no direct edits).
```

```ctx
type: task
id: task-061
status: completed
---
Implement explicit "applied" state for proposals (distinct from "accepted") so UIs can reliably show Accepted vs Applied and prevent re-apply. Implemented: proposal status APPLIED, AppliedMetadata (appliedAt, appliedBy, appliedFromProposalId, appliedToRevisionId, previousRevisionId), idempotent apply (re-apply returns 200 no-op).
```

```ctx
type: task
id: task-062
status: open
---
Define and enforce a workspace/tenancy model for the UI (`/workspaces/:ws`), including data partitioning and policy boundaries.

Notes:
- WorkspaceId is determined by server config or request context; file-backed workspaces live under server config root (question-038). Use explicit workspaceId on entities; store instance or namespace partition as chosen per deployment.
- Ensure no cross-workspace leakage in queries, proposals, reviews, comments, and projections.
```

```ctx
type: task
id: task-063
status: open
---
Introduce “projection runs” / truth snapshot identity so the UI can label projections as “Generated from Truth Snapshot: X” and diff between runs deterministically.
```

```ctx
type: task
id: task-064
status: open
---
Build **minimal governance UI** (required): list proposals, Accept/Reject/Apply. Can be standalone UI or CLI, or the review section of a larger app. **The Agent** (we build it) cannot perform these actions; humans ratify here. See docs/core/UI_SPEC.md, decision-031.
```

```ctx
type: task
id: task-068
status: open
---
Implement **The Agent** loop (we build it): in-process LLM + store tools (query truth, create proposals; no submitReview or applyProposal). Deployment optional (in-process or API). Expose via API for thin clients. See docs/core/AGENT_API.md, docs/appendix/CONTEXTUALIZED_AI_MODEL.md.
```

```ctx
type: task
id: task-069
status: open
---
Build full Web UI MVP (optional): Explore, Node detail, Proposal composer, Review accept/reject + Apply, Projections viewer. For teams that want rich Web UX; agentic-first v1 only requires agent + minimal review surface (task-064). Aligned to docs/core/UI_SPEC.md.
```

```ctx
type: task
id: task-065
status: open
---
Create shared UI component library + client SDK to enforce ACAL invariants consistently across minimal review surface, optional web UI, and optional VS Code extension (accepted-only defaults, proposal-only writes, anchored comments, clear proposal state).
```

```ctx
type: task
id: task-056
status: open
---
Validate security/privacy - ensure zero IP leakage, all data in self-hosted storage (file-based Git or MongoDB) within organization, no external services.
```

```ctx
type: task
id: task-057
status: open
---
Create comprehensive test suite - unit tests for all storage implementations, integration tests, performance tests, >80% coverage.
```

```ctx
type: task
id: task-066
status: open
---
Support bidirectional flow from Word/Google: create, modify, comment, and review proposals via store API (createProposal, updateProposal, addProposalComment, submitReview, applyProposal). Prefer Office Add-in; fallback: defined export/import format and sync step. See docs/appendix/DOCX_REVIEW_INTEGRATION.md.
```

```ctx
type: task
id: task-067
status: open
---
Provide context relationship visualization: context map (diagram or table of nodes/edges) in or alongside projections; with Office Add-in, graph/tree view in task pane. See docs/appendix/DOCX_REVIEW_INTEGRATION.md.
```

```ctx
type: task
id: task-071
status: open
---
Implement projection engine in Rust server — Markdown/DOCX/HTML projection: projection templates (per workspace or default), anchor maps (projection span → node/field anchor for change detection and comments), deterministic output (same revision + template = same output). Required for change detection (task-072) and bidirectional sync (task-039). See docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md Phase 3, docs/core/ARCHITECTURE.md.
```

```ctx
type: task
id: task-072
status: open
---
Implement change detection from projections — Parse edited projection (Markdown/DOCX), resolve edits to anchor map entries, emit structured proposal operations (create, update, delete, move, status-change, insert, edge create/delete). Validate operations against schema; surface optional policy findings. Depends on projection engine (task-071). See docs/appendix/CHANGE_DETECTION.md, docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md Phase 4.
```

```ctx
type: task
id: task-073
status: open
---
Implement full NodeQuery on HTTP API — Extend GET /nodes with remaining query filters: full-text search across content/title, date range (createdAfter/Before, modifiedAfter/Before), relatedTo (node ID + relationship types + depth), namespace, tags, creator, sorting options. Currently subset implemented. Match comprehensive spec in docs/core/AGENT_API.md.
```

```ctx
type: task
id: task-074
status: open
---
Expose conflict detection and merge on HTTP routes — Add: GET /proposals/:id/conflicts (list conflicting proposals), POST /proposals/merge (merge non-conflicting fields from multiple proposals), stale-proposal warning on POST /proposals/:id/review and POST /proposals/:id/apply. Currently detect_conflicts/is_proposal_stale/merge_proposals are programmatic InMemoryStore API only. See task-051, docs/scenarios/CONFLICT_AND_MERGE_SCENARIO.md.
```

```ctx
type: task
id: task-075
status: open
---
Complete retention engine enforcement — Extend retention background task to perform actual deletion or archiving of expired entities (nodes, proposals, reviews, comments, audit entries per retention class). Currently stub that loads retention.json rules and logs audit events but does not mutate store. Requires: queryable created_at timestamps on all entities, configurable retention periods per class, dry-run mode. See question-043, docs/reference/PRIVACY_AND_DATA_PROTECTION.md.
```

```ctx
type: task
id: task-076
status: open
---
Complete DSAR erase implementation — Extend POST /admin/dsar/erase to perform actual store mutation: anonymize or redact actor references across nodes (createdBy/modifiedBy), proposals, reviews, and audit log entries for a given data subject. Currently records an erasure audit event only. Consider: redaction vs crypto-shredding (per PRIVACY doc), audit log immutability constraints, cascade to related entities. See question-042, docs/reference/PRIVACY_AND_DATA_PROTECTION.md.
```

```ctx
type: task
id: task-077
status: open
---
Implement multi-workspace support in Rust server — Enforce workspace scoping (workspaceId) on all read/write paths: nodes, proposals, reviews, comments, audit log, projections. Partition storage per workspace (file-based: subdirectories; MongoDB: per-document workspaceId). Prevent cross-workspace leakage in queries and proposals. API routes scoped by /workspaces/:ws or header. See task-062, risk-010, risk-020, question-041.
```

```ctx
type: task
id: task-078
status: open
---
Implement SSO/SAML/OIDC integration — Extend JWT authentication to accept tokens from enterprise identity providers (Azure AD, Okta, Auth0, etc.). Map external token claims (groups, roles, UPN) to TruthLayer role hierarchy via configurable RBAC provider abstraction. Support token refresh and session management. See question-007, docs/reference/SECURITY_GOVERNANCE.md, docs/reference/PRIVACY_AND_DATA_PROTECTION.md.
```

```ctx
type: task
id: task-079
status: open
---
Implement production backup and restore — File-based backend: automatic Git commit on apply with structured message (proposal ID, actor, revision); periodic full snapshot. MongoDB backend: native mongodump/mongorestore + periodic Git export of accepted state. Restore must preserve revision lineage and audit log integrity. Validate with round-trip tests. See docs/reference/OPERATIONS.md.
```

```ctx
type: task
id: task-080
status: open
---
Implement schema evolution and migration tooling — Version field on stored entities; migration scripts for both backends (file-based JSON schema transforms, MongoDB migration aggregations). Backward-compatible reads for N-1 version; forward migration on server startup or via CLI tool. Document breaking vs non-breaking changes. See question-023, question-048.
```

```ctx
type: task
id: task-081
status: open
---
Implement load testing and performance benchmarks — Benchmark both storage backends: concurrent proposal creation (10/100/1000 agents), large graph queries (1K/10K/100K nodes), traversal depth performance, audit log query at scale. Establish latency and throughput baselines. Inform file-based storage scalability limits and MongoDB migration guidance. See risk-003, risk-022.
```

```ctx
type: task
id: task-082
status: open
---
Implement MCP server — Expose TruthLayer as an MCP (Model Context Protocol) server: tools for query truth, create proposals, traverse reasoning chains; resources for read-only context (accepted nodes, graph). Same agent-safe contract (no review/apply tools). Authentication via MCP session tokens mapped to JWT. See docs/core/AGENT_API.md, docs/appendix/OPTIONAL_INTEGRATIONS.md, question-047.
```

```ctx
type: task
id: task-083
status: open
---
Design and implement notification system — Notify relevant actors when: proposal created/submitted, review requested, review submitted, proposal applied, conflict detected, retention action pending. Pluggable transport layer (webhook, email, in-app, GitHub/GitLab notifications). Configurable per workspace (notification preferences, digest vs immediate). See question-017.
```

```ctx
type: task
id: task-084
status: open
---
Implement deployment automation — Dockerfile and docker-compose for local dev and CI. Helm chart or ARM/Bicep templates for cloud deployment (Azure Container Apps, Kubernetes). CI/CD pipeline (GitHub Actions) for automated build, test, and deploy. Environment-specific configuration (dev/staging/prod). Health check and readiness probes.
```

```ctx
type: task
id: task-085
status: open
---
Implement AI Compliance Gateway proxy middleware — Add an Axum middleware layer that intercepts outbound HTTP requests to configured external LLM API endpoints (OpenAI, Anthropic, Google, Azure OpenAI, self-hosted). The middleware must: extract the target model from the request, evaluate EgressControl and destination policies before forwarding, capture the response, and pass both through the prompt inspection (task-087) and response filtering (task-088) pipelines. Configurable model routing table maps model identifiers to endpoints, API key vault references, and regional constraints. See Phase 8 item 1, task-086, `docs/core/ARCHITECTURE.md`, `docs/reference/SECURITY_GOVERNANCE.md`.
```

```ctx
type: task
id: task-086
status: open
---
Enforce EgressControl.destinations policy — Wire up the existing `destinations` field in the EgressControl policy type (`server/src/policy.rs`): allowlist/denylist of permitted external model providers, endpoints, and regions per workspace. Default behavior: all external LLM calls blocked until a workspace admin explicitly adds allowed destinations. Evaluate destinations policy in the gateway proxy middleware (task-085) before any outbound request. Return 403 with policy violation details when a destination is not allowed. Audit log the evaluation result. See Phase 8 item 2, `server/policies.json`.
```

```ctx
type: task
id: task-087
status: open
---
Implement prompt inspection and redaction in the AI Compliance Gateway — Before any request leaves the gateway to an external model: (1) scan prompt content against node sensitivity labels (Public/Internal/Confidential/Restricted), (2) redact or block content above the workspace's allowed egress sensitivity (from EgressControl policy), (3) enforce AgentProposalLimit on prompt size (max tokens/content length), (4) log the inspection result as an audit event (fields scanned, redactions applied, sensitivity level of egressed content). Configurable: block vs redact mode, per-workspace redaction rules, verbosity of audit entry. See Phase 8 item 3, task-085, `docs/reference/SECURITY_GOVERNANCE.md`, `docs/reference/PRIVACY_AND_DATA_PROTECTION.md`.
```

```ctx
type: task
id: task-088
status: open
---
Implement response filtering and validation in the AI Compliance Gateway — Inspect responses from external models before returning to callers: (1) detect responses that claim permissions the caller doesn't have (hallucinated approvals, review actions), (2) optionally validate that response content does not introduce data above the caller's sensitivity clearance, (3) detect prompt injection or jailbreak indicators in model output, (4) log filtering results in audit. Configurable: strict mode (block suspect responses) vs advisory mode (annotate and pass through). See Phase 8 item 4, task-085.
```

```ctx
type: task
id: task-089
status: open
---
Extend audit log for external model calls — Add a new AuditEvent action type `ExternalModelCall` to the audit log (`server/src/types/audit.rs`). Fields: provider, model_id, region, prompt_hash (SHA-256, not verbatim), response_hash, sensitivity_classification of egressed content, policy_evaluation_result (allowed/blocked/redacted), token_count (prompt + completion), latency_ms, cost_estimate, actor_id, workspace_id, timestamp. Queryable via existing `GET /audit` filters (action=ExternalModelCall, actor, date range). Exportable via `GET /audit/export`. See Phase 8 item 5, task-085.
```

```ctx
type: task
id: task-090
status: open
---
Implement MCP gateway mode — Extend the MCP server (task-082) to operate as a compliance gateway: MCP clients (Cursor, Claude Desktop, etc.) invoke TruthLayer MCP tools that transparently route to external frontier models through the full compliance layer (auth → RBAC → policy → prompt inspection → model call → response filtering → audit). New MCP tools: `gateway_query` (send a governed prompt to an allowed model), `gateway_embed` (generate embeddings via allowed provider). The MCP client never needs direct access to model APIs — TruthLayer mediates all interactions. See Phase 8 item 6, task-082, `docs/core/AGENT_API.md`.
```

```ctx
type: task
id: task-091
status: open
---
Implement model routing configuration — Design and implement a configuration file (`models.json` or workspace-level policy extension in `policies.json`) defining: allowed models per workspace (e.g. `gpt-4o`, `claude-sonnet`, `gemini-pro`), per-model endpoint URLs, API key references (environment variable or vault path), per-model rate limits and cost caps, regional routing constraints (EU-only, US-only, specific Azure region), fallback model chains (primary → fallback if rate-limited or unavailable), and timeout/retry configuration. Loaded at server startup and reloadable via admin API. See Phase 8 item 7, task-085, task-094.
```

```ctx
type: task
id: task-092
status: open
---
Implement gateway observability — Extend OTEL instrumentation (`docs/OTEL_LOGGING.md`) with gateway-specific spans and metrics: `gateway.model_call` span (provider, model, latency, token count, cost), `gateway.policy_check` span (rules evaluated, outcome), `gateway.redaction` span (fields redacted, sensitivity level). New metrics: `gateway.requests.total` (by provider, model, outcome), `gateway.tokens.total` (by direction, model), `gateway.cost.total` (by workspace, model), `gateway.latency` histogram. Dashboard-ready for compliance reporting and cost monitoring. See Phase 8 item 8, `docs/OTEL_LOGGING.md`.
```

```ctx
type: task
id: task-093
status: open
---
Implement cost and rate governance for external model calls — Per-workspace and per-actor rate limiting and cost tracking: max tokens per day per actor, max cost per month per workspace, burst limits (requests per minute). Enforcement: soft limit (warn in audit log) and hard limit (block request with 429 + policy violation detail). Cost tracking: per-model token pricing table, accumulate per actor/workspace, expose via gateway admin API (task-094). Policy rules in `policies.json` or `models.json`. See Phase 8 item 9.
```

```ctx
type: task
id: task-094
status: open
---
Implement gateway admin API — Admin-only endpoints for managing the AI Compliance Gateway: `GET /admin/gateway/config` (current model routing and policy configuration), `PUT /admin/gateway/config` (update model allowlist, rate limits, cost caps — requires Admin role), `GET /admin/gateway/usage` (usage statistics per workspace, actor, model — token counts, costs, request counts, time range filters), `GET /admin/gateway/audit` (gateway-specific audit trail — shorthand for `GET /audit?action=ExternalModelCall` with additional gateway fields). See Phase 8 item 10, task-089.
```
