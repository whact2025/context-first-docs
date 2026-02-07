#!/usr/bin/env node
/**
 * Build DOCX projections of the whitepaper and supporting documents (one DOCX per document).
 * - Extracts Mermaid code blocks from each Markdown file
 * - Renders each diagram to high-resolution PNG via @mermaid-js/mermaid-cli (mmdc)
 * - Replaces Mermaid blocks in content with image references
 * - Rewrites cross-document links to point to the generated .docx files for easy navigation
 * - Writes one intermediate .md and one .docx per source document, each with a table of contents (--toc)
 * - Generates truth-layer-docs-index.docx with links to all documents
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

/** Document list: whitepaper first, then appendix, then supporting docs (incl. UX and human interaction). */
const DOC_LIST = [
  { file: "WHITEPAPER.md", prefix: "wp", title: "Whitepaper" },
  { file: "WHITEPAPER_APPENDIX.md", prefix: "app", title: "Whitepaper Appendix" },
  { file: "ARCHITECTURE.md", prefix: "arch", title: "Architecture" },
  { file: "UX_AND_HUMAN_INTERACTION.md", prefix: "ux", title: "UX and Human Interaction" },
  { file: "UI_SPEC.md", prefix: "ui", title: "UI Specification" },
  { file: "DOCX_REVIEW_INTEGRATION.md", prefix: "docx", title: "DOCX / Word / Excel Review Integration" },
  { file: "STORAGE_ARCHITECTURE.md", prefix: "storage", title: "Storage Architecture" },
  { file: "CONTEXTUALIZED_AI_MODEL.md", prefix: "ctxai", title: "Contextualized AI Model" },
  { file: "HELLO_WORLD_SCENARIO.md", prefix: "hello", title: "Hello World Scenario" },
  { file: "CONFLICT_AND_MERGE_SCENARIO.md", prefix: "conflict", title: "Conflict and Merge Scenario" },
  { file: "STORAGE_IMPLEMENTATION_PLAN.md", prefix: "impl", title: "Storage Implementation Plan" },
];

const MERMAID_BLOCK_RE = /```mermaid\n([\s\S]*?)```/g;

/** Map: source .md basename -> output .docx filename (for cross-doc link rewriting). */
function buildMdToDocxMap() {
  const map = new Map();
  for (const { file } of DOC_LIST) {
    const slug = slugFromFile(file);
    map.set(file, `truth-layer-${slug}.docx`);
  }
  return map;
}

/**
 * Rewrite cross-document links in processed content so they point to the generated .docx files.
 * Replaces ](FILENAME.md) and ](docs/FILENAME.md) (optional #anchor) with ](truth-layer-slug.docx#anchor).
 */
function rewriteCrossDocLinks(content, mdToDocx) {
  let out = content;
  for (const [mdName, docxName] of mdToDocx) {
    const escaped = mdName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\]\\((?:docs/)?${escaped}(#.*?)?\\)`, "g");
    out = out.replace(re, (_, anchor) => `](${docxName}${anchor || ""})`);
  }
  return out;
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
    const processed = rewriteCrossDocLinks(afterMermaid, mdToDocx);

    const slug = slugFromFile(file);
    const mdName = `${slug}.md`;
    const docxName = `truth-layer-${slug}.docx`;
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
        const docxName = mdToDocx.get(file);
        return docxName ? `- [${title}](${docxName})` : null;
      }).filter(Boolean),
      "",
    ].join("\n");
    const indexMdPath = path.join(outputDir, "truth-layer-docs-index.md");
    const indexDocxPath = path.join(outputDir, "truth-layer-docs-index.docx");
    await writeFile(indexMdPath, indexMd, "utf8");
    try {
      await exec(pandocCmd, ["-f", "markdown", "-t", "docx", "--toc", "truth-layer-docs-index.md", "-o", "truth-layer-docs-index.docx"], outputDir);
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
