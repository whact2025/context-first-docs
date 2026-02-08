# Documentation Reanalysis

**Date:** 2026-02-06  
**Scope:** All documentation (root + docs/) checked for consistency and broken references.

**Source of truth:** The **docs/ folder is the source of truth** for product and architecture. Root README, CONTEXT, and PLAN are aligned to docs/ and point into it; they do not override or replace docs/ content.

---

## 1. Stated solution (canonical — from docs/)

From **docs/README.md**, **docs/core/ARCHITECTURE.md**, **docs/WHITEPAPER.md**:

- **TruthLayer is enterprise truth governance for humans and agents** — a **truth ledger + collaboration layer**.
- **ACAL** (Accepted → Candidate → Accepted → Ledger): accepted truth immutable; changes are proposals; proposals reviewed (accept/reject); accepted proposals applied → new accepted revision.
- **One minimal governance UI is required** (list proposals, accept/reject/apply). **The Agent** (we build it) is **optional** (query truth, author proposals; cannot accept/reject/apply).
- Rich UIs (Web, VS Code, Word/Google) are optional.

---

## 2. Alignment (root → docs/)

Root and PLAN have been updated so they match docs/ (docs/ is source of truth):

| File           | Aligned to docs/                                                                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **README.md**  | Leads with "Enterprise truth governance"; "truth ledger + collaboration layer"; ACAL; minimal governance UI required; The Agent optional; points to docs/ as canonical.           |
| **CONTEXT.md** | context-001 and goal-001 use docs/ framing (truth ledger + ACAL, minimal governance UI required, The Agent optional).                                                             |
| **PLAN.md**    | Intro states docs/ is source of truth; Phase 5 = "Contextualize + The Agent (optional)"; broken section refs (§4, §7.4, §7.5, DOCX §5–7) removed or replaced with file-only refs. |

docs/ content was not changed; it remains the authoritative product and architecture description.

---

## 3. Terminology

Canonical terminology is defined in docs/ (typed nodes + relationships, truth ledger, ACAL, DRAFT/SUBMITTED/ACCEPTED/etc. in REVIEW_MODE). Root and PLAN now use the same high-level framing (truth ledger + collaboration, minimal governance UI, The Agent optional). Implementation details (ContextStore, queryNodes, etc.) may still appear in PLAN/code; API contract is in docs/AGENT_API.md. The **store implementation** is the Rust server (server/); clients use the HTTP API (TypeScript client: src/api-client.ts). See docs/core/ARCHITECTURE.md and server/README.md.

---

## 4. Broken references (addressed)

References that previously pointed to non-existent sections have been fixed in PLAN and root README:

- **CONTEXTUALIZED_AI_MODEL §4** — PLAN now links to `docs/CONTEXTUALIZED_AI_MODEL.md` and `docs/AGENT_API.md` without §4.
- **WHITEPAPER §4.1, §7, §7.4, §7.5** — PLAN now links to `docs/WHITEPAPER.md` (and `docs/SECURITY_GOVERNANCE.md` where applicable) without section numbers.
- **DOCX_REVIEW_INTEGRATION §5, §6, §7** — PLAN now links to `docs/DOCX_REVIEW_INTEGRATION.md` without section numbers.
- **ARCHITECTURE "built from solution up"** — Root README no longer claims this; it defers to docs/ARCHITECTURE.md.

---

## 5. Optional future expansion (docs/)

If you later add more structure to docs/, the following would make PLAN/DECISIONS references more precise (optional):

- Numbered sections in WHITEPAPER (e.g. status model, security/enterprise) for deep links.
- Numbered sections in DOCX_REVIEW_INTEGRATION (bidirectional flow, visualization) for deep links.
- A dedicated "Agent loop" subsection in CONTEXTUALIZED_AI_MODEL if The Agent (optional) is expanded.

Not required for consistency; docs/ is already the source of truth.

---

## 6. What is consistent

- **docs/README, ARCHITECTURE, WHITEPAPER**: Truth ledger + collaboration, ACAL, minimal governance UI required, The Agent optional.
- **REVIEW_MODE** (ACAL): agents propose; humans review/apply.
- **UI_SPEC**: one required minimal governance surface.
- **AGENT_API**: agents read accepted truth and create proposals; no review/apply.
- **HELLO_WORLD_SCENARIO**, **CONFLICT_AND_MERGE_SCENARIO**: end-to-end flow.
- **Root README, CONTEXT, PLAN**: Aligned to docs/ and point into it.

---

## 7. Recommendations (current)

- **Keep docs/ as source of truth** — Do not overwrite docs/ to match older root-led framing.
- **Root and PLAN** — Already updated; keep links as file-level (e.g. `docs/WHITEPAPER.md`) unless docs/ add stable section IDs.
- **Terminology** — Use docs/ terms in new root/PLAN text (truth ledger, ACAL, minimal governance UI, The Agent optional).
- **Optional** — Add a one-line note in docs/README that "Root README and CONTEXT are summaries that point here" if helpful for newcomers.

---

## 8. Summary table

| Doc                                                                                | Role                                                                                        | Status                              |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------- |
| **docs/** (all)                                                                    | **Source of truth**                                                                         | Canonical product and architecture. |
| README (root)                                                                      | Entry point; defers to docs/                                                                | Aligned to docs/.                   |
| CONTEXT.md                                                                         | Project context; defers to docs/                                                            | Aligned to docs/.                   |
| PLAN.md                                                                            | Roadmap; refs docs/                                                                         | Aligned; broken § refs removed.     |
| [Docs index](../README.md)           | Doc index + ACAL                                                                            | Canonical.                          |
| [Architecture](../core/ARCHITECTURE.md) | Components (Truth Store, Policy, Projection, Change Detection, Clients, The Agent optional) | Canonical.                          |
| [Whitepaper](../WHITEPAPER.md)       | Problem, solution, ACAL, enterprise                                                         | Canonical.                          |
| [Contextualized AI Model](../appendix/CONTEXTUALIZED_AI_MODEL.md) | Context for agents; leakage policy                                                          | Canonical.                          |
| [Agent API](../core/AGENT_API.md)    | Safe agent contract                                                                         | Canonical.                          |
| [UI Specification](../core/UI_SPEC.md) | Minimal governance UI                                                                       | Canonical.                          |

---

**Conclusion:** The **docs/ folder is the source of truth**. Root README, CONTEXT, and PLAN have been aligned to docs/ (enterprise truth governance, truth ledger + collaboration layer, ACAL, minimal governance UI required, The Agent optional). Broken section references in PLAN have been removed or replaced with file-level links. No further changes to docs/ are required for consistency.
