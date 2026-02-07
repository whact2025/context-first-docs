# Whitepaper Appendix

This appendix collects stable references so builders can implement without re-reading the entire narrative.

## Key documents

- Review invariant and state machine: [core/REVIEW_MODE.md](core/REVIEW_MODE.md)
- Canonical schema: [reference/DATA_MODEL_REFERENCE.md](reference/DATA_MODEL_REFERENCE.md)
- Agent-safe API: [core/AGENT_API.md](core/AGENT_API.md)
- UI surface requirements: [core/UI_SPEC.md](core/UI_SPEC.md)
- Concurrency and merging: [appendix/RECONCILIATION_STRATEGIES.md](appendix/RECONCILIATION_STRATEGIES.md)

## Glossary

- **Workspace**: tenancy boundary for truth, permissions, and audit.
- **Truth store**: canonical graph of nodes and relationships.
- **Projection**: generated Markdown/DOCX views of truth.
- **Proposal**: candidate change set; never mutates accepted truth.
- **Review**: accept/reject proposals with comments and policy enforcement.
- **Apply**: materializes accepted proposals into a new accepted revision.

## Design principles

1. Accepted truth is immutable.
2. All mutation happens via proposals + apply.
3. “Applied” is first-class (who/when/from what review).
4. Agents do not hold authority to accept/reject/apply.
5. The system must support both software and non-software truth.
