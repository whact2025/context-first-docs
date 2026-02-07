# Ctx Block Markdown Preview

Renders **` ```ctx ``` `** code blocks in the Cursor/VS Code Markdown preview so that the **body** (after `---`) is shown as formatted Markdown (bold, lists, links) instead of raw code.

## Format

```ctx
type: question
id: question-001
status: resolved
---
**Question**: Your question here?

**Answer**: The answer with **bold** and lists.
- Item one
- Item two

**Impact**: High
```

- **Before `---`:** metadata (type, id, status, etc.) shown as a small caption bar.
- **After `---`:** rendered as Markdown.

## Install (load automatically in this workspace)

From the repo root, run once:

```bash
npm run install:ctx-extension
# Or, if PowerShell blocks npm: node scripts/install-ctx-extension.js
```

This copies the extension into your Cursor (or VS Code) extensions directory so it loads in every window. Then **reload the window** (Ctrl+Shift+P / Cmd+Shift+P → "Developer: Reload Window"). After that, opening any Markdown file with ` ```ctx ``` ` blocks and using the preview will use this extension automatically. The workspace also recommends this extension so you may see a prompt to install it if it's not present.

**Alternative (development):** Open the `vscode-ctx-markdown` folder and press **F5** to run the extension in a new window without installing.

## Package (optional)

To create a `.vsix` for sharing:

```bash
cd vscode-ctx-markdown
npx @vscode/vsce package
```

Then install the generated `.vsix` via Extensions → "..." → "Install from VSIX...".
