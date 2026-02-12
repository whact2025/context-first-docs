# Operations

This document describes production operations for TruthLayer.

## Deploy models

- Self-hosted single-tenant (one workspace per deployment)
- Multi-tenant (workspaceId isolation)

## Backup and restore

Minimum requirements:

- backup accepted revisions and audit logs
- backup proposals/reviews/comments
- restore must preserve revision lineage

MongoDB:

- use snapshots or consistent dumps
- verify restore integrity with revision lineage checks

## Observability

Metrics:

- proposal counts by status
- apply latency and failure rate
- validation failures by policy
- traversal/query latency

Logs:

- all governance actions (review/apply)
- policy findings
- authentication failures
- audit events for all governance actions (queryable via /audit API)
- sensitivity-gated agent reads

Tracing:

- request correlation IDs per API call

## Audit log

The server maintains an immutable, append-only audit log. Every state-changing action (proposal create/update, review, apply, withdraw, reset, policy evaluation) and agent-sensitive reads are recorded.

**Query:** `GET /audit?actor=&action=&resource_id=&from=&to=&limit=&offset=` (Admin role required).

**Export:** `GET /audit/export?format=json|csv` (Admin role required). CSV includes: event_id, timestamp, actor_id, actor_type, action, resource_id, outcome.

**Provenance:** `GET /nodes/:id/provenance` returns the full audit trail for a specific resource (Reader role).

Audit events include: `proposal_created`, `proposal_updated`, `review_submitted`, `proposal_applied`, `proposal_withdrawn`, `node_created`, `node_updated`, `role_changed`, `policy_evaluated`, `store_reset`, `sensitive_read`.

The audit log survives store resets and is retained according to the retention policy.

## Retention

Retention is configured via `retention.json` in the server config root:

```json
{
  "rules": [
    { "resource_type": "proposal", "retention_days": 365, "action": "archive" },
    { "resource_type": "audit", "retention_days": 730, "action": "archive" }
  ],
  "check_interval_secs": 86400
}
```

A background task runs at the configured interval. **Current status:** The task loads rules and logs audit events on each check cycle; actual deletion/archiving of expired resources is pending (requires queryable created_at timestamps on proposals/nodes). Actions when fully implemented: `archive` or `delete`.

## DSAR (Data Subject Access Request)

- `GET /admin/dsar/export?subject=actorId` — Exports all audit events associated with a data subject (Admin role required).
- `POST /admin/dsar/erase` — Records an erasure audit event for a data subject. Body: `{ "subject": "actorId" }`. Admin role required. **Current status:** Records the audit event; actual store mutation (anonymizing actor references in nodes/proposals) is pending.

## Upgrades and schema evolution

- schema version field on stored objects
- migration scripts run per workspace
- backward-compatible read paths during rolling upgrades

## DR and resilience

- apply must be transactional (or compensating)
- idempotent apply is mandatory
