# TruthLayer

TruthLayer is a **governance-first truth system** (**governed truth, guarded AI**): a truth ledger and collaboration layer for accepted decisions, policy, and rationale, with a governed path for change. Humans ratify; guardrails that apply to AI (ACAL, RBAC, audit) enforce. Agents read truth and create proposals within that model. The solution **provides an MCP server** so AI assistants (Cursor, Claude Desktop, etc.) can use TruthLayer as a native tool for querying truth and creating proposals.

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

First-time local setup: `node scripts/install.js` or `npm run install:all`. [INSTALL_NODEJS.md](INSTALL_NODEJS.md) if you need Node. In Cursor/VS Code: **Run Task > "Playground (run both servers)"**.

---

## What's in this repo

| Area                        | Description                                                                                                                                                                                                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[docs/](docs/README.md)** | Whitepaper, architecture, Agent API, UI spec, scenarios, reference. Start here for design and usage.                                                                                                                                                                                                  |
| **Playground**              | Web UI + embedded context server. Run via `npm run playground` or Docker (see above).                                                                                                                                                                                                                 |
| **Server**                  | Rust API with **JWT auth, RBAC, policy engine, audit log, sensitivity labels, and IP protection**. Two storage backends (in-memory and file-based). See [server/README.md](server/README.md).                                                                                                         |
| **MCP server**              | TruthLayer exposes an **MCP server** so AI assistants (Cursor, Claude Desktop, etc.) can use it as a native tool: query accepted truth, create proposals, traverse reasoning chains. Config: [.cursor/mcp.json](.cursor/mcp.json). See [docs/core/AGENT_API.md](docs/core/AGENT_API.md#mcp-exposure). |
| **Scripts**                 | Install, build, tests, whitepaper DOCX, ctx-block extension. [scripts/README.md](scripts/README.md)                                                                                                                                                                                                   |

---

## Governance (enforced)

The Rust server enforces enterprise governance controls at runtime:

```
  Request
    |
    v
[ JWT Auth ] --- 401 Unauthorized
    |
    v
[   RBAC   ] --- 403 Forbidden (role / agent check)
    |
    v
[  Policy  ] --- 422 Policy Violation
    |
    v
[  Handler ] ---> Response
    |
    v
[ Audit Log ] (append-only, survives reset)
```

- **Authentication**: JWT (HS256) with configurable shared secret. Env: `AUTH_SECRET`, `AUTH_DISABLED`.
- **RBAC**: Role hierarchy (Reader < Contributor < Reviewer < Applier < Admin). Agents are hard-blocked from review and apply.
- **Policy engine**: 6 rule types loaded from `policies.json` (min_approvals, required_reviewer_role, change_window, agent_restriction, agent_proposal_limit, egress_control).
- **Sensitivity labels**: Nodes classified as public/internal/confidential/restricted. Agent reads above allowed level are redacted and audited.
- **Audit log**: Immutable, append-only. Queryable (`GET /audit`), exportable as JSON/CSV.
- **IP protection**: Content fingerprinting (SHA-256), source attribution, IP classification, provenance endpoint.
- **DSAR**: Export endpoint queries audit log by subject; erase endpoint records audit event (store mutation pending).
- **Retention**: Background task with configurable rules from `retention.json` (enforcement stub; deletion/archiving pending).

See [Security & Governance](docs/reference/SECURITY_GOVERNANCE.md), [server/README.md](server/README.md).

---

## Development

| Task                   | Command                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Install, build, test   | `npm install && npm run build && npm test`                                                                             |
| Unit tests             | `npm test` or `npm run test:coverage`                                                                                  |
| Rust server tests      | `cd server && cargo test` (54 tests covering routes, auth, RBAC, policy, sensitivity, store, telemetry)                |
| Integration tests      | `npm run test:integration` -- starts the Rust server, runs tests, then stops it (in-memory store).                     |
| Server API smoke test  | `npm run test:server-api` (server must be running). Uses real server (in-memory store).                                |
| Ctx blocks in Markdown | `npm run install:ctx-extension` then reload the editor. [vscode-ctx-markdown/README.md](vscode-ctx-markdown/README.md) |

The playground and the scripts above use the **real Rust server** with an **in-memory store** by default (`npm run server`). Set `TRUTHTLAYER_STORAGE=file` for persistent file-based storage.

Project context and planning: [CONTEXT.md](CONTEXT.md), [DECISIONS.md](DECISIONS.md), [PLAN.md](PLAN.md), [RISKS.md](RISKS.md), [QUESTIONS.md](QUESTIONS.md). [docs/appendix/SELF-REFERENCE.md](docs/appendix/SELF-REFERENCE.md).

---

## Docker

- **Playground (recommended):** One image, context server embedded; only port 4317 is exposed.  
  `docker compose up --build` -> http://localhost:4317  
  Build only: `docker build -t truthlayer-playground -f Dockerfile.playground .`
- **Server only** (CI / API testing): `docker build -t truthlayer-server -f server/Dockerfile server`
- **API tests:** `npm run test:server-api` or `node scripts/test-server-api.mjs http://host:3080`

Requires [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

**Deploy to Azure:** A GitHub Actions workflow can build and deploy the playground to Azure Container Apps. One-time setup: [docs/DEVELOPMENT_DEPLOY_AZURE.md](docs/DEVELOPMENT_DEPLOY_AZURE.md).

---

## License

MIT. Implementation status: [PLAN.md](PLAN.md), [docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md](docs/engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md). Examples: [examples/](examples/).
