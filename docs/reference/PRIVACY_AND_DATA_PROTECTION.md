# Privacy and Data Protection

This document supports procurement and DPIA (Data Protection Impact Assessment) review. It states TruthLayer’s posture for **GDPR-ready** deployment: controller/processor posture, DSAR workflow, retention classes and defaults, redaction vs crypto-shredding policy, subprocessor/LLM egress, residency options, and security controls.

**Related:** [Security & Governance](SECURITY_GOVERNANCE.md), [Contextualized AI Model](../appendix/CONTEXTUALIZED_AI_MODEL.md) (prompt-leakage policy).

---

## 1. Controller/processor posture

**Statement for procurement:** The **Customer** (data owner) is the **Controller** of personal data processed in TruthLayer; the **TruthLayer operator** (vendor), when providing TruthLayer as a service, acts as **Processor** under the Customer’s documented instructions and a Data Processing Agreement. In self-hosted deployments the Customer is the sole Controller; the vendor does not process customer data unless separately agreed (e.g. support under NDA).

- **Customer (data owner) = Controller.** The customer determines the purposes and means of processing personal data stored in or processed through TruthLayer (e.g. names, roles, comments, audit metadata).
- **TruthLayer operator (vendor) = Processor.** When TruthLayer is operated as a service, the operator processes personal data only on documented instructions from the Controller and in accordance with the agreement.
- **Data Processing Agreement (DPA).** Customer and TruthLayer operator are expected to conclude a DPA that includes: subject matter and duration of processing; nature and purpose of processing; types of personal data and categories of data subjects; obligations and rights of the Controller; Processor commitments (confidentiality, subprocessor rules, assistance with compliance, deletion/return of data, audits). Standard DPA language should be provided by the vendor and aligned with this document and [Security & Governance](SECURITY_GOVERNANCE.md).
- **Self-hosted deployment.** Where the customer hosts TruthLayer entirely within their own environment, the customer may act as sole Controller (and effectively no separate Processor); the vendor’s role is limited to software licensing and support, with no access to customer data unless separately agreed (e.g. support under NDA).

---

## 2. Data Subject Rights (DSAR) workflow

**DSAR handling:** Data subject access, rectification, and erasure requests are handled via **export** (access), **proposal-driven correction** (rectification), and **redaction or crypto-shredding** (erasure) within the statutory response period (e.g. **one month** under GDPR). Process is documented; operational tooling (export-by-subject, erase-by-subject) is provided via admin API endpoints.

TruthLayer is designed to support **access**, **rectification**, and **erasure** (DSAR workflow) in a way that fits the product model (immutable accepted truth, proposals, comments, audit logs).

- **Access (Art. 15).** Data subjects can request a copy of personal data concerning them. **Workflow:** Export or query by actor/identifier (e.g. by `createdBy`, `modifiedBy`, or comment author). Export format and scope (accepted truth, proposals, comments, audit log) are admin-configurable. **Timeline:** Response within the statutory period (e.g. one month under GDPR); export tools and documented procedures support this.
- **Rectification (Art. 16).** Data subjects can request correction of inaccurate personal data. **Workflow:** Corrections are implemented via **proposals** (not direct edits to accepted truth). A designated role creates a proposal that updates or replaces the relevant nodes/fields; after review and apply, the corrected data becomes the new accepted truth. Where data appears in immutable audit logs, rectification is documented as a separate correction record rather than alteration of the log. **Timeline:** Same statutory period; proposal/review/apply cycle is the operational path.
- **Erasure / right to be forgotten (Art. 17).** Data subjects can request deletion of their personal data. **Workflow:**
  - **Redaction vs removal:** TruthLayer supports **redaction** (overwrite or tombstone) for fields/nodes that hold personal data, and **retention of structure** (e.g. “Approved by [REDACTED]” or removal of a comment thread) so that auditability and provenance are preserved where legally permitted. Full **deletion** of rows/nodes is available where the entire record is personal data.
  - **Scope:** Erasure applies to accepted truth, proposals, and comments in scope of the request; **audit logs** may be retained in redacted form (e.g. “User [REDACTED] applied proposal X at T”) where required for legal obligation or legitimate interest, in line with retention policy.
  - **Timeline:** Within the statutory period; admin or automated jobs perform redaction/deletion according to documented procedures.
- **Redaction vs crypto-shredding policy.**
  - **Redaction:** Overwrite or tombstone personal data in place (e.g. “[REDACTED]”, empty field); **structure and auditability** are preserved (e.g. “Approved by [REDACTED] at T”). Used when the organization must retain the record for legal or operational reasons but the data subject’s identity or personal data must be removed.
  - **Crypto-shredding:** Irreversibly destroy data or encryption keys so that personal data **cannot be recovered**. Used when full erasure (Art. 17) is required and no legal exception applies to retaining the record. TruthLayer design prefers **isolating personal data into dedicated fields/nodes** so that crypto-shredding (or key destruction) can target only those elements; narrative text that mixes personal data with policy is harder to redact or shred.
  - **Policy:** Default to redaction where retention of structure is required (e.g. audit logs); use full deletion/crypto-shredding where the entire record is personal data or the Controller instructs full erasure.
- **Implementation.** Data subject rights workflows are provided via the Rust server: `GET /admin/dsar/export?subject=actorId` returns all audit events for a data subject. `POST /admin/dsar/erase` records an erasure audit event and anonymizes actor references across nodes, proposals, and reviews. Rectification follows the standard proposal workflow. Crypto-shredding of content fields is supported for high-sensitivity erasure requirements.

---

## 3. Retention policy model

Enterprises require clear **retention classes**, **default periods**, and **admin-configurable policies**.

**If you do nothing (retention defaults):** With no admin configuration, the following defaults apply: **accepted truth** — retained indefinitely; **proposals** — accepted proposals 7 years (audit), rejected/withdrawn 2 years; **comments** — 2 years (or aligned to proposal retention); **audit logs** — 7 years. These are conservative defaults; customers can configure shorter (or longer) periods per workspace.

- **Retention classes (data categories).**
  - **Accepted truth** (immutable revision history): Configurable retention (e.g. keep last N revisions, or time-based). Default: retain indefinitely unless policy specifies otherwise.
  - **Proposals** (open, accepted, rejected, withdrawn): Configurable by status. Default: accepted 7 years (audit); rejected/withdrawn 2 years unless policy requires longer.
  - **Comments** (on proposals/reviews): Configurable; default 2 years or align to proposal retention.
  - **Audit logs** (review decisions, apply events, permission changes): Immutable; default 7 years. Exportable per workspace/date range for compliance.
- **Default periods.** Documented above; defaults are conservative (retain longer) unless customer policy specifies shorter.
- **Admin-configurable policies.** Retention is **admin-configurable** per workspace (and optionally per node type or tag): retention period, action at end of retention (delete, archive, redact), and exceptions. Policy engine and storage layer support retention jobs (scheduled or on-demand) that apply these rules.
- **Implementation.** The retention engine loads rules from `retention.json` in the config root (resource type, retention days, action: archive or delete) and runs a background task at a configurable interval (`check_interval_secs`). The task evaluates retention rules against entity timestamps and performs deletion or archiving of expired resources. Retention actions are logged in the audit trail. Per-workspace retention policies are configurable.

---

## 4. Subprocessor and LLM egress policy

**Subprocessor declaration:** **None by default.** TruthLayer does not use subprocessors or send data to external LLMs unless the customer explicitly enables and configures them. Optional use of external LLMs (e.g. for summarization, embedding, inference) is under **customer control** (allowlist/denylist, region, no-egress mode). Silence here is resolved: no egress until the customer opts in.

If any **external LLM or subprocessor** is enabled by the customer, procurement requires an explicit **allowlist/denylist** model, **logging/training guarantees**, and **regional routing / residency** options.

- **Allowlist/denylist.** Use of external services (including LLMs) is governed by an **explicit allowlist**: only services and regions that the customer or admin has approved may receive data. Denylist: block specific providers, regions, or use cases. Default: **no egress** (all external LLM/subprocessor use disabled) until explicitly enabled and configured.
- **Logging and training guarantees.**
  - **No training on customer data.** Customer data (accepted truth, proposals, comments) must not be used to train vendor or third-party models unless the customer has given explicit, separate consent (e.g. in a DPA or order form).
  - **Logging.** Any call to an external LLM or subprocessor is logged (e.g. provider, region, node IDs or scope, timestamp) for audit and DPIA; logs are retained per retention policy and not used for model training.
- **No-egress mode.** A **no-egress** deployment mode is supported: all inference, embedding, and processing run entirely within the customer’s environment (self-hosted model, no data sent to third parties). This is the default for high-sensitivity or regulated workloads until the customer opts in to specific external services.
- **Regional routing and residency.** Where the product supports routing to external LLMs or subprocessors, **region/residency** can be configured (e.g. EU-only, UK-only) so that data does not leave the chosen jurisdiction. Subprocessor list and regions are documented and kept up to date for procurement.
- **Residency options.** Data residency (e.g. EU-only, UK-only, US-only) for storage and for any external LLM/subprocessor routing is **designed** and configurable where the deployment supports it. Full residency controls (certification, geo-fencing, documented subprocessor regions) are on the **roadmap** for customers that require strict jurisdictional guarantees.
- **Reference.** See [Security & Governance](SECURITY_GOVERNANCE.md) § External model boundary; [Contextualized AI Model](../appendix/CONTEXTUALIZED_AI_MODEL.md) (prompt-leakage policy, retrieval policy, sensitivity labels).

### AI Compliance Gateway enforcement

The policies above are enforced at the infrastructure level by the **AI Compliance Gateway**:

- **Allowlist/denylist** → `EgressControl.destinations` policy field: the gateway blocks any outbound request to a model or provider not on the workspace's allowlist. Denylist overrides allowlist.
- **Logging** → `ExternalModelCall` audit event: every gateway-mediated model call is logged with provider, model, region, prompt hash, response hash, sensitivity classification, token count, cost estimate, and latency. No verbatim prompt/response is stored (privacy-safe hashing).
- **No-egress mode** → Gateway default behavior: all external calls are blocked until the workspace admin explicitly configures allowed destinations. Air-gapped deployments never enable external destinations.
- **Regional routing** → Model routing config (`models.json`): per-model regional constraints (e.g., EU-only Azure OpenAI endpoint). The gateway rejects requests that would route to a non-permitted region.
- **Prompt inspection** → Before egress: gateway scans prompt content against node sensitivity labels. Content above the workspace's allowed egress sensitivity level is redacted or blocked. Agent proposal limits are enforced on prompt size.
- **Response filtering** → After model response: gateway inspects for policy violations, hallucinated permissions, and injection indicators before returning to the caller.

This transforms the privacy posture from **policy guidance** (agents should not egress) to **infrastructure enforcement** (the gateway blocks non-compliant egress).

See [Security & Governance](SECURITY_GOVERNANCE.md) § AI Compliance Gateway, [Architecture](../core/ARCHITECTURE.md).

---

## 5. Security controls checklist

Procurement can use this as a **security controls checklist** for DPIA and vendor questionnaires.

| Control                   | Description                                                                                                        | Status                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **SSO / SAML**            | Identity integration with customer IdP (SAML 2.0 or OIDC).                                                         | Designed; RBAC provider abstraction supports external identity. Implementation roadmap.               |
| **SCIM**                  | User/group provisioning and deprovisioning from customer directory.                                                | Designed; RBAC provider can be driven by directory. Implementation roadmap.                           |
| **Encryption at rest**    | Data at rest encrypted (e.g. AES-256); backend-dependent (file, MongoDB).                                          | Designed (e.g. Storage Architecture); deployment-specific.                                            |
| **Encryption in transit** | TLS for all API and UI traffic.                                                                                    | Standard for production deployment.                                                                   |
| **Key management / BYOK** | Customer-managed keys (BYOK) or HSM for encryption keys where supported by backend.                                | Designed where backend supports it; roadmap.                                                          |
| **Audit log export**      | Immutable audit logs; exportable per workspace and date range in a standard format.                                | **Implemented.** `GET /audit/export?format=json                                                       | csv`exports the full audit log.`GET /audit` supports filtered queries (actor, action, resource_id, date range, pagination). |
| **Breach notification**   | Process and timeline for notifying the Controller of a personal data breach (e.g. as per DPA and GDPR Art. 33/34). | Defined in DPA and vendor process; product supports audit and export to facilitate impact assessment. |

Additional controls (RBAC, policy engine, workspace isolation, agent guardrails) are described in [Security & Governance](SECURITY_GOVERNANCE.md).

---

## 6. Summary for procurement

- **Controller/processor posture:** Customer = Controller, TruthLayer operator = Processor when operated as a service; DPA required. Self-hosted = customer as sole Controller. (See §1 for one-paragraph statement.)
- **DSAR handling:** Access (export), rectification (via proposals), erasure via redaction or crypto-shredding within statutory period (e.g. one month under GDPR); documented process with admin API tooling.
- **Retention defaults (if you do nothing):** Accepted truth indefinitely; proposals 7y (accepted) / 2y (rejected/withdrawn); comments 2y; audit logs 7y. Admin-configurable; retention engine on roadmap.
- **Redaction vs crypto-shredding:** Redaction preserves structure; crypto-shredding irreversibly removes data; policy favors dedicated fields/nodes for personal data so shredding is scoped.
- **Subprocessor declaration:** None by default; optional external LLMs under customer control (allowlist/denylist, no-egress mode, regional routing). No egress until customer opts in.
- **Residency options:** Storage and LLM/subprocessor routing residency (e.g. EU, UK) designed where supported; full residency controls and certification on roadmap.
- **Security:** SSO/SAML, SCIM, encryption at rest/transit, BYOK where supported, audit log export, breach notification process; see Security & Governance and this checklist.

**Use.** This document can be stapled into a DPIA packet or attached to a DPA as the technical annex describing TruthLayer’s privacy and data protection posture. For implementation status of any item, refer to the roadmap and release notes.
