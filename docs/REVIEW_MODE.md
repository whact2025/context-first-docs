# Review Mode (Google Docs–style)

This project treats all concurrent work on context as **suggestions** that must be **accepted/rejected** — similar to Google Docs “Suggesting” mode.

## Core invariant

- **No direct edits to accepted context.**
- All writes are captured as **proposals**.
- Only **reviews** can accept/reject a proposal into truth.

In the current reference implementation (`InMemoryStore`), this is enforced by:
- disallowing `updateProposal(...{ status: "accepted" | "rejected" })`
- requiring acceptance/rejection via `submitReview(...)`
- only allowing `applyProposal(...)` for `accepted` proposals

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

