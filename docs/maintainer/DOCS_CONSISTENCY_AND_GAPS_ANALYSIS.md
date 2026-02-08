# Documentation: Consistency, Legibility, and Solution Gaps

**Date:** 2026-02-08  
**Scope:** Full document set (root, docs/, CONTEXT, DECISIONS, PLAN, RISKS, QUESTIONS).

This analysis identifies **wording/terminology inconsistencies**, **legibility issues**, **broken or ambiguous references**, and **gaps in the proposed solution**.

---

## 1. Wording and terminology inconsistencies

### 1.1 “The Agent” vs “Agent Runtime” vs “agent”

- **docs/** (WHITEPAPER, ARCHITECTURE, AGENT_API, CONTEXT, PLAN) consistently use **“The Agent (we build it)”** or **“the agent”** (product component that reads truth and creates proposals).
- **docs/maintainer/DOCS_ANALYSIS.md** uses **“Agent Runtime”** and **“Agent Runtime optional”** in several places (e.g. §2 table, §6, §7, §8, conclusion). That term does not appear in the canonical docs.
- **Recommendation:** Standardize on **“The Agent”** (when referring to the product component) and **“agent”** (lowercase when referring to the role/capability). Remove or replace “Agent Runtime” in DOCS_ANALYSIS with “The Agent” and “optional” where appropriate.

### 1.2 “Ratify” vs “review and apply”

- Most of the doc set uses **“ratify”** as the human action (e.g. “humans ratify,” “Ratify truth”) and **“review and apply”** as the concrete steps. This is consistent.
- A few places say only “review/apply” without “ratify.” Keeping both is fine: “ratify” is the umbrella; “review and apply” is the mechanism. No change required, but ensure new text doesn’t drop “ratify” where the tagline or positioning is stated.

### 1.3 MCP: “we provide it” vs “optional”

- **CONTEXT.md**, **README**, **ARCHITECTURE**, **AGENT_API**, **WHITEPAPER**: MCP server is described as something **the solution provides** (shipped, not optional for product direction).
- **OPTIONAL_INTEGRATIONS.md** says the MCP server is “not optional for the product direction—the solution ships it,” which is consistent.
- **docs/README** and root README list MCP under “what’s in this repo” / “the solution provides.” No inconsistency; just ensure “optional” is never used for the MCP server itself (only for MCP _resources_ or other integrations).

### 1.4 DOCX / Word integration: “Phase 2” vs “optional”

- **DOCX_REVIEW_INTEGRATION.md** describes DOCX as “optional review surface”; PLAN and DECISIONS describe Word/Google as optional (Phase 3/6).
- **DOCS_ANALYSIS** previously referred to “DOCX Review Integration (Phase 2 / optional)”; DOCX is optional, not a specific phase number. Recommendation: avoid “Phase 2” for DOCX unless the roadmap explicitly assigns it; use “optional” consistently.

---

## 2. Legibility and clarity

### 2.1 Dense paragraphs

- **CONTEXT.md** and **PLAN.md** contain long ctx blocks and intro paragraphs with many cross-references in a single sentence. Example: PLAN.md first bullet (source of truth) is one long sentence with multiple doc links. **Recommendation:** Break into 2–3 short sentences or a small bullet list so the “source of truth” and “what TruthLayer is” are scannable.

### 2.2 Duplicated framing

- The same high-level framing (truth ledger + collaboration layer, ACAL, minimal governance UI required, agent proposes / humans ratify) appears in README, CONTEXT, PLAN, docs/README, WHITEPAPER. This aids consistency but adds length. **Recommendation:** Keep one “elevator” version in docs/README (and root README); elsewhere use short pointers (“see docs/”) to avoid copy-paste drift.

### 2.3 Acronyms and jargon

- **ACAL** is expanded (Accepted → Candidate → Accepted → Ledger) in docs/README and WHITEPAPER; elsewhere it’s used without expansion. **Recommendation:** First use in each major doc should expand ACAL; later uses can be “ACAL” only.
- **RBAC provider abstraction**, **config root**, **workspaceId** are used consistently; no change needed.

### 2.4 Typo / phrasing

- User request referred to “ligibility”; interpreted as **legibility** (readability). No recurring typo found in the doc set for that term.

---

## 3. Broken or incorrect references

### 3.1 Wrong path: SELF-REFERENCE

- **CONTEXT.md** (note-001): `See docs/SELF-REFERENCE.md for more details.`
- **Actual path:** `docs/appendix/SELF-REFERENCE.md`
- **Fix:** Change to `docs/appendix/SELF-REFERENCE.md`.

### 3.2 Wrong path: STORAGE_ARCHITECTURE

- **DECISIONS.md** (decision-005): `See docs/STORAGE_ARCHITECTURE.md for full schema design`
- **Actual path:** `docs/engineering/storage/STORAGE_ARCHITECTURE.md`
- **Fix:** Change to `docs/engineering/storage/STORAGE_ARCHITECTURE.md`.

### 3.3 Broken relative link in ARCHITECTURE

- **docs/core/ARCHITECTURE.md** (Policy & Governance): `See [SECURITY_GOVERNANCE.md](SECURITY_GOVERNANCE.md).`
- From `docs/core/`, that resolves to `docs/core/SECURITY_GOVERNANCE.md`, which does not exist. The file is in **docs/reference/**.
- **Fix:** Use `[../reference/SECURITY_GOVERNANCE.md](../reference/SECURITY_GOVERNANCE.md)`.

### 3.4 DOCS_ANALYSIS summary table paths

- **docs/maintainer/DOCS_ANALYSIS.md** §8 uses shorthand like `docs/ARCHITECTURE`, `docs/AGENT_API`, `docs/WHITEPAPER`, `docs/CONTEXTUALIZED_AI_MODEL`. These are doc names, not full paths. The real paths are `docs/core/ARCHITECTURE.md`, `docs/core/AGENT_API.md`, `docs/WHITEPAPER.md`, `docs/appendix/CONTEXTUALIZED_AI_MODEL.md`. If the table is used for navigation or tooling, consider adding correct relative paths; otherwise the shorthand is acceptable as long as it’s clear these are doc titles, not file paths.

---

## 4. Gaps in the proposed solution

### 4.1 Implementation vs design

- **Conflict detection and merge** are designed (RECONCILIATION_STRATEGIES, CONFLICT_AND_MERGE_SCENARIO) and partially implemented in the Rust server; “to be extended in the Rust server” is stated in ARCHITECTURE and DECISIONS. **Gap:** No single “current implementation status” for conflict/stale/merge (which endpoints exist, which are stubbed, which are in TS only). **Recommendation:** Add a short “Implementation status” subsection in ARCHITECTURE or in server/README listing: queryNodes, getNode, createProposal, submitReview, applyProposal, reset; and for detectConflicts, isProposalStale, mergeProposals: “designed; server implementation status: …”.

### 4.2 Minimal governance UI

- **UI_SPEC** and PLAN require a minimal governance UI (list proposals, accept/reject/apply). The **playground** implements parts of this (proposals, review, apply) but is described as a “minimal governance UI” and “Scenario Runner” in different places. **Gap:** It is not stated explicitly whether the current playground _is_ the minimal governance UI for v1 or a prototype. **Recommendation:** In README or UI_SPEC, state clearly: “The current playground provides a prototype of the minimal governance UI; the required production UI may be refined from this.”

### 4.3 Workspace and tenancy

- **WorkspaceId** is mandated (tenancy, RBAC, audit), but the **Rust server** and **playground** do not yet expose workspace-scoped APIs or a workspace selector. **Gap:** How workspaceId is determined (single default, config, request header) is not specified for the current server. **Recommendation:** Document in server/README or ARCHITECTURE: “Current server behavior: single workspace (default or from config); workspaceId in API is reserved for future use.”

### 4.4 Applied vs accepted state

- **decision-021** and **REVIEW_MODE** require an explicit “applied” state (e.g. appliedAt/appliedBy). **task-061** is open: “Implement explicit ‘applied’ state for proposals.” **Gap:** Data model and API may not yet distinguish “accepted but not applied” from “applied” in a way that prevents double-apply. **Recommendation:** Keep task-061 and reference it in REVIEW_MODE or DATA_MODEL_REFERENCE until implemented; add a one-line “Current status: …” in REVIEW_MODE if helpful.

### 4.5 Agent identity and audit

- **question-034** (open): How is The Agent attributed in the audit log when it creates a proposal? **question-035** (open): How do we guarantee the agent never receives submitReview or applyProposal? **Gap:** Audit and enforcement for agent identity and tool boundaries are not yet designed in one place. **Recommendation:** Resolve or document these in SECURITY_GOVERNANCE or AGENT_API (e.g. “Agent actor type; tool allowlist; audit field for proposal.createdBy”).

### 4.6 File-based persistence

- **Phase 2** and tasks (task-006, task-047, task-048) describe file-based storage and storage abstraction. **Current state:** Rust server has in-memory store only; no file-backed or MongoDB backend. **Gap:** No step-by-step “first file-based deployment” guide (config layout, directory structure, migration from in-memory). **Recommendation:** When file-based is implemented, add a short “First file-based setup” in DEVELOPMENT or server/README; until then, keep STORAGE_IMPLEMENTATION_PLAN as the authority for what’s next.

### 4.7 Open questions that block design

- **question-008:** Multi-approval when approvers disagree (workflow semantics).
- **question-010:** Withdraw/reopen proposal lifecycle.
- **question-011:** Namespaces scope (deferred to workspaceId-only for now).
- **question-035:** Guarantee agent never gets review/apply (enforcement mechanism).
- **question-034:** Agent attribution in audit.

These are called out in QUESTIONS.md; they affect UI_SPEC, REVIEW_MODE, and SECURITY_GOVERNANCE. No doc currently summarizes “design blocked by open questions” in one place. **Recommendation:** Optional: add a “Design blockers” subsection in PLAN or QUESTIONS that lists open questions that block specific design decisions (e.g. “question-035 blocks final AGENT_API safety section”).

---

## 5. Summary of recommended fixes

| Priority | Item                                               | Action                                                                                                                       |
| -------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| High     | CONTEXT.md SELF-REFERENCE link                     | Change to `docs/appendix/SELF-REFERENCE.md`                                                                                  |
| High     | DECISIONS.md STORAGE_ARCHITECTURE link             | Change to `docs/engineering/storage/STORAGE_ARCHITECTURE.md`                                                                 |
| High     | docs/core/ARCHITECTURE.md SECURITY_GOVERNANCE link | Change to `../reference/SECURITY_GOVERNANCE.md`                                                                              |
| Medium   | DOCS_ANALYSIS “Agent Runtime”                      | Replace with “The Agent” and “optional” where appropriate                                                                    |
| Medium   | Legibility                                         | Shorten PLAN.md and CONTEXT.md intro sentences; expand ACAL on first use per doc                                             |
| Low      | DOCS_ANALYSIS summary table                        | Add correct paths if used for tooling                                                                                        |
| Ongoing  | Gaps                                               | Document “current implementation status” for conflict/merge; workspace and applied state; agent audit/identity when resolved |

---

**Conclusion:** The document set is largely consistent and aligned to docs/ as source of truth. The main issues are **three broken references** (SELF-REFERENCE, STORAGE_ARCHITECTURE, SECURITY_GOVERNANCE in ARCHITECTURE), **terminology drift** in DOCS_ANALYSIS (“Agent Runtime”), and **solution gaps** around implementation status (conflict/merge, workspace, applied state, agent audit). Fixing the broken links and aligning terminology will improve consistency; addressing the gaps will keep the solution narrative accurate as implementation progresses.
