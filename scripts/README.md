# Installation Scripts

This directory contains cross-platform installation scripts for managing all project dependencies.

## Available Scripts

### Render Markdown with ctx blocks

**File**: `render-markdown-with-ctx.js`

Renders a Markdown file to HTML using the **ctx block plugin**: ` ```ctx ``` ` blocks (with optional `---` and body) are shown with metadata and the body rendered as Markdown instead of raw code.

**Usage** (from repo root, after `npm run build`):

```bash
node scripts/render-markdown-with-ctx.js QUESTIONS.md > QUESTIONS.html
node scripts/render-markdown-with-ctx.js path/to/file.md [output.html]
```

Open the resulting HTML in a browser. The plugin is also used by the playground’s markdown preview (`npm run playground`).

### Run the playground

From the repo root: **`npm run playground`**. Then open http://localhost:4317. This starts both the context-store server and the playground UI (requires Node and Rust). Stop with Ctrl+C. In Cursor/VS Code: **Terminal → Run Task → "Playground (run both servers)"**.

### Set GitHub Azure secrets/variables

**Files**: `set-github-azure-secrets.ps1` (PowerShell), `set-github-azure-secrets.sh` (Bash)

Sets GitHub Actions secrets and variables for the Azure deploy workflow from your environment variables. Requires [GitHub CLI](https://cli.github.com/) installed and authenticated (`gh auth login`). Run from repo root after setting `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_ACR_NAME`, `AZURE_RESOURCE_GROUP`, `AZURE_CONTAINER_APP_NAME`. See [docs/DEVELOPMENT_DEPLOY_AZURE.md](../docs/DEVELOPMENT_DEPLOY_AZURE.md).

---

### Server API test

**File**: `test-server-api.mjs`

Smoke-tests the server REST API (health, nodes, proposals). Use after starting the server (locally or in a container).

**Usage** (from repo root):

```bash
npm run test:server-api
# or with a custom base URL:
node scripts/test-server-api.mjs http://localhost:3080
```

CI runs this against the server running in a Docker container after building the server image.

---

### Node.js Script (Recommended - Cross-platform)

**File**: `install.js`

Works on Windows, macOS, and Linux. This is the recommended script as it's the most portable.

**Usage**:

```bash
# Full installation (installs dependencies, builds, and runs tests)
node scripts/install.js

# Skip build step
node scripts/install.js --skip-build

# Skip tests
node scripts/install.js --skip-tests

# Skip verification
node scripts/install.js --skip-verify

# Combine flags
node scripts/install.js --skip-build --skip-tests
```

**Via npm**:

```bash
npm run install:all
```

### PowerShell Script (Windows)

**File**: `install.ps1`

For Windows PowerShell users.

**Usage**:

```powershell
# Full installation
.\scripts\install.ps1

# Skip build step
.\scripts\install.ps1 -SkipBuild

# Skip tests
.\scripts\install.ps1 -SkipTests

# Skip verification
.\scripts\install.ps1 -SkipVerify

# Combine flags
.\scripts\install.ps1 -SkipBuild -SkipTests
```

**Note**: If you get an execution policy error, run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Whitepaper DOCX build

**File**: `build-whitepaper-docx.js`

Builds **one DOCX per document** from the whitepaper and supporting docs (`docs/WHITEPAPER.md`, `WHITEPAPER_APPENDIX.md`, `ARCHITECTURE.md`, `STORAGE_ARCHITECTURE.md`, `CONTEXTUALIZED_AI_MODEL.md`, `HELLO_WORLD_SCENARIO.md`, `CONFLICT_AND_MERGE_SCENARIO.md`, `STORAGE_IMPLEMENTATION_PLAN.md`). All Mermaid diagrams are rendered to **high-resolution PNG** images (default 2× scale) via `@mermaid-js/mermaid-cli`; each document is written as an intermediate `.md` and converted to DOCX with **Pandoc**. For easy navigation:

- **Table of contents**: Each DOCX is built with `--toc` so you can jump to sections within the document.
- **Cross-document links**: References like `[Hello World](HELLO_WORLD_SCENARIO.md)` are rewritten to point to `truth-layer-hello-world-scenario.docx`, so links between documents work when all DOCX files are in the same folder.
- **Index document**: `truth-layer-docs-index.docx` is generated with a list of links to all DOCX files; open it first to jump to any document.

**Requirements**:

- `npm install` (installs optional `@mermaid-js/mermaid-cli`, which uses Puppeteer for rendering; if mmdc fails with "Cannot find package 'puppeteer'", run `npm install` again without `--no-optional`)
- **Pandoc** installed on your PATH for DOCX output: [pandoc.org/installing](https://pandoc.org/installing.html)

**Usage**:

```bash
# Full build: render Mermaid to PNG + produce one DOCX per document (requires Pandoc + Chrome for mmdc)
npm run build:whitepaper-docx

# If Chrome/Puppeteer is not installed: skip Mermaid rendering, still produce all DOCX (diagrams stay as code blocks)
node scripts/build-whitepaper-docx.js --skip-mermaid

# Or run the script directly
node scripts/build-whitepaper-docx.js

# Only render Mermaid to PNG and write .md files (skip Pandoc)
node scripts/build-whitepaper-docx.js --skip-pandoc

# Higher resolution PNG (e.g. 3× scale)
node scripts/build-whitepaper-docx.js --scale 3

# Also build one combined DOCX with internal links (truthlayer-docs.docx)
node scripts/build-whitepaper-docx.js --single-docx
```

**Output**: In `dist/whitepaper-docx/`, one `.md` and one `.docx` per source document (e.g. `whitepaper.docx`, `architecture.docx`), plus **docs-index.docx** (master index with links to all documents), `mermaid-*.png`, and `*.mmd` for diagrams. With **`--single-docx`**, also produces **truthlayer-docs.md** and **truthlayer-docs.docx** — one combined document with all docs in order and cross-references rewritten to internal heading links so navigation works inside the single file.

If Pandoc is not installed, run with `--skip-pandoc` and then run pandoc per `.md` file in that folder, e.g. `pandoc -f markdown -t docx whitepaper.md -o truth-layer-whitepaper.docx`.

### Bash Script (macOS/Linux)

**File**: `install.sh`

For macOS and Linux users.

**Usage**:

```bash
# Make executable (first time only)
chmod +x scripts/install.sh

# Full installation
./scripts/install.sh

# Skip build step
./scripts/install.sh --skip-build

# Skip tests
./scripts/install.sh --skip-tests

# Skip verification
./scripts/install.sh --skip-verify

# Combine flags
./scripts/install.sh --skip-build --skip-tests
```

## What the Scripts Do

1. **Check Node.js version** - Verifies Node.js 18+ is installed
2. **Check npm version** - Verifies npm is available
3. **Install dependencies** - Runs `npm install` to install all packages
4. **Verify installation** - Checks that key dependencies are installed correctly
5. **Build project** (optional) - Runs `npm run build` to compile TypeScript
6. **Run tests** (optional) - Runs `npm test` to verify everything works

## Automatic Post-Install

The `package.json` includes a `postinstall` script that automatically runs a lightweight installation check after `npm install`. This verifies dependencies are installed but skips build and tests for faster execution.

## Manual Installation

If you prefer to install manually:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

## Troubleshooting

### Node.js version too old

The scripts require Node.js 18 or higher. Install a newer version from [nodejs.org](https://nodejs.org/).

### npm install fails

- Check your internet connection
- Try clearing npm cache: `npm cache clean --force`
- Delete `node_modules` and `package-lock.json`, then run `npm install` again

### Build fails

This is expected if there are TypeScript errors. Fix the errors and run `npm run build` manually.

### Tests fail

This might be expected during development. Run `npm test` manually to see detailed error messages.

## Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: Comes with Node.js (usually 9.0.0 or higher)

## Dependencies Installed

The scripts verify these key dependencies are installed:

- **TypeScript** - TypeScript compiler
- **Jest** - Testing framework
- **ts-jest** - Jest TypeScript preset
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **markdown-it** - Markdown parser
- **yaml** - YAML parser

See `package.json` for the complete list of dependencies.
