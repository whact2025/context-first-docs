# Architecture Decisions

This document tracks key architectural decisions made during the context-first-docs project.

```ctx
type: decision
id: decision-001
status: accepted
---
**Decision**: Use Markdown as the human interface, not as the source of truth.

**Rationale**: 
- Markdown is familiar to developers and renders well on GitHub/GitLab
- Git workflows work naturally with Markdown files
- However, Markdown alone is not structured enough for agent consumption
- Solution: Markdown is a projection of the canonical context store

**Alternatives Considered**:
- YAML/JSON as the interface (too technical, poor readability)
- Custom format (requires new tooling, harder adoption)
- Database-only (loses Git integration)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-002
status: accepted
---
**Decision**: Use ctx blocks for semantic sections in Markdown.

**Rationale**:
- Lightweight syntax that doesn't break Markdown rendering
- Stable IDs survive rebases and merges
- Clear separation between system-managed and human-edited content
- Can be ignored by tools that don't understand context blocks

**Alternatives Considered**:
- HTML comments (not visible, harder to work with)
- Frontmatter (only works at file level, not section level)
- Custom Markdown extensions (requires parser modifications)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-003
status: accepted
---
**Decision**: The project itself must be self-referential and use its own system.

**Rationale**:
- Demonstrates the approach in practice
- Serves as a living example for users
- Validates that the system works for real-world use
- Forces us to "eat our own dog food"

**Alternatives Considered**:
- Separate example project (less authentic, harder to maintain)
- Traditional documentation (defeats the purpose)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-004
status: accepted
---
**Decision**: Use TypeScript for type safety and better developer experience.

**Rationale**:
- Strong typing helps prevent errors in the context graph
- Better IDE support and autocomplete
- Easier to maintain as the system grows
- Type definitions serve as documentation

**Alternatives Considered**:
- JavaScript (less type safety)
- Rust/Go (higher barrier to entry, overkill for v1)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-005
status: proposed
---
**Decision**: Store context in Git as structured data (JSON/YAML), not in Markdown.

**Rationale**:
- Git diffs on structured data are more meaningful
- Easier to query and process programmatically
- Markdown files are generated deterministically from the store
- Enables advanced features like cross-references and validation

**Status**: Under review - this is a key architectural decision for v1
```
