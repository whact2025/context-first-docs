# DOCX Review Integration

DOCX is an optional review surface. The canonical workflow remains: proposals → reviews → apply.

## Approaches

### 1) Word Add-in (recommended)

- Word UI posts comments/changes to TruthLayer as proposals
- Review/apply still happens in TruthLayer UI
- Best governance fidelity

### 2) Tracked changes round-trip

- Export projection to DOCX with anchors
- User edits + tracked changes
- Import:
  - map edits back to node/field anchors
  - emit proposal operations
- Hardest part is anchor stability and drift

### 3) “Attach DOCX to proposal”

- A proposal includes a DOCX artifact as supporting evidence
- Reviewer can approve changes conceptually, but truth ops must still exist

## Minimal requirement

DOCX must never directly mutate accepted truth.
