# TruthLayer Docs

**Ratify truth. AI with Guardrails for Security & Compliance.** Root README and CONTEXT are summaries that point here; this folder is the canonical source for product and architecture. TruthLayer is a collaboration and governance layer for "truth" inside an organization—software decisions, business policy, operating procedures, risks, and rationale. **We build an agent** that reads accepted truth and authors proposals; humans **ratify** (review and apply). The solution **provides an MCP server** so AI assistants (Cursor, Claude Desktop, etc.) can use TruthLayer as a native tool. Immutable accepted truth, proposal → review → **ratify** → apply workflow, and **guardrails** (RBAC, audit) deliver security and compliance by design.

## One invariant

TruthLayer enforces **ACAL** (the guardrails):

1. **Accepted truth is immutable.**
2. All changes are **Proposals** (candidates).
3. Proposals are **Reviewed** (accept/reject, with comments).
4. Accepted proposals are **Applied**, producing a new **Accepted Revision** in the ledger.

The **agent** can read accepted truth and author proposals; it **cannot** accept/reject/apply. Humans govern.

---

## Core narrative (start here)

| Doc                                          | Purpose                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [WHITEPAPER.md](WHITEPAPER.md)               | AI with Guardrails for Security & Compliance; what TruthLayer is, ACAL, enterprise positioning |
| [core/ARCHITECTURE.md](core/ARCHITECTURE.md) | Components, data flows, tenancy, storage                                                       |
| [core/REVIEW_MODE.md](core/REVIEW_MODE.md)   | Proposal lifecycle, statuses, review/apply semantics                                           |
| [core/UI_SPEC.md](core/UI_SPEC.md)           | Minimal governance UI (required), UX, roles, views                                             |
| [core/AGENT_API.md](core/AGENT_API.md)       | Agent-safe contract: read truth, create proposals; no review/apply; **MCP server** exposure    |
| [core/USAGE.md](core/USAGE.md)               | How to use TruthLayer                                                                          |

## Scenarios

- [scenarios/HELLO_WORLD_SCENARIO.md](scenarios/HELLO_WORLD_SCENARIO.md) — end-to-end proposal → review → apply
- [scenarios/CONFLICT_AND_MERGE_SCENARIO.md](scenarios/CONFLICT_AND_MERGE_SCENARIO.md) — concurrency & merge
- [scenarios/BUSINESS_POLICY_SCENARIO.md](scenarios/BUSINESS_POLICY_SCENARIO.md) — non-software "truth" example

## Reference

- [reference/DATA_MODEL_REFERENCE.md](reference/DATA_MODEL_REFERENCE.md) — canonical schema
- [reference/SECURITY_GOVERNANCE.md](reference/SECURITY_GOVERNANCE.md) — security & governance
- [reference/OPERATIONS.md](reference/OPERATIONS.md) — operations

---

## Appendix (design notes, optional features)

Valuable for implementers and evaluators; not part of the core pitch.

| Doc                                                                            | Content                                                      |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| [appendix/SELF-REFERENCE.md](appendix/SELF-REFERENCE.md)                       | Dogfooding: this repo uses ACAL to document itself           |
| [appendix/OPTIONAL_INTEGRATIONS.md](appendix/OPTIONAL_INTEGRATIONS.md)         | Integrations (optional): VS Code, Slack, Office, etc.        |
| [appendix/DOCX_REVIEW_INTEGRATION.md](appendix/DOCX_REVIEW_INTEGRATION.md)     | Word/DOCX review flow (Phase 2 / optional)                   |
| [appendix/CHANGE_DETECTION.md](appendix/CHANGE_DETECTION.md)                   | How projection edits become proposal operations              |
| [appendix/RECONCILIATION_STRATEGIES.md](appendix/RECONCILIATION_STRATEGIES.md) | Conflict resolution design                                   |
| [appendix/CONTEXTUALIZED_AI_MODEL.md](appendix/CONTEXTUALIZED_AI_MODEL.md)     | Context substrate for agents; leakage policy; deep technical |

## Engineering (implementation)

For builders; not required for "what is this and why should I care."

- **Running**: From the repo root run **`npm run playground`**, then open http://localhost:4317. In Cursor/VS Code: **Run Task → "Playground (run both servers)"**. Alternatively, run with **Docker**: **`docker compose up --build`** (single container; see [../README.md](../README.md) § Docker).

| Doc                                                                                                      | Content                            |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| [engineering/storage/STORAGE_ARCHITECTURE.md](engineering/storage/STORAGE_ARCHITECTURE.md)               | Storage backends, file vs database |
| [engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md](engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md) | Implementation plan for storage    |

---

## Tenancy model

All APIs and stored objects include **workspaceId**. A workspace is the unit of: access control (RBAC), audit boundary, retention policies, export/import, optional Git repo mapping.

---

## Rule of thumb

- **What is this and why should I care?** → Core narrative above.
- **How would we implement this?** → Engineering.
- **What else could we do later?** → Appendix.
