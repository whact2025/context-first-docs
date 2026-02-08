# TruthLayer Docs

**Governed truth. Guarded AI.** Root README and CONTEXT are summaries that point here; this folder is the canonical source for product and architecture. TruthLayer is a **governance-first truth system** (**governed truth, guarded AI**): a truth ledger and collaboration layer for "truth" inside an organization—software decisions, business policy, operating procedures, risks, and rationale. Immutable accepted truth, proposal → review → **ratify** → apply workflow, and **guardrails that apply to AI** (RBAC, audit) by design. An **agent** reads accepted truth and authors proposals within that model; humans ratify. The solution **provides an MCP server** so AI assistants (Cursor, Claude Desktop, etc.) can use TruthLayer as a native tool.

## One invariant

TruthLayer enforces **ACAL** (the guardrails that apply to AI):

1. **Accepted truth is immutable.**
2. All changes are **Proposals** (candidates).
3. Proposals are **Reviewed** (accept/reject, with comments).
4. Accepted proposals are **Applied**, producing a new **Accepted Revision** in the ledger.

The **agent** can read accepted truth and author proposals; it **cannot** accept/reject/apply. Humans govern.

---

## Core narrative (start here)

| Doc                                       | Purpose                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| [Whitepaper](WHITEPAPER.md)               | Governance-first truth system (governed truth, guarded AI); ACAL, enterprise                |
| [Architecture](core/ARCHITECTURE.md)      | Components, data flows, tenancy, storage                                                    |
| [Review Mode (ACAL)](core/REVIEW_MODE.md) | Proposal lifecycle, statuses, review/apply semantics                                        |
| [UI Specification](core/UI_SPEC.md)       | Minimal governance UI (required), UX, roles, views                                          |
| [Agent API](core/AGENT_API.md)            | Agent-safe contract: read truth, create proposals; no review/apply; **MCP server** exposure |
| [Usage](core/USAGE.md)                    | How to use TruthLayer                                                                       |

## Scenarios

- [Hello World Scenario](scenarios/HELLO_WORLD_SCENARIO.md) — end-to-end proposal → review → apply
- [Conflict and Merge Scenario](scenarios/CONFLICT_AND_MERGE_SCENARIO.md) — concurrency & merge
- [Business Policy Scenario](scenarios/BUSINESS_POLICY_SCENARIO.md) — non-software "truth" example

## Reference

- [Data Model Reference](reference/DATA_MODEL_REFERENCE.md) — canonical schema
- [Security & Governance](reference/SECURITY_GOVERNANCE.md) — security & governance
- [Privacy and Data Protection](reference/PRIVACY_AND_DATA_PROTECTION.md) — GDPR-ready posture for procurement / DPIA
- [Operations](reference/OPERATIONS.md) — operations

---

## Appendix (design notes, optional features)

Valuable for implementers and evaluators; not part of the core pitch.

| Doc                                                                           | Content                                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [Self-Reference](appendix/SELF-REFERENCE.md)                                  | Dogfooding: this repo uses ACAL to document itself           |
| [Optional Integrations](appendix/OPTIONAL_INTEGRATIONS.md)                    | Integrations (optional): VS Code, Slack, Office, etc.        |
| [DOCX / Word / Excel Review Integration](appendix/DOCX_REVIEW_INTEGRATION.md) | Word/DOCX review flow (Phase 2 / optional)                   |
| [Change Detection](appendix/CHANGE_DETECTION.md)                              | How projection edits become proposal operations              |
| [Reconciliation Strategies](appendix/RECONCILIATION_STRATEGIES.md)            | Conflict resolution design                                   |
| [Contextualized AI Model](appendix/CONTEXTUALIZED_AI_MODEL.md)                | Context substrate for agents; leakage policy; deep technical |

## Engineering (implementation)

For builders; not required for "what is this and why should I care."

- **Running**: From the repo root run **`npm run playground`**, then open http://localhost:4317. In Cursor/VS Code: **Run Task → "Playground (run both servers)"**. Alternatively, run with **Docker**: **`docker compose up --build`** (single container; see [Repo README](../README.md) § Docker).

| Doc                                                                               | Content                            |
| --------------------------------------------------------------------------------- | ---------------------------------- |
| [Storage Architecture](engineering/storage/STORAGE_ARCHITECTURE.md)               | Storage backends, file vs database |
| [Storage Implementation Plan](engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md) | Implementation plan for storage    |

---

## Tenancy model

All APIs and stored objects include **workspaceId**. A workspace is the unit of: access control (RBAC), audit boundary, retention policies, export/import, optional Git repo mapping.

---

## Rule of thumb

- **What is this and why should I care?** → Core narrative above.
- **How would we implement this?** → Engineering.
- **What else could we do later?** → Appendix.
