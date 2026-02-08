# Optional Integrations

TruthLayer supports multiple entry points without compromising governance.

## MCP server (Model Context Protocol)

TruthLayer **provides an MCP server** so AI assistants can use it as a first-class tool (not optional for the product direction—the solution ships it). Cursor, Claude Desktop, and other MCP clients can:

- **Tools**: Query accepted truth (`query_nodes`, `get_node`), traverse reasoning chains (`traverse_reasoning_chain`), create proposals (`create_proposal`, `add_proposal_operations`). No review/apply tools; humans govern in the minimal UI.
- **Resources** (optional): Read-only context for workspace nodes and proposals.

Config: project-level [.cursor/mcp.json](../../.cursor/mcp.json) or equivalent in other clients. Same agent-safe contract and RBAC as the HTTP API. See [Agent API](../core/AGENT_API.md#mcp-exposure), [Architecture](../core/ARCHITECTURE.md).

## Chat/voice assistants

- Assistants query accepted truth
- Draft proposals with structured operations
- Link proposals for human review

## VSCode extension

- Render projections alongside code
- Inline comments mapped to node/field anchors
- “Create proposal from selection” actions

## Git hosting (GitHub/GitLab)

- Store projections in repos
- CI checks: ensure projection matches accepted revision
- PRs can be converted into proposals via change detection

## OpenClaw / agent orchestrators

- Treat TruthLayer as the “truth substrate”
- Agents read accepted truth, propose deltas
- Human review gates applying changes
