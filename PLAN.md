# Development Plan

This document tracks the development roadmap and milestones for TruthLayer.

- **Source of truth for product/architecture:** [docs/](docs/README.md).
- **TruthLayer** = **Ratify truth. AI with Guardrails for Security & Compliance**: a truth ledger + collaboration layer. **ACAL** (Accepted → Candidate → Accepted → Ledger): humans ratify, guardrails enforce; minimal governance UI **required**.
- **The Agent** (we build it) uses the agent-safe API; deployment is optional (in-process or API). The solution **provides an MCP server** so AI assistants (Cursor, Claude Desktop, etc.) can use TruthLayer as a native tool. See `docs/core/ARCHITECTURE.md`, `docs/WHITEPAPER.md`, `docs/core/UI_SPEC.md`, `docs/core/AGENT_API.md`.
- **UI**: One **minimal governance UI** is required (list proposals, accept/reject/apply). Optional: full Web UI, VS Code, Word/Google. See `docs/core/UI_SPEC.md`.
- **Canonical walkthroughs**: [Hello World](docs/scenarios/HELLO_WORLD_SCENARIO.md) (proposal → review → apply) and [Conflict and Merge](docs/scenarios/CONFLICT_AND_MERGE_SCENARIO.md) — run via playground Scenario Runner (`npm run playground`).
- **The Agent / Contextualize**: Phase 5; design in `docs/appendix/CONTEXTUALIZED_AI_MODEL.md`, `docs/core/AGENT_API.md` (retrieval, prompt building, optional agent loop; prompt-leakage policy). Agent reads truth and creates proposals only; never review/apply.
- **Security & Compliance**: Guardrails by design per `docs/WHITEPAPER.md` (RBAC, audit logs, policy hooks, data residency, LLM safety). See `docs/reference/SECURITY_GOVERNANCE.md` for the security model.
- **Decisions**: Key decisions in `DECISIONS.md` (e.g. agent boundary, DOCX projection, Word/Google flow).
- **Doc suite**: TruthLayer does not replace doc suites; many orgs use both. See `docs/WHITEPAPER.md` (competitive positioning, “enterprise foundation”).
- **Word/Google review**: Optional bidirectional flow and context visualization: `docs/appendix/DOCX_REVIEW_INTEGRATION.md`.

**Current implementation (from code):** **Rust server** in `server/`: ContextStore trait, InMemoryStore, config from server config root, Axum HTTP API (nodes, proposals, reviews, apply, reset). **TypeScript**: `src/api-client.ts` (RustServerClient), `src/store/core/` (apply-proposal, graph, node-key), `src/store/preview-store.ts` (Map-backed preview for projection), Markdown projection and ctx blocks in `src/markdown/`, playground and Scenario Runner in `src/playground/`. Playground uses the Rust server for ACAL store; scenarios call `store.reset()` before each run. Coverage tests in `tests/store-core.coverage.test.ts` for applyAcceptedProposalToNodeMap and graph helpers. Persistence (file-based, MongoDB), full query/traversal/conflict in the server, GraphQL layer, and minimal governance UI are next per phases below and `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md`.

**Server and configuration:** Agent deployments use a **server component** (local or remote). All runtime configuration—storage backend and paths, RBAC provider, and other runtime settings—lives in a **predefined location relative to the server** (config root). No repo-scattered runtime config. See QUESTIONS.md question-038 (storage/workspace config), question-007 (RBAC provider abstraction). The Rust server in `server/` (see `server/README.md`) is the reference implementation; extend with file/MongoDB backends, full query/traversal/conflict, RBAC.

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

**Phase 2: Persistence & Storage Implementations** (Next)
1. ✅ Rust server provides InMemoryStore baseline (server/); TS retains apply-proposal + graph in `src/store/core/` for preview and tests; coverage tests in `tests/store-core.coverage.test.ts` (see `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md` Phase 1)
2. Storage abstraction layer - storage factory, **configuration from server config root** (backend choice, paths, RBAC provider config; see question-038), backend selection (see Phase 2)
3. File-based storage implementation - JSON graph format; paths **under server config root** (e.g. `data/workspaces/{workspaceId}/` or equivalent; see question-038, STORAGE_ARCHITECTURE.md Phase 3)
4. MongoDB storage implementation - self-hosted MongoDB document database (for production/scaling); connection/config from server config root (see Phase 4)
5. GraphQL API layer - schema definition, resolvers, type validation; authentication/authorization via **RBAC provider abstraction** (question-007)
6. Conflict detection and resolution - build on the baseline (conflict detection, field-level merge, optimistic locking) with manual resolution + superseding workflow (see Phase 6). To be implemented in the **Rust server** (or extended there); canonical walkthrough: [Conflict and Merge scenario](docs/scenarios/CONFLICT_AND_MERGE_SCENARIO.md).
7. Decision/rationale traversal (provenance chains) - typed relationship paths, context building, decision reasoning (see Phase 7)
8. Issue creation system - create issues from approved proposals (see Phase 8)
9. Reference tracking - bidirectional references, automatic updates (see Phase 9)
10. Git integration - automatic commits (file-based), snapshots (MongoDB), commit tracking (see Phase 10)

**See**: `docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md` for detailed gap analysis, implementation tasks, and timeline

**Phase 3: Authoring & Review System**
1. Implement proposal authoring APIs and helpers
2. Add risk authoring tools and validation
3. Create authoring helpers for all node types (decisions, tasks, questions, etc.)
4. Implement role and permission system (contributors, approvers, admins); **roles supplied by RBAC provider abstraction** (Git/GitLab, Azure AD, DLs, or configured provider per question-007; provider config in server config root)
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
17. **Audit export**: Standard format for exporting proposals/reviews for compliance (store holds data; see `docs/WHITEPAPER.md`, `docs/reference/SECURITY_GOVERNANCE.md` for audit roadmap).
18. **Bidirectional flow (Word/Google)** (optional): See `docs/appendix/DOCX_REVIEW_INTEGRATION.md`.
19. **Context relationship visualization** (optional): See `docs/appendix/DOCX_REVIEW_INTEGRATION.md`.

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
status: in-progress
---
Implement file-based storage layer for context store (JSON graph format; example path: `.context/graph.json`).
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
status: open
---
Implement role and permission system - contributors, approvers, and admins with proper access control.
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
status: open
---
Add role validation - check permissions before allowing proposal creation, review, and approval actions.
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
status: open
---
Implement storage abstraction layer - storage factory, **configuration read from server config root** (storage backend, paths, RBAC; see question-038), storage backend selection (file-based, MongoDB, memory).
```

```ctx
type: task
id: task-048
status: open
---
Implement file-based storage - FileBasedStore class, JSON Graph file management under **server config root** (e.g. data/workspaces/{workspaceId}/), Git integration, file locking/concurrency.
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
status: open
---
Implement conflict detection and resolution - conflict detection algorithm, field-level merging, optimistic locking, proposal superseding.
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
status: open
---
Implement explicit “applied” state for proposals (distinct from “accepted”) so UIs can reliably show Accepted vs Applied and prevent re-apply.

Notes:
- Add `appliedAt`/`appliedBy` (and optional `appliedRevision`) metadata.
- Expose via store/API so all clients behave consistently.
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
