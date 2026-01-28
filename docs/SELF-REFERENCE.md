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

The canonical context store is represented by the `ContextStore` interface.

- **Today (in this repo)**: the reference implementation is `InMemoryStore` (useful for demos/tests)
- **Planned**: persistent backends (file-based and MongoDB). A file-based backend may store its data under a `.context/` directory (path is implementation-defined)

### Workflow

1. **Author suggestions**: Developers (or agents) create proposals (optionally derived from Markdown ctx blocks)
2. **Review mode**: Proposals are accepted/rejected via reviews (no direct edits to accepted truth)
3. **Apply**: Accepted proposals are applied into truth
4. **Project**: Accepted truth can be projected back into Markdown deterministically

### Current State

Currently:

- The core proposal/review workflow is implemented in the in-memory store (see `docs/REVIEW_MODE.md`)
- Markdown import/projection utilities exist (`importFromMarkdown`, `projectToMarkdown`)
- A small local playground exists to demonstrate the flow (`npm run playground`)
- Persistent storage backends are still planned (see `docs/STORAGE_IMPLEMENTATION_PLAN.md`)

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
