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

See [AGENT_API.md](AGENT_API.md), [REVIEW_MODE.md](REVIEW_MODE.md).

## Optional UI capabilities

- projection editing (Markdown)
- docx tracked-change integration
- “truth graph” explorer
- agent-assisted proposal drafting

See: [REVIEW_MODE.md](REVIEW_MODE.md)
