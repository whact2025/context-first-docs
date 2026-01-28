# Change Capture (Suggesting Mode) and Proposal Creation

This system does **not** allow direct edits to accepted context. All concurrent work is captured as **proposals** and then **accepted/rejected** into truth (Google Docs “Suggesting” mode).

See `docs/REVIEW_MODE.md` for the invariant and allowed status transitions.

## What “change detection” means here

There are two separable concerns:

- **Change capture**: turning user/agent intent into a proposal.
- **Change application**: applying an *accepted* proposal into truth.

Change capture can happen in a UI, a server API, or a CLI; the important part is that the output is always a **proposal**.

## Two change-capture inputs

### 1) Structured edits (recommended)

Clients submit semantic edits directly as proposal operations:

- create a node
- update fields (`title`, `description`, typed fields, relationships, etc.)
- change status

This keeps the API/store decoupled from Markdown parsing.

### 2) Markdown-derived proposals (ctx blocks)

Markdown (with `ctx` blocks) is a convenient authoring/projection format. A client or API can:

1. extract `ctx` blocks
2. compare each block against the current node (by id)
3. emit create/update proposals

## ctx block format

Ctx blocks use fenced code blocks with either backticks or tildes (3+ chars). Tildes are preferred so the body can contain triple-backtick code fences safely.

```markdown
~~~ctx
type: decision
id: decision-001
status: proposed
title: Use TypeScript (optional)
---
Markdown description here (canonical body).
May include fenced code blocks safely.
~~~
```

### Mapping to node fields

- **`title`**: optional short label
- **body (after `---`)**: becomes **`description`** (canonical Markdown)
- **`content`**: deterministic derived plain-text index (computed from `description` + typed fields); do not treat it as the authored body

## Markdown-derived proposal algorithm (high level)

For each extracted ctx block:

1. **Lookup** node by `{id, namespace?}`.
2. If missing: emit a **create** proposal with `description` (and optional `title`).
3. If present: detect differences in:
   - `description` (compare to existing `description`, fallback to existing `content` for backward compatibility)
   - `title` (only if explicitly present in the ctx header)
   - `status`
4. If any differences exist: emit an **update** proposal with the changed fields.

Important: **changing status in Markdown is still only a suggestion** — it becomes truth only if the proposal is accepted and applied.

## Review + apply flow

1. `createProposal(proposal)` stores the suggestion (`status: "open"`).
2. Reviewers accept/reject via `submitReview(...)`.
3. If accepted, apply into truth via `applyProposal(proposalId)`.

## Conflicts and staleness

The store can support safe concurrency with:

- `detectConflicts(proposalId)` to flag overlapping proposals
- `isProposalStale(proposalId)` to detect optimistic-lock failures (`baseVersions`)
- `mergeProposals([...])` for field-level auto-merging where safe

## What is *not* managed automatically

- Non-ctx Markdown outside fences is treated as regular document content and is not canonical truth.
- Persisting the store (file-based / MongoDB) and any Git integration is a storage concern (see `docs/STORAGE_ARCHITECTURE.md`).

## Minimal example

```ts
import { InMemoryStore, importFromMarkdown } from "context-first-docs";

const store = new InMemoryStore();
const proposals = await importFromMarkdown(store, markdown, "alice", "DECISIONS.md");

for (const p of proposals) {
  await store.createProposal(p);
  await store.submitReview({
    id: `review-${p.id}`,
    proposalId: p.id,
    reviewer: "bob",
    reviewedAt: new Date().toISOString(),
    action: "accept",
  });
  await store.applyProposal(p.id);
}
```

