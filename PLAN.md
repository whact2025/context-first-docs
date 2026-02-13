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

**Current implementation (from code):** **Rust server** in `server/`: ContextStore trait with two backends (InMemoryStore — full, FileStore — partial: missing conflict detection/merge/stale), config from server config root, **HTTP/3 (QUIC) transport** via `quinn`/`h3`/`h3-quinn` with mandatory TLS 1.3 (self-signed dev cert auto-generated, production PEM from config), **SSE real-time events** via `GET /events?workspace={id}` (EventBus with `tokio::sync::broadcast`), 18 HTTP routes bridged through h3→axum (all middleware applies: auth, RBAC, policy, OTEL, CORS), JWT auth (HS256), RBAC enforcement on all routes, configurable policy engine (6 rule types from `policies.json`), immutable audit log (queryable + exportable), sensitivity labels with agent egress control, IP protection (SHA-256 content hash, source attribution), DSAR endpoints (export queries audit log; erase records audit event but does not yet mutate store data), retention engine (background task with config loading; enforcement stub — logs audit events but does not yet delete/archive), and optional dev TCP bridge (`TRUTHTLAYER_DEV_TCP=true`) for Node.js tooling (Node.js does not yet support HTTP/3 clients). **58 Rust tests** covering routes, auth, RBAC, policy, sensitivity, store, telemetry, TLS, and events. **TypeScript** (pure client): `src/api-client.ts` (RustServerClient with auth token injection + SSE `subscribeToEvents()` + `ServerEvent` type), types in `src/types/`, Markdown projection and ctx blocks in `src/markdown/`, telemetry in `src/telemetry.ts`. **60 TypeScript tests** (unit, integration, metrics, telemetry, type guards, ctx blocks). All store logic lives exclusively in the Rust server; TS store core and playground were removed to enforce the client-only boundary. **118 tests total** (58 Rust + 60 TypeScript). MongoDB backend, full query/traversal/conflict in the server, GraphQL layer, and minimal governance UI are next per phases below and `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md`.

**Server and configuration:** Agent deployments use a **server component** (local or remote). All runtime configuration—storage backend and paths, RBAC provider, TLS certificates, and other runtime settings—lives in a **predefined location relative to the server** (config root). No repo-scattered runtime config. See QUESTIONS.md question-038 (storage/workspace config), question-007 (RBAC provider abstraction). The Rust server in `server/` (see `server/README.md`) is the reference implementation with HTTP/3 (QUIC) transport, mandatory TLS 1.3, JWT auth, RBAC, policy engine, audit log, sensitivity labels, SSE real-time events, file-based storage, and dev TCP bridge for Node.js tooling; extend with MongoDB backend, full query/traversal/conflict.

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
1. ✅ Rust server provides InMemoryStore baseline (server/). TS store core (`src/store/core/`) and coverage tests (`tests/store-core.coverage.test.ts`) have been removed; store logic lives exclusively in the Rust server. (See `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md` Phase 1.)
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
13. ✅ HTTP/3 (QUIC) transport — Primary transport via `quinn`/`h3`/`h3-quinn`, mandatory TLS 1.3, SSE real-time events via `EventBus`, dev TCP bridge for Node.js tooling, 0-RTT reconnection, stream multiplexing. See task-128, decision-038.

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
24. Notification system — Notify contributors and approvers of new proposals, reviews, and apply events. Pluggable transport (email, webhook, in-app, GitHub/GitLab notifications). **SSE infrastructure ready** (task-098, task-128): EventBus publishes proposal_updated, review_submitted, config_changed events; `GET /events` endpoint streams to subscribers. Remaining: email/webhook/external transports, notification preferences, digest mode. See question-017, task-083.

**Phase 4: Agent APIs** (power **The Agent** we build; agent uses these to read truth and create proposals only)
1. Implement comprehensive query API (type, status, keyword, relationships, pagination, sorting) — Full NodeQuery on HTTP API (task-073: full-text search, date range, relatedTo, relationshipTypes, depth, namespace, tags, sorting)
2. Implement decision/rationale traversal APIs (provenance chains; typed relationship traversal: goal → decision → risk → task):
   - traverseReasoningChain() - follow typed relationship paths
   - buildContextChain() - progressive context building
   - followDecisionReasoning() - understand decision rationale
   - discoverRelatedReasoning() - find related context
   - queryWithReasoning() - query with provenance chains attached to results
   - **Note**: traversal methods are implemented in InMemoryStore only; FileStore needs parity (task-113)
3. Implement graph traversal APIs (relationship queries, path finding, dependencies)
4. Implement proposal generation API
5. Add validation and safety checks (default to accepted only, explicit opt-in for proposals)
6. Create agent documentation (see `docs/core/AGENT_API.md`)
7. **MCP server** — Expose TruthLayer as an MCP (Model Context Protocol) server so AI assistants (Cursor, Claude Desktop, etc.) can use it as a native tool: query truth, create proposals, traverse reasoning chains; same agent-safe contract (no review/apply). Optional MCP resources for read-only context. See `docs/core/AGENT_API.md` (MCP exposure), `docs/core/ARCHITECTURE.md`, `docs/appendix/OPTIONAL_INTEGRATIONS.md`. See task-082.

**Phase 5: Contextualize module + The Agent (we build it)**

Implement the **Contextualize** module and **The Agent** as in `docs/appendix/CONTEXTUALIZED_AI_MODEL.md` and `docs/core/AGENT_API.md`: retrieval, prompt building, optional in-process agent loop (LLM + store tools; agent cannot submitReview or applyProposal), export for fine-tuning, optional vector index; **prompt-leakage policy layer**. Store remains substrate; enterprise IP stays in-house. **The Agent** reads accepted truth and creates proposals only; deployment is optional (in-process or API). **Minimal governance UI** (list proposals, Accept/Reject/Apply) is required for humans to ratify; implement in Phase 3 or 5 so reviewers have a surface for truth-changing actions.

**Implementation tasks** (in dependency order):
1. Retrieval module — scoped context retrieval, token budgeting, policy enforcement (task-114)
2. Prompt builder — system prompt templates, context budget, conversation history (task-115)
3. Truth-marked prompt construction — three-layer prompt assembly with provenance metadata and truth boundary markers (task-127)
4. LLM integration / model abstraction — pluggable providers, streaming, tool call parsing (task-116)
5. Server-side agent loop — `POST /agent/chat` SSE endpoint, convergence of retrieval + gateway (task-112)
6. Grounding classification engine — semantic verification, contradiction detection, confidence scoring (task-126)
7. Truth anchoring pipeline — citation verification, segment classification, grounding events, proposal metadata (task-125)
8. Export pipeline — JSONL/JSON for fine-tuning, sensitivity enforcement (task-123)
9. Optional vector index — semantic search, hybrid results with traversal expansion (task-124)

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
6. **TruthLayer IDE and Extension Pack** -- See **Phase 9** for the full plan: a VS Code fork (TruthLayer IDE) with a layered extension strategy. Six extensions (`truthlayer.governance`, `truthlayer.ctx-language`, `truthlayer.ctx-preview`, `truthlayer.audit`, `truthlayer.config`, `truthlayer.agent`) work in vanilla VS Code, Cursor, and TruthLayer IDE. Fork-only features (semantic inline diffs, anchored comments, proposal mode, agent inline editing) require the fork. See `.cursor/plans/truthlayer_ide_analysis_4f3e7459.plan.md` for detailed architecture.
7. **(Optional)** Pre-baked Cursor rules - AI-assisted proposal and risk authoring (for when extensions are used in Cursor)
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

**Phase 9: TruthLayer IDE — VS Code Fork with Extension Layering**

A standalone TruthLayer IDE built as a VS Code fork with a layered extension strategy. Most governance features are built as **standard VS Code extensions** (portable to VS Code, Cursor, and TruthLayer IDE). Fork-only features provide deep editor integration available only in TruthLayer IDE. Detailed architecture in `.cursor/plans/truthlayer_ide_analysis_4f3e7459.plan.md`.

**Prerequisites (before extension development):**
1. ContextStore interface cleanup — Trim unimplemented stubs in `src/types/context-store.ts` to match actual server capabilities, so extensions don't depend on methods that throw or return empty data. See task-096.
2. Shared library packaging — Package `src/` as `@truthlayer/client` npm module (API client, types, markdown, telemetry). Decide package boundary (question-064). See task-095.
3. Server config management API — Add admin endpoints: `GET/PUT /admin/config/policies`, `GET/PUT /admin/config/retention`, `GET /admin/config/server`, `POST /admin/config/reload`. Required by `truthlayer.config` extension. See task-097.
4. ✅ Real-time update strategy — Decided: SSE over HTTP/3 (question-057, decision-038). Implemented: `GET /events?workspace={id}` SSE endpoint with `EventBus`, workspace filtering, 15s keep-alive; TypeScript `subscribeToEvents()` client. See task-098 (completed), task-128 (completed).
5. WebView framework decision — Choose UI framework (React, Svelte, Lit, raw HTML) for all WebView panels across all 6 extensions (question-058).
6. Repository structure decision — Monorepo, multi-repo, or hybrid for extensions, shared lib, and IDE fork (question-059).
7. Server-side agent loop — Implement `POST /agent/chat` SSE streaming endpoint (Cursor-pattern architecture): server runs agent loop (prompt building, compliance gateway interception, LLM call, tool execution, audit), extension is thin client. Required by `truthlayer.agent` extension. Convergence point of Phase 5 (Contextualize) and Phase 8 (AI Compliance Gateway). Can ship with minimal gateway shim (model routing + audit) before full Phase 8 (question-069). See task-112.

**Extension Layer (works in VS Code, Cursor, AND TruthLayer IDE):**
7. Extension: `truthlayer.ctx-language` + `truthlayer.ctx-preview` — TextMate grammar, validation diagnostics, auto-complete, CodeLens, decorations; evolve existing `vscode-ctx-markdown/` preview. See task-099.
8. Extension: `truthlayer.governance` — Proposal list TreeView, proposal detail WebView (semantic diff cards), review flow, apply confirmation, status bar, server connection. See task-100.
9. Extension: `truthlayer.audit` + `truthlayer.config` — Audit log WebView, provenance viewer, DSAR tools; Policy Builder wizard, Workflow Visualizer, Retention config, Sensitivity defaults, Role matrix. See task-101.
10. Extension: `truthlayer.agent` — **Thin chat client** (Cursor-pattern architecture): Agent Chat WebView renders SSE stream from server-side agent loop. Server runs the full agent loop: receives user messages, builds prompts, calls frontier models through compliance gateway (Phase 8), executes tool calls in-process, streams conversation back. Extension never calls LLMs directly. Guided workflow templates (draft proposal, risk assessment, impact analysis, compliance check, explain decision) execute server-side. Requires server-side agent loop endpoint (task-112). See task-102.
11. Extension pack — Bundle all 6 extensions as `truthlayer` extension pack, publishable to VS Code Marketplace and Open VSX. See task-103.

**Fork Layer (TruthLayer IDE only):**
12. Fork setup — Fork `microsoft/vscode` (Code OSS), apply branding (product.json, icons, splash), pre-install extensions, custom welcome tab, upstream tracking branch, build pipeline. See task-104.
13. Fork-only features — Semantic inline diffs (modify `viewLineRenderer`), anchored review comments (margin rail), proposal mode overlay (`ProposalOverlayModel`), agent inline editing (ghost text with per-operation accept/reject). See task-105.
14. Polish and distribution — Cross-platform builds (Windows/Mac/Linux), code signing, auto-update (Electron autoUpdater), graph visualization (Truth Graph explorer), E2E testing. See task-106.
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
Write comprehensive tests for all core functionality. **Current**: 118 tests total — 58 Rust tests (routes, auth, RBAC, policy, sensitivity, store, telemetry, TLS, events) + 60 TypeScript tests (unit, integration, metrics, telemetry, type guards, ctx blocks). Target: >80% coverage, performance tests, both backend parity tests (see task-057, task-113).
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
Extract reusable store core logic from InMemoryStore into `src/store/core/*` (query, conflicts/stale/merge, apply-proposal, graph traversal, node keying) and add targeted coverage tests to lock behavior. **Current state**: Store implementation lives in **Rust server** (server/). TS store core (`src/store/core/`) and coverage tests (`tests/store-core.coverage.test.ts`) have been removed; all store logic is server-only. TypeScript is a pure client.
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

```ctx
type: task
id: task-095
status: open
---
Package shared TypeScript library as `@truthlayer/client` npm module — Extract `src/` (API client, types, markdown utilities, telemetry) into a publishable package consumed by all extensions and fork modifications. Decide package boundary (question-064): whether telemetry and markdown should be separate packages or bundled. Add package.json with proper exports, TypeScript declarations, and peer dependencies. See Phase 9 item 2.
```

```ctx
type: task
id: task-096
status: open
---
Clean up ContextStore interface — Trim unimplemented stubs in `src/types/context-store.ts` to match actual `RustServerClient` capabilities. Remove or mark as optional any methods that currently throw "not implemented" or return empty arrays. Extensions should not depend on an interface that promises capabilities the server does not provide. See Phase 9 item 1, question-060.
```

```ctx
type: task
id: task-097
status: open
---
Implement server config management API — Add admin endpoints to the Rust server for reading and writing configuration: `GET /admin/config/policies` (current policy rules), `PUT /admin/config/policies` (update policies, admin only, audited), `GET /admin/config/retention` (retention rules), `PUT /admin/config/retention` (update retention, admin only, audited), `GET /admin/config/server` (server config with sensitive fields redacted), `POST /admin/config/reload` (hot-reload config without restart). Required by `truthlayer.config` extension. See Phase 9 item 3.
```

```ctx
type: task
id: task-098
status: completed
---
Implement real-time update channel — Decided: SSE over HTTP/3 (decision-038, question-057). Implemented: `EventBus` (tokio::sync::broadcast) publishes `ServerEvent` on state-changing routes (create_proposal, update_proposal, submit_review, apply_proposal, withdraw_proposal, reset_store). `GET /events?workspace={id}` SSE endpoint streams events with 15s keep-alive; events filtered by workspace_id. TypeScript `subscribeToEvents(workspaceId, onEvent, onError)` reads SSE stream with auto-parsing. Extensions subscribe to relevant event streams for live proposal/review/config updates. Implemented in task-128. See Phase 9 item 4, risk-032 (resolved).
```

```ctx
type: task
id: task-099
status: open
---
Build `truthlayer.ctx-language` and `truthlayer.ctx-preview` extensions — Language support: TextMate grammar for ctx blocks in Markdown, DiagnosticCollection for validation (required fields, valid types/statuses, duplicate IDs), CompletionItemProvider for auto-complete, CodeLens (proposal count, sensitivity, last review), decorations (gutter icons, background tints). Preview: evolve existing `vscode-ctx-markdown/` with sensitivity badges, proposal status indicators, and relationship links. See Phase 9 item 7.
```

```ctx
type: task
id: task-100
status: open
---
Build `truthlayer.governance` extension — Core governance UI: Proposal List TreeView (grouped by status, filterable, badge counts), Proposal Detail WebView (semantic diff cards, policy warnings, review timeline, action buttons), Review Flow WebView (approve/reject/request changes, comments, multi-reviewer status), Apply Confirmation WebView (policy check results, affected nodes). Status bar: connection status, current role, open proposals count. Commands: Create Proposal, Submit Review, Apply, Withdraw, Connect to Server, Show Audit Log, Show Truth Graph. See Phase 9 item 8.
```

```ctx
type: task
id: task-101
status: open
---
Build `truthlayer.audit` and `truthlayer.config` extensions — Audit: timeline WebView with filters (actor, action, resource, date range), export to CSV/JSON, provenance viewer (full history per node), compliance TreeView (DSAR tools, policy viewer, retention status). Config: Policy Builder wizard (visual rule editor for all 6 rule types with validation and dry-run), Workflow Pipeline Visualizer (interactive ACAL flow showing where rules fire), Retention Configuration (visual editor with timeline preview), Sensitivity/IP Configuration, Server Connection/Auth panel, Role Matrix display, Config Status TreeView with health indicators. Requires server config API (task-097). See Phase 9 item 9.
```

```ctx
type: task
id: task-102
status: open
---
Build `truthlayer.agent` extension — **Thin chat client** following Cursor-pattern architecture (extension renders conversation; server runs agent loop). Agent Chat WebView (renders SSE stream from server: tokens, tool calls, tool results, node citations with clickable links, conversation history). Agent Status TreeView (active sessions, guardrails visibility, agent-authored proposals, token/cost tracking). Extension sends user messages + conversation context to `POST /agent/chat`; server runs full agent loop (prompt building, compliance gateway interception, LLM call, tool execution, audit logging) and streams response back. No direct LLM calls from extension; model config is server-side. Guided workflow templates (Draft Proposal, Risk Assessment, Impact Analysis, Compliance Check, Explain Decision, Generate Implementation Plan, Review Assistant) execute server-side, selected by template name in request body. User confirmation required before truth-changing actions (proposal creation). Commands: Ask Agent, Draft Proposal with Agent, Explain This Node, Assess Risk, Agent Impact Analysis. Requires task-112 (server-side agent loop). See Phase 9 item 10.
```

```ctx
type: task
id: task-103
status: open
---
Create TruthLayer extension pack — Bundle all 6 extensions (`truthlayer.governance`, `truthlayer.ctx-language`, `truthlayer.ctx-preview`, `truthlayer.audit`, `truthlayer.config`, `truthlayer.agent`) as a single installable extension pack. Publish to VS Code Marketplace and Open VSX Registry. Test in vanilla VS Code and Cursor. See Phase 9 item 11.
```

```ctx
type: task
id: task-104
status: open
---
Fork and brand TruthLayer IDE — Fork `microsoft/vscode` (Code OSS). Apply branding: product.json (name, publisher, icon), custom splash screen, about dialog, welcome tab with TruthLayer onboarding. Pre-install all 6 extensions. Set up upstream tracking branch for monthly rebases. Build pipeline (CI/CD) for at least one platform initially. See Phase 9 item 12.
```

```ctx
type: task
id: task-105
status: open
---
Implement fork-only editor features — Deep editor modifications in `src/vs/editor/contrib/truthlayer/`: (1) Semantic inline diffs: modify `viewLineRenderer` for proposal overlay rendering (field-level colored annotations). (2) Anchored review comments: margin rail component synced to scroll position. (3) Proposal mode overlay: `ProposalOverlayModel` wrapping `TextModel` with virtual "applied" state. (4) Agent inline editing: ghost text with per-operation accept/reject buttons, `PendingProposalBuffer`, "Accept All"/"Reject All" toolbar. See Phase 9 item 13.
```

```ctx
type: task
id: task-106
status: open
---
TruthLayer IDE polish and distribution — Cross-platform build verification (Windows .exe/.msi, macOS .dmg, Linux .deb/.rpm/.AppImage). Code signing for all platforms. Auto-update infrastructure (Electron autoUpdater). Truth Graph visualization explorer. End-to-end testing of full workflows (extension + fork features + server). Agent analytics dashboard. See Phase 9 item 14.
```

```ctx
type: task
id: task-107
status: open
---
Fix type serialization mismatch (snake_case vs camelCase) — Add `#[serde(rename_all = "camelCase")]` to `Comment`, `CommentAnchor`, and `RelationshipMetadata` structs in the Rust server. Currently these types serialize field names as snake_case (`created_at`, `node_id`, etc.) but the TypeScript client expects camelCase (`createdAt`, `nodeId`). This causes `undefined` values when the TS client reads server JSON. Prerequisite for all UI extension development. See `docs/engineering/ui/SERVER_API_REQUIREMENTS.md` section 2, risk-036.
```

```ctx
type: task
id: task-108
status: open
---
Add proposal query filters to GET /proposals — Extend the `GET /proposals` endpoint to accept query parameters: `status` (comma-separated, filter by proposal status — currently only returns open), `createdBy` (filter by author actor ID), `tags` (comma-separated), `nodeTypes` (filter by node types affected by operations). Update `ContextStore` trait and both store implementations (InMemoryStore, FileStore). Required by `truthlayer.governance` extension for proposal list filtering. See `docs/engineering/ui/SERVER_API_REQUIREMENTS.md` section 4.1, risk-037.
```

```ctx
type: task
id: task-109
status: open
---
Add audit, provenance, and DSAR methods to RustServerClient — The server already implements `GET /audit`, `GET /audit/export`, `GET /nodes/:id/provenance`, `GET /admin/dsar/export`, and `POST /admin/dsar/erase`, but the TypeScript `RustServerClient` has no methods to call them. Add: `queryAudit(params)`, `exportAudit(format)`, `getProvenance(nodeId)`, `dsarExport(subject)`, `dsarErase(subject)`. Required by `truthlayer.audit` extension. **Note**: SSE `subscribeToEvents()` and `ServerEvent` type were added to `api-client.ts` in task-128. See `docs/engineering/ui/SERVER_API_REQUIREMENTS.md` section 4.4.
```

```ctx
type: task
id: task-110
status: open
---
Add redacted node type support to TypeScript types — The server returns redacted nodes for agents above sensitivity level: `{ redacted: true, reason: "sensitivity", ... }` with `content`, `description`, and other body fields omitted. The TypeScript `AnyNode` type has no `redacted` or `reason` fields. Add optional `redacted?: boolean` and `reason?: string` to the TS node type. Extensions must check `node.redacted` before rendering content fields. See `docs/engineering/ui/SERVER_API_REQUIREMENTS.md` section 4.5.
```

```ctx
type: task
id: task-111
status: open
---
Add dedicated comments API endpoints — Add `GET /proposals/:id/comments` (Reader role) and `POST /proposals/:id/comments` (Contributor role, body: `{ author, content, anchor?, operationId? }`) to the Rust server. Currently comments are embedded in the Proposal object and modified via `PATCH /proposals/:id`, which requires sending the full proposal to add a single comment and doesn't support concurrent additions. Required by `truthlayer.governance` extension for the comment thread UI. See `docs/engineering/ui/SERVER_API_REQUIREMENTS.md` section 4.2.
```

```ctx
type: task
id: task-112
status: open
---
Implement server-side agent loop endpoint (Cursor-pattern architecture) — The `truthlayer.agent` extension is a thin chat client; the server runs the full agent loop. Add `POST /agent/chat` (SSE streaming endpoint): receives user message + conversation history + optional workflow template, retrieves relevant context from ContextStore, builds prompt with system context and tool definitions, calls configured frontier model **through the compliance gateway** (Phase 8: prompt inspection, sensitivity enforcement, EgressControl, response filtering), executes tool calls in-process (query_nodes, create_proposal, get_provenance, query_audit), feeds tool results back to model, streams conversation as SSE events (token, tool_call, tool_result, citation, error, done). Add `GET /agent/templates` (list available workflow templates) and `GET /agent/sessions` (active/recent sessions). All interactions audit-logged with user identity and agent session ID. Agent acts on behalf of authenticated user with agent-type restrictions (cannot review/apply per question-035). Model configuration (allowed models, API keys, rate limits, cost caps) is server-side admin config (task-091). This is the convergence point of Contextualize module (Phase 5) and AI Compliance Gateway (Phase 8). Required by task-102 (`truthlayer.agent` extension). See `docs/engineering/ui/SERVER_API_REQUIREMENTS.md`, `docs/engineering/ui/EXTENSION_ARCHITECTURE.md` section 2.6.
```

```ctx
type: task
id: task-113
status: open
---
FileStore feature parity with InMemoryStore — Implement missing ContextStore trait methods in FileStore: `detect_conflicts`, `is_proposal_stale`, `merge_proposals`, `traverse_reasoning_chain`, `build_context_chain`, `follow_decision_reasoning`, `query_with_reasoning`. Currently only InMemoryStore implements these; FileStore returns empty/error for all. Both backends must pass the same test suite. Add shared integration tests that run against both backends to verify parity. Blocks production use of file-based storage. See risk-040, `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md`.
```

```ctx
type: task
id: task-114
status: open
---
Phase 5 — Retrieval module implementation — Build the retrieval pipeline for the Contextualize module: (1) scoped context retrieval with configurable depth limits and max node count, (2) context window management (token counting per model, prioritization by relevance), (3) workspace-scoped policy enforcement for allowed/forbidden node types before context assembly, (4) content redaction of sensitive fields before prompt building (per egress_control policy). Used by the server-side agent loop (task-112) and export pipeline (task-123). See `docs/appendix/CONTEXTUALIZED_AI_MODEL.md` §§ Retrieval pipeline, Context policies.
```

```ctx
type: task
id: task-115
status: open
---
Phase 5 — Prompt builder implementation — Implement prompt construction from retrieved context: (1) system prompt templates with tool definitions and agent identity, (2) conversation history management with sliding window, (3) context budget allocation (max tokens per section: system, context, history, user), (4) workspace-specific prompt policies (allowed node types, redaction rules, max context size). Output: complete prompt ready for LLM call. Used by the server-side agent loop (task-112). Depends on retrieval module (task-114). See `docs/appendix/CONTEXTUALIZED_AI_MODEL.md` §§ Context policies.
```

```ctx
type: task
id: task-116
status: open
---
Phase 5 — LLM integration / model abstraction layer — Implement model-agnostic LLM client in Rust server: (1) pluggable provider trait (OpenAI, Anthropic, Google, Azure OpenAI, self-hosted endpoints), (2) streaming response parsing (SSE from provider → internal token stream), (3) tool call extraction and structured response parsing, (4) retry with exponential backoff and circuit breakers, (5) cost tracking (input/output tokens × provider pricing), (6) rate limiting per workspace. Shared by the server-side agent loop (task-112) and AI Compliance Gateway (task-085). Configuration from server config root (model routing table, API keys, rate limits, cost caps).
```

```ctx
type: task
id: task-117
status: open
---
Extension shared infrastructure library — Build shared WebView component library for all 6 TruthLayer extensions: (1) `ServerConnectionManager` — auth token injection, base URL config, health check polling, automatic reconnection, (2) `DataPoller` — configurable interval, ETag/last-modified caching, error backoff, change notification, (3) `WebViewMessageProtocol` — typed request/response messages between extension host and WebView, (4) `ThemeInjector` — VS Code theme variables → CSS custom properties for consistent styling, (5) `StatePersistence` — globalState/workspaceState wrapper with typed keys and migration. Publish as `@truthlayer/vscode-shared` package. Used by all extensions (task-097 through task-102). See `docs/engineering/ui/EXTENSION_ARCHITECTURE.md` § Shared patterns.
```

```ctx
type: task
id: task-118
status: open
---
Naming convention standardization — Audit and fix naming inconsistencies: (1) Ensure all Rust structs serialized to JSON use `#[serde(rename_all = "camelCase")]` — fix Comment, CommentAnchor, RelationshipMetadata (overlaps task-107; task-107 covers the serde fix, this task covers the broader audit). (2) Verify all HTTP API endpoint paths follow kebab-case convention for multi-word segments. (3) Ensure all doc references to API fields use the correct casing convention (camelCase for JSON, snake_case for Rust internals). (4) Add a naming convention section to CONTRIBUTING.md covering: Rust (snake_case internals, camelCase JSON via serde), TypeScript (camelCase throughout), HTTP API (camelCase JSON fields, kebab-case URL paths), documentation (match the layer being described). See risk-041.
```

```ctx
type: task
id: task-119
status: open
---
Server error handling audit and hardening — Audit all route handlers in `server/src/api/routes.rs` for silent error swallowing. Currently some handlers use `.ok()` or `.unwrap_or_default()` which masks failures from clients and audit. Fix: (1) all errors return appropriate HTTP status codes (400 bad request, 404 not found, 422 policy violation, 500 internal), (2) all error responses include structured JSON body `{ error, code, details }`, (3) all errors logged with OpenTelemetry trace context, (4) security-relevant failures (auth, RBAC, policy) always produce audit log entries even when the request is rejected. Add integration tests for error scenarios (malformed input, missing resources, policy violations, concurrent conflicts). See risk-042.
```

```ctx
type: task
id: task-120
status: open
---
Heightened review triggers implementation — Implement automated detection of proposals requiring elevated review per `docs/reference/SECURITY_GOVERNANCE.md`: triggers when (1) proposal touches nodes with sensitivity ≥ confidential, (2) proposal is from an agent actor, (3) proposal affects identity/access/policy node types, (4) proposal contains >N operations (configurable threshold), (5) proposal modifies retention or security classification fields. When triggered: automatically add `heightened_review: true` to proposal metadata, require additional reviewer approval (extend policy engine), emit notification to designated security reviewers (depends on task-083). See SECURITY_GOVERNANCE §agent-behavior guardrails.
```

```ctx
type: task
id: task-121
status: open
---
Workspace isolation enforcement and testing — Verify strict workspace scoping across all ContextStore methods and HTTP routes: (1) every query includes workspaceId filter (currently some methods accept optional workspaceId), (2) no cross-workspace data leakage in query results or traversals, (3) traversal APIs respect workspace boundaries (don't follow edges to nodes in other workspaces), (4) audit log entries include workspaceId, (5) proposals cannot reference nodes from other workspaces. Add integration tests: create data in workspace A and workspace B, verify queries in workspace A never return workspace B data. See `docs/core/ARCHITECTURE.md` § Tenancy.
```

```ctx
type: task
id: task-122
status: open
---
Gateway performance benchmarks and HA design — (1) Establish latency baselines for the full gateway pipeline (auth → policy → prompt inspection → model routing → response filtering → audit) with target p99 < 200ms overhead beyond model latency. (2) Design high-availability strategy: connection pooling to model providers with configurable pool size, circuit breakers on provider failures (configurable thresholds), automatic failover routing to backup providers, graceful degradation when gateway is overloaded (queue with backpressure, reject with 503). (3) Load test with concurrent model calls (10/50/100 simultaneous) to both store-side and gateway-side operations. Document results and scalability limits. See risk-030, risk-038.
```

```ctx
type: task
id: task-123
status: open
---
Export pipeline for fine-tuning — Implement export of accepted nodes to training data format: (1) JSONL export with configurable filters (node types, tags, date range, sensitivity ≤ threshold), (2) instruction/response format mapping (configurable templates per node type), (3) snapshot attachment for audit trail (which revision was exported, by whom, when), (4) sensitivity enforcement (never export above workspace's max export sensitivity), (5) CLI command and HTTP endpoint (`GET /export/training?format=jsonl&...`). Training data stays in-house. See `docs/appendix/CONTEXTUALIZED_AI_MODEL.md` § Retrieval pipeline, `docs/reference/PRIVACY_AND_DATA_PROTECTION.md`.
```

```ctx
type: task
id: task-124
status: open
---
Optional vector index for semantic search — Design and implement optional vector embedding of accepted nodes: (1) embed node content on apply (configurable: enabled/disabled per workspace), (2) self-hosted vector DB integration (Qdrant recommended, pgvector as alternative), (3) top-k semantic retrieval endpoint (`GET /nodes/search/semantic?query=...&limit=...`), (4) hybrid results: expand vector hits with `traverseReasoningChain` for related context, (5) index management: re-embed on node update, remove on delete, rebuild command. Useful for large workspaces (>1K nodes) or when keyword search is insufficient. See `docs/appendix/CONTEXTUALIZED_AI_MODEL.md` § Retrieval pipeline.
```

```ctx
type: task
id: task-125
status: open
---
Implement truth anchoring pipeline (decision-037) — Add post-response grounding analysis to the server-side agent loop (task-112). Steps: (1) **Citation extraction**: parse model response for `[node:ID]` markers, build citation map with positions. (2) **Citation verification**: for each citation, verify node exists in workspace, status is accepted, and content semantically supports the model's claim (fuzzy match using sentence embedding or keyword overlap). Emit verified/failed citation SSE events. (3) **Segment classification**: split response into segments (sentence or paragraph level), classify each as grounded/derived/ungrounded/contradicted based on citation verification results. (4) **Aggregate grounding summary**: compute overall statistics (segment counts per tier, cited nodes, uncited claims, overall confidence). Emit `grounding` events per segment and `grounding_summary` event at turn end. (5) **Proposal metadata inheritance**: when `create_proposal` tool is called, attach grounding metadata to the proposal (groundingTier, citedNodes, uncitedClaims, contradictions). Depends on task-112 (agent loop), task-114 (retrieval module). See `docs/appendix/CONTEXTUALIZED_AI_MODEL.md` § Truth anchoring pipeline, `docs/core/AGENT_API.md` § Truth anchoring contract.
```

```ctx
type: task
id: task-126
status: open
---
Implement grounding classification engine — Build the core engine used by the truth anchoring pipeline (task-125) for semantic verification and confidence scoring. (1) **Semantic similarity check**: given a model's claim and a cited node's content, compute whether the claim is supported (keyword overlap for MVP; sentence embedding cosine similarity for production). Configurable threshold (default: 0.7). (2) **Contradiction detection**: compare model claims against all retrieved accepted nodes, not just cited ones. Flag claims that directly contradict accepted content (negation, conflicting values, reversed decisions). (3) **Confidence scoring algorithm**: combine citation density (fraction of claims with verified citations), citation accuracy (semantic match scores), traversal depth (hops from source node), and recency (revision age). Output: 0.0–1.0 score per segment and aggregate. (4) **Configurable grounding policy**: per-workspace settings for grounding thresholds (minimum confidence to classify as "grounded"), contradiction sensitivity, and whether ungrounded claims should trigger warnings or be silently labeled. See `docs/appendix/CONTEXTUALIZED_AI_MODEL.md` § Confidence scoring, decision-037.
```

```ctx
type: task
id: task-127
status: open
---
Implement truth-marked prompt construction — Build the three-layer prompt assembly used by the server-side agent loop (task-112). (1) **System context layer**: template-driven system prompt with truth boundary markers ("The following is ACCEPTED ORGANIZATIONAL TRUTH"), agent identity, citation instructions, grounding behavior expectations. Configurable per workspace. (2) **Retrieved context layer**: format retrieved nodes with provenance metadata (node ID, type, status, creator, reviewer, revision, sensitivity, relationships). Each node wrapped in `--- ACCEPTED TRUTH: node ID ---` / `--- END NODE ---` delimiters for clear truth boundaries. (3) **Tool definition layer**: inject tool definitions with grounding-aware descriptions (e.g. "cite results when referencing", "state reasoning when proposing"). (4) **Token budget allocation**: configurable budget per layer (system, context, history, response headroom). Truncation strategy: drop lowest-relevance nodes first, summarize conversation history beyond window. Depends on task-114 (retrieval module), task-115 (prompt builder). See `docs/appendix/CONTEXTUALIZED_AI_MODEL.md` § Prompt construction.
```

```ctx
type: task
id: task-128
status: completed
---
Enable HTTP/3 (QUIC) transport on the Axum server from v1. Implemented: `quinn` 0.11, `h3` 0.0, `h3-quinn` 0.0 dependencies; `h3_server.rs` bridges QUIC connections to axum Router (all middleware applies); `tls.rs` manages TLS certs (PEM loading for production, self-signed dev cert auto-generation); `events.rs` provides `EventBus` (tokio::sync::broadcast, capacity 256) with `ServerEvent` (event_type, workspace_id, resource_id, actor_id, timestamp, data); `GET /events?workspace={id}` SSE endpoint streams real-time notifications (proposal_updated, review_submitted, config_changed), JWT-authenticated; TypeScript `subscribeToEvents()` method + `ServerEvent` interface added to `api-client.ts`; dev TCP bridge (`TRUTHTLAYER_DEV_TCP=true`) on same port for Node.js tooling (Node.js does not yet support HTTP/3 clients). QUIC config: ALPN h3, 0-RTT enabled, 15s keep-alive, 5min idle timeout. Integration test runner passes `TRUTHTLAYER_DEV_TCP=true` to server. Implements decision-038, resolves question-057. Related: task-098 (completed), risk-032 (resolved).
```

```ctx
type: task
id: task-129
status: open
---
Remove dev TCP bridge when Node.js supports HTTP/3 — The `TRUTHTLAYER_DEV_TCP=true` listener in `server/src/main.rs` exists because Node.js (v24) does not yet support HTTP/3/QUIC clients. Monitor Node.js `undici` HTTP/3 progress (nodejs/undici and nodejs/node issue #60122). When Node.js ships stable HTTP/3 fetch support: (1) update TypeScript `api-client.ts` to use HTTPS URLs (QUIC), (2) update integration test runner to remove `TRUTHTLAYER_DEV_TCP` env var, (3) remove the dev TCP listener from `main.rs`, (4) update smoke test and documentation. Low priority — the dev TCP bridge has no production impact. See risk-047, task-128.
```

```ctx
type: task
id: task-130
status: open
---
Document build prerequisites for ARM64 Windows — The `ring` cryptographic library (transitive dependency via `quinn`/`rustls`) requires LLVM/clang for ARM assembly compilation on `aarch64-pc-windows-msvc`. Document in `server/README.md` and project root `README.md`: (1) install LLVM via `winget install LLVM.LLVM` or from llvm.org, (2) ensure `C:\Program Files\LLVM\bin` is in PATH, (3) note this is only required for ARM64 Windows — x86_64 Windows and Linux/macOS do not require extra tooling. See risk-048.
```


```ctx
type: task
id: task-132
status: open
---
SSE event ID tracking and reconnection — The current `GET /events` SSE endpoint does not include event IDs or support `Last-Event-ID` for reconnection. Implement: (1) assign monotonically increasing `id` to each SSE event, (2) accept `Last-Event-ID` header from client, (3) replay missed events from a bounded buffer on reconnection, (4) update TypeScript `subscribeToEvents()` to send `Last-Event-ID` and automatically reconnect with exponential backoff. Important for reliable real-time updates when network is intermittent. See task-128, task-098.
```

```ctx
type: task
id: task-133
status: open
---
FileStore comment support — FileStore `get_proposal_comments` and `add_proposal_comment` are stubs (return empty/Ok). Implement file-backed comment persistence: store comments as part of the proposal JSON or as separate `data/comments/{proposalId}.json` files. Required for file-based deployments that need comment functionality. See task-113 (FileStore parity).
```

```ctx
type: risk
id: risk-047
status: accepted
severity: low
likelihood: certain
---
**Node.js HTTP/3 client gap** — Node.js (v24, undici) does not support HTTP/3/QUIC client connections. The production server speaks QUIC-only; Node.js tooling (integration tests, smoke scripts, VS Code extension host) requires the `TRUTHTLAYER_DEV_TCP=true` TCP bridge. **Impact**: dev-only; production clients (Chromium-based VS Code fork) support HTTP/3 natively. **Mitigation**: dev TCP bridge implemented (task-128); monitor Node.js upstream progress (task-129). **Risk level**: Low (no production impact; dev workaround in place).
```

```ctx
type: risk
id: risk-048
status: accepted
severity: low
likelihood: possible
---
**ARM64 Windows build dependency on LLVM/clang** — The `ring` crate requires LLVM/clang for ARM assembly compilation on `aarch64-pc-windows-msvc`. Without it, `cargo build` fails with "failed to find tool clang". **Impact**: affects ARM64 Windows developers only (x86_64 Windows, Linux, macOS unaffected). **Mitigation**: install via `winget install LLVM.LLVM`; document in build prerequisites (task-130). **Risk level**: Low (one-time setup per dev machine).
```
