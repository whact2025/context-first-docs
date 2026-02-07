#!/usr/bin/env node
/**
 * Render a Markdown file to HTML using the ctx block plugin.
 * ```ctx blocks are rendered with metadata + body as Markdown (not raw code).
 *
 * Usage (from repo root, after npm run build):
 *   node scripts/render-markdown-with-ctx.js QUESTIONS.md > QUESTIONS.html
 *   node scripts/render-markdown-with-ctx.js path/to/file.md
 *
 * Open the resulting HTML in a browser to view with ctx blocks rendered.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import { ctxRenderPlugin } from "../dist/markdown/ctx-render-plugin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const inputFile = process.argv[2] || path.join(rootDir, "QUESTIONS.md");
const outputFile = process.argv[3]; // optional: write to file instead of stdout

let markdown;
try {
  markdown = fs.readFileSync(inputFile, "utf8");
} catch (err) {
  console.error("Error reading file:", inputFile, err.message);
  process.exit(1);
}

const md = new MarkdownIt({ html: false, linkify: true });
md.use(ctxRenderPlugin);
const bodyHtml = md.render(markdown);

const title = path.basename(inputFile, path.extname(inputFile));
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: 52rem; margin: 0 auto; padding: 1.5rem; }
    .ctx-block { margin: 1rem 0; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; }
    .ctx-meta { font-size: 0.85rem; padding: 0.4rem 0.75rem; background: #f5f5f5; color: #555; }
    .ctx-meta span { margin-right: 1rem; }
    .ctx-body { padding: 0.75rem 1rem; }
    .ctx-body p:first-child { margin-top: 0; }
    .ctx-body p:last-child { margin-bottom: 0; }
    pre { background: #f8f8f8; padding: 0.75rem; border-radius: 4px; overflow-x: auto; }
    code { font-size: 0.9em; }
    hr { border: none; border-top: 1px solid #e0e0e0; margin: 1.5rem 0; }
    a { color: #0066cc; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

if (outputFile) {
  fs.writeFileSync(outputFile, html, "utf8");
  console.error("Wrote", outputFile);
} else {
  process.stdout.write(html);
}
