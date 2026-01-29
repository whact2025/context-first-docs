# Review Mode (Google Docs–style)

This system is an **Agentic Collaboration Approval Layer (ACAL)**. It treats all concurrent work on a **solution model** as **suggestions** that must be **accepted/rejected** — similar to Google Docs “Suggesting” mode, but anchored to semantic nodes (not line diffs).

For a **concrete end-to-end walkthrough** (accepted graph → proposal → review with comments anchored to nodes → accept/apply → regenerated Markdown), see [Hello World scenario](HELLO_WORLD_SCENARIO.md).

## Core invariant

- **No direct edits to accepted context.**
- All writes are captured as **proposals**.
- Only **reviews** can accept/reject a proposal into truth.

In the current reference implementation (`InMemoryStore`), this is enforced by:
- disallowing `updateProposal(...{ status: "accepted" | "rejected" })`
- requiring acceptance/rejection via `submitReview(...)`
- only allowing `applyProposal(...)` for `accepted` proposals

## Enterprise approval policies (roadmap)

In enterprise deployments, review mode can be extended with policy constraints like quorum approvals, separation of duties, required evidence/attestations, and role-based gates on sensitive node types (see the whitepaper “Enterprise approval policies” roadmap).

## Status transitions

- **`open` → `accepted`**: via `submitReview({ action: "accept" })`
- **`open` → `rejected`**: via `submitReview({ action: "reject" })`
- **`open` → `withdrawn`**: via `updateProposal(...{ status: "withdrawn" })` (author withdraws suggestion)

All other direct status transitions are disallowed.

## Canonical text fields

Nodes intentionally separate “what humans author” from “what the system derives”:

- **`title`** (optional): short label for display/search.
- **`description`** (optional): canonical long-form **Markdown** body (what humans and agents propose).
- **`content`** (required): deterministic derived **plain-text index** used for search/similarity/snippets.

When a proposal updates `title`/`description`, the store re-derives `content` to prevent drift.

## Projections (views), not truth

“Projection” is a **derived view** and should not be stored as canonical node truth.

- **Documentation projections**: e.g. projecting accepted nodes into Markdown (`projectToMarkdown()`).
- **Codebase projections**: e.g. a PR/branch/patch that implements an approved proposal.

For traceability, codebase projections can be attached to **issues** created on approval (see `Issue.codeProjection`).

