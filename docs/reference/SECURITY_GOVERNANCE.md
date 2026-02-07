# Security & Governance

This is the authoritative enterprise security model for TruthLayer—**Ratify truth. AI with Guardrails for Security & Compliance**. Humans **ratify** proposals (review and apply); **guardrails**—RBAC, policy hooks, audit logging—enforce security and compliance; agents never hold review/apply authority.

## Identity and authentication

- Integrate with SSO/OIDC where possible.
- Every action is attributed to an Actor.
- Agents authenticate as `type=AGENT` with least privilege.

## Authorization (RBAC)

Workspace roles (baseline):
- `Reader`: read accepted truth + projections
- `Contributor`: propose
- `Reviewer`: review (approve/reject)
- `Applier`: apply
- `Admin`: manage roles/policies

**Role assignment** is deployment-specific. A clear **RBAC provider abstraction** supplies who has which role: Git/GitLab use their native roles; enterprise deployments can use Azure AD, DLs (distribution lists), or any external system configured as the RBAC provider. The system consumes a unified role model above; see `question-007` in QUESTIONS.md.

Principle: **agents never receive Reviewer or Applier.**

## Policy engine

Policies evaluate:
- proposal operations (validate)
- review approvals (additional approvers)
- apply (change windows, sign-off requirements)

Examples:
- POLICY nodes require 2 reviewers.
- SECURITY policy changes require an InfoSec reviewer.
- High-risk updates require a CAB window.

## Audit logging

Log:
- proposal creation and updates
- validation results
- review decisions and comments
- apply operations and resulting revision IDs
- permission changes

Audit logs are immutable and exportable per workspace.

## Threat model highlights

- **Prompt injection**: untrusted content must not change accepted truth.
- **Privilege escalation**: proposals that alter RBAC or security policy require strict checks.
- **Poisoned context**: accepted-only default; proposals isolated.
- **Data exfiltration**: per-workspace redaction and scope constraints.

## Data handling

- Workspace-level retention policies
- Optional encryption at rest (backend dependent)
- Export/import tools with redaction support
