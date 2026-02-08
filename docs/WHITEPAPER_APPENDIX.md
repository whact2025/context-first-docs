# Whitepaper Appendix

This appendix collects stable references so builders can implement without re-reading the entire narrative.

## Key documents

- Review invariant and state machine: [Review Mode (ACAL)](core/REVIEW_MODE.md)
- Canonical schema: [Data Model Reference](reference/DATA_MODEL_REFERENCE.md)
- Agent-safe API: [Agent API](core/AGENT_API.md)
- UI surface requirements: [UI Specification](core/UI_SPEC.md)
- Concurrency and merging: [Reconciliation Strategies](appendix/RECONCILIATION_STRATEGIES.md)

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
6. Personal data sensitivity: agents and proposers should prefer anonymization and role-based references; proposals with personal data should be flagged for heightened review (GDPR data minimization upstream). See [Security & Governance](reference/SECURITY_GOVERNANCE.md#personal-data-sensitivity).
7. Truth scope discipline: organizational truth (policies, decisions, processes) is durable and long-lived; personal facts are scoped, ephemeral, or externalized. Prefer structural references (e.g. “Approved by Security Review Committee”) over embedding personal details. See [Security & Governance](reference/SECURITY_GOVERNANCE.md#truth-scope-discipline).
8. Immutability with redaction: preserve structure and decision history; prefer fields that support redaction or tombstoning; avoid encoding personal data in irreversible narrative; isolate personal data in dedicated fields/nodes when removal may be required. See [Security & Governance](reference/SECURITY_GOVERNANCE.md#immutability-with-redaction).
9. Trade secret awareness: assume accepted truth may contain trade secrets or confidential IP; avoid summarizing sensitive truth for convenience, broadening access without justification, or including sensitive details in wide-audience projections; prefer abstraction over disclosure. See [Security & Governance](reference/SECURITY_GOVERNANCE.md#trade-secret-awareness).
10. External model boundary: content sent outside the workspace may have different confidentiality guarantees; avoid including confidential or personal data for external models unless policy allows; prefer high-level descriptions over verbatim content; flag when a proposal assumes external processing. See [Security & Governance](reference/SECURITY_GOVERNANCE.md#external-model-boundary).
11. Heightened review triggers: recommend additional reviewers or stricter review when proposals affect policy, security, legal, pricing, or IP-sensitive domains; introduce or modify personal data handling; or expand access or visibility of accepted truth (soft policy engine). See [Security & Governance](reference/SECURITY_GOVERNANCE.md#heightened-review-triggers).
12. Retention awareness: prefer concise, purpose-driven proposals; avoid embedding unnecessary historical context, personal narratives, or transient discussion into accepted truth; use comments or ephemeral discussion for context that does not need long-term retention (GDPR storage limitation). See [Security & Governance](reference/SECURITY_GOVERNANCE.md#retention-awareness).
13. Provenance and justification: for each proposal, clearly separate what is changing, why the change is needed, and what sources or prior truth informed it; avoid blending rationale with the truth itself unless required (strengthens auditability and legal defensibility). See [Security & Governance](reference/SECURITY_GOVERNANCE.md#provenance-and-justification).
14. Workspace isolation: treat workspace boundaries as hard trust and data-isolation limits; do not assume information from one workspace can be reused in another unless explicitly authorized (IP isolation and GDPR purpose limitation). See [Security & Governance](reference/SECURITY_GOVERNANCE.md#workspace-isolation).
15. When in doubt, propose, don’t apply: if there is ambiguity about sensitivity, correctness, ownership, or policy implications, create a proposal with explicit notes and questions; do not resolve ambiguity autonomously; surface uncertainty to reviewers (reinforces ACAL at the cognitive level). See [Security & Governance](reference/SECURITY_GOVERNANCE.md#when-in-doubt-propose-dont-apply).
