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
 * Usage: node scripts/build-whitepaper-docx.js [--skip-pandoc] [--skip-mermaid] [--scale N] [--single-docx] [--watermark TEXT]
 *   --skip-pandoc   Only render Mermaid to PNG and write .md files; do not run pandoc
 *   --skip-mermaid  Skip Mermaid rendering (leave diagram code in .md); use when Chrome/Puppeteer unavailable
 *   --scale N       PNG scale factor (default: 2 for high resolution)
 *   --single-docx   Also build one combined DOCX (truthlayer-docs.docx) with internal links to sections
 *   --watermark TEXT Add a diagonal text watermark (e.g., CONFIDENTIAL) to every generated DOCX
 *
 * Requirements: npm install (optionalDep @mermaid-js/mermaid-cli + Puppeteer, adm-zip for --watermark), Pandoc on PATH for DOCX output
 */

import { execFile, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const docsDir = path.join(repoRoot, "docs");
const defaultOutputDir = path.join(repoRoot, "dist", "whitepaper-docx");
const isWindows = process.platform === "win32";

/** GitHub base URL for links that escape the docs/ folder (points to main branch). */
const GITHUB_BLOB_BASE = "https://github.com/whact2025/context-first-docs/blob/main";

/** Document list: README (entry point), audience briefs, then whitepaper, appendix, core, reference, scenarios, engineering. Paths relative to docs/. */
const DOC_LIST = [
  { file: "README.md", prefix: "idx", title: "TruthLayer Docs — Start Here" },
  { file: "INVESTOR_BRIEF.md", prefix: "inv", title: "Investor Brief" },
  { file: "CUSTOMER_OVERVIEW.md", prefix: "cust", title: "Customer Overview" },
  { file: "COLLABORATOR_GUIDE.md", prefix: "collab", title: "Collaborator Guide" },
  { file: "WHITEPAPER.md", prefix: "wp", title: "Whitepaper" },
  { file: "WHITEPAPER_APPENDIX.md", prefix: "app", title: "Whitepaper Appendix" },
  { file: "core/ARCHITECTURE.md", prefix: "arch", title: "Architecture" },
  { file: "core/REVIEW_MODE.md", prefix: "review", title: "Review Mode (ACAL)" },
  { file: "core/UI_SPEC.md", prefix: "ui", title: "UI Specification" },
  { file: "core/AGENT_API.md", prefix: "agent", title: "Agent API" },
  { file: "core/USAGE.md", prefix: "usage", title: "Usage" },
  { file: "reference/DATA_MODEL_REFERENCE.md", prefix: "data", title: "Data Model Reference" },
  { file: "reference/SECURITY_GOVERNANCE.md", prefix: "sec", title: "Security & Governance" },
  { file: "reference/PRIVACY_AND_DATA_PROTECTION.md", prefix: "privacy", title: "Privacy and Data Protection" },
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
  { file: "OTEL_LOGGING.md", prefix: "otel", title: "OpenTelemetry (OTEL) Logging" },
  { file: "engineering/storage/STORAGE_ARCHITECTURE.md", prefix: "storage", title: "Storage Architecture" },
  { file: "engineering/storage/STORAGE_IMPLEMENTATION_PLAN.md", prefix: "impl", title: "Storage Implementation Plan" },
];

/** Match Mermaid code blocks: optional space after ``` and after 'mermaid', flexible closing. */
const MERMAID_BLOCK_RE = /```\s*mermaid\s*\r?\n([\s\S]*?)```\s*/g;

/** Map: source .md path (normalized) -> { docxName, title, prefix }. Used for index and for link rewriting. */
function buildMdToDocxMap() {
  const map = new Map();
  for (const { file, title, prefix } of DOC_LIST) {
    const slug = slugFromFile(file);
    const docxName = `${slug}.docx`;
    map.set(normalizeDocsPath(file), { docxName, title, prefix });
  }
  return map;
}

/** Slug for heading IDs: lowercase, spaces/slashes to hyphen, strip other non-alphanumeric. */
function slugifyHeading(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/\//g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "section";
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
    // Skip external URLs and anchors
    if (/^https?:\/\/|^mailto:|^#/.test(href)) return match;

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
    if (info) return `[${info.title}](${info.docxName}${anchor})`;

    // External reference (escapes docs/ folder) — rewrite to GitHub main branch URL
    const pathPart = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
    if (pathPart && /^\.\.[\\/]/.test(pathPart)) {
      const currentDir = path.dirname(currentFile); // relative to docs/
      const resolvedFromDocs = path.normalize(path.join(currentDir, pathPart));
      // resolvedFromDocs is relative to docs/, strip leading ".." to get repo-root-relative path
      const repoRelative = normalizeDocsPath(resolvedFromDocs).replace(/^(\.\.\/)+/, "");
      return `[${label}](${GITHUB_BLOB_BASE}/${repoRelative}${anchor})`;
    }

    return match;
  });
}

/**
 * Inject Pandoc heading IDs {#prefix-slug} into each heading so the combined doc has unique anchors.
 * Skips lines that already have {#...}.
 */
function injectHeadingIds(content, prefix) {
  const headingRe = /^(#{1,6})\s+(.+?)(?:\s*\{#[^}]+\})?\s*$/gm;
  return content.replace(headingRe, (match, hashes, title) => {
    if (match.includes("{#")) return match;
    const slug = slugifyHeading(title);
    return `${hashes} ${title} {#${prefix}-${slug}}`;
  });
}

/**
 * Rewrite links for single-DOCX: [label](path#anchor) -> [label](#prefix-anchor) so they point inside the combined doc.
 * Resolves path relative to currentFile so relative links work.
 */
function rewriteLinksForSingleDoc(content, currentFile, mdToDocx) {
  const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
  return content.replace(LINK_RE, (match, label, href) => {
    const resolved = resolveLinkToDocsPath(currentFile, href);
    if (resolved == null) return match;
    const info = mdToDocx.get(resolved);
    if (!info) return match;
    const hashIndex = href.indexOf("#");
    const anchorPart = hashIndex >= 0 ? href.slice(hashIndex + 1) : "";
    const anchorSlug = anchorPart ? slugifyHeading(anchorPart) : "";
    const targetId = anchorSlug ? `${info.prefix}-${anchorSlug}` : info.prefix;
    return `[${label}](#${targetId})`;
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  let skipPandoc = false;
  let skipMermaid = false;
  let scale = 2;
  let singleDocx = false;
  let watermarkText = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--skip-pandoc") skipPandoc = true;
    if (args[i] === "--skip-mermaid") skipMermaid = true;
    if (args[i] === "--single-docx") singleDocx = true;
    if (args[i] === "--scale" && args[i + 1] != null) {
      scale = Math.max(1, parseInt(args[i + 1], 10) || 2);
      i++;
    }
    if (args[i] === "--watermark" && args[i + 1] != null) {
      watermarkText = args[i + 1];
      i++;
    }
  }
  return { skipPandoc, skipMermaid, scale, singleDocx, watermarkText };
}

/* ── Watermark injection ────────────────────────────────────────────── */

function escapeXml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Build OOXML for a header part containing a diagonal VML text watermark.
 * Uses the standard WordArt (shapetype 136) approach that Word, LibreOffice, and Google Docs all render.
 */
function buildWatermarkHeaderXml(text) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
       xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
       xmlns:o="urn:schemas-microsoft-com:office:office"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:v="urn:schemas-microsoft-com:vml"
       xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:w10="urn:schemas-microsoft-com:office:word"
       xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">
  <w:p>
    <w:pPr><w:pStyle w:val="Header"/></w:pPr>
    <w:r>
      <w:rPr><w:noProof/></w:rPr>
      <w:pict>
        <v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800"
                     path="m@7,l@8,m@5,21600l@6,21600e">
          <v:formulas>
            <v:f eqn="sum #0 0 10800"/>
            <v:f eqn="prod #0 2 1"/>
            <v:f eqn="sum 21600 0 @1"/>
            <v:f eqn="sum 0 0 @2"/>
            <v:f eqn="sum 21600 0 @3"/>
            <v:f eqn="if @0 @3 0"/>
            <v:f eqn="if @0 21600 @1"/>
            <v:f eqn="if @0 0 @2"/>
            <v:f eqn="if @0 @4 21600"/>
            <v:f eqn="mid @5 @6"/>
            <v:f eqn="mid @8 @5"/>
            <v:f eqn="mid @7 @8"/>
            <v:f eqn="mid @6 @7"/>
            <v:f eqn="sum @6 0 @5"/>
          </v:formulas>
          <v:path textpathok="t" o:connecttype="custom"
                  o:connectlocs="@9,0;@10,10800;@11,21600;@12,10800"
                  o:connectangles="270,180,90,0"/>
          <v:textpath on="t" fitshape="t"/>
          <v:handles>
            <v:h position="#0,bottomRight" xrange="6629,14971"/>
          </v:handles>
          <o:lock v:ext="edit" text="t" shapetype="t"/>
        </v:shapetype>
        <v:shape id="PowerPlusWaterMarkObject" o:spid="_x0000_s2049"
                 type="#_x0000_t136"
                 style="position:absolute;margin-left:0;margin-top:0;width:527.85pt;height:131.95pt;rotation:315;z-index:-251658752;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin"
                 o:allowincell="f" fillcolor="silver" stroked="f">
          <v:fill opacity=".5"/>
          <v:textpath style="font-family:&quot;Calibri&quot;;font-size:1pt" string="${escapeXml(text)}"/>
        </v:shape>
      </w:pict>
    </w:r>
  </w:p>
</w:hdr>`;
}

/**
 * Inject a diagonal text watermark into an existing DOCX file (in-place).
 * Creates a new header part with the VML watermark shape, wires it into
 * [Content_Types].xml, word/_rels/document.xml.rels, and every <w:sectPr>
 * in word/document.xml.
 */
async function addWatermarkToDocx(docxPath, text) {
  const AdmZip = (await import("adm-zip")).default;
  const zip = new AdmZip(docxPath);

  // Pick a header filename that doesn't collide with existing ones
  let headerNum = 1;
  while (zip.getEntry(`word/header${headerNum}.xml`)) headerNum++;
  const headerFile = `header${headerNum}.xml`;
  const headerPartPath = `word/${headerFile}`;

  // 1. Add watermark header part
  zip.addFile(headerPartPath, Buffer.from(buildWatermarkHeaderXml(text), "utf8"));

  // 2. Update [Content_Types].xml
  const ctEntry = zip.getEntry("[Content_Types].xml");
  let ct = ctEntry.getData().toString("utf8");
  if (!ct.includes(headerPartPath)) {
    ct = ct.replace(
      "</Types>",
      `<Override PartName="/${headerPartPath}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>\n</Types>`
    );
    zip.updateFile("[Content_Types].xml", Buffer.from(ct, "utf8"));
  }

  // 3. Add relationship in word/_rels/document.xml.rels
  const relsPath = "word/_rels/document.xml.rels";
  const relsEntry = zip.getEntry(relsPath);
  let rels = relsEntry.getData().toString("utf8");
  const rId = `rIdWatermark`;
  if (!rels.includes(rId)) {
    rels = rels.replace(
      "</Relationships>",
      `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="${headerFile}"/>\n</Relationships>`
    );
    zip.updateFile(relsPath, Buffer.from(rels, "utf8"));
  }

  // 4. Wire the header into every <w:sectPr> in document.xml
  const docEntry = zip.getEntry("word/document.xml");
  let doc = docEntry.getData().toString("utf8");

  // Remove any existing default headerReference so ours takes precedence
  doc = doc.replace(/<w:headerReference\s+w:type="default"[^/]*\/>/g, "");

  // Insert our headerReference right after each <w:sectPr ...>
  doc = doc.replace(
    /(<w:sectPr[^>]*>)/g,
    `$1<w:headerReference w:type="default" r:id="${rId}"/>`
  );
  zip.updateFile("word/document.xml", Buffer.from(doc, "utf8"));

  // 5. Write the modified DOCX back
  zip.writeZip(docxPath);
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
    try {
      if (isWindows) {
        execSync(`"${mmdcBin}" -i "${mmdPath}" -o "${pngPath}" --scale ${scale}`, { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 });
      } else {
        await exec(mmdcBin, ["-i", mmdPath, "-o", pngPath, "--scale", String(scale)], repoRoot);
      }
      imageRefs.push(`\n![Diagram: ${baseName}](${path.basename(pngPath)})\n`);
    } catch (err) {
      console.warn(`${path.basename(mmdPath)}: Mermaid render failed (${err.message}); leaving code block in place.`);
      imageRefs.push(`\n<details><summary>Diagram (render failed)</summary>\n\n\`\`\`mermaid\n${matches[i][1].trimEnd()}\n\`\`\`\n\n</details>\n`);
    }
  }

  let idx = 0;
  const newContent = content.replace(MERMAID_BLOCK_RE, () => imageRefs[idx++]);
  return { content: newContent, imageCount: imageRefs.length };
}

function slugFromFile(file) {
  return path.basename(file, ".md").toLowerCase().replace(/_/g, "-");
}

const IMAGE_LINK_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|svg|webp)$/i;

/**
 * Copy static image refs from source-relative paths into outputDir and rewrite refs to basename
 * so Pandoc (with --resource-path) can find them. Skips absolute URLs and anchors.
 */
async function copyStaticImagesAndRewriteRefs(content, currentFile, prefix, outputDir) {
  const currentDir = path.join(docsDir, path.dirname(currentFile));
  const docsDirAbs = path.resolve(docsDir);
  const replacements = [];
  let nextIndex = 1;
  for (const m of [...content.matchAll(IMAGE_LINK_RE)]) {
    const alt = m[1];
    const srcTrim = m[2].trim();
    if (/^https?:\/\/|^#|^mailto:/.test(srcTrim)) continue;
    if (!IMAGE_EXT_RE.test(srcTrim)) continue;
    const resolved = path.resolve(currentDir, srcTrim);
    if (!resolved.startsWith(docsDirAbs) || !existsSync(resolved)) continue;
    const ext = path.extname(srcTrim).toLowerCase();
    const destName = `img-${prefix}-${String(nextIndex++).padStart(2, "0")}${ext}`;
    await copyFile(resolved, path.join(outputDir, destName));
    replacements.push({ from: m[0], to: `![${alt}](${destName})` });
  }
  const byFrom = new Map();
  for (const { from: k, to } of replacements) byFrom.set(k, to);
  let result = content;
  for (const [from, to] of byFrom) result = result.replaceAll(from, to);
  return result;
}

/** Absolute path to output dir so Pandoc can resolve image paths reliably (e.g. on Windows). */
function outputDirForPandoc(dir) {
  const abs = path.resolve(dir);
  return isWindows ? abs.replace(/\\/g, "/") : abs;
}

async function main() {
  const { skipPandoc, skipMermaid, scale, singleDocx, watermarkText } = parseArgs();
  const outputDir = defaultOutputDir;
  const resourcePath = outputDirForPandoc(outputDir);

  await mkdir(outputDir, { recursive: true });

  let pandocCmd = "pandoc";
  if (isWindows) {
    const localPandoc = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Pandoc", "pandoc.exe");
    const programFiles = path.join(process.env.ProgramFiles || "C:\\Program Files", "Pandoc", "pandoc.exe");
    if (localPandoc && existsSync(localPandoc)) pandocCmd = localPandoc;
    else if (programFiles && existsSync(programFiles)) pandocCmd = programFiles;
  }

  const mdToDocx = buildMdToDocxMap();
  const singleChunks = [];

  for (const { file, prefix, title } of DOC_LIST) {
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
    let processed = rewriteCrossDocLinks(afterMermaid, file, mdToDocx);
    processed = await copyStaticImagesAndRewriteRefs(processed, file, prefix, outputDir);

    const slug = slugFromFile(file);
    const mdName = `${slug}.md`;
    const docxName = `${slug}.docx`;
    const mdPath = path.join(outputDir, mdName);
    const docxPath = path.join(outputDir, docxName);

    await writeFile(mdPath, processed, "utf8");
    console.log(`Wrote ${mdPath}`);

    if (singleDocx) {
      const withIds = injectHeadingIds(afterMermaid, prefix);
      const singleContent = rewriteLinksForSingleDoc(withIds, file, mdToDocx);
      singleChunks.push("\n\n# " + title + " {#" + prefix + "}\n\n" + singleContent);
    }

    if (!skipPandoc) {
      try {
        await exec(
          pandocCmd,
          ["-f", "markdown", "-t", "docx", "--toc", "--resource-path", resourcePath, mdName, "-o", docxName],
          outputDir
        );
        if (watermarkText) {
          await addWatermarkToDocx(docxPath, watermarkText);
          console.log(`Wrote ${docxPath} (watermark: ${watermarkText})`);
        } else {
          console.log(`Wrote ${docxPath}`);
        }
      } catch (e) {
        console.error(`Pandoc failed for ${file}: ${e.message}`);
      }
    }
  }

  if (singleDocx && singleChunks.length > 0 && !skipPandoc) {
    const combinedMd = "# TruthLayer Documentation\n\nGoverned truth. Guarded AI.\n" + singleChunks.join("\n\n");
    const singleMdPath = path.join(outputDir, "truthlayer-docs.md");
    const singleDocxPath = path.join(outputDir, "truthlayer-docs.docx");
    await writeFile(singleMdPath, combinedMd, "utf8");
    console.log(`Wrote ${singleMdPath}`);
    try {
      await exec(
        pandocCmd,
        ["-f", "markdown", "-t", "docx", "--toc", "--toc-depth=3", "--resource-path", resourcePath, "truthlayer-docs.md", "-o", "truthlayer-docs.docx"],
        outputDir
      );
      if (watermarkText) {
        await addWatermarkToDocx(singleDocxPath, watermarkText);
        console.log(`Wrote ${singleDocxPath} (watermark: ${watermarkText})`);
      } else {
        console.log(`Wrote ${singleDocxPath}`);
      }
    } catch (e) {
      console.error(`Pandoc failed for single DOCX: ${e.message}`);
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
      await exec(
        pandocCmd,
        ["-f", "markdown", "-t", "docx", "--toc", "--resource-path", resourcePath, "docs-index.md", "-o", "docs-index.docx"],
        outputDir
      );
      if (watermarkText) {
        await addWatermarkToDocx(indexDocxPath, watermarkText);
        console.log(`Wrote ${indexDocxPath} (watermark: ${watermarkText})`);
      } else {
        console.log(`Wrote ${indexDocxPath}`);
      }
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
