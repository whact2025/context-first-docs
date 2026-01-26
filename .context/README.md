# Context Store

This directory contains the canonical context store - the source of truth for all project context.

## Structure

Once file-based persistence is implemented, this directory will contain:

- `nodes/` - Individual node files (JSON/YAML)
- `proposals/` - Proposal files
- `reviews/` - Review history
- `index.json` - Index/metadata

## Current State

Currently, this directory is a placeholder. The project uses in-memory storage during development. File-based persistence will be implemented in Phase 3 of the development plan.

## Relationship to Markdown Files

The Markdown files in the project root (`CONTEXT.md`, `DECISIONS.md`, etc.) are **projections** of this store. They are:

- Generated deterministically from the store
- Human-readable and Git-friendly
- Editable (changes import as proposals)
- Synchronized with the store

The store is the source of truth; Markdown is the interface.
