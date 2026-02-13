# UI Spec (Minimal Governance Surface)

The product can have many clients, but **one UI surface is required**:

> A reviewer/apply interface that can:
>
> - list proposals
> - display diffs semantically
> - collect comments
> - accept/reject
> - apply accepted proposals
> - show audit history

The current **playground** provides a **prototype** of this minimal governance UI; the required production UI may be refined from it.

## UX and human interaction

TruthLayer is designed around a simple human reality: people need drafts and discussion; organizations need accepted truth; agents need stable, safe context.

**Roles:** **Contributor** (drafts proposals, human or agent); **Reviewer** (approves/rejects with comments); **Applier** (applies accepted proposals into accepted truth); **Reader** (consumes accepted projections).

**Interaction principles:** (1) Accepted is boring, and that’s good. (2) Proposals are where creativity and debate live. (3) Every acceptance has rationale (via comments or summary). (4) Apply is explicit (separate from review).

**Cognitive load:** Show semantic diffs (not raw JSON); anchor comments to fields/sections; keep the required UI minimal; allow optional rich clients later.

## Required views

### 1) Proposal list

Filters:

- workspace
- status
- author
- tags
- affected node types

### 2) Proposal detail

Show:

- base revision
- operations summary (created/updated nodes/edges)
- semantic diff per node (field-level)
- policy findings
- discussion thread (anchored comments)

### 3) Review flow

Actions:

- request changes
- approve
- reject

**Multi-approval:** When multiple approvals are required, **one reject blocks** apply; all required reviewers must approve. Reviewers see existing reviews and comments before deciding (default). The proposal is the unit—no partial approval of operations. See [Review Mode (ACAL)](REVIEW_MODE.md) § Multi-approval.

Reviews must be immutable after closure.

### 4) Apply flow (separate)

Apply must:

- require `apply` permission
- produce a new accepted revision
- stamp `AppliedMetadata`
- be idempotent for already-applied proposals

### 5) Audit view

- proposal history
- reviews and decisions
- applied revisions
- actors and timestamps

## API surface (minimal UI)

The minimal governance UI typically uses:

- **List proposals**: queryProposals({ workspaceId, status?, createdBy?, limit, offset }); filter by status, author, tags, affected node types.
- **Proposal detail**: getProposal(proposalId), getProposalComments(proposalId), getReviewHistory(proposalId).
- **Semantic diff**: from proposal.baseRevisionId + proposal.operations vs current accepted nodes (field-level create/update/delete per node).
- **Review**: submitReview(review) with APPROVED/REJECTED and comments; reviews immutable once closed.
- **Apply**: applyProposal(proposalId) (requires apply permission); idempotent for already-applied.
- **Audit**: audit log or review history and applied revisions (backend-dependent).

See [Agent API](AGENT_API.md), [Review Mode (ACAL)](REVIEW_MODE.md).

## Optional UI capabilities

- projection editing (Markdown)
- docx tracked-change integration
- “truth graph” explorer
- agent-assisted proposal drafting

## Extended governance views (Phase 8/9)

The following views extend the minimal governance surface for AI compliance, privacy, and advanced governance capabilities. They are **required** for deployments using the AI Compliance Gateway or operating under data protection regulations.

### 6) AI Compliance Gateway dashboard

Show:

- **Active model configurations**: allowed models per workspace, rate limits, cost caps, regional constraints
- **Gateway traffic**: real-time or recent model calls, latency, cost, pass/fail
- **Policy violations**: blocked requests with reason (sensitivity gate, destination not in allowlist, injection detected)
- **Prompt inspection log**: sensitivity scan results, redacted fields, egress decisions
- **Model routing status**: health checks per model provider, failover state

Actions:

- Configure model allowlist and rate limits per workspace
- Enable/disable prompt inspection rules
- Export gateway audit log (JSON/CSV)

### 7) DSAR (Data Subject Access Request) view

Show:

- **Subject search**: find all truth operations and audit entries for a given actor/subject
- **Data inventory**: nodes created/modified by subject, proposals authored, reviews submitted
- **Retention status**: per-node retention class, scheduled deletion dates, crypto-shredding status
- **Export**: package all data for subject as structured archive (JSON + Markdown projections)

Actions:

- Execute DSAR export for a subject
- Initiate crypto-shredding for a subject's PII fields
- Mark DSAR as complete with audit trail

### 8) Retention management view

Show:

- **Retention policies**: configured retention classes (operational, compliance, legal-hold, permanent) and their default durations
- **Retention schedule**: nodes approaching expiry, grouped by workspace and retention class
- **Deletion queue**: pending deletions, blocked by legal holds, completed deletions
- **Compliance status**: percentage of nodes with explicit retention classification

Actions:

- Assign retention class to nodes (individual or bulk)
- Place/lift legal hold on nodes or workspaces
- Execute scheduled deletion (with confirmation and audit)
- Configure retention defaults per workspace

### 9) Truth graph explorer

Show:

- **Interactive graph**: visual representation of node relationships — goals → decisions → tasks → risks → constraints
- **Traversal controls**: select a node, follow typed relationships (depends-on, mitigates, implements, references), bounded depth
- **Reasoning chains**: visual `traverseReasoningChain` from any node to its governance ancestors
- **Provenance overlay**: accepted revisions per node, who changed what and when

Actions:

- Navigate to node detail or proposal
- Start an agent-assisted analysis from any node ("assess risk", "analyze impact")
- Filter graph by node type, tags, sensitivity, status

### 10) Conflict resolution view

Show:

- **Concurrent proposals**: proposals that touch overlapping nodes/fields
- **Conflict summary**: per-field conflicts (both proposals change same field), structural conflicts (create/delete same node)
- **Merge preview**: proposed merged result when auto-mergeable; highlighted manual-resolution areas when not

Actions:

- Auto-merge compatible proposals (field-level, non-overlapping)
- Manual resolution for conflicting fields
- Create merged proposal from conflicting proposals

See: [Review Mode (ACAL)](REVIEW_MODE.md), [Reconciliation Strategies](../appendix/RECONCILIATION_STRATEGIES.md)
