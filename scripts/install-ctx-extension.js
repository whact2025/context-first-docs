#!/usr/bin/env node
/**
 * Install the Ctx Block Markdown Preview extension into the user's
 * Cursor/VS Code extensions directory so it loads automatically in this workspace
 * (and others). Run once; reload the window if the editor is already open.
 *
 * Usage: node scripts/install-ctx-extension.js
 *    or: npm run install:ctx-extension
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const extSource = path.join(repoRoot, "vscode-ctx-markdown");

const pkgPath = path.join(extSource, "package.json");
if (!fs.existsSync(pkgPath)) {
  console.error("Missing vscode-ctx-markdown/package.json");
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const extId = `${pkg.publisher}.${pkg.name}-${pkg.version}`;

const home =
  process.env.USERPROFILE ||
  process.env.HOME ||
  (process.env.LOGNAME && `/home/${process.env.LOGNAME}`) ||
  process.cwd();

const candidates = [
  path.join(home, ".cursor", "extensions"), // Cursor
  path.join(home, ".vscode", "extensions"), // VS Code
];

let extDir = process.env.CURSOR_EXTENSIONS_DIR || process.env.VSCODE_EXTENSIONS_DIR;
if (!extDir) {
  for (const d of candidates) {
    if (fs.existsSync(d)) {
      extDir = d;
      break;
    }
  }
}
if (!extDir) {
  extDir = candidates[0]; // default to Cursor first
  try {
    fs.mkdirSync(extDir, { recursive: true });
  } catch (e) {
    extDir = candidates[1];
    fs.mkdirSync(extDir, { recursive: true });
  }
}

const target = path.join(extDir, extId);

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true });
  }
  copyRecursive(extSource, target);
  console.log("Installed:", extId);
  console.log("Path:", target);
  console.log("Reload the window to activate (Ctrl+Shift+P / Cmd+Shift+P → \"Developer: Reload Window\").");
} catch (err) {
  console.error("Install failed:", err.message);
  process.exit(1);
}
