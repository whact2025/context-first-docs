# Multi-Platform UI Specification — Context-First Docs (ACAL)

This document is the **clean-slate UI spec** for building the ACAL user interface(s).

ACAL (Agentic Collaboration Approval Layer) implements the core contract described in `docs/WHITEPAPER.md` and enforced by the `ContextStore` API:

- **Accepted truth is read-only.**
- **All writes are proposals** (human + agent).
- **Only reviews accept/reject** proposals.
- **Accepted proposals become truth only when applied** (apply is explicit and separate).
- **Markdown is a projection** (a view), not canonical truth.
- **Agent-safe defaults**: queries return accepted truth unless proposals are explicitly requested.

This spec covers:

- Web app (canonical UI)
- VS Code/Cursor extension (in-flow authoring + review)
- CLI (fast read/write workflows + CI checks)
- Agents (API clients; no direct UI)

---

## 0) Definitions (UI-level)

- **Truth**: accepted nodes (and their accepted relationships) in the store.
- **Proposal**: a suggestion represented as structured operations (create/update/move/status-change/insert/deleteText/delete).
- **Review**: the only mechanism that changes a proposal’s acceptance state (accept/reject).
- **Apply**: a separate, explicit action that mutates truth by applying an accepted proposal.
- **Projection**: derived view(s) generated deterministically from truth (Markdown, UI views, reports).
- **Anchor**: a stable reference for comments/feedback, typically `{ nodeId, field, range? }`.
- **Workspace**: a tenancy boundary for UI navigation. A workspace maps to a single store partition (see §2.6).

---

## 1) Product North Star

### 1.1 The promise

Google Docs/Word **review ergonomics**, but with a **typed solution graph** as canonical truth, enabling:

- deterministic, reproducible views (UI + Markdown) safe to store in Git
- explicit status semantics (accepted/proposed/rejected/superseded)
- agent-safe consumption and governance-grade provenance

### 1.2 Non-negotiable rules (UI must make these obvious)

1) **No direct edits to accepted truth** → “Propose change” is the primary action.
2) **All writes are proposals** (humans + agents).
3) **Only reviews accept/reject proposals**; **Apply** is explicit and separate.
4) **Structured truth, not documents**: canonical model is a typed graph.
5) **Markdown is a projection**; projection edits become suggestions (proposals); system updates only system-owned blocks.
6) **Agent-safe defaults**: accepted-only queries by default; explicit opt-in for proposals/drafts.
7) **Concurrency above line merges**: conflicts/staleness at proposal level; merge safe fields.
8) **Governance is part of the model**: roles, approvers, and enterprise approval policies (roadmap).

---

## 2) Platforms and Responsibilities

### 2.1 Clients

- **Web app (canonical UI)**: full browse/review/apply/conflict/projection flows; admin policy surfaces.
- **VS Code / Cursor extension**: in-flow authoring, proposal drafting, projection-aware “suggesting mode” overlays.
- **CLI**: fast querying, batch proposal submission, deterministic projection checks (CI).
- **Mobile (later)**: read + approve/reject + notifications (minimal authoring).

### 2.2 Multi-client lifecycle

All clients share one lifecycle:

`createProposal → submitReview → applyProposal → projections update`

Agents query accepted-only by default.

### 2.3 Responsibility split: UI vs server

**Server must enforce invariants**. UI must *reflect* them and provide ergonomic pathways.

- **Enforced server-side (non-negotiable)**:
  - accepted truth is not directly writable
  - accept/reject only via review
  - apply only for accepted proposals
  - agent-safe defaults in read APIs
- **UI guidance / prechecks (advisory, but valuable)**:
  - rationale required (pre-submit)
  - policy preview (required approvers, blocks)
  - staleness/conflict preview

---

## 3) Information Architecture

### 3.1 Global nav (consistent across clients)

1) **Explore (Graph)**
2) **Nodes**
3) **Proposals**
4) **Reviews (My queue)**
5) **Projections**
6) **Conflicts**
7) **Policy / Roles** (admin)
8) **Audit** (later; enterprise)

### 3.2 Web route map

- `/workspaces/:ws`
- `/graph`
- `/nodes/:nodeId`
- `/proposals`
- `/proposals/:proposalId`
- `/reviews`
- `/projections`
- `/projections/:projectionId`
- `/conflicts`
- `/admin/policy`

### 3.3 VS Code/Cursor extension surfaces

- Sidebar tabs:
  - **Context** (search nodes, chain view)
  - **Proposals** (drafts + submitted)
  - **Reviews** (assigned)
- Editor integrations:
  - **Projection overlay** for Markdown: system blocks locked; edits generate proposal drafts.

---

## 4) Core Data Semantics the UI Must Represent

### 4.1 Node types (examples)

Goals, decisions (rationale + alternatives), constraints, tasks/plans, risks/mitigations, questions/answers.

### 4.2 Typed relationships (traversal)

Edges like `implements`, `depends-on`, `blocks`, `references`, `parent-child` enable traversal chains such as:

**goal → decision → task → risk / question / constraint**

### 4.3 Truth status (first-class)

**NodeStatus**: accepted / proposed / rejected / superseded must be queryable and visible.

### 4.4 Authoring vs indexing

- Humans author Markdown in `description`
- `content` is derived deterministically (index)
- UI should not encourage editing derived `content`

### 4.5 Proposals, reviews, and apply (three distinct states)

The UI must represent three distinct notions of “done”:

- **Reviewed** (proposal has a review with accept/reject)
- **Accepted** (proposal status is `accepted`)
- **Applied** (truth has been mutated by applying the accepted proposal)

#### Required model addition (implementation requirement)

To support correct UI semantics, the system must represent “applied” explicitly (not just “accepted”), e.g.:

- `proposal.metadata.appliedAt?: string`
- `proposal.metadata.appliedBy?: string`
- `proposal.metadata.appliedRevision?: string` (optional; e.g., store revision/commit id)

UI will use this to:

- disable re-apply
- render “Accepted but not applied” warnings
- attach projections to a truth snapshot
- audit who applied what and when

### 4.6 Workspaces / tenancy (clean-slate decision)

This spec assumes a **workspace** is a hard partition for:

- data scope (nodes/proposals/reviews/comments)
- policy/roles
- projections configuration

Implementation options (choose one early):

- **Workspace = store instance** (simplest boundary, easiest to reason about)
- **Workspace = namespace partition** (lighter, but must be enforced consistently)
- **WorkspaceId field** on all entities (explicit tenancy)

UI should not leak cross-workspace content.

---

## 5) UX Principles (must stay consistent across screens)

### 5.1 Never “Edit” accepted truth

- Accepted nodes show a **🔒 Accepted (Read-only)** banner.
- Primary CTA is **Propose change**.

### 5.2 Always make proposal state obvious

Proposal pages must show, at minimum:

- status: open / accepted / rejected / withdrawn
- reviewed by + reviewed at (if reviewed)
- applied at/by (if applied)
- baseVersions (staleness detection)
- conflicts summary (node vs field)

### 5.3 Comments are anchored to meaning

Reviewer feedback must be representable as anchored threads:

- `nodeId`
- `field` (title/description/relationships/typed field)
- optional `range` for description
- optional `quote` for best-effort re-anchoring

### 5.4 Safe-by-default filters

Across Explore/Nodes:

- accepted-only is ON by default
- “include proposals” requires explicit opt-in and stays visibly enabled

---

## 6) Core Screens (Web)

### 6.1 Explore — Graph Explorer

**Purpose**: browse accepted truth; traverse reasoning chains.

**Layout**

- Left: filters (type, status, tag, creator, “Accepted-only” default ON)
- Center: graph canvas (toggle to outline/tree)
- Right: node inspector

**Must-have interactions**

- select node → inspector
- “Show chain” → expands typed traversal
- “Related proposals” widget for node

**Acceptance criteria**

- accepted-only default is enforced in UI and server calls
- explicit toggle required to include open proposals

### 6.2 Node Detail — Accepted Truth View

**Purpose**: view canonical truth; initiate proposals.

**UI rules**

- If status = accepted: show **🔒 Accepted (Read-only)** and disable inline edit.
- Primary CTA: **Propose change**.

**Actions**

- propose field updates: title, description, typed fields
- propose relationship updates: add/remove typed edges
- templates: “Add risk / question / task” (creates proposal ops linked to this node)

**Acceptance criteria**

- UI never directly mutates accepted node fields
- any “edit” interaction produces proposal operations

### 6.3 Proposal Composer — Draft → Submit

**Purpose**: capture changes as structured proposal operations.

**Header fields**

- proposal title
- rationale (**required**)
- base snapshot/version info (for staleness)
- impact summary: nodes touched + types touched

**Authoring modes**

1) **Structured mode**
   - operation builder:
     - create node
     - update node fields
     - add/remove relationships
     - status change
     - (later) insert/deleteText
2) **Markdown suggestion mode**
   - edit a `ctx` block in a projection → parse into ops → preview ops before submit

**Pre-submit validations**

- staleness check (baseVersions)
- conflict prediction (node/field severity)
- policy preview (required approvals; who can apply)

**Acceptance criteria**

- cannot submit without rationale
- proposal diff is reviewable at node+field granularity

### 6.4 Proposal Review — Accept/Reject (and Apply)

**Purpose**: gate truth changes via explicit review; keep apply separate.

**Review UI**

- summary + rationale
- changes grouped by node:
  - field diffs
  - relationship diffs
- anchored comment threads (node+field)

**Actions**

- accept (optional comment)
- reject (**required reason**)
- after accepted: **Apply** (if policy allows)

**Acceptance criteria**

- accepting does not mutate truth until apply
- applying updates truth and triggers projection updates
- UI distinguishes:
  - accepted-but-not-applied
  - accepted-and-applied

### 6.5 Reviews — My Queue

**Purpose**: efficiently process assigned approvals.

**List columns**

- proposal title
- impact score (heuristic)
- required approvals (policy)
- age / staleness risk

**Batch actions**

- accept selected (policy-gated)
- reject selected (requires reasons per item or a shared reason)

### 6.6 Projections — Markdown & Views

**Purpose**: browse deterministic projections; keep Git-friendly outputs.

**Projection viewer**

- header: “Generated from Truth Snapshot: X”
- rendered + raw Markdown
- diff vs previous projection
- actions: regenerate / export / (future) commit

**Acceptance criteria**

- projections are clearly labeled **non-canonical**
- projection generation is deterministic for a given truth snapshot + config

#### Required model addition (implementation requirement)

The UI assumes a stable projection identity, e.g.:

- `ProjectionRun { id, workspaceId, configId, basedOnRevision, generatedAt, generatedBy, outputs... }`

### 6.7 Conflicts & Staleness Center

**Purpose**: handle concurrency above line merges.

**Displays**

- stale proposals (base versions behind)
- conflicts grouped by node+field
- safe auto-merges (non-overlapping fields)

**Actions**

- rebase proposal onto latest truth (regenerate ops with new baseVersions)
- auto-merge safe fields
- manual resolve overlaps

**Acceptance criteria**

- conflicts resolved at proposal level
- field-wise merge when safe; node-level conflicts require manual resolution

### 6.8 Policy / Roles (Admin)

**Purpose**: enforce governance: who can approve/apply what.

**Capabilities (target-state)**

- contributors / approvers / admins
- approvers per node type
- multi-approval workflows (quorum)
- constraints on who can apply accepted proposals
- policy-as-code (roadmap)

**MVP note**

In MVP, this screen may be “read-only policy preview” unless server-side enforcement exists.

---

## 7) Shared Component Library (Web + Extension)

### 7.1 Primitives

- `TruthStatusPill`: accepted / proposed / rejected / superseded
- `ReadOnlyBanner`: “Accepted truth (🔒) — propose changes”
- `ProposalStatusPill`: open / accepted / rejected / withdrawn / (applied)
- `OperationList`: grouped by nodeId
- `FieldDiff`: title/description/typed fields
- `RelationshipDiff`: add/remove typed edges
- `ChainViewer`: goal → decision → task → risk/question/constraint
- `AnchoredComments`: nodeId + field (+ optional range)
- `PolicyBadge`: required approvals + apply permissions
- `StalenessBadge`: baseVersions vs current versions
- `ConflictBadge`: node vs field severity

### 7.2 Pattern rules

- never show “Edit” on accepted nodes; always “Propose”
- always show proposal base versions
- always distinguish:
  - accepted vs applied
  - comment threads vs change operations

---

## 8) CLI Spec (User-visible UX)

### 8.1 Commands

- `ctx query [--include-proposals] [--type decision] [--tag auth]`
- `ctx propose --from-json proposal.json`
- `ctx propose --from-md README.md` (extract ctx blocks → ops)
- `ctx review <proposalId> --accept|--reject --comment "..."`
- `ctx apply <proposalId>` (permission gated)
- `ctx project --check` (deterministic projection verification in CI)

### 8.2 CLI invariants

- default queries are accepted-only
- writes are proposals only (never mutate truth directly)

---

## 9) API Contract (clean-slate requirements)

This spec assumes a single server API that all clients use. The API must:

- default to accepted-only queries (unless explicitly overridden)
- expose policy evaluation results (even if “policy” is minimal in MVP)
- expose applied state for proposals
- expose projection runs/snapshots (at least enough to label projection outputs)

Minimum endpoints/operations (HTTP or GraphQL):

- `queryNodes` (accepted-only default)
- `getNode`
- `createProposal`
- `getProposal` / `queryProposals`
- `submitReview`
- `getReviewHistory`
- `applyProposal`
- `detectConflicts`
- `isProposalStale`
- `mergeProposals`
- `getProposalComments` / `addProposalComment` / `queryComments`
- (roadmap) `evaluatePolicy(proposalId)` and `setPolicy(...)`
- (roadmap) `createProjectionRun(...)` / `getProjectionRun(...)`

---

## 10) MVP Scope and Delivery Phases

### 10.1 MVP (end-to-end lifecycle)

1) Explore accepted graph (list + basic graph)
2) Node detail (read-only accepted + propose change)
3) Proposal composer (structured ops + rationale + baseVersions capture)
4) Review accept/reject (anchored comments)
5) Apply accepted proposal (and record applied state)
6) Projection viewer (Markdown) with regenerate

### 10.2 Phase 2

- conflicts/staleness center (full workflows)
- VS Code projection overlay editing (`ctx` blocks → ops)
- policy/roles UI with policy evaluation (server enforced)

### 10.3 Phase 3

- agent assistant panel (proposal templates + reviewer-assistant)
- mobile approvals + notifications
- dashboards/analytics + audit export

---

## 11) Non-goals (explicit)

- Replacing freeform wikis/Notion for narrative knowledge
- Replacing code review (PRs remain canonical for code changes)
- “Magic merge” for all conflicts (some require judgment; policy does not remove judgment)

---

## 12) Appendix: Screen-to-Contract checklist

Every screen must answer:

1) Is this showing **truth** or a **proposal**?
2) If truth: is it explicitly **read-only** and is the primary action **Propose**?
3) If proposal: is the state visible (open/accepted/rejected/withdrawn/applied)?
4) Are comments anchored to meaning (node/field/range)?
5) Are accepted-only defaults visible and consistent?

