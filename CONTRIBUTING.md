# Contributing

Thank you for your interest in contributing to TruthLayer!

## Self-Referential Development

**This project uses its own Agentic Collaboration Approval Layer (ACAL) semantics to document itself.**

When contributing, please be aware that:

1. **Project documentation uses ctx blocks** - Files like `CONTEXT.md`, `DECISIONS.md`, `PLAN.md`, etc. contain semantic nodes embedded in ctx blocks
2. **Changes should follow the system** - When adding decisions, tasks, or other context, use the appropriate ctx block format
3. **See examples** - Look at existing ctx blocks in the project root files for examples

## Development Workflow

1. **Read the context** - Check `CONTEXT.md`, `DECISIONS.md`, and `PLAN.md` to understand the project
2. **Check open questions** - See `QUESTIONS.md` for areas that need input
3. **Follow existing patterns** - Match the style and structure of existing ctx blocks
4. **Update relevant docs** - If your change affects architecture, add a decision. If it's a task, add it to PLAN.md

## Making Changes

### Adding a Decision

If you're making an architectural decision, add it to `DECISIONS.md`:

```markdown
```ctx
type: decision
id: decision-XXX
status: proposed
---
**Decision**: [Your decision]

**Rationale**: [Why]

**Alternatives Considered**: [What else you considered]

**Decided At**: [Date]
```
```

### Adding a Task

Add tasks to `PLAN.md`:

```markdown
```ctx
type: task
id: task-XXX
status: open
---
[Description of the task]
```
```

### Asking a Question

Add questions to `QUESTIONS.md`:

```markdown
```ctx
type: question
id: question-XXX
status: open
---
**Question**: [Your question]

**Context**: [Relevant background]

**Impact**: [Why this matters]
```
```

## Code Style

- TypeScript with strict mode
- Use meaningful variable and function names
- Add comments for complex logic
- Follow existing code structure

## Testing

- Write tests for new functionality
- Ensure existing tests pass
- Test the self-referential aspects (project docs)

## Questions?

- Check `QUESTIONS.md` for open questions
- Review `docs/` for architecture and usage details
- Look at `examples/` for usage patterns
