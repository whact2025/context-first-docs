# Documentation Analysis: Inconsistencies and Gaps

This document summarizes an analysis of all documentation in `docs/` for inconsistencies, broken references, and gaps. **Date:** 2026-01-29.

**Updates applied (2026-01-29):** Section 6 numbering in WHITEPAPER fixed (8.x → 6.x); §8.9 → §6.9 in RISKS, QUESTIONS, PLAN, DECISIONS; docs/README expanded with full index, link convention, and DOCS_ANALYSIS; ARCHITECTURE and root README linked to DOCX_REVIEW_INTEGRATION; "See also" added to HELLO_WORLD and CONFLICT_AND_MERGE scenarios; selected link normalizations (same-folder and ../ for repo root) in RECONCILIATION_STRATEGIES, WHITEPAPER_APPENDIX, CONTEXTUALIZED_AI_MODEL.

---

## 1. Inconsistencies

### 1.1 WHITEPAPER.md — Wrong section numbering under Section 6

**Issue:** Section **6. Comparative analysis** has subsections numbered **8.1, 8.2, … 8.9** instead of **6.1 … 6.9**.

- **Location:** `docs/WHITEPAPER.md` from ~line 1036.
- **Current:** `## 6. Comparative analysis` then `### 8.1 "Hodgepodge" workflows`, `### 8.2`, … `### 8.9 Office and Google Docs`.
- **Expected:** `### 6.1 "Hodgepodge" workflows`, `### 6.2`, … `### 6.9 Office and Google Docs`.
- **Impact:** Cross-references like "whitepaper §8.9" are correct for the *content* (Office/Docs) but the parent section is 6, not 8. Section **7** is "Security, privacy, and governance" (line 1182); **8** is "Implementation status" (line 1312). Renumbering 8.x → 6.x under Section 6 would make the outline consistent.

**Recommendation:** Renumber all subsections under `## 6. Comparative analysis` from `8.1`–`8.9` to `6.1`–`6.9`. Then update any references to "§8.9" (or similar) to "§6.9" where they refer to the comparative analysis.

---

### 1.2 Link path convention (docs-internal vs repo-root)

**Issue:** Mixed use of paths for links from within `docs/`:

- **Same-folder (no prefix):** e.g. `[Hello World](HELLO_WORLD_SCENARIO.md)`, `[Conflict and Merge](CONFLICT_AND_MERGE_SCENARIO.md)` in ARCHITECTURE.md, REVIEW_MODE.md, USAGE.md, WHITEPAPER.md.
- **With `docs/` prefix:** e.g. `docs/CONFLICT_AND_MERGE_SCENARIO.md`, `docs/WHITEPAPER.md`, `docs/REVIEW_MODE.md` in RECONCILIATION_STRATEGIES.md, WHITEPAPER_APPENDIX.md, CONTEXTUALIZED_AI_MODEL.md, etc.

**Impact:**

- When the **repo root** is the base (e.g. GitHub), `docs/CONFLICT_AND_MERGE_SCENARIO.md` resolves correctly; `HELLO_WORLD_SCENARIO.md` from `docs/ARCHITECTURE.md` also works (relative to `docs/`).
- When a **doc site or viewer** uses `docs/` as the root, `docs/CONFLICT_AND_MERGE_SCENARIO.md` would resolve to `docs/docs/...` and break. Same-folder links (no prefix) still work.

**Recommendation:** Pick one convention and stick to it:

- **Option A:** Use **same-folder relative** links only for files inside `docs/` (e.g. `CONFLICT_AND_MERGE_SCENARIO.md`, `WHITEPAPER.md`). Use `../DECISIONS.md`, `../CONTEXT.md` for repo-root files. Works when `docs/` is the served root.
- **Option B:** Use **repo-root relative** links (e.g. `docs/WHITEPAPER.md`) everywhere and assume rendering from repo root (e.g. GitHub). Then links to repo-root files stay as `DECISIONS.md` only if the viewer’s base is repo root; otherwise they should be `../DECISIONS.md`.

Document the chosen convention in CONTRIBUTING or docs/README.

---

### 1.3 References to repo-root files (DECISIONS.md, CONTEXT.md, PLAN.md)

**Issue:** Many docs in `docs/` refer to `DECISIONS.md`, `CONTEXT.md`, `PLAN.md` without a path (e.g. WHITEPAPER.md, CONTEXTUALIZED_AI_MODEL.md, SELF-REFERENCE.md).

**Impact:** When viewing from a **docs-only** context (e.g. `docs/` as web root), these resolve to `docs/DECISIONS.md` etc., which do not exist.

**Recommendation:** If the doc set is always consumed from repo root, leave as-is but state that in docs/README. If you want docs to be viewable with `docs/` as root, change to `../DECISIONS.md`, `../CONTEXT.md`, `../PLAN.md`.

---

## 2. Gaps

### 2.1 docs/README.md — Incomplete index

**Issue:** `docs/README.md` does not list several important docs:

- **Canonical scenarios:** HELLO_WORLD_SCENARIO, CONFLICT_AND_MERGE_SCENARIO — ✅ listed.
- **Other key docs:** WHITEPAPER, CONTEXTUALIZED_AI_MODEL, REVIEW_MODE, AGENT_API, RECONCILIATION_STRATEGIES, UI_SPEC, USAGE — ✅ listed (partial).
- **Missing from "Other key docs" (or table):**
  - CHANGE_DETECTION.md
  - SELF-REFERENCE.md
  - DOCX_REVIEW_INTEGRATION.md
  - STORAGE_ARCHITECTURE.md
  - STORAGE_IMPLEMENTATION_PLAN.md
  - WHITEPAPER_APPENDIX.md

**Impact:** Readers who use `docs/README.md` as the map won’t discover these unless they browse the folder.

**Recommendation:** Add a second table or bullet list: “Storage, scenarios, and reference” (or similar) and include CHANGE_DETECTION, SELF-REFERENCE, DOCX_REVIEW_INTEGRATION, STORAGE_ARCHITECTURE, STORAGE_IMPLEMENTATION_PLAN, WHITEPAPER_APPENDIX with one-line descriptions.

---

### 2.2 Root README.md — Missing links to some docs

**Issue:** Root `README.md` links to HELLO_WORLD_SCENARIO, CONFLICT_AND_MERGE, CHANGE_DETECTION, RECONCILIATION_STRATEGIES, WHITEPAPER, WHITEPAPER_APPENDIX, CONTEXTUALIZED_AI_MODEL, ARCHITECTURE. It does **not** link to:

- DOCX_REVIEW_INTEGRATION.md
- STORAGE_ARCHITECTURE.md
- STORAGE_IMPLEMENTATION_PLAN.md
- SELF-REFERENCE.md
- UI_SPEC.md

**Impact:** New users may not find DOCX review options, storage design, self-reference, or UI spec unless they open the repo or docs/README.

**Recommendation:** Either add a short “More docs” row in the Start Here table (e.g. “Storage & implementation” → STORAGE_ARCHITECTURE / STORAGE_IMPLEMENTATION_PLAN; “DOCX / Word–Excel review” → DOCX_REVIEW_INTEGRATION; “UI spec” → UI_SPEC; “Self-reference” → SELF-REFERENCE) or add a single “Full doc index” link to `docs/README.md` and keep the root README minimal.

---

### 2.3 DOCX_REVIEW_INTEGRATION.md — Orphaned from main doc map

**Issue:** DOCX_REVIEW_INTEGRATION.md is not linked from ARCHITECTURE.md, docs/README.md, or root README.md.

**Impact:** The “use Word/Excel for review” analysis is hard to discover.

**Recommendation:** Add DOCX_REVIEW_INTEGRATION to docs/README (see 2.1). Optionally add a short line in ARCHITECTURE.md § Projections (Markdown and DOCX): “For using DOCX/Word/Excel as a review surface, see `docs/DOCX_REVIEW_INTEGRATION.md`.”

---

### 2.4 Scenario docs — No back-links to REVIEW_MODE / RECONCILIATION / WHITEPAPER

**Issue:** HELLO_WORLD_SCENARIO.md and CONFLICT_AND_MERGE_SCENARIO.md do not link back to REVIEW_MODE.md, RECONCILIATION_STRATEGIES.md, or WHITEPAPER.md.

**Impact:** Someone reading a scenario first may not know where to go for invariant semantics or reconciliation policy.

**Recommendation:** Add a short “See also” at the end of each scenario: REVIEW_MODE.md (invariant), RECONCILIATION_STRATEGIES.md (conflict policy), and WHITEPAPER.md (full design).

---

### 2.5 CHANGE_DETECTION — Not in docs/README

**Issue:** CHANGE_DETECTION.md is linked from root README but not from docs/README.md.

**Recommendation:** Include CHANGE_DETECTION in the docs/README index (see 2.1).

---

### 2.6 STORAGE_ARCHITECTURE vs STORAGE_IMPLEMENTATION_PLAN

**Issue:** Both exist; WHITEPAPER and others reference STORAGE_IMPLEMENTATION_PLAN. CHANGE_DETECTION references STORAGE_ARCHITECTURE. The relationship (architecture vs implementation plan) is not stated in docs/README.

**Recommendation:** In docs/README, list both and clarify: e.g. “STORAGE_ARCHITECTURE — dual storage options and abstraction; STORAGE_IMPLEMENTATION_PLAN — gap analysis and implementation tasks.”

---

## 3. Cross-reference and section checks (summary)

- **Whitepaper §4.1, §7.1, §7.4, §7.5:** Exist and are referenced correctly (after fixing §6 vs §8 numbering under Section 6).
- **Whitepaper §5.3.4:** Exists (Examples: conflict vs merge vs staleness).
- **ARCHITECTURE “§4” (Contextualize module):** Correct; ARCHITECTURE has “### 4. Contextualize module”.
- **REVIEW_MODE → HELLO_WORLD_SCENARIO:** Link present and correct (same-folder).
- **RECONCILIATION_STRATEGIES → CONFLICT_AND_MERGE_SCENARIO:** Uses `docs/CONFLICT_AND_MERGE_SCENARIO.md`; see link convention (1.2).
- **All referenced doc files** (HELLO_WORLD_SCENARIO, CONFLICT_AND_MERGE, REVIEW_MODE, AGENT_API, STORAGE_IMPLEMENTATION_PLAN, STORAGE_ARCHITECTURE, CONTEXTUALIZED_AI_MODEL, WHITEPAPER, WHITEPAPER_APPENDIX, RECONCILIATION_STRATEGIES, etc.) **exist** in `docs/`. No broken file targets within `docs/`.

---

## 4. Terminology and consistency (spot check)

- **ACAL,** **review mode,** **proposal → review → apply,** **projection (Markdown/DOCX),** **ContextStore,** **accepted truth** — used consistently across WHITEPAPER, ARCHITECTURE, REVIEW_MODE, USAGE.
- **Provenance chains / decision–rationale traversal** — aligned between AGENT_API, ARCHITECTURE, WHITEPAPER.
- **DOCX** — described as export-only projection in ARCHITECTURE, WHITEPAPER, USAGE, DOCX_REVIEW_INTEGRATION; consistent.

---

## 5. Recommended action list (priority)

| Priority | Action |
|----------|--------|
| **High** | Fix WHITEPAPER Section 6 numbering: change 8.1–8.9 to 6.1–6.9 and update references that assume “§8” for comparative analysis. |
| **High** | Update docs/README.md to include CHANGE_DETECTION, SELF-REFERENCE, DOCX_REVIEW_INTEGRATION, STORAGE_ARCHITECTURE, STORAGE_IMPLEMENTATION_PLAN, WHITEPAPER_APPENDIX. |
| **Medium** | Choose and document link convention (same-folder vs repo-root); normalize links and repo-root paths (../DECISIONS.md vs DECISIONS.md) if needed. |
| **Medium** | Add DOCX_REVIEW_INTEGRATION to ARCHITECTURE § Projections and/or root README. |
| **Low** | Add “See also” (REVIEW_MODE, RECONCILIATION_STRATEGIES, WHITEPAPER) to HELLO_WORLD_SCENARIO and CONFLICT_AND_MERGE_SCENARIO. |
| **Low** | Add “More docs” or “Full doc index” in root README for STORAGE_*, UI_SPEC, SELF-REFERENCE, DOCX_REVIEW_INTEGRATION. |

---

## 6. File inventory (docs/)

| File | Referenced from (within docs/) | In docs/README? | In root README? |
|------|--------------------------------|-----------------|-----------------|
| AGENT_API.md | ARCHITECTURE, CONTEXTUALIZED_AI_MODEL | Yes | No (indirect via ARCHITECTURE) |
| ARCHITECTURE.md | CONTEXTUALIZED_AI_MODEL, SELF-REFERENCE, DOCX_REVIEW_INTEGRATION | No (only “Full system design” from root) | Yes |
| CHANGE_DETECTION.md | — | **No** | Yes |
| CONFLICT_AND_MERGE_SCENARIO.md | WHITEPAPER, RECONCILIATION_STRATEGIES, WHITEPAPER_APPENDIX | Yes | Yes |
| CONTEXTUALIZED_AI_MODEL.md | WHITEPAPER_APPENDIX | Yes | Yes |
| DOCX_REVIEW_INTEGRATION.md | — | **No** | **No** |
| HELLO_WORLD_SCENARIO.md | REVIEW_MODE, USAGE, WHITEPAPER, ARCHITECTURE | Yes | Yes |
| README.md | — | — | — |
| RECONCILIATION_STRATEGIES.md | WHITEPAPER | Yes | Yes |
| REVIEW_MODE.md | Many | Yes | No (indirect) |
| SELF-REFERENCE.md | — | **No** | **No** |
| STORAGE_ARCHITECTURE.md | CHANGE_DETECTION | **No** | **No** |
| STORAGE_IMPLEMENTATION_PLAN.md | WHITEPAPER, CONTEXTUALIZED_AI_MODEL, SELF-REFERENCE | **No** | **No** |
| UI_SPEC.md | — | Yes | **No** |
| USAGE.md | SELF-REFERENCE | Yes | No (indirect) |
| WHITEPAPER.md | Many | Yes | Yes |
| WHITEPAPER_APPENDIX.md | WHITEPAPER_APPENDIX (self), root README | **No** | Yes |

This table can be used to fix the index and README gaps above.
