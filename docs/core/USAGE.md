# Usage

This guide shows how teams use TruthLayer day-to-day.

## Core workflow

1. **Read accepted truth**
2. **Draft proposals** (human or agent)
3. **Review** (humans)
4. **Apply** to create a new accepted revision
5. **Project** to Markdown/DOCX for distribution

## Recommended repo layout (projection-first)

In a Git repo you may store projections:

- `README.md` (projection)
- `DECISIONS.md` (projection)
- `RISKS.md` (projection)
- `PLAN.md` (projection)

The canonical truth remains in the store; projections are generated outputs.

## Typical use cases

- Architecture decision records (ADR-like), but governed
- Engineering plans with explicit constraints and risks
- Policy and process documentation with approvals
- Incident follow-ups and mitigation tracking

**Dogfooding:** This repo uses ACAL to document itself (CONTEXT, DECISIONS, PLAN, etc.). See [Self-Reference](../appendix/SELF-REFERENCE.md).

## Getting started

- **Run the playground**: From the repo root run **`npm run playground`**, then open http://localhost:4317. In Cursor/VS Code: **Run Task → "Playground (run both servers)"**. Or use **Docker**: **`docker compose up --build`** (single container with embedded server). See [Docs index](../README.md).
- Run the Hello World scenario: [Hello World Scenario](../scenarios/HELLO_WORLD_SCENARIO.md)
- Implement the minimal UI: [UI Specification](UI_SPEC.md)
- Implement the schema: [Data Model Reference](../reference/DATA_MODEL_REFERENCE.md)
