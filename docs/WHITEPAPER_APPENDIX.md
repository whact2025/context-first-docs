# Whitepaper Appendix

This appendix provides deep technical excerpts and API references that support the main whitepaper ([WHITEPAPER.md](WHITEPAPER.md)). For the **Glossary**, see **section 11** of the whitepaper. For **using the context store to create a contextualized AI model** (RAG, fine-tuning, structured prompting) and **enterprise IP benefits**, see [CONTEXTUALIZED_AI_MODEL.md](CONTEXTUALIZED_AI_MODEL.md) and whitepaper section 7.1.

---

## A. ContextStore interface (excerpt)

The canonical store contract is defined in `src/types/context-store.ts`. Key methods:

| Method | Purpose |
|--------|--------|
| `getNode(nodeId)` | Get a node by ID |
| `queryNodes(query)` | Query with type, status, search, relationships; **default `status: ["accepted"]`** for agent safety |
| `getProposal` / `queryProposals` | Get proposal(s) |
| `createProposal(proposal)` | Create a new proposal (no direct edits to truth) |
| `updateProposal(id, updates)` | Update proposal metadata; **cannot set `status: "accepted" \| "rejected"`** |
| `submitReview(review)` | Accept or reject a proposal (only path to change proposal status) |
| `applyProposal(proposalId)` | Apply an **accepted** proposal into truth |
| `getReviewHistory` / `getProposalComments` / `addProposalComment` | Review and comment APIs |
| `detectConflicts(proposalId)` | Proposal-level conflict detection |
| `isProposalStale(proposalId)` | Optimistic locking (base versions) |
| `mergeProposals(proposalIds)` | Field-level merge |
| `traverseReasoningChain` / `buildContextChain` / `followDecisionReasoning` / `discoverRelatedReasoning` | Decision/rationale traversal (provenance chains) — typed relationship traversal: goal → decision → risk → task. Not LLM chain-of-thought. |
| `queryWithReasoning(options)` | Query with provenance chains (typed relationship paths) attached to results |

For **concrete examples** of conflicts, merges, and staleness (two proposals same field → conflict; different fields → mergeable; stale baseVersion → rebase), see whitepaper **section 5.3.4** and the canonical walkthrough **[CONFLICT_AND_MERGE_SCENARIO.md](CONFLICT_AND_MERGE_SCENARIO.md)** (day-in-the-life style, with proposal JSON and outcome shapes). Run the **conflicts-and-merge** and **stale-proposal** scenarios in the playground to reproduce.

---

## B. NodeQuery (excerpt)

Query for nodes (`src/types/context-store.ts`). **Default `status: ["accepted"]`** so agents must explicitly opt-in to proposals.

- **Type / status**: `type`, `status` (default `["accepted"]`)
- **Search**: `search` (string or `{ query, fields, operator }` for keyword/fuzzy)
- **Filtering**: `tags`, `namespace`, `createdBy`, `modifiedBy`, date ranges
- **Relationships**: `relatedTo`, `relationshipTypes`, `depth`, `direction`; `descendantsOf`, `ancestorsOf`; `dependenciesOf`, `dependentsOf`
- **Sorting / pagination**: `sortBy`, `sortOrder`, `limit`, `offset`

See `docs/AGENT_API.md` for full usage and examples.

---

## C. Proposal and operations (excerpt)

For the **Status model** (node vs proposal vocabulary and allowed transitions), see whitepaper **section 4.1**.

- **Proposal** (`src/types/proposal.ts`): `id`, `status` (`open` \| `accepted` \| `rejected` \| `withdrawn`), `operations[]`, `metadata` (rationale, baseVersions, codeProjection, etc.).
- **Operation types**: `create`, `update`, `status-change`, `insert`, `delete`, `move`.
- **Apply** (`src/store/core/apply-proposal.ts`): `applyAcceptedProposalToNodeMap(nodes, proposal, options)` mutates the node map; used by `InMemoryStore` and (when implemented) file-backed stores.

---

## D. Review-mode enforcement (code)

In `src/store/in-memory-store.ts`:

- `updateProposal(proposalId, updates)`: disallows `updates.status` being `"accepted"` or `"rejected"` (enforced in implementation).
- `submitReview(review)`: only way to set proposal status to accepted/rejected.
- `applyProposal(proposalId)`: only applies proposals that are already `status: "accepted"`.

See `docs/REVIEW_MODE.md` for the invariant and status transitions.

---

## E. Glossary

For the full glossary of terms (node, relationship, proposal, review, accepted truth, projection, ctx block, etc.), see **section 11 (Glossary)** of [WHITEPAPER.md](WHITEPAPER.md).
