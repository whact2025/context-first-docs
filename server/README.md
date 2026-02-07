# TruthLayer server (Rust)

Server-centric implementation: all runtime configuration (storage, RBAC, etc.) lives in a **predefined location relative to the server** (config root). See QUESTIONS.md question-038 and docs (STORAGE_ARCHITECTURE, STORAGE_IMPLEMENTATION_PLAN).

## Prerequisites

- [Rust](https://rustup.rs/) (1.70+)

## Build and run

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

## HTTP API (minimal slice)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/nodes` | Query nodes (default query) |
| GET | `/nodes/:id` | Get node by ID |
| GET | `/proposals` | List open proposals |
| POST | `/proposals` | Create proposal (JSON body) |
| GET | `/proposals/:id` | Get proposal |
| POST | `/proposals/:id/review` | Submit review (JSON body) |
| POST | `/proposals/:id/apply` | Apply accepted proposal |

Types mirror the TypeScript definitions in `src/types/` (node, proposal, query). More endpoints and full query filters can be added incrementally.

## Tests

```bash
cargo test
```

Unit tests live in `src/store/in_memory.rs` and `src/types/node.rs`. With **rust-analyzer** installed, tests appear in the **Test Explorer** in Cursor/VS Code; you can run or debug individual tests from there.

## Debugging (Cursor / VS Code)

Install the **CodeLLDB** extension (`vadimcn.vscode-lldb`). Then use **Run and Debug** and choose:

- **Rust: Debug server** — build and run the server under the debugger (working directory: `server/`).
- **Rust: Debug server (with config root)** — same, but passes `.context` as the config root argument.
