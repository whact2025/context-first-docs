# Change Detection

Change detection converts edited projections into structured proposal operations.

## Inputs

- Projection output (Markdown/DOCX)
- Anchor map (projection spans → node/field anchors)
- Edited projection content

## Outputs

- **Proposal operations**: ordered list matching store operation types: **create**, **update**, **delete**, **move**, **status-change**, **insert**, and edge create/delete. Each operation has nodeId/payload as in [DATA_MODEL_REFERENCE.md](../reference/DATA_MODEL_REFERENCE.md).
- Updated anchor map (if structure changed).
- Policy findings (optional).

## Strategy

1. Parse projection into sections
2. Resolve edits to anchors:
   - if edit is within a known anchor span → update that field
   - if edit introduces new section patterns → propose new node(s)
3. Validate operations against schema and policy
4. Emit a proposal ready for review

## Edge cases

- ambiguous edits → create a proposal with “CHANGES_REQUESTED” hints
- **Anchor drift**: fall back to fuzzy matching; require human confirmation.
- **Doc structure changes**: treat as projection-spec change, not direct truth change.

Related:
- [DOCX_REVIEW_INTEGRATION.md](DOCX_REVIEW_INTEGRATION.md)
- [RECONCILIATION_STRATEGIES.md](RECONCILIATION_STRATEGIES.md)
- [DATA_MODEL_REFERENCE.md](../reference/DATA_MODEL_REFERENCE.md) (Operation schema)
