# Using DOCX / Word / Excel for Review and Acceptance

This document analyzes what is needed to use **DOCX (and Word/Excel)** as a **means for review and acceptance** in TruthLayer — i.e., reviewers performing accept/reject in Word or Excel rather than (or in addition to) the web UI, VS Code extension, or API.

**Current state:** DOCX is an **export-only projection** for distribution (whitepaper, reports). The **canonical review path** is: `submitReview({ proposalId, action: "accept" | "reject", ... })` and `applyProposal(proposalId)` on the context store (see `docs/REVIEW_MODE.md`, `src/types/context-store.ts`). No DOCX or Office round-trip exists today.

---

## 1. Goal and contract

**Goal:** Allow reviewers to accept or reject proposals using Word (DOCX) or Excel, so that their decisions flow back into TruthLayer (store receives `submitReview` and, on accept, `applyProposal`).

**TruthLayer contract:**

- `submitReview(review: Review)` — `review.action` is `"accept"` or `"reject"`; `review.proposalId`, `review.reviewer`, etc.
- `applyProposal(proposalId)` — called only after a proposal is accepted (e.g. by the same client or a backend).

So any “DOCX/Word/Excel as review surface” must ultimately **produce calls to** `submitReview` (and optionally `applyProposal`) against the store or API.

---

## 2. Two high-level approaches

| Approach | Extension? | How review gets back into TruthLayer |
|----------|------------|--------------------------------------|
| **A. Native Word/Excel** | No | Export a document/spreadsheet that encodes proposals; reviewer uses default Word/Excel behavior; **import** the result (or a companion file) and map back to `submitReview` / `applyProposal`. |
| **B. Office Add-in** | Yes (Word or Excel Add-in) | Add-in talks to TruthLayer API; shows proposals; reviewer clicks Accept/Reject in task pane; Add-in calls API (`submitReview`, `applyProposal`). DOCX/Excel can still be a **view** of the projection. |

Both can coexist: e.g. lightweight “no extension” path for Excel table review + optional Add-in for richer Word integration.

---

## 3. Option A: Native Word / Excel (no extension)

### 3.1 Excel — simplest “no extension” path

**Idea:** Represent pending proposals as a table. Reviewer fills Accept/Reject. A script or backend reads the file and calls the API.

**Flow:**

1. **Export:** Generate a spreadsheet (CSV or XLSX) with columns such as: `ProposalId`, `NodeId`, `Title`, `Summary`, `Accept/Reject` (empty), optional `Comment`.
2. **Review:** Reviewer opens in Excel, fills `Accept` or `Reject` (and optionally comment) using **default Excel behavior** — no Add-in.
3. **Import:** A script (Node, Python, or backend) reads the saved CSV/XLSX, finds rows with Accept/Reject set, and for each calls `submitReview({ proposalId, action, reviewer, comment })` and, for accepted proposals, `applyProposal(proposalId)`.

**Requirements:**

- Defined format for the export (column names, allowed values).
- Import script or API endpoint that: reads file → validates → calls store (or HTTP API).
- Optional: export from playground or CLI; import via CLI or “upload review file” in web UI.

**Verdict:** No extension. Uses default Excel behavior. Straightforward to implement and document.

---

### 3.2 Word (DOCX) — native Track Changes or Comments

**Idea:** Export a DOCX where “proposed changes” are represented using Word’s **Track Changes** or **Comments**. Reviewer uses Word’s built-in **Accept/Reject** (or comment resolution). We **import** the DOCX (or a companion manifest) and infer accept/reject per proposal.

**Challenges:**

1. **Mapping proposals to Word revisions**  
   TruthLayer proposals are structured (proposal ID, node ID, field, operations). Word’s model is **position-based** (insertions/deletions in the document stream). We need a stable **mapping** from each “change” in the DOCX back to a `proposalId` (and ideally operation/node).

2. **Export format**  
   - **Track Changes:** Export DOCX so that “proposed” text is marked as insertions (`w:ins`) and optionally “current accepted” as deletions (`w:del`) in a compare view. Each revision must be **tagged** (e.g. custom XML, bookmark, or a sidecar) with `proposalId` so we know which Word revision corresponds to which proposal.  
   - **Comments:** Export DOCX with one comment per proposal (or per operation); comment text or metadata carries `proposalId`. Reviewer resolves comment (e.g. “Resolved – Accept” vs “Resolved – Reject”). Import: parse OOXML for resolved comments and map resolution + optional reply to accept/reject.

3. **Import (round-trip)**  
   - Parse DOCX (OOXML): read `word/document.xml` (and related parts) for revision elements (`w:ins`, `w:del`, etc.) or comments (`w:commentReference`, comments part).  
   - Reconstruct which revisions/comments were accepted or rejected (Word stores revision state; after “Accept All” some elements are merged into content and revision markup removed).  
   - Map each revision/comment back to `proposalId` using the tagging from export.  
   - Call `submitReview({ proposalId, action: "accept"|"reject", reviewer })` and then `applyProposal` for accepted ones.

**Requirements:**

- **Export:** Generator that produces DOCX with proposals encoded as Track Changes or Comments, with reliable `proposalId` (and optionally node/operation) tagging. May require custom XML or bookmarks in OOXML.
- **Import:** Parser for DOCX (e.g. Open XML SDK, or JS lib that reads OOXML) to detect accepted/rejected revisions or resolved comments and extract the tags.
- **Determinism:** Export order and tagging scheme must be stable so that re-import after reviewer action is unambiguous.

**Verdict:** Possible with **default Word behavior** (no Add-in), but non-trivial: export format design, OOXML parsing, and mapping from linear document revisions to graph-based proposals. Best treated as a dedicated project (design doc, then implementation).

---

## 4. Option B: Office Add-in (extension)

**Idea:** A **Word Add-in** or **Excel Add-in** (Office JS / Microsoft 365) that:

- Connects to TruthLayer backend (REST or GraphQL).
- Shows list of open proposals (and optionally node/proposal detail) in a **task pane**.
- Lets reviewer choose **Accept** or **Reject** (and optionally add comment).
- On submit, the Add-in calls the TruthLayer API: `submitReview`, and if accept then `applyProposal`.

The **document** (DOCX or workbook) can still be a **projection view** (e.g. “current accepted + proposed” exported as DOCX) for reading; the **review actions** go through the Add-in and API, not through parsing the document.

**Requirements:**

- TruthLayer API exposed over HTTP (already planned).
- Add-in project (Word and/or Excel), auth to your API (e.g. same gateway as web UI).
- Task pane UI: proposal list, Accept/Reject, optional comment; call `POST /review` (or equivalent) and `POST /apply`.

**Verdict:** **Extension** (Add-in). No need to parse DOCX round-trip; review semantics stay in the API. DOCX/Excel remain “view” of the projection; acceptance is explicit in the Add-in. Best UX for “review in Word/Excel” with minimal ambiguity.

---

## 5. Summary and recommendation

| Method | Extension? | Integrates with default Word/Excel? | Complexity | Use case |
|--------|------------|-------------------------------------|------------|----------|
| **Excel table + import script** | No | Yes — default Excel | Low | Reviewers who prefer a table (ProposalId, Accept/Reject, Comment); batch review. |
| **Word Track Changes / Comments + DOCX import** | No | Yes — default Word | High | Review in DOCX with native Accept/Reject; requires export tagging and OOXML import. |
| **Office Add-in (Word or Excel)** | Yes | Add-in inside Word/Excel | Medium | Integrated UX: task pane + API; DOCX as view only. |

**Recommendation:**

1. **Short term (no extension):** Add **Excel-based review**: define export format (CSV/XLSX with ProposalId, Summary, Accept/Reject, Comment), and an **import script** (or API) that reads the file and calls `submitReview` / `applyProposal`. Document in USAGE and ARCHITECTURE. This gives “DOCX/Excel as a means for review” for the Excel path without any Add-in.
2. **Medium term (optional extension):** Build a **Word or Excel Add-in** that uses the TruthLayer API for review (task pane: proposals → Accept/Reject → API). DOCX export stays as today (distribution); review is done in the Add-in, not by re-importing DOCX.
3. **Optional (later):** If there is strong need for “review entirely inside Word with Track Changes and no Add-in”, invest in the **DOCX round-trip** (export with tagged revisions/comments, import parser, mapping to proposals). Design doc first (export schema, OOXML mapping, edge cases).

**Is it an extension or default behavior?**

- **Default Word/Excel behavior** can be used **without an extension** for **Excel** (table + import script) and in **theory** for Word (Track Changes/Comments + DOCX import), but the Word path is complex and requires custom export/import.
- **Tight integration** (see proposals in-context, one-click Accept/Reject, live sync) is best done with an **Office Add-in** that calls the API; then Word/Excel are the host, but “review” is implemented by the Add-in, not by parsing the document.

---

## 6. References

- Review contract: `docs/REVIEW_MODE.md`, `src/types/context-store.ts` (`submitReview`, `applyProposal`), `src/types/proposal.ts` (`Review`).
- DOCX export today: `scripts/build-whitepaper-docx.js`, `scripts/README.md`, `docs/ARCHITECTURE.md` § Projections (Markdown and DOCX).
- Word OOXML / Track Changes: [Detecting tracked revisions in Open XML](https://www.ericwhite.com/blog/using-xml-dom-to-detect-tracked-revisions-in-an-open-xml-wordprocessingml-document/), [Accepting revisions programmatically](https://learn.microsoft.com/en-us/archive/blogs/ericwhite/accepting-revisions-in-open-xml-wordprocessingml-documents).
- Office Add-ins: [Office Add-ins platform](https://learn.microsoft.com/en-us/office/dev/add-ins/).
