# Project Risks

This document tracks potential risks and mitigation strategies for context-first-docs.

```ctx
type: risk
id: risk-001
status: accepted
severity: medium
likelihood: possible
---
**Risk**: Developers may find ctx blocks intrusive or confusing.

**Mitigation**: 
- Provide clear documentation and examples
- Make ctx blocks optional for simple use cases
- Ensure Markdown still renders correctly even if ctx blocks are ignored
- Create reverse engineering tools for extracting historical context from existing documentation
- Use the project itself as a demonstration
```

```ctx
type: risk
id: risk-002
status: accepted
severity: high
likelihood: possible
---
**Risk**: Context store and Markdown files may drift out of sync.

**Mitigation**:
- Enforce deterministic projection (same store = same Markdown)
- Provide validation tools to detect drift
- Make import/export operations explicit and auditable
- Consider read-only Markdown files (generated only)
- Test this extensively in the self-referential project
```

```ctx
type: risk
id: risk-003
status: accepted
severity: low
likelihood: unlikely
---
**Risk**: Performance issues with large context graphs.

**Mitigation**:
- Design for scalability from the start
- Support namespacing and filtering
- Consider lazy loading and pagination
- Benchmark early and often
- Use the project's own growing context as a test case
```

```ctx
type: risk
id: risk-004
status: accepted
severity: medium
likelihood: possible
---
**Risk**: Self-referential documentation may become circular or confusing.

**Mitigation**:
- Keep a clear separation between "how the system works" and "how we use it"
- Maintain traditional docs/ directory for implementation details
- Use examples/ directory for non-self-referential examples
- Ensure the system can document itself without creating confusion
```

```ctx
type: risk
id: risk-005
status: accepted
severity: low
likelihood: unlikely
---
**Risk**: The system may be too complex for simple use cases.

**Mitigation**:
- Provide simple defaults and sensible conventions
- Make advanced features optional
- Create quick-start guides
- Ensure basic usage is straightforward
```

```ctx
type: risk
id: risk-006
status: accepted
severity: medium
likelihood: possible
---
**Risk**: Store semantics diverge across providers (in-memory vs file-based vs MongoDB), causing inconsistent query/conflict behavior.

**Mitigation**:
- Centralize provider-agnostic behavior in `src/store/core/*` (apply/query/traversal/conflicts/stale/merge).
- Keep providers focused on persistence/indexing and reuse core functions wherever possible.
- Maintain targeted coverage tests for core behavior to prevent regressions.
```

```ctx
type: risk
id: risk-007
status: accepted
severity: low
likelihood: possible
---
**Risk**: Strict ctx-block validation causes “silent drops” of invalid blocks, confusing authors.

**Mitigation**:
- UI should surface parse/validation errors inline (highlight invalid `type`/`status`).
- Provide quick fixes / suggestions where safe.
- Keep a clear audit trail when content is rejected or corrected.
```

```ctx
type: risk
id: risk-008
status: accepted
severity: medium
likelihood: possible
---
**Risk**: Docs-style anchored comments may drift as text changes (ranges no longer point at the intended snippet), causing reviewer feedback to become confusing or appear “misplaced”.

**Mitigation**:
- Anchor primarily to **semantic identity** (`nodeId` + `field`), and treat range offsets as optional enhancements.
- Persist an optional **quote/snippet** with the anchor so clients can attempt best-effort re-anchoring.
- When re-anchoring fails, clearly surface “stale anchor” state and fall back to field-level attachment (still on the right node/field).
- Prefer deterministic projections so regeneration doesn’t change meaning; avoid anchoring to Markdown line numbers.
- Add tests for storing/querying anchored comments and for preserving anchors across proposal/review lifecycles.
```

```ctx
type: risk
id: risk-009
status: accepted
severity: medium
likelihood: likely
---
**Risk**: UI confusion between **Accepted** (reviewed) and **Applied** (truth mutated) leads to incorrect user expectations, duplicated applies, or “why didn’t it change?” incidents.

**Mitigation**:
- Represent “applied” explicitly in the data model (`appliedAt`/`appliedBy`), not inferred from node state.
- UI must always show proposal state clearly: open / accepted / rejected / withdrawn / applied.
- After accept, present “Accepted but not applied” with a dedicated Apply CTA (policy-gated).
```

```ctx
type: risk
id: risk-010
status: accepted
severity: high
likelihood: possible
---
**Risk**: Multi-workspace/tenancy is underspecified, causing accidental cross-workspace data leakage in UI queries, proposal review queues, comments, or projections.

**Mitigation**:
- Define a first-class workspace boundary early (store instance vs namespace vs explicit workspaceId) and enforce it in the API.
- Add tests for workspace scoping on all read/write paths (nodes, proposals, reviews, comments, projections).
- UI should never “fall back” to global searches without an explicit workspace selector.
```

```ctx
type: risk
id: risk-011
status: accepted
severity: medium
likelihood: possible
---
**Risk**: Policy/roles UI implies enforcement that the server does not yet guarantee, creating a false sense of governance and auditability.

**Mitigation**:
- Treat policy displays as “preview” until server enforcement exists; clearly label enforcement status.
- Centralize policy evaluation server-side and return explicit “blocked/required approvals” results to all clients.
- Maintain an audit trail for policy evaluation and apply actions in enterprise deployments (roadmap).
```
