# Self-Referential Documentation

This project uses its own context-first system to document itself. This document explains how that works.

## Why Self-Reference?

We believe that if we can't use our own tool effectively, we shouldn't expect others to. Self-reference:

1. **Validates the approach** - If it works for us, it can work for others
2. **Serves as a living example** - Users can see the system in action
3. **Forces us to "eat our own dog food"** - We experience the pain points firsthand
4. **Demonstrates commitment** - We're willing to use what we build

## How It Works

### Project Documentation Files

The following files in the project root are managed by the context-first system:

- `CONTEXT.md` - Core context, goals, and constraints
- `DECISIONS.md` - Architecture decisions with rationale
- `PLAN.md` - Development roadmap and tasks
- `RISKS.md` - Project risks and mitigation
- `QUESTIONS.md` - Open questions

These files contain `ctx` blocks that embed semantic nodes. The blocks are managed by the system; other content is preserved.

### Context Store

The `.context/` directory (to be implemented) will contain the canonical context store - structured data (JSON/YAML) that represents the truth.

### Workflow

1. **Editing**: Developers edit the Markdown files directly
2. **Import**: Changes to ctx blocks are imported as proposals
3. **Review**: Proposals are reviewed and accepted/rejected
4. **Export**: Accepted truth is exported back to Markdown deterministically

### Current State

Currently, the project is in early development. The Markdown files exist and use ctx blocks, but the full import/export workflow is not yet automated. This will be implemented as part of Phase 2-3 of the development plan.

## Separation of Concerns

We maintain a clear separation:

- **Self-referential docs** (`CONTEXT.md`, `DECISIONS.md`, etc.) - Use the system to document the project
- **Implementation docs** (`docs/ARCHITECTURE.md`, `docs/USAGE.md`) - Traditional documentation about how the system works
- **Examples** (`examples/`) - Non-self-referential examples for users

This prevents circularity and confusion while still demonstrating the approach.

## Future Enhancements

As the system matures, we plan to:

- Automate the import/export workflow for project docs
- Use the system to track all development decisions
- Generate reports from the context store
- Use agent APIs to query project context
- Validate that project docs stay in sync with the store
