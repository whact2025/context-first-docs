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

## Implementation status

- **Implemented:** Health, nodes (query, get by ID), proposals (list, create, get, PATCH update), review, apply (with optional `appliedBy`, APPLIED status and AppliedMetadata, idempotent), withdraw, reset. In-memory store only.
- **Conflict / stale / merge:** `detectConflicts(proposalId)`, `isProposalStale(proposalId)`, and `mergeProposals(proposalIds)` are implemented on the **ContextStore** (InMemoryStore); return types match `docs/core/AGENT_API.md` and `docs/appendix/RECONCILIATION_STRATEGIES.md`. Not yet exposed on the HTTP API (programmatic store only).
- **Workspace (current behavior):** Single workspace (default). `workspaceId` in the API contract is reserved for future use; the server does not yet scope by workspace.

## HTTP API (minimal slice)

| Method | Path                      | Description                                                                                                     |
| ------ | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                 | Health check                                                                                                    |
| GET    | `/nodes`                  | Query nodes (default query)                                                                                     |
| GET    | `/nodes/:id`              | Get node by ID                                                                                                  |
| GET    | `/proposals`              | List open proposals. Query params: `limit`, `offset`. Response: `{ proposals, total, limit, offset, hasMore }`. |
| POST   | `/proposals`              | Create proposal (JSON body)                                                                                     |
| GET    | `/proposals/:id`          | Get proposal                                                                                                    |
| PATCH  | `/proposals/:id`          | Partially update proposal (status, metadata, comments)                                                          |
| POST   | `/proposals/:id/review`   | Submit review (JSON body)                                                                                       |
| POST   | `/proposals/:id/apply`    | Apply accepted proposal. Optional body: `{ "appliedBy": "actorId" }`. Idempotent when already applied.          |
| POST   | `/proposals/:id/withdraw` | Withdraw proposal (author only). Allowed only when status is open. → WITHDRAWN.                                 |
| POST   | `/reset`                  | Reset store (dev only)                                                                                          |

Types mirror the TypeScript definitions in `src/types/` (node, proposal, query). More endpoints and full query filters can be added incrementally.

## Tests

```bash
cargo test
```

- **Store and types:** unit tests in `src/store/in_memory.rs` and `src/types/node.rs`.
- **Router (HTTP API):** tests in `src/api/routes.rs` use `tower::ServiceExt::oneshot` to call the router without starting a server; they cover health, nodes, proposals (create, get, PATCH), apply (with optional body), withdraw, and reset.

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
