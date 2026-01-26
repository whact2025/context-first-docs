# Project Structure

This document explains the structure of the context-first-docs project itself.

## Self-Referential Documentation

The project root contains documentation files that use the context-first system:

- **`CONTEXT.md`** - Core project context, goals, and constraints
- **`DECISIONS.md`** - Architecture decisions with rationale and alternatives
- **`PLAN.md`** - Development roadmap, phases, and tasks
- **`RISKS.md`** - Project risks and mitigation strategies  
- **`QUESTIONS.md`** - Open questions needing answers

These files contain `ctx` blocks that embed semantic nodes. They demonstrate the system in practice.

## Implementation

- **`src/`** - Source code
  - `types/` - Type definitions (nodes, proposals, store interface)
  - `markdown/` - Markdown projection system (ctx blocks, import/export)
  - `store/` - Context store implementations (in-memory, file-based to come)

## Documentation

- **`docs/`** - Traditional documentation
  - `ARCHITECTURE.md` - System architecture and design
  - `USAGE.md` - Usage guide and examples
  - `SELF-REFERENCE.md` - Explanation of self-referential approach

## Examples

- **`examples/`** - Non-self-referential examples
  - `example-project/` - Simple example project structure

## Context Store

- **`.context/`** - Canonical context store (to be implemented)
  - Will contain structured data (JSON/YAML) representing the source of truth
  - Markdown files are projections of this store

## Tests

- **`tests/`** - Test files
  - Currently contains tests for ctx block parsing

## Configuration

- `package.json` - Node.js project configuration
- `tsconfig.json` - TypeScript configuration
- `jest.config.js` - Jest test configuration
- `.gitignore` - Git ignore rules

## Key Principle

**The project uses its own system to document itself.** This validates the approach and serves as a living example. If we can't use our own tool effectively, we shouldn't expect others to.
