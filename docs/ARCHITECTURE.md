# Architecture Overview

## System Components

### 1. Type System (`src/types/`)

The foundation of the system is a strongly-typed node and proposal system:

- **Node Types**: Define semantic concepts (goals, decisions, constraints, tasks, risks, etc.)
- **Proposal System**: Represents changes as proposals with operations
- **Context Store Interface**: Abstract interface for persistence

Key principles:
- Every concept is a typed node with identity
- Changes are proposals, not direct mutations
- Status is explicit (accepted, proposed, rejected, superseded)

### 2. Markdown Projection (`src/markdown/`)

Bidirectional synchronization between Markdown and the context store:

- **ctx Blocks**: Lightweight syntax for embedding semantic nodes
- **Import**: Converts Markdown edits to proposals
- **Export**: Projects accepted nodes to Markdown deterministically

Key principles:
- Markdown is a projection, not the source of truth
- Only ctx blocks are managed by the system
- Other Markdown content is preserved

### 3. Context Store (to be implemented)

The canonical source of truth:

- Stores all nodes (accepted, proposed, rejected)
- Manages proposals and reviews
- Provides query interface for agents

Planned implementations:
- In-memory store (for testing)
- File-based store (JSON/YAML)
- Git-backed store (for versioning)

## Data Flow

### Writing Context

1. Human edits Markdown file (e.g., `DECISIONS.md`)
2. System detects changes to ctx blocks
3. Changes are imported as proposals
4. Proposals are reviewed
5. Accepted proposals become truth in context store
6. Markdown is regenerated from accepted truth

### Reading Context

1. Agent queries context store (never reads raw Markdown)
2. Store returns accepted nodes + open proposals
3. Agent can distinguish truth from proposals
4. Agent can create new proposals

### Review Workflow

1. Proposal is created (from Markdown edit or agent)
2. Reviewers comment and review
3. Proposal is accepted or rejected
4. If accepted:
   - Operations are applied to store
   - Actions are automatically created (if configured)
   - Actions can be created as task nodes
5. Markdown is regenerated

## Key Design Decisions

### Why Proposals, Not Diffs?

- Proposals preserve intent and rationale
- Review is a first-class operation
- Rejected proposals are preserved for provenance
- Enables partial accept/reject

### Why ctx Blocks?

- Lightweight and non-intrusive
- Stable IDs survive Git operations
- Clear ownership (system vs human)
- Renders correctly even if ignored

### Why Deterministic Projection?

- Same context = same Markdown (critical for Git)
- Enables validation and drift detection
- Predictable behavior for agents
- Supports reproducible builds

## Agent Safety

Agents never:
- Read raw Markdown directly
- Mutate accepted truth directly
- Guess at intent from unstructured text

Agents always:
- Query the context store
- Create proposals for changes
- Distinguish accepted truth from proposals
- Respect review workflows

## VS Code/Cursor Extension (Required)

The VS Code/Cursor extension is a core component, not optional:

- **In-editor review**: Review proposals, accept/reject changes without leaving the editor
- **Context awareness**: See related decisions, risks, and tasks while coding
- **Authoring support**: Create proposals and nodes directly from the editor
- **Syntax support**: Highlight and validate ctx blocks
- **Git integration**: Link commits to proposals, track implementation

## Future Extensions

- Real-time collaboration
- GitHub/GitLab integration
- Advanced query language
- Cross-reference resolution
- Validation rules
- Migration tools
