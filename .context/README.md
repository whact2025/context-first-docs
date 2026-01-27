# Context Store

This directory contains GraphQL schema definition and Git snapshots for the context store.

## Storage Architecture

The context store uses **MongoDB** (self-hosted document database) as primary storage, accessed via **GraphQL API**.

### GraphQL Schema

- `schema.graphql` - GraphQL schema definition (committed to Git for versioning)
  - Type-safe API definition
  - Self-documenting (introspection)
  - Human-readable schema changes (reviewable in PRs)

### Git Snapshots

- `snapshots/` - Periodic snapshots exported from MongoDB
  - Backup and disaster recovery
  - Version history and audit trail
  - Reviewable changes for compliance

## MongoDB Collections

The MongoDB database (self-hosted within organization) contains:

- `nodes` - Graph nodes (goals, decisions, tasks, risks, questions, etc.)
- `proposals` - Change proposals
- `reviews` - Review history
- `relationships` - Typed graph edges

## Current State

Currently, the project uses in-memory storage during development. MongoDB storage with GraphQL API will be implemented in Phase 2 of the development plan.

## Relationship to Markdown Files

The Markdown files in the project root (`CONTEXT.md`, `DECISIONS.md`, etc.) are **projections** of the MongoDB store. They are:

- Generated deterministically from MongoDB via GraphQL API
- Human-readable and Git-friendly
- Editable (changes import as proposals)
- Synchronized with the store

MongoDB is the source of truth; Markdown is the interface.

See `docs/STORAGE_ARCHITECTURE.md` for detailed architecture.
