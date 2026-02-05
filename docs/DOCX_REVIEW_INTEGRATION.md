# Using DOCX / Word / Excel for Review and Acceptance

This document analyzes what is needed to use **DOCX (and Word/Excel)** as a **means for review and acceptance** in TruthLayer — i.e., reviewers performing accept/reject in Word or Excel rather than (or in addition to) the web UI, VS Code extension, or API.

**Current state (see also [ARCHITECTURE.md](ARCHITECTURE.md) § Projections):** DOCX is an **export-only projection** for distribution (whitepaper, reports). The **canonical review path** is: `submitReview({ proposalId, action: "accept" | "reject", ... })` and `applyProposal(proposalId)` on the context store (see `docs/REVIEW_MODE.md`, `src/types/context-store.ts`). No DOCX or Office round-trip exists today.

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

## 5. Bidirectional flow: create, modify, comment, and review from Word/Google

**Requirement:** Data must flow in **both directions**. Users should be able to **create** proposals, **modify** proposals, **comment** on proposals, and **review** (accept/reject) from within Word or Google Docs, with all changes syncing back to the context store. The document (or companion surface) should also reflect the **current state** from the store (accepted nodes, open proposals, comments).

### 5.1 Store → Word/Google (export / refresh)

| What | How it flows |
|------|----------------|
| **Accepted context** | Export a DOC/Docx (or section) that represents the current accepted graph as narrative or structured content (e.g. one section per node, or a table). |
| **Open proposals** | List or embed each proposal in the doc (e.g. as comments, or a “Proposals” section with tagged entries). Include proposalId, nodeId, summary, proposed text, author, so the reviewer sees what’s pending. |
| **Comments** | Export proposal comments (and optionally anchored reviewer feedback) into the doc — e.g. as comment threads attached to the right proposal, or as a sidebar/list. |
| **Refresh** | Re-export or “Sync from TruthLayer” so the doc reflects the latest store state (after others accept/reject or add comments). |

So the **document** (or an Add-in pane) is a **projection** of the store: accepted truth + open proposals + comments.

### 5.2 Word/Google → Store (create, modify, comment, review)

| Action | How it flows back | Store contract |
|--------|-------------------|----------------|
| **Create proposal** | User adds new content (e.g. a new “proposal” comment, or a new row/section) that represents “I propose to add/change node X.” Import or Add-in maps that to `createProposal(...)`. | `createProposal(proposal)` |
| **Modify proposal** | User edits the proposed text or metadata in the doc (e.g. edits the comment body or a tracked change). Import or Add-in maps that to `updateProposal(proposalId, updates)`. | `updateProposal(proposalId, updates)` |
| **Comment** | User replies to a proposal comment or adds an anchored comment. Import or Add-in maps that to `addProposalComment(proposalId, comment)` (and optionally anchor to node/field). | `addProposalComment` (see `ContextStore`) |
| **Review (accept/reject)** | User marks the proposal as Accept or Reject (e.g. resolves comment with “Accept”/“Reject,” or fills a cell in a table). Import or Add-in calls `submitReview({ proposalId, action, reviewer, comment })` and, on accept, `applyProposal(proposalId)`. | `submitReview(review)`, `applyProposal(proposalId)` |

So **every authoring action** in the doc (create, edit, comment, accept/reject) has a **defined mapping** to the store API. That can be implemented by:

- **Add-in / extension:** Task pane and in-doc actions call the API directly; no need to “import” the document.
- **Native doc only:** Export a structured doc (e.g. comments tagged with proposalId); user works in Word/Google; then an **import/sync** step (upload doc or run a job) parses the doc and calls the API (createProposal, updateProposal, addProposalComment, submitReview, applyProposal). Conflict handling and idempotency (e.g. “already applied”) need to be part of the import logic.

### 5.3 Sync and conflict handling

- **Refresh (store → doc):** Re-export or sync so the doc shows latest proposals and comments. If the user has local edits not yet sent to the store, either merge (e.g. “last write wins” for a given proposal) or prompt to resolve (e.g. “Your draft comment was superseded by a reply in the store; overwrite or keep?”).
- **Push (doc → store):** On “Sync to TruthLayer” or on Add-in submit, send create/update/comment/review to the API. Use proposalId and (where applicable) version/baseVersion so the store can reject stale updates (optimistic locking).
- **Clear semantics:** Document for users whether the doc is “live” (Add-in, always in sync) or “snapshot + sync later” (export → edit → import), and what happens when the store changes between export and import.

---

## 6. Visualization of context relationships

**Requirement:** Users need a **clear visualization of context relationships** — the typed graph (goal → decision → task → risk, dependencies, references) — when working in Word or Google Docs, so they see how nodes relate, not just a flat list.

### 6.1 Options

| Option | Where it lives | How relationships are shown |
|--------|----------------|-----------------------------|
| **Embedded diagram in the doc** | Inside the same DOC/Docx (e.g. first section or appendix). | Export a **graph diagram** (e.g. Mermaid rendered to image, or a simple “context map” graphic) showing nodes and edges (implements, depends-on, references, etc.). Update the image when re-exporting/syncing. |
| **Outline / navigation pane** | Doc structure (headings, bookmarks) or Add-in pane. | Use headings or a tree (e.g. “Goal g1 → Decision d1, d2 → Task t1”) so the doc structure mirrors the graph. Add-in can show a **tree or mini-graph** (e.g. D3 or Mermaid in a task pane) driven by store data. |
| **Companion “context map” document** | Separate DOC/Docx or sheet (or Add-in tab). | One document/sheet is the “relationship view”: table (From, EdgeType, To) or a diagram. Link from the main doc (“See context map”) or open side-by-side. |
| **Add-in / extension pane** | Task pane in Word/Google or sidebar. | **Graph view** in the pane: nodes as boxes, edges as arrows (goal → decision → task → risk). Clicking a node scrolls to or highlights that node’s content in the doc. Data from store (queryNodes, graph traversal); no need to embed the full graph in the doc body. |

### 6.2 Recommended direction

- **Short term (export-only):** Add an **“Context map”** section or **appendix** to the exported DOC/Docx: a single diagram (or table) of nodes and key relationships, generated at export time from the store. Re-generate when re-exporting. No interactivity, but relationships are visible in the doc.
- **With Add-in:** Provide a **graph/tree view** in the task pane (or a dedicated tab) that queries the store and renders the relationship graph. Optionally “Click node → jump to that node’s section in the doc” if the doc body is structured by node (e.g. one heading per node). That gives a clear, up-to-date visualization of context relationships while editing in Word/Google.

---

## 7. Summary and recommendation

| Method | Extension? | Integrates with default Word/Excel? | Complexity | Use case |
|--------|------------|-------------------------------------|------------|----------|
| **Excel table + import script** | No | Yes — default Excel | Low | Reviewers who prefer a table (ProposalId, Accept/Reject, Comment); batch review. |
| **Word Track Changes / Comments + DOCX import** | No | Yes — default Word | High | Review in DOCX with native Accept/Reject; requires export tagging and OOXML import. |
| **Office Add-in (Word or Excel)** | Yes | Add-in inside Word/Excel | Medium | Integrated UX: task pane + API; DOCX as view only. |

**Recommendation:**

1. **Bidirectional flow:** Support **create, modify, comment, and review** from Word/Google by mapping doc actions to the store API (`createProposal`, `updateProposal`, `addProposalComment`, `submitReview`, `applyProposal`). Prefer an Add-in for direct API calls; without it, use a defined export/import format and sync step (see §5).
2. **Context visualization:** Provide a **context map** (diagram or table of nodes and edges) in or alongside the doc (e.g. appendix or companion doc). With an Add-in, add a **graph/tree view** in the task pane for an interactive, up-to-date view of the context graph (see §6).
3. **Short term (no extension):** Add **Excel-based review**: define export format (CSV/XLSX with ProposalId, Summary, Accept/Reject, Comment), and an **import script** (or API) that reads the file and calls `submitReview` / `applyProposal`. Document in USAGE and ARCHITECTURE. This gives “DOCX/Excel as a means for review” for the Excel path without any Add-in.
4. **Medium term (optional extension):** Build a **Word or Excel Add-in** that uses the TruthLayer API for review (task pane: proposals → Accept/Reject → API). DOCX export stays as today (distribution); review is done in the Add-in, not by re-importing DOCX.
5. **Optional (later):** If there is strong need for “review entirely inside Word with Track Changes and no Add-in”, invest in the **DOCX round-trip** (export with tagged revisions/comments, import parser, mapping to proposals). Design doc first (export schema, OOXML mapping, edge cases).

**Is it an extension or default behavior?**

- **Default Word/Excel behavior** can be used **without an extension** for **Excel** (table + import script) and in **theory** for Word (Track Changes/Comments + DOCX import), but the Word path is complex and requires custom export/import.
- **Tight integration** (see proposals in-context, one-click Accept/Reject, live sync) is best done with an **Office Add-in** that calls the API; then Word/Excel are the host, but “review” is implemented by the Add-in, not by parsing the document.

---

## 8. References

- Review contract: `docs/REVIEW_MODE.md`, `src/types/context-store.ts` (`submitReview`, `applyProposal`), `src/types/proposal.ts` (`Review`).
- DOCX export today: `scripts/build-whitepaper-docx.js`, `scripts/README.md`, `docs/ARCHITECTURE.md` § Projections (Markdown and DOCX).
- Word OOXML / Track Changes: [Detecting tracked revisions in Open XML](https://www.ericwhite.com/blog/using-xml-dom-to-detect-tracked-revisions-in-an-open-xml-wordprocessingml-document/), [Accepting revisions programmatically](https://learn.microsoft.com/en-us/archive/blogs/ericwhite/accepting-revisions-in-open-xml-wordprocessingml-documents).
- Office Add-ins: [Office Add-ins platform](https://learn.microsoft.com/en-us/office/dev/add-ins/).
