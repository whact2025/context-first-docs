#!/usr/bin/env node
/**
 * Build DOCX projections of the whitepaper and supporting documents (one DOCX per document).
 * - Extracts Mermaid code blocks from each Markdown file
 * - Renders each diagram to high-resolution PNG via @mermaid-js/mermaid-cli (mmdc)
 * - Replaces Mermaid blocks in content with image references
 * - Rewrites cross-document links to point to the generated .docx files for easy navigation
 * - Writes one intermediate .md and one .docx per source document, each with a table of contents (--toc)
 * - Generates docs-index.docx with links to all documents
 *
 * Usage: node scripts/build-whitepaper-docx.js [--skip-pandoc] [--skip-mermaid] [--scale N]
 *   --skip-pandoc   Only render Mermaid to PNG and write .md files; do not run pandoc
 *   --skip-mermaid  Skip Mermaid rendering (leave diagram code in .md); use when Chrome/Puppeteer unavailable
 *   --scale N       PNG scale factor (default: 2 for high resolution)
 *
 * Requirements: npm install (optionalDep @mermaid-js/mermaid-cli + Puppeteer), Pandoc on PATH for DOCX output
 */

import { execFile, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const docsDir = path.join(repoRoot, "docs");
const defaultOutputDir = path.join(repoRoot, "dist", "whitepaper-docx");
const isWindows = process.platform === "win32";

/** Document list: whitepaper first, then appendix, core, reference, scenarios, engineering. Paths relative to docs/. */
const DOC_LIST = [
  { file: "WHITEPAPER.md", prefix: "wp", title: "Whitepaper" },
  { file: "WHITEPAPER_APPENDIX.md", prefix: "app", title: "Whitepaper Appendix" },
  { file: "core/ARCHITECTURE.md", prefix: "arch", title: "Architecture" },
  { file: "core/REVIEW_MODE.md", prefix: "review", title: "Review Mode (ACAL)" },
  { file: "core/UI_SPEC.md", prefix: "ui", title: "UI Specification" },
  { file: "core/AGENT_API.md", prefix: "agent", title: "Agent API" },
  { file: "core/USAGE.md", prefix: "usage", title: "Usage" },
  { file: "reference/DATA_MODEL_REFERENCE.md", prefix: "data", title: "Data Model Reference" },
  { file: "reference/SECURITY_GOVERNANCE.md", prefix: "sec", title: "Security & Governance" },
  { file: "reference/OPERATIONS.md", prefix: "ops", title: "Operations" },
  { file: "appendix/SELF-REFERENCE.md", prefix: "self", title: "Self-Reference" },
  { file: "appendix/CHANGE_DETECTION.md", prefix: "chg", title: "Change Detection" },
  { file: "appendix/RECONCILIATION_STRATEGIES.md", prefix: "recon", title: "Reconciliation Strategies" },
  { file: "appendix/OPTIONAL_INTEGRATIONS.md", prefix: "opt", title: "Optional Integrations" },
  { file: "appendix/DOCX_REVIEW_INTEGRATION.md", prefix: "docx", title: "DOCX / Word / Excel Review Integration" },
  { file: "appendix/CONTEXTUALIZED_AI_MODEL.md", prefix: "ctxai", title: "Contextualized AI Model" },
  { file: "scenarios/HELLO_WORLD_SCENARIO.md", prefix: "hello", title: "Hello World Scenario" },
  { file: "scenarios/CONFLICT_AND_MERGE_SCENARIO.md", prefix: "conflict", title: "Conflict and Merge Scenario" },
  { file: "scenarios/BUSINESS_POLICY_SCENARIO.md", prefix: "biz", title: "Business Policy Scenario" },
  { file: "engineering/storage/STORAGE_ARCHITECTURE.md", prefix: "storage", title: "Storage Architecture" },
  { file: "engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md", prefix: "impl", title: "Storage Implementation Plan" },
];

const MERMAID_BLOCK_RE = /```mermaid\n([\s\S]*?)```/g;

/** Map: source .md path (normalized) -> { docxName, title }. Used for index and for link rewriting. */
function buildMdToDocxMap() {
  const map = new Map();
  for (const { file, title } of DOC_LIST) {
    const slug = slugFromFile(file);
    const docxName = `${slug}.docx`;
    map.set(normalizeDocsPath(file), { docxName, title });
  }
  return map;
}

/** Normalize path to forward slashes, no leading ./, for consistent comparison. */
function normalizeDocsPath(p) {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Resolve a link href relative to the current file (path relative to docs/).
 * Returns a path relative to docs/ (normalized), or null if not a .md link we can resolve.
 */
function resolveLinkToDocsPath(currentFile, href) {
  const hashIndex = href.indexOf("#");
  const pathPart = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  if (!pathPart.toLowerCase().endsWith(".md")) return null;
  let linkPath = pathPart.trim();
  if (!linkPath) return null;
  // Strip optional docs/ prefix (links from repo root)
  if (linkPath.replace(/\/$/, "").toLowerCase().startsWith("docs/")) {
    linkPath = linkPath.slice(5);
  }
  const currentDir = path.dirname(currentFile);
  const resolved = path.normalize(path.join(currentDir, linkPath));
  return normalizeDocsPath(resolved);
}

/**
 * Rewrite cross-document links: point to .docx and use the document title as the link label (no path/extension).
 * Resolves each [label](path#anchor) relative to the current file; rewrites to [Title](slug.docx#anchor).
 * If the link label looks like a path (contains / or .md), also try resolving the label as a docs path so we never emit path-style text.
 */
function rewriteCrossDocLinks(content, currentFile, mdToDocx) {
  const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
  return content.replace(LINK_RE, (match, label, href) => {
    const hashIndex = href.indexOf("#");
    const anchor = hashIndex >= 0 ? href.slice(hashIndex) : "";
    let resolved = resolveLinkToDocsPath(currentFile, href);
    let info = resolved != null ? mdToDocx.get(resolved) : null;
    // Fallback: if label looks like a path, look up by normalized label so we never show path as link text
    if (!info && /[/\\]|\.md\s*$/i.test(label)) {
      const labelAsPath = normalizeDocsPath(path.normalize(label.trim()));
      info = mdToDocx.get(labelAsPath);
      if (info) resolved = labelAsPath;
    }
    if (!info) return match;
    return `[${info.title}](${info.docxName}${anchor})`;
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  let skipPandoc = false;
  let skipMermaid = false;
  let scale = 2;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--skip-pandoc") skipPandoc = true;
    if (args[i] === "--skip-mermaid") skipMermaid = true;
    if (args[i] === "--scale" && args[i + 1] != null) {
      scale = Math.max(1, parseInt(args[i + 1], 10) || 2);
      i++;
    }
  }
  return { skipPandoc, skipMermaid, scale };
}

function exec(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, maxBuffer: 10 * 1024 * 1024, shell: isWindows }, (err, stdout, stderr) => {
      if (err) {
        const msg = stderr?.trim() || stdout?.trim() || err.message;
        reject(new Error(`${cmd} ${args.join(" ")}: ${msg}`));
      } else resolve({ stdout: stdout?.trim() ?? "", stderr: stderr?.trim() ?? "" });
    });
  });
}

/**
 * Replace each ```mermaid ... ``` block with an image reference; render each block to PNG.
 * If skipMermaid is true, returns content unchanged and imageCount 0.
 * Returns { content: string, imageCount: number }.
 */
async function processMermaidInContent(content, prefix, outputDir, scale, skipMermaid = false) {
  const matches = [...content.matchAll(MERMAID_BLOCK_RE)];
  if (matches.length === 0 || skipMermaid) return { content, imageCount: 0 };

  const mmdcBin = path.join(repoRoot, "node_modules", ".bin", "mmdc" + (isWindows ? ".cmd" : ""));
  const imageRefs = [];

  for (let i = 0; i < matches.length; i++) {
    const baseName = `mermaid-${prefix}-${String(i + 1).padStart(3, "0")}`;
    const mmdPath = path.join(outputDir, `${baseName}.mmd`);
    const pngPath = path.join(outputDir, `${baseName}.png`);
    await writeFile(mmdPath, matches[i][1].trimEnd(), "utf8");
    if (isWindows) {
      execSync(`"${mmdcBin}" -i "${mmdPath}" -o "${pngPath}" --scale ${scale}`, { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 });
    } else {
      await exec(mmdcBin, ["-i", mmdPath, "-o", pngPath, "--scale", String(scale)], repoRoot);
    }
    imageRefs.push(`\n![Diagram: ${baseName}](${path.basename(pngPath)})\n`);
  }

  let idx = 0;
  const newContent = content.replace(MERMAID_BLOCK_RE, () => imageRefs[idx++]);
  return { content: newContent, imageCount: imageRefs.length };
}

function slugFromFile(file) {
  return path.basename(file, ".md").toLowerCase().replace(/_/g, "-");
}

async function main() {
  const { skipPandoc, skipMermaid, scale } = parseArgs();
  const outputDir = defaultOutputDir;

  await mkdir(outputDir, { recursive: true });

  let pandocCmd = "pandoc";
  if (isWindows) {
    const localPandoc = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Pandoc", "pandoc.exe");
    const programFiles = path.join(process.env.ProgramFiles || "C:\\Program Files", "Pandoc", "pandoc.exe");
    if (localPandoc && existsSync(localPandoc)) pandocCmd = localPandoc;
    else if (programFiles && existsSync(programFiles)) pandocCmd = programFiles;
  }

  const mdToDocx = buildMdToDocxMap();

  for (const { file, prefix } of DOC_LIST) {
    const filePath = path.join(docsDir, file);
    let content;
    try {
      content = await readFile(filePath, "utf8");
    } catch (e) {
      if (e.code === "ENOENT") {
        console.warn(`Skipping ${file} (not found)`);
        continue;
      }
      throw e;
    }

    const { content: afterMermaid, imageCount } = await processMermaidInContent(content, prefix, outputDir, scale, skipMermaid);
    if (imageCount > 0) console.log(`${file}: rendered ${imageCount} Mermaid diagram(s) to PNG`);
    const processed = rewriteCrossDocLinks(afterMermaid, file, mdToDocx);

    const slug = slugFromFile(file);
    const mdName = `${slug}.md`;
    const docxName = `${slug}.docx`;
    const mdPath = path.join(outputDir, mdName);
    const docxPath = path.join(outputDir, docxName);

    await writeFile(mdPath, processed, "utf8");
    console.log(`Wrote ${mdPath}`);

    if (!skipPandoc) {
      try {
        await exec(pandocCmd, ["-f", "markdown", "-t", "docx", "--toc", mdName, "-o", docxName], outputDir);
        console.log(`Wrote ${docxPath}`);
      } catch (e) {
        console.error(`Pandoc failed for ${file}: ${e.message}`);
      }
    }
  }

  if (!skipPandoc) {
    const indexMd = [
      "# TruthLayer Documentation (DOCX)",
      "",
      "This folder contains the following documents. Use the links below to open any document.",
      "",
      ...DOC_LIST.map(({ file, title }) => {
        const info = mdToDocx.get(normalizeDocsPath(file));
        return info ? `- [${title}](${info.docxName})` : null;
      }).filter(Boolean),
      "",
    ].join("\n");
    const indexMdPath = path.join(outputDir, "docs-index.md");
    const indexDocxPath = path.join(outputDir, "docs-index.docx");
    await writeFile(indexMdPath, indexMd, "utf8");
    try {
      await exec(pandocCmd, ["-f", "markdown", "-t", "docx", "--toc", "docs-index.md", "-o", "docs-index.docx"], outputDir);
      console.log(`Wrote ${indexDocxPath}`);
    } catch (e) {
      console.error(`Pandoc failed for index: ${e.message}`);
    }
  }

  if (skipPandoc) {
    console.log("Skipping Pandoc (--skip-pandoc). Install Pandoc and run pandoc per .md file in dist/whitepaper-docx/");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
