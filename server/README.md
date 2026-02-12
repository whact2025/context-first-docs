# TruthLayer server (Rust)

Server-centric implementation: all runtime configuration (storage, RBAC, etc.) lives in a **predefined location relative to the server** (config root). See QUESTIONS.md question-038 and docs (STORAGE_ARCHITECTURE, STORAGE_IMPLEMENTATION_PLAN).

## Prerequisites

- [Rust](https://rustup.rs/) (1.70+). Ensure `cargo` is on your PATH (e.g. after rustup: on Windows `%USERPROFILE%\.cargo\bin`, on Unix `~/.cargo/bin`).

## Build and run

From this directory (`server/`):

```bash
cargo build --release
cargo run --release
```

Optional: pass config root as first argument, or set env:

- `TRUTHTLAYER_CONFIG_ROOT` — path to config root (default: current directory)
- `TRUTHTLAYER_STORAGE` — `memory` | `file` | `mongodb` (default: `memory`)
- `TRUTHTLAYER_LISTEN` — listen address (default: `127.0.0.1:3080`)
- `TRUTHTLAYER_MONGO_URI` — MongoDB URI when backend is `mongodb`
- `AUTH_SECRET` — HMAC-SHA256 shared secret for JWT validation (required when auth is enabled)
- `AUTH_DISABLED` — set to `true` or `1` to disable auth (default: `true` for dev; set to `false` for production)
- `OTEL_EXPORTER_OTLP_ENDPOINT` — when set, enable OTLP trace export and W3C trace context propagation (client→server). See [OTEL_LOGGING.md](../docs/OTEL_LOGGING.md) (Azure Monitor, Grafana, etc.).
- `OTEL_CONSOLE_SPANS` — when set to `true` or `1`, also print spans to stdout (local dev). Can be used with or without an OTLP endpoint.

## Config root layout

Under the config root you can place:

- `config/config.json` or `config.json` with:

```json
{
  "storage": {
    "backend": "memory",
    "file_data_dir": "data",
    "mongo_uri": null
  },
  "rbac": {
    "provider": "git"
  },
  "server": {
    "listen_addr": "127.0.0.1:3080"
  }
}
```

If no file is found, defaults are used (memory backend, listen on `127.0.0.1:3080`).

**Config files in config root:**

- `policies.json` — Policy engine rules (min_approvals, required_reviewer_role, change_window, agent_restriction, agent_proposal_limit, egress_control). Example:

```json
{
  "rules": [
    { "type": "min_approvals", "node_types": [], "min": 1 },
    { "type": "agent_restriction", "blocked_actions": ["apply", "review"] },
    {
      "type": "agent_proposal_limit",
      "max_operations": 10,
      "max_content_length": 50000
    },
    {
      "type": "egress_control",
      "max_sensitivity": "internal",
      "destinations": []
    }
  ]
}
```

- `retention.json` — Retention policy rules. Example:

```json
{
  "rules": [
    { "resource_type": "proposal", "retention_days": 365, "action": "archive" },
    { "resource_type": "audit", "retention_days": 730, "action": "archive" }
  ],
  "check_interval_secs": 86400
}
```

## Implementation status

- **Implemented:** Auth (JWT HS256), RBAC enforcement on all routes, policy engine (6 rule types), immutable audit log (queryable + exportable), sensitivity labels, agent guardrails (redaction + audit), content fingerprinting (SHA-256), file-based storage. Health, nodes (query, get by ID, provenance), proposals (list, create, get, PATCH update), review, apply (with optional `appliedBy`, APPLIED status and AppliedMetadata, idempotent), withdraw, reset. DSAR export (queries audit by subject).
- **Partial (endpoint exists, enforcement pending):** Retention engine (background task + config loading; logs audit events but does not yet delete/archive). DSAR erase (records audit event but does not yet mutate store data).
- **Storage backends:** Memory (default) and File-based (`TRUTHTLAYER_STORAGE=file`). File store persists as JSON under `data/` with atomic writes. Set `file_data_dir` in config.json or leave default `data`.
- **Conflict / stale / merge:** `detectConflicts(proposalId)`, `isProposalStale(proposalId)`, and `mergeProposals(proposalIds)` are implemented on the **ContextStore** (InMemoryStore); return types match `docs/core/AGENT_API.md` and `docs/appendix/RECONCILIATION_STRATEGIES.md`. Not yet exposed on the HTTP API (programmatic store only).
- **Workspace (current behavior):** Single workspace (default). `workspaceId` in the API contract is reserved for future use; the server does not yet scope by workspace.

## HTTP API (minimal slice)

| Method | Path                      | Description                                                                                                     |
| ------ | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                 | Health check                                                                                                    |
| GET    | `/nodes`                  | Query nodes (default query)                                                                                     |
| GET    | `/nodes/:id`              | Get node by ID                                                                                                  |
| GET    | `/nodes/:id/provenance`   | Full attribution/audit chain for a node (Reader)                                                                |
| GET    | `/proposals`              | List open proposals. Query params: `limit`, `offset`. Response: `{ proposals, total, limit, offset, hasMore }`. |
| POST   | `/proposals`              | Create proposal (JSON body)                                                                                     |
| GET    | `/proposals/:id`          | Get proposal                                                                                                    |
| PATCH  | `/proposals/:id`          | Partially update proposal (status, metadata, comments)                                                          |
| POST   | `/proposals/:id/review`   | Submit review (JSON body)                                                                                       |
| POST   | `/proposals/:id/apply`    | Apply accepted proposal. Optional body: `{ "appliedBy": "actorId" }`. Idempotent when already applied.          |
| POST   | `/proposals/:id/withdraw` | Withdraw proposal (author only). Allowed only when status is open. → WITHDRAWN.                                 |
| GET    | `/audit`                  | Query audit events. Filters: actor, action, resource_id, from, to, limit, offset (Admin)                        |
| GET    | `/audit/export`           | Export audit log as JSON or CSV (format=json\|csv) (Admin)                                                      |
| GET    | `/admin/dsar/export`      | DSAR export: all data for a subject (Admin, query: subject=actorId)                                             |
| POST   | `/admin/dsar/erase`       | DSAR erase: records erasure audit event (Admin, body: `{ "subject": "actorId" }`). Store mutation pending.      |
| POST   | `/reset`                  | Reset store (dev only)                                                                                          |

Types mirror the TypeScript definitions in `src/types/` (node, proposal, query). More endpoints and full query filters can be added incrementally.

## Tests

```bash
cargo test
```

54 tests covering routes, auth, RBAC, policy, sensitivity, store, and telemetry.

- **Store and types:** unit tests in `src/store/in_memory.rs`, `src/store/file_store.rs`, and `src/types/node.rs`.
- **Router (HTTP API):** tests in `src/api/routes.rs` use `tower::ServiceExt::oneshot` to call the router without starting a server; they cover health, nodes, proposals (create, get, PATCH), apply (with optional body), withdraw, provenance, audit, DSAR export/erase, and reset.
- **Governance:** tests for auth (JWT validation), RBAC enforcement, policy engine, sensitivity labels, and retention.

With **rust-analyzer** installed, tests appear in the **Test Explorer** in Cursor/VS Code; you can run or debug individual tests from there.

### Code coverage

Coverage is generated in CI (see `.github/workflows/ci.yml` job `rust-server-coverage`); the LCOV report is uploaded as an artifact.

To run coverage locally (from `server/`):

```bash
rustup component add llvm-tools-preview
cargo install cargo-llvm-cov
cargo llvm-cov --lcov --output-path lcov.info
cargo llvm-cov report
```

For an HTML report: `cargo llvm-cov --html` (output in `target/llvm-cov/html/`).

## Debugging (Cursor / VS Code)

Install the **CodeLLDB** extension (`vadimcn.vscode-lldb`). Then use **Run and Debug** and choose:

- **Rust: Debug server** — build and run the server under the debugger (working directory: `server/`).
- **Rust: Debug server (with config root)** — same, but passes `.context` as the config root argument.
