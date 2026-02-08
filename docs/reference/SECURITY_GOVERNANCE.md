# Security & Governance

This is the authoritative enterprise security model for TruthLayer, a **governance-first truth system** (**governed truth, guarded AI**) that happens to use AI: humans **ratify** proposals (review and apply); **guardrails that apply to AI**—RBAC, policy hooks, audit logging—enforce security and compliance; agents never hold review/apply authority.

**Related:** [Privacy and Data Protection](PRIVACY_AND_DATA_PROTECTION.md) — Controller/Processor, data subject rights, retention, subprocessor/LLM egress, security controls checklist for procurement and DPIA. **Agent posture:** Agents follow an **enforcement bias** (conservative, governance-first; personal data minimize/anonymize/escalate; no external egress without explicit policy; trade secret awareness; immutability-aware writing; when in doubt propose and ask). See [Agent API](core/AGENT_API.md) § Agent posture: enforcement bias.

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

## Personal data sensitivity

When proposing changes, actively identify whether content may include **personal data** (names, emails, identifiers, incident participants, health, HR-related information).

If personal data is detected:

- **Prefer anonymized roles** (e.g. “Engineer A”, “Security Reviewer”) or **structured references** (e.g. “Approved by [role] per audit record”) instead of embedding identifiable individuals.
- **Avoid embedding personal data in accepted truth** unless explicitly required by policy.
- **Flag the proposal and recommend heightened review** so a human can confirm necessity and retention before apply.

**Agent hint:** Implementers and agents should follow the same rules; see [Agent API](core/AGENT_API.md) § Agent hint: personal data.

**Why this matters:** This pushes GDPR data minimization upstream into agent behavior, not just storage policy.

## Truth scope discipline

Treat **organizational truth** (policies, standards, decisions, processes) as distinct from **personal facts**. Organizational truth should be durable and long-lived; personal data should be scoped, ephemeral, or externalized where possible. When uncertain, propose structural references rather than embedding personal details.

**Example:**

- ❌ “John Smith approved this on Jan 4”
- ✅ “Approved by Security Review Committee on Jan 4 (see audit record)”

## Immutability with redaction

Preserve structural and decision history, but do not assume all content must remain human-readable forever. When proposing edits involving personal data:

- **Prefer fields that support redaction or tombstoning** (e.g. dedicated fields or nodes that can be cleared or replaced).
- **Avoid encoding personal data into irreversible narrative text** (e.g. free-form paragraphs that cannot be redacted without losing structure).
- **If removal may be required later, recommend isolating personal data into dedicated fields or nodes.**

This makes “crypto-shredding” and redaction possible later, even if not implemented yet.

## Trade secret awareness

Assume that accepted truth may contain **trade secrets or confidential IP**. Avoid:

- **Summarizing sensitive truth for convenience** unless requested.
- **Broadening access scope in proposals** without explicit justification.
- **Including sensitive details in projections** intended for wide audiences.

When generating summaries, **prefer abstraction over disclosure**. This trains agents to not overshare by default, which is critical for IP protection.

## External model boundary

Assume that any content sent **outside the workspace boundary** may have different confidentiality guarantees. When interacting with or preparing data for external models:

- **Avoid including confidential or personal data** unless policy explicitly allows it.
- **Prefer high-level descriptions** over verbatim content.
- **Flag when a proposal assumes external processing.**

This aligns agent behavior with future LLM routing policies.

## Heightened review triggers

Automatically recommend **additional reviewers or stricter review requirements** when proposals:

- **Affect policy, security, legal, pricing, or IP-sensitive domains**
- **Introduce or modify personal data handling**
- **Expand access or visibility of accepted truth**

This creates a soft policy engine without hard enforcement.

## Retention awareness

**Prefer concise, purpose-driven proposals.** Avoid embedding unnecessary historical context, personal narratives, or transient discussion into accepted truth. Use **comments or ephemeral discussion spaces** for context that does not need long-term retention.

This supports GDPR storage limitation and keeps truth clean.

## Provenance and justification

For each proposal, clearly separate:

- **What is changing**
- **Why the change is needed**
- **What sources or prior truth informed it**

Avoid blending rationale with the truth itself unless explicitly required. This strengthens auditability and legal defensibility.

## Workspace isolation

Treat **workspace boundaries** as hard trust and data-isolation limits. Do not assume information from one workspace can be reused in another, even if the subject appears similar, unless explicitly authorized.

This supports both IP isolation and GDPR purpose limitation.

## When in doubt, propose, don’t apply

If there is ambiguity about **sensitivity, correctness, ownership, or policy implications**:

- **Create a proposal** with explicit notes and questions.
- **Do not attempt to “resolve” ambiguity autonomously.**
- **Surface uncertainty clearly to reviewers.**

This reinforces the ACAL invariant at the cognitive level.
