# Project Risks

This document tracks potential risks and mitigation strategies for TruthLayer. The design is **agentic-first**: primary interface = in-process agent; one minimal review/apply surface; rich UIs optional. Mitigations reference `server/` (Rust context store), `src/api-client.ts`, `src/types/`, `src/markdown/`, and `docs/`. For **canonical walkthroughs**, see [Hello World](docs/scenarios/HELLO_WORLD_SCENARIO.md) and [Conflict and Merge](docs/scenarios/CONFLICT_AND_MERGE_SCENARIO.md). For **production security**, see `docs/WHITEPAPER.md` §7.4, §7.5. For **agent-behavior guardrails** (personal data, trade secrets, external model boundary, heightened review, retention, provenance, workspace isolation, when in doubt propose), see `docs/reference/SECURITY_GOVERNANCE.md`. For **procurement and DPIA** (controller/processor, DSAR, retention, redaction vs crypto-shredding, subprocessor/LLM egress, residency), see `docs/reference/PRIVACY_AND_DATA_PROTECTION.md`. For **doc suite** (TruthLayer vs Office/Google Docs + Copilot/Gemini), whitepaper §2.4, §6.9. For **Word/Excel/Google** (optional), `docs/appendix/DOCX_REVIEW_INTEGRATION.md`.

```ctx
type: risk
id: risk-001
status: accepted
severity: medium
likelihood: possible
---
**Risk**: Developers may find ctx blocks intrusive or confusing.

**Mitigation**:
- Provide clear documentation and examples
- Make ctx blocks optional for simple use cases
- Ensure Markdown still renders correctly even if ctx blocks are ignored
- Create reverse engineering tools for extracting historical context from existing documentation
- Use the project itself as a demonstration
```

```ctx
type: risk
id: risk-002
status: accepted
severity: high
likelihood: possible
---
**Risk**: Context store and Markdown files may drift out of sync.

**Mitigation**:
- Enforce deterministic projection (same store = same Markdown/DOCX)
- Provide validation tools to detect drift
- Make import/export operations explicit and auditable
- Consider read-only Markdown files (generated only)
- Test this extensively in the self-referential project
```

```ctx
type: risk
id: risk-003
status: accepted
severity: low
likelihood: unlikely
---
**Risk**: Performance issues with large context graphs.

**Mitigation**:
- Design for scalability from the start
- Support namespacing and filtering
- Consider lazy loading and pagination
- Benchmark early and often
- Use the project's own growing context as a test case
```

```ctx
type: risk
id: risk-004
status: accepted
severity: medium
likelihood: possible
---
**Risk**: Self-referential documentation may become circular or confusing.

**Mitigation**:
- Keep a clear separation between "how the system works" and "how we use it"
- Maintain traditional docs/ directory for implementation details
- Use examples/ directory for non-self-referential examples
- Ensure the system can document itself without creating confusion
```

```ctx
type: risk
id: risk-005
status: accepted
severity: low
likelihood: unlikely
---
**Risk**: The system may be too complex for simple use cases.

**Mitigation**:
- Provide simple defaults and sensible conventions
- Make advanced features optional
- Create quick-start guides
- Ensure basic usage is straightforward
```

```ctx
type: risk
id: risk-006
status: accepted
severity: medium
likelihood: possible
---
**Risk**: Store semantics diverge across providers (in-memory vs file-based vs MongoDB), causing inconsistent query/conflict behavior.

**Mitigation**:
- Canonical store behavior in Rust server (server/); TS store core has been removed — all store logic lives exclusively in the Rust server. Conflict/traversal to be extended in server.
- Keep providers focused on persistence/indexing and reuse core functions wherever possible.
- Maintain targeted coverage tests for core behavior to prevent regressions.
- See `docs/scenarios/CONFLICT_AND_MERGE_SCENARIO.md` for conflict/merge/stale behavior and playground scenarios.
```

```ctx
type: risk
id: risk-007
status: accepted
severity: low
likelihood: possible
---
**Risk**: Strict ctx-block validation causes “silent drops” of invalid blocks, confusing authors.

**Mitigation**:
- UI should surface parse/validation errors inline (highlight invalid `type`/`status`).
- Provide quick fixes / suggestions where safe.
- Keep a clear audit trail when content is rejected or corrected.
```

```ctx
type: risk
id: risk-008
status: accepted
severity: medium
likelihood: possible
---
**Risk**: Docs-style anchored comments may drift as text changes (ranges no longer point at the intended snippet), causing reviewer feedback to become confusing or appear “misplaced”.

**Mitigation**:
- Anchor primarily to **semantic identity** (`nodeId` + `field`), and treat range offsets as optional enhancements.
- Persist an optional **quote/snippet** with the anchor so clients can attempt best-effort re-anchoring.
- When re-anchoring fails, clearly surface “stale anchor” state and fall back to field-level attachment (still on the right node/field).
- Prefer deterministic projections so regeneration doesn’t change meaning; avoid anchoring to Markdown line numbers.
- Add tests for storing/querying anchored comments and for preserving anchors across proposal/review lifecycles.
```

```ctx
type: risk
id: risk-009
status: accepted
severity: medium
likelihood: likely
---
**Risk**: UI confusion between **Accepted** (reviewed) and **Applied** (truth mutated) leads to incorrect user expectations, duplicated applies, or “why didn’t it change?” incidents.

**Mitigation**:
- Represent “applied” explicitly in the data model (`appliedAt`/`appliedBy`), not inferred from node state.
- UI must always show proposal state clearly: open / accepted / rejected / withdrawn / applied.
- After accept, present “Accepted but not applied” with a dedicated Apply CTA (policy-gated).
```

```ctx
type: risk
id: risk-010
status: accepted
severity: high
likelihood: possible
---
**Risk**: Multi-workspace/tenancy is underspecified, causing accidental cross-workspace data leakage in UI queries, proposal review queues, comments, or projections.

**Mitigation**:
- Define a first-class workspace boundary early (store instance vs namespace vs explicit workspaceId) and enforce it in the API.
- Add tests for workspace scoping on all read/write paths (nodes, proposals, reviews, comments, projections).
- UI should never “fall back” to global searches without an explicit workspace selector.
```

```ctx
type: risk
id: risk-011
status: accepted
severity: medium
likelihood: possible
---
**Risk**: Policy/roles UI implies enforcement that the server does not yet guarantee, creating a false sense of governance and auditability.

**Mitigation**:
- Treat policy displays as “preview” until server enforcement exists; clearly label enforcement status.
- Centralize policy evaluation server-side and return explicit “blocked/required approvals” results to all clients.
- Maintain an audit trail for policy evaluation and apply actions in enterprise deployments (roadmap).
- For secure deployment today: see **Production posture today** table in `docs/WHITEPAPER.md` §7.4 (gateway, approvers-only for review/apply, disable reset, log vendor prompts, audit split) and §7.5 (enterprise-grade summary).
```

```ctx
type: risk
id: risk-012
status: accepted
severity: high
likelihood: possible
---
**Risk**: When using a **vendor LLM** for contextualized inference (RAG or structured prompting), sensitive context included in prompts leaves the perimeter; misconfiguration or over-retrieval can leak goals, decisions, risks, or PII.

**Mitigation**:
- Treat retrieval and prompt building as a controlled pipeline: topic-scoped retrieval, namespace/type allowlists, redaction, and a max context budget (see `docs/appendix/CONTEXTUALIZED_AI_MODEL.md` §3.3).
- Introduce a **policy interface**: sensitivity labels on nodes/namespaces, a retrieval policy module (allow/deny by destination e.g. vendor_llm), and logging of node IDs included in each prompt (§3.4). Policy layer wraps retrieval; store remains agnostic.
- Prefer self-hosted or private-VPC LLM when context must not leave the perimeter; use vendor LLM only with explicit policy and audit.
- Implement retrieval policy module and sensitivity support as roadmap (see PLAN Phase 5).
```

```ctx
type: risk
id: risk-013
status: accepted
severity: high
likelihood: possible
---
**Risk**: Fine-tuning export or RAG retrieval accidentally includes **proposed or rejected** nodes (e.g. query override or misconfiguration), so the model or answers are grounded in non-truth.

**Mitigation**:
- Export pipeline and retrieval for contextualized AI must **default to** and **enforce** `status: ["accepted"]` unless explicitly allowed by policy (e.g. "include proposed for internal-only preview").
- Document the contract in CONTEXTUALIZED_AI_MODEL and Phase 5; add validation or assertions in export/retrieve modules that accepted-only is used for vendor/training paths.
- Audit what was exported (node IDs, status filter) per export run; see question-030.
```

```ctx
type: risk
id: risk-014
status: accepted
severity: medium
likelihood: possible
---
**Risk**: Optional **vector index** (Phase 5) becomes stale relative to the store — delay between store update and index rebuild causes retrieval to return outdated context.

**Mitigation**:
- Document rebuild policy (on-write vs periodic vs manual) and expected staleness; consider "index as of" or snapshot id in retrieval response for transparency.
- Prefer store-as-source-of-truth: vector index is a performance optimization; critical paths can bypass index and query store directly when freshness matters.
- See question-031.
```

```ctx
type: risk
id: risk-015
status: accepted
severity: low
likelihood: possible
---
**Risk**: Adopters confuse TruthLayer with the **doc suite feature set** (Office/Google Docs + Copilot/Gemini) or expect TruthLayer to replace document-centric truth and consumption across the full suite and messaging apps (Teams, Chat, Slack, email), including drafting discussions and emails.

**Mitigation**:
- Document clear positioning: doc suite + Copilot/Gemini establish and consume truth for **document-centric** workflows (policy, contracts, SOPs, strategy; consumption across suite and messaging; drafting discussions/emails). TruthLayer targets **solution modeling** and **agent-safe structured truth** (typed graph, proposal/review/apply, accepted-only reads, deterministic projection, provenance). Many orgs use both (whitepaper §2.4, §6.9, decision-027).
- In PLAN Phase 6: document "when to use which" for adopters; optional future integration points (e.g. export context to Doc for Copilot/Gemini) if needed.
```

```ctx
type: risk
id: risk-016
status: accepted
severity: high
likelihood: possible
---
**Risk**: Agents or users embed **personal data, confidential IP, or unnecessary narrative** into accepted truth, or blend rationale with truth, reducing GDPR compliance, IP protection, and auditability.

**Mitigation**:
- Follow guardrail behavior in `docs/reference/SECURITY_GOVERNANCE.md`: Personal data sensitivity (anonymize, flag for review); Truth scope discipline (structural references over personal details); Immutability with redaction (dedicated fields, avoid irreversible narrative); Trade secret awareness (abstraction over disclosure); Retention awareness (concise proposals, ephemeral discussion for context); Provenance and justification (separate what/why/sources from truth); When in doubt, propose don’t apply (surface uncertainty to reviewers).
- Apply agent hints in `docs/core/AGENT_API.md` (personal data: detect/prefer anonymized/flag + heightened review; rewrite narrative into dedicated redactable fields; summarizing: default to abstraction, redacted projection for broad audience; additional reviewers for sensitive domains). See `docs/reference/PRIVACY_AND_DATA_PROTECTION.md` for redaction vs crypto-shredding policy and DSAR workflow.
- Wire guardrail guidance into agent docs and prompts (PLAN Phase 5 item 10); consider heightened review triggers for sensitive domains (SECURITY_GOVERNANCE § Heightened review triggers).
```

```ctx
type: risk
id: risk-017
status: accepted
severity: high
likelihood: possible
---
**Risk**: Content from one **workspace** is reused or inferred in another (e.g. in retrieval or prompts), causing IP or GDPR purpose-limitation violations.

**Mitigation**:
- Treat workspace boundaries as hard trust and data-isolation limits per `docs/reference/SECURITY_GOVERNANCE.md` § Workspace isolation. Do not assume information from one workspace can be reused in another unless explicitly authorized.
- Enforce workspace scoping on all read/write paths (risk-010); add retrieval and prompt-building policy to restrict context to a single workspace unless policy allows cross-workspace (QUESTIONS.md question-041).
```

```ctx
type: risk
id: risk-018
status: accepted
severity: medium
likelihood: possible
---
**Risk**: Data sent to **external models** (vendor LLMs, external APIs) includes confidential or personal data because agents or UIs do not treat the workspace boundary as a confidentiality boundary.

**Mitigation**:
- Follow `docs/reference/SECURITY_GOVERNANCE.md` § External model boundary: avoid including confidential or personal data for external models unless policy allows; prefer high-level descriptions over verbatim content; flag when a proposal assumes external processing.
- Apply agent hint in `docs/core/AGENT_API.md` § External model usage: treat external model use as policy-governed; assume no egress if workspace policy unknown; when allowed, avoid verbatim sensitive content. See `docs/reference/PRIVACY_AND_DATA_PROTECTION.md` § Subprocessor and LLM egress (allowlist/denylist, no-egress mode, residency).
- Combine with prompt-leakage controls (risk-012) and retrieval policy (CONTEXTUALIZED_AI_MODEL); align agent behavior with future LLM routing policies.
```

```ctx
type: risk
id: risk-019
status: accepted
severity: high
likelihood: likely
---
**Risk**: Retention engine and DSAR erase are deployed as stubs (log audit events only; no actual deletion, archiving, or data mutation), creating a **compliance gap** if customers assume these features are fully operational. Procurement reviewers or DPIAs may accept the system based on documented capabilities that are not yet enforced.

**Mitigation**:
- Clearly label retention and DSAR erase as "partial / stub" in all customer-facing documentation, API responses, and admin UI (do not imply enforcement).
- Prioritize task-075 (retention enforcement) and task-076 (DSAR erase) in Phase 7 before production deployment to regulated customers.
- Add a startup warning or health-check flag when retention/DSAR enforcement is disabled so operators know the state.
- Track question-042 (DSAR tooling) and question-043 (retention timeline) as blockers for regulated deployment.
```

```ctx
type: risk
id: risk-020
status: accepted
severity: high
likelihood: likely
---
**Risk**: The server currently operates as **single-workspace**. Enterprise customers requiring workspace isolation (data partitioning, per-workspace RBAC policies, cross-workspace leakage prevention) cannot adopt without multi-workspace support, blocking enterprise scaling.

**Mitigation**:
- Prioritize task-077 (multi-workspace server support) and task-062 (workspace/tenancy model) in Phase 7.
- Design workspaceId partitioning before MongoDB implementation to avoid costly schema rework.
- Add integration tests for cross-workspace leakage prevention on all read/write paths.
- See risk-010 (cross-workspace leakage), question-050 (multi-tenant deployment model), question-041 (workspace isolation in retrieval).
```

```ctx
type: risk
id: risk-021
status: accepted
severity: high
likelihood: possible
---
**Risk**: **MongoDB backend** is recommended for production/scaling (question-004, question-012, question-026) but has no implementation started (task-049 open). Enterprise customers needing >1000 nodes, concurrent access, or ACID transactions have no production-ready storage backend. File-based storage does not scale and has concurrency limitations.

**Mitigation**:
- Prioritize task-049 (MongoDB storage) as a critical-path item. Consider implementing before or in parallel with Phase 3 authoring features.
- Define migration path from file-based to MongoDB (question-046) early to avoid data-loss risk during transition.
- Establish performance benchmarks (task-081) for file-based storage to clearly communicate its scalability limits to adopters.
- Consider interim guidance: "file-based for development and small teams (<1000 nodes); MongoDB required for production" in adoption documentation.
```

```ctx
type: risk
id: risk-022
status: accepted
severity: medium
likelihood: likely
---
**Risk**: **No load testing or performance benchmarks** exist. Production behavior under concurrent agents, large graphs (10K+ nodes), deep traversal queries, and sustained audit log growth is unknown. Performance regressions may be introduced without detection.

**Mitigation**:
- Implement task-081 (load testing and performance benchmarks) before production deployment.
- Establish baselines for: concurrent proposal creation, large graph query latency, traversal depth performance, audit log query at scale.
- Add performance regression tests to CI (e.g. benchmark suite that fails if latency exceeds threshold).
- Use benchmarks to inform file-based → MongoDB migration guidance (risk-021, question-012).
```

```ctx
type: risk
id: risk-023
status: accepted
severity: high
likelihood: likely
---
**Risk**: The **projection engine** is a dependency for multiple downstream features (change detection, bidirectional sync, DOCX review, context relationship visualization) but has no implementation tasks started. Delays in projection engine (task-071) cascade to Phase 3 items 7, 20, 21 and Phase 6 items 5, 6, blocking the authoring workflow.

**Mitigation**:
- Prioritize task-071 (projection engine) early in Phase 3 as a critical dependency.
- Resolve question-049 (Rust vs TypeScript for projection) before starting implementation to avoid rework.
- Design projection templates and anchor map format as a separate design task before full implementation.
- Accept that current TypeScript projection in `src/markdown/` may serve as interim for development; plan explicit migration or coexistence strategy.
```

```ctx
type: risk
id: risk-024
status: accepted
severity: medium
likelihood: likely
---
**Risk**: **Phase 5 (The Agent / Contextualize)** has deep dependencies on many open Phase 3 and Phase 4 items (full NodeQuery, traversal APIs on HTTP, conflict detection on HTTP, MCP server, projection engine). If these prerequisites slip, the agent implementation—the product's primary differentiator—is delayed.

**Mitigation**:
- Map Phase 5 prerequisites explicitly and track as a critical path: task-073 (full NodeQuery), task-074 (conflict on HTTP), task-082 (MCP server), and Phase 4 traversal APIs.
- Consider a "minimal agent" milestone that requires only existing HTTP API capabilities (current query + create proposal) to unblock early agent development while full APIs are built.
- Decouple retrieval module (Phase 5 item 2) from full traversal APIs by implementing basic queryNodes-based retrieval first.
- Track dependency chain in project management (PLAN or issue tracker) to surface delays early.
```

```ctx
type: risk
id: risk-025
status: accepted
severity: high
likelihood: possible
---
**Risk**: The **AI Compliance Gateway** (Phase 8) introduces a latency-sensitive proxy layer between callers and external LLMs. Prompt inspection, policy evaluation, and response filtering add overhead on every request. If latency is too high, users will bypass the gateway or reject the product.

**Mitigation**:
- Design the gateway as an Axum middleware layer (not a separate network hop) to minimize latency.
- Implement prompt inspection as a streaming pipeline — inspect as content is buffered, not after full assembly.
- Benchmark gateway overhead early: target <50ms added latency for policy evaluation + prompt inspection (excluding model call time).
- Provide a "passthrough" mode for trusted internal models where only audit logging is performed (no inspection/filtering).
- Related: task-085 (gateway middleware), task-087 (prompt inspection), question-052 (architecture), question-055 (streaming).
```

```ctx
type: risk
id: risk-026
status: accepted
severity: high
likelihood: likely
---
**Risk**: **External LLM API diversity** (OpenAI, Anthropic, Google, Azure OpenAI, self-hosted) means the gateway must support multiple API formats, authentication schemes, streaming protocols, and error handling patterns. Maintaining compatibility as providers change APIs is an ongoing burden.

**Mitigation**:
- Abstract the provider interface behind a trait (`ModelProvider`) with per-provider implementations. Start with OpenAI-compatible API (covers OpenAI, Azure OpenAI, and many self-hosted models) as the primary target.
- Use OpenAI-compatible format as the gateway's internal request/response format; add Anthropic and Google adapters as needed.
- Pin provider SDK versions and add integration tests with mock endpoints for each supported provider.
- Monitor provider API changelogs and version gateway adapters independently.
- Related: task-085 (gateway middleware), task-091 (model routing config).
```

```ctx
type: risk
id: risk-027
status: accepted
severity: medium
likelihood: possible
---
**Risk**: **Prompt inspection may produce false positives** — blocking or redacting content that is not actually sensitive, degrading the quality of model responses and user trust in the gateway.

**Mitigation**:
- Implement configurable inspection modes: strict (block on any match), moderate (redact matched content), and advisory (log but pass through).
- Use node-level sensitivity labels (already implemented) as the authoritative source — don't rely on content scanning heuristics alone.
- Provide an audit trail of redaction decisions so admins can review false positives and tune policies.
- Allow per-workspace sensitivity thresholds (e.g., some workspaces allow Internal content to egress, others only Public).
- Related: task-087 (prompt inspection), question-053 (multi-sensitivity handling).
```

```ctx
type: risk
id: risk-028
status: accepted
severity: high
likelihood: possible
---
**Risk**: The gateway creates a **single point of failure** for all external AI model interactions. If the gateway is unavailable, all LLM-dependent workflows stop — potentially more disruptive than direct model access.

**Mitigation**:
- Design for high availability: stateless gateway middleware (no session state) enables horizontal scaling and load balancing.
- Implement circuit breakers for external model endpoints with configurable fallback behavior (queue, retry, fail-open with audit).
- Provide a degraded mode where the gateway passes requests through with audit-only (no inspection/filtering) during gateway component failures.
- Health check endpoints for the gateway layer, independent of external model availability.
- Related: task-085 (gateway middleware), task-092 (gateway observability), question-052 (architecture).
```

```ctx
type: risk
id: risk-029
status: accepted
severity: medium
likelihood: likely
---
**Risk**: **Phase 8 depends on the MCP server** (task-082, Phase 4 item 7) for the MCP gateway mode (task-090). If the MCP server is not implemented or is delayed, the gateway's primary integration surface for AI assistants is unavailable — limiting the gateway to direct HTTP API usage only.

**Mitigation**:
- Implement the gateway HTTP API (task-085) independently of MCP — it can serve non-MCP clients immediately.
- Prioritize MCP server (task-082) as a prerequisite; track in critical path alongside Phase 5 dependencies (risk-024).
- Design the gateway middleware layer so MCP gateway mode (task-090) is an extension, not a replacement, of the HTTP gateway API.
- Related: task-082 (MCP server), task-090 (MCP gateway mode), question-056 (MCP + gateway interaction), risk-024 (Phase 5 dependencies).
```

```ctx
type: risk
id: risk-030
status: accepted
severity: high
likelihood: likely
---
**Risk**: **VS Code fork maintenance burden.** Upstream rebases may break fork-only features when Microsoft changes editor rendering internals (`viewLineRenderer`, `TextModel`, margin components). Monthly VS Code releases mean ongoing rebase effort; breaking changes may require significant rework of proposal mode, anchored comments, and agent inline editing.

**Mitigation**:
- Isolate all fork changes in a new directory (`src/vs/editor/contrib/truthlayer/`) that does not conflict with upstream.
- Maintain an `upstream/main` tracking branch with automated CI that builds against latest upstream to detect breakage early.
- Monthly rebase cadence aligned with VS Code release cycle.
- Fork-only features are additive — if one breaks, extensions still work. No extension depends on the fork layer.
- Related: task-104 (fork setup), task-105 (fork features), `.cursor/plans/truthlayer_ide_analysis_4f3e7459.plan.md`.
```

```ctx
type: risk
id: risk-031
status: accepted
severity: medium
likelihood: likely
---
**Risk**: **WebView theming and state persistence.** All 6 extensions use WebView panels for rich UIs. WebViews must respect VS Code's dark/light/high-contrast themes (via CSS variables), and they lose their DOM state when the tab is hidden and restored. Poor theming breaks in dark mode; state loss forces users to re-navigate panels.

**Mitigation**:
- Inject VS Code theme CSS variables (`--vscode-*`) into all WebView panels; test in both light and dark themes.
- Use VS Code's `getState()`/`setState()` WebView API to persist panel state across hide/show cycles.
- Create a shared WebView utility library (part of `@truthlayer/client` or a separate internal package) that handles theming and state for all extensions consistently.
- Related: task-099 through task-102 (extension development), question-058 (WebView framework).
```

```ctx
type: risk
id: risk-032
status: resolved
severity: high
likelihood: possible
---
**Risk**: **REST-only server limits IDE responsiveness.** The Rust server has no WebSocket or SSE support. Extensions must poll for proposal updates, review changes, and audit events. Polling creates stale data (user sees outdated proposal status), wasted bandwidth, and poor UX compared to real-time push.

**Resolution**: SSE implemented over HTTP/3 (task-128, task-098). `GET /events?workspace={id}` streams real-time notifications (proposal_updated, review_submitted, config_changed) with 15s keep-alive. EventBus publishes events on all state-changing routes. TypeScript `subscribeToEvents()` client added. Extensions can subscribe to live event streams — no polling required. Remaining: event ID tracking and reconnection (task-132) for reliable delivery.

**Original mitigation**:
- ~~Implement polling with a configurable interval~~ — superseded by SSE.
- ~~Plan WebSocket or SSE server endpoint (question-057)~~ — SSE chosen and implemented (decision-038).
- Design extension code with a `SubscriptionProvider` abstraction so switching from polling to push requires no UI changes — still recommended for testing.
- Related: task-098 (completed), task-128 (completed), question-057 (resolved).
```

```ctx
type: risk
id: risk-033
status: accepted
severity: medium
likelihood: likely
---
**Risk**: **ContextStore interface bloat.** `src/types/context-store.ts` defines ~20 methods but only ~8 are implemented by `RustServerClient`. The rest are stubs returning empty arrays or throwing "not implemented." Extensions building against this interface will encounter dead methods, confusing developers and causing runtime errors.

**Mitigation**:
- Trim the `ContextStore` interface to match actual server capabilities before publishing `@truthlayer/client` (task-096).
- Move aspirational methods (not yet implemented) to a separate `ContextStoreExtended` interface or mark them with `@experimental` JSDoc tags.
- Extensions should type-check against the trimmed interface, not the full one.
- Related: task-095 (shared library packaging), task-096 (interface cleanup), question-060.
```

```ctx
type: risk
id: risk-034
status: accepted
severity: medium
likelihood: possible
---
**Risk**: **Cursor compatibility.** Extensions must work in vanilla VS Code AND Cursor (itself a VS Code fork). Cursor's fork may have divergent Extension API behavior, missing APIs, or additional restrictions. Extensions tested only in VS Code may break silently in Cursor.

**Mitigation**:
- CI testing in both vanilla VS Code and Cursor for all 6 extensions.
- Avoid Cursor-specific APIs; use only standard VS Code Extension API.
- Document known Cursor differences and workarounds.
- The extension pack (task-103) must be tested in both environments before publishing.
- Related: question-058 (WebView framework may behave differently in Cursor).
```

```ctx
type: risk
id: risk-035
status: accepted
severity: high
likelihood: likely
---
**Risk**: **Fork-only features resist AI generation.** VS Code editor internals (`viewLineRenderer`, `TextModel`, margin components, `ICodeEditor` interfaces) are complex, sparsely documented, and change between releases. AI-driven development (Opus 4.6) may require significant human debugging time for Phase 9 fork features (semantic inline diffs, anchored comments, proposal mode, agent inline editing), as the AI must read and understand VS Code source to make correct modifications.

**Mitigation**:
- Build extensions first (Phase 9 items 7-11) — delivers immediate value with zero fork risk. Extensions are boilerplate-heavy and AI-friendly.
- Fork features are additive — if one is blocked, skip it; extensions still ship and work.
- Allocate extra time for Phase 9 items 12-13 (fork features are the highest-risk, highest-effort items).
- Consider implementing fork features incrementally: start with the simplest (branding), then semantic diffs, then proposal mode, then anchored comments (hardest).
- Related: task-104 (fork setup), task-105 (fork features), `.cursor/plans/truthlayer_ide_analysis_4f3e7459.plan.md` Phase 4.
```

```ctx
type: risk
id: risk-036
status: accepted
severity: high
likelihood: certain
---
**Risk**: **Type serialization mismatch between Rust server and TypeScript client.** The `Comment`, `CommentAnchor`, and `RelationshipMetadata` structs in the Rust server are missing `#[serde(rename_all = "camelCase")]`, causing them to serialize field names as snake_case (`created_at`, `node_id`, `resolved_by`). The TypeScript client expects camelCase (`createdAt`, `nodeId`, `resolvedBy`). This causes **silent data loss** -- fields evaluate to `undefined` in JavaScript with no error. Additionally, the server sends `{ redacted: true, reason: "sensitivity" }` for redacted nodes, but the TS `AnyNode` type has no `redacted` or `reason` fields.

**Mitigation**:
- Fix server-side: add `#[serde(rename_all = "camelCase")]` to all three structs (task-107). This is a one-line change per struct and is backward-compatible for JSON consumers.
- Fix TS types: add `redacted?: boolean` and `reason?: string` to `AnyNode` (task-110).
- Add integration tests that verify JSON field names match between Rust serialization and TS type definitions.
- These fixes are Gate 0 prerequisites -- must be completed before any extension development begins.
- Related: task-107, task-110, `docs/engineering/ui/SERVER_API_REQUIREMENTS.md` section 2.
```

```ctx
type: risk
id: risk-037
status: accepted
severity: medium
likelihood: certain
---
**Risk**: **Server returns only open proposals**, blocking UI from showing accepted, rejected, withdrawn, or applied proposals. The `GET /proposals` endpoint calls `get_open_proposals()` internally and has no status filter parameter. The `truthlayer.governance` extension needs to list proposals of all statuses (grouped by status in a TreeView). The TS client's `getRejectedProposals()` method always returns `[]` because it filters the server response client-side, but the server never returns non-open proposals.

**Mitigation**:
- Add `status` query parameter to `GET /proposals` (task-108). When `status` is not provided, return all proposals (not just open).
- Update both InMemoryStore and FileStore to support proposal status filtering.
- This is a Gate 0 prerequisite -- must be completed before `truthlayer.governance` extension development begins.
- Related: task-108, `docs/engineering/ui/SERVER_API_REQUIREMENTS.md` section 4.1.
```

```ctx
type: risk
id: risk-038
status: accepted
severity: high
likelihood: possible
---
**Risk**: **Server-side agent loop complexity** — The Cursor-pattern architecture (thin client extension, server runs agent loop with compliance gateway) concentrates significant complexity in the Rust server: multi-turn LLM orchestration, tool call execution, SSE streaming, conversation state management, context window management, and compliance gateway integration. This is a new capability area for the Rust server (previously REST-only CRUD) and creates a critical dependency between Phase 5 (Contextualize), Phase 8 (AI Compliance Gateway), and Phase 9 (agent extension).

**Mitigation**:
- Implement a minimal viable agent loop first: single-model routing + basic audit logging + SSE streaming (question-069). Layer in advanced gateway features (prompt inspection, response filtering, cost caps) progressively.
- Cap per-request iteration depth (e.g. max 10 tool-call rounds) and enforce request timeouts to prevent runaway agent loops.
- Use Axum's built-in SSE support (`axum::response::Sse`) for streaming — well-supported and production-tested.
- Design the agent loop as a composable pipeline (retrieve → prompt → gateway → model → tools → loop) with each stage independently testable.
- Add integration tests with mock LLM providers (canned responses + tool calls) to validate the full loop without external dependencies.
- Monitor server resource usage under concurrent agent sessions (each session holds an open SSE connection + in-flight LLM request).
- Related: task-112, question-067, question-068, question-069, risk-032 (REST limits), Phase 8 tasks.
```

```ctx
type: risk
id: risk-039
status: accepted
severity: medium
likelihood: possible
---
**Risk**: **Agent loop creates Phase 5/8 hard dependency for Phase 9** — The `truthlayer.agent` extension cannot function without the server-side agent loop (task-112), which in turn requires at minimum basic model routing and audit from Phase 8. This creates a longer critical path for the agent extension compared to other extensions that only need REST API.

**Mitigation**:
- Allow a minimal gateway shim (basic model config + audit logging) so the agent loop can ship before the full Phase 8 gateway is complete (question-069).
- Sequence Phase 9 so the agent extension is built last (after governance, audit, config), giving more time for Phase 5/8 prerequisites to be ready.
- If Phase 8 is delayed, the agent extension can ship with a "gateway-lite" mode (model routing + audit only, no prompt inspection/response filtering) with clear documentation that advanced compliance features are pending.
- Related: task-112, task-102, Phase 5, Phase 8, question-069.
```

```ctx
type: risk
id: risk-040
status: accepted
severity: high
likelihood: certain
---
**Risk**: **FileStore feature parity gaps** — FileStore is missing implementations for 7 ContextStore trait methods: `detect_conflicts`, `is_proposal_stale`, `merge_proposals`, `traverse_reasoning_chain`, `build_context_chain`, `follow_decision_reasoning`, `query_with_reasoning`. These methods return empty results or errors. Any deployment using file-based storage (`TRUTHTLAYER_STORAGE=file`) cannot use conflict detection, reasoning chain traversal, or provenance queries — core features for the agent and governance workflows. This is a silent degradation: the server starts successfully but critical functionality is unavailable.

**Mitigation**:
- Implement all missing methods in FileStore to achieve full parity (task-113).
- Add a shared integration test suite that runs against both InMemoryStore and FileStore, verifying identical behavior for all ContextStore methods.
- Add a startup warning log when FileStore is active and any trait method returns a "not implemented" error.
- Consider extracting shared logic from InMemoryStore into helper functions that both backends can use (many traversal methods only need node/edge access, not backend-specific logic).
- Related: task-113, `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md`.
```

```ctx
type: risk
id: risk-041
status: accepted
severity: medium
likelihood: likely
---
**Risk**: **Naming convention inconsistency across layers** — The codebase has three naming conventions in different layers: Rust (snake_case), JSON API (mostly camelCase but 3 types still snake_case), TypeScript (camelCase), documentation (mixed). The inconsistency causes runtime bugs (TS fields read as `undefined` from snake_case JSON) and developer confusion. As the codebase grows with the extension layer and agent loop, the inconsistency will compound.

**Mitigation**:
- Establish and document the naming convention in CONTRIBUTING.md (task-118): Rust internals = snake_case, JSON serialization = camelCase (via `#[serde(rename_all = "camelCase")]`), TypeScript = camelCase, HTTP URL paths = kebab-case.
- Fix the 3 remaining types (Comment, CommentAnchor, RelationshipMetadata) that serialize as snake_case (task-107, overlaps task-118).
- Add a CI check: compile-time test that serializes each public API type and asserts all JSON field names are camelCase.
- Audit all documentation references to field names and update to match the convention.
- Related: task-107, task-118, risk-036.
```

```ctx
type: risk
id: risk-042
status: accepted
severity: medium
likelihood: likely
---
**Risk**: **Silent error swallowing in server route handlers** — Several route handlers in `server/src/api/routes.rs` use `.ok()`, `.unwrap_or_default()`, or match-and-ignore patterns that silently discard errors. This means: (a) clients receive success responses when operations partially failed, (b) audit log entries may be silently lost, (c) debugging production issues is harder because errors leave no trace, (d) security-relevant failures (auth, RBAC) may not be recorded.

**Mitigation**:
- Audit all route handlers for silent error patterns (task-119).
- Replace `.ok()` / `.unwrap_or_default()` with explicit error handling that returns appropriate HTTP status codes.
- Ensure all error responses use a consistent structured format: `{ "error": "message", "code": "ERROR_CODE", "details": {...} }`.
- Ensure audit log writes are themselves error-handled (log a warning if audit write fails, but don't mask the original error).
- Add integration tests for error scenarios: malformed input (400), missing resources (404), policy violations (422), internal failures (500).
- Related: task-119, risk-038 (agent loop complexity depends on reliable error handling).
```

```ctx
type: risk
id: risk-043
status: accepted
severity: high
likelihood: possible
---
**Risk**: **Gateway single point of failure** — When the AI Compliance Gateway is active, all external model calls route through it. If the gateway (integrated in the Axum server) experiences high load, bugs, or resource exhaustion, all AI-dependent features (agent loop, MCP gateway mode, any application using the gateway) are blocked. There is no current HA or failover design.

**Mitigation**:
- Design connection pooling and circuit breakers for model provider connections (task-122).
- Implement backpressure: when concurrent agent sessions exceed a configurable limit, return 503 with retry-after header.
- Add health check endpoints for gateway components (model provider connectivity, policy engine status).
- Document operational guidance for horizontal scaling (multiple server instances behind a load balancer with sticky sessions for SSE streams).
- Consider a "bypass mode" for emergency situations where the gateway can be temporarily disabled (with full audit logging of the bypass).
- Related: task-122, risk-038, Phase 8.
```

```ctx
type: risk
id: risk-044
status: accepted
severity: medium
likelihood: possible
---
**Risk**: **Workspace isolation gaps in traversal and retrieval** — The architecture specifies that every object is scoped by workspaceId, but the traversal APIs (`traverse_reasoning_chain`, `build_context_chain`, etc.) and the future retrieval module may follow edges that cross workspace boundaries if the edge references a node in a different workspace. This could leak data between tenants.

**Mitigation**:
- Add workspace boundary checks to all traversal methods: before following an edge, verify the target node's workspaceId matches the query's workspace (task-121).
- Make workspaceId required (not optional) on all ContextStore query methods.
- Add integration tests with multi-workspace data that verify no cross-workspace leakage (task-121).
- Document the invariant: "traversals never cross workspace boundaries" in ARCHITECTURE.md.
- Related: task-121, `docs/core/ARCHITECTURE.md` § Tenancy.
```

```ctx
type: risk
id: risk-045
status: accepted
severity: medium
likelihood: likely
---
**Risk**: **Grounding classification accuracy** — The truth anchoring pipeline (decision-037) relies on semantic similarity to verify whether a model's citation actually supports its claim. Both false positives (marking a loosely related citation as "grounded") and false negatives (marking a valid paraphrase as "ungrounded") undermine trust in the grounding system. If the grounding indicators are unreliable, users will learn to ignore them — defeating the purpose.

**Mitigation**:
- Start with keyword overlap for MVP (simple, fast, explainable); graduate to sentence embeddings for production accuracy (task-126).
- Make grounding thresholds configurable per workspace — conservative enterprises can set high thresholds (more "ungrounded" flags, fewer false positives); teams that trust the model can lower them.
- Include a "grounding confidence" score (0.0–1.0) alongside the tier, so the UI can show granularity (e.g. 0.85 grounded vs 0.62 grounded).
- Build a grounding accuracy test suite: known-good citations (expect grounded), known-bad citations (expect ungrounded), known contradictions (expect contradicted). Run against each classifier implementation.
- Log grounding decisions in the audit trail — if a classification is later found incorrect, the evidence is available for debugging and improvement.
- The grounding system is a **signal, not a judgment** — documentation and UI must make clear that grounding tiers assist human reviewers but do not replace human judgment.
- Related: task-125, task-126, decision-037, `docs/appendix/CONTEXTUALIZED_AI_MODEL.md` § Truth anchoring pipeline.
```

```ctx
type: risk
id: risk-046
status: accepted
severity: low
likelihood: possible
---
**Risk**: **Grounding pipeline latency** — The truth anchoring pipeline adds post-processing to every model response: citation extraction, semantic verification, contradiction scanning, confidence scoring. If this adds significant latency (>500ms per turn), it degrades the chat UX. Streaming helps (tokens arrive immediately), but `grounding` events may lag behind `token` events if classification is slow.

**Mitigation**:
- Stream `token` events immediately as they arrive from the model; run grounding classification asynchronously and emit `grounding` events as they complete (not blocking the token stream).
- Use lightweight classification first (keyword overlap) for real-time grounding; optionally run a more accurate pass (sentence embeddings) asynchronously and emit updated grounding events.
- Cache node content for retrieved context — the grounding classifier needs to compare model claims against node content that was already retrieved for the prompt, so no additional store queries are needed.
- Benchmark the full pipeline (task-122) and set a p99 target for grounding classification latency.
- Related: task-125, task-126, task-122, risk-038 (agent loop complexity).
```
