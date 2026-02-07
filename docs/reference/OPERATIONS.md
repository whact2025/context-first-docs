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

Tracing:
- request correlation IDs per API call

## Upgrades and schema evolution

- schema version field on stored objects
- migration scripts run per workspace
- backward-compatible read paths during rolling upgrades

## DR and resilience

- apply must be transactional (or compensating)
- idempotent apply is mandatory
