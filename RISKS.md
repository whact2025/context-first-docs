# Project Risks

This document tracks potential risks and mitigation strategies for TruthLayer. The design is **agentic-first**: primary interface = in-process agent; one minimal review/apply surface; rich UIs optional. Mitigations reference `server/` (Rust context store), `src/store/`, `src/playground/`, `src/api-client.ts`, and `docs/`. For **canonical walkthroughs**, see [Hello World](docs/scenarios/HELLO_WORLD_SCENARIO.md) and [Conflict and Merge](docs/scenarios/CONFLICT_AND_MERGE_SCENARIO.md). For **production security**, see `docs/WHITEPAPER.md` §7.4, §7.5. For **agent-behavior guardrails** (personal data, trade secrets, external model boundary, heightened review, retention, provenance, workspace isolation, when in doubt propose), see `docs/reference/SECURITY_GOVERNANCE.md`. For **procurement and DPIA** (controller/processor, DSAR, retention, redaction vs crypto-shredding, subprocessor/LLM egress, residency), see `docs/reference/PRIVACY_AND_DATA_PROTECTION.md`. For **doc suite** (TruthLayer vs Office/Google Docs + Copilot/Gemini), whitepaper §2.4, §6.9. For **Word/Excel/Google** (optional), `docs/appendix/DOCX_REVIEW_INTEGRATION.md`.

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
- Canonical store behavior in Rust server (server/); TS keeps apply + graph in src/store/core/ for preview and tests; conflict/traversal to be extended in server.
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
