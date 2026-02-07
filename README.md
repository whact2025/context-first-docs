# TruthLayer

TruthLayer is a **truth ledger and collaboration layer** for organizations: a single place for accepted decisions, policy, and rationale, with a governed path for change. Agents read that truth and create proposals; humans review and apply. The result is **AI with guardrails**—stable context for agents, audit and RBAC for compliance. The solution **provides an MCP server** so AI assistants (Cursor, Claude Desktop, etc.) can use TruthLayer as a native tool for querying truth and creating proposals.

**Canonical documentation:** [docs/](docs/README.md) (whitepaper, architecture, API, scenarios).

---

## Run the playground

Try the minimal governance UI and context server:

```bash
# Option A: Local (requires Node 18+ and Rust)
npm run playground

# Option B: Docker (single container, no local toolchain)
docker compose up --build
```

Then open **http://localhost:4317**.

First-time local setup: `node scripts/install.js` or `npm run install:all`. [INSTALL_NODEJS.md](INSTALL_NODEJS.md) if you need Node. In Cursor/VS Code: **Run Task → "Playground (run both servers)"**.

---

## What’s in this repo

| Area | Description |
|------|-------------|
| **[docs/](docs/README.md)** | Whitepaper, architecture, Agent API, UI spec, scenarios, reference. Start here for design and usage. |
| **Playground** | Web UI + embedded context server. Run via `npm run playground` or Docker (see above). |
| **Server** | Rust API (nodes, proposals, review, apply). Used by the playground; also buildable as a standalone image for CI/API testing. |
| **MCP server** | TruthLayer exposes an **MCP server** so AI assistants (Cursor, Claude Desktop, etc.) can use it as a native tool: query accepted truth, create proposals, traverse reasoning chains. Config: [.cursor/mcp.json](.cursor/mcp.json). See [docs/core/AGENT_API.md](docs/core/AGENT_API.md#mcp-exposure). |
| **Scripts** | Install, build, tests, whitepaper DOCX, ctx-block extension. [scripts/README.md](scripts/README.md) |

---

## Development

| Task | Command |
|------|---------|
| Install, build, test | `npm install && npm run build && npm test` |
| Unit tests | `npm test` or `npm run test:coverage` |
| Server API smoke test | `npm run test:server-api` (server must be running) |
| Ctx blocks in Markdown | `npm run install:ctx-extension` then reload the editor. [vscode-ctx-markdown/README.md](vscode-ctx-markdown/README.md) |

Project context and planning: [CONTEXT.md](CONTEXT.md), [DECISIONS.md](DECISIONS.md), [PLAN.md](PLAN.md), [RISKS.md](RISKS.md), [QUESTIONS.md](QUESTIONS.md). [docs/appendix/SELF-REFERENCE.md](docs/appendix/SELF-REFERENCE.md).

---

## Docker

- **Playground (recommended):** One image, context server embedded; only port 4317 is exposed.  
  `docker compose up --build` → http://localhost:4317  
  Build only: `docker build -t truthlayer-playground -f Dockerfile.playground .`
- **Server only** (CI / API testing): `docker build -t truthlayer-server -f server/Dockerfile server`
- **API tests:** `npm run test:server-api` or `node scripts/test-server-api.mjs http://host:3080`

Requires [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

**Deploy to Azure:** A GitHub Actions workflow can build and deploy the playground to Azure Container Apps. One-time setup: [docs/DEVELOPMENT_DEPLOY_AZURE.md](docs/DEVELOPMENT_DEPLOY_AZURE.md).

---

## License

MIT. Implementation status: [PLAN.md](PLAN.md), [docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md](docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md). Examples: [examples/](examples/).
