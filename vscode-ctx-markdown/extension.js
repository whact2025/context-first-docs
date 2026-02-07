/**
 * Ctx Block Markdown Preview - VS Code / Cursor extension
 * Renders ```ctx code blocks with metadata + body (after ---) as Markdown.
 */

// Match first "---" on its own line (content starts with "type: ...", not with newline)
const CTX_SEP = /\r?\n---\r?\n/;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseMetadata(header) {
  const out = {};
  for (const line of header.split(/\r?\n/)) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

function renderCtxBlock(token, md) {
  const raw = token.content || "";
  const sepMatch = raw.match(CTX_SEP);
  const metadataRaw = sepMatch ? raw.substring(0, sepMatch.index).trim() : raw.trim();
  const bodyRaw = sepMatch ? raw.substring(sepMatch.index + sepMatch[0].length).trim() : "";

  const meta = parseMetadata(metadataRaw);
  const metaHtml =
    Object.keys(meta).length > 0
      ? `<div class="ctx-meta">${Object.entries(meta)
        .map(([k, v]) => `<span class="ctx-meta-${k}">${escapeHtml(k)}: ${escapeHtml(v)}</span>`)
        .join(" ")}</div>`
      : "";

  // Same md instance: nested ```ctx and other fenced code (e.g. ```js) render recursively
  const bodyHtml = bodyRaw
    ? `<div class="ctx-body">${md.render(bodyRaw)}</div>`
    : "";

  return `<div class="ctx-block">${metaHtml}${bodyHtml}</div>\n`;
}

function ctxRenderPlugin(md) {
  const renderer = md.renderer;
  if (!renderer || !renderer.rules) return md;
  const defaultFence = renderer.rules.fence;
  renderer.rules.fence = function (tokens, idx, options, env, self) {
    const token = tokens[idx];
    const info = (token.info || "").trim().toLowerCase();
    if (info === "ctx") {
      return renderCtxBlock(token, md);
    }
    if (defaultFence) {
      return defaultFence.call(this, tokens, idx, options, env, self);
    }
    return (
      "<pre><code" +
      (token.info ? ` class="language-${escapeHtml(token.info)}"` : "") +
      ">" +
      escapeHtml(token.content || "") +
      "</code></pre>\n"
    );
  };
  return md;
}

/**
 * @param {import('vscode').ExtensionContext} context
 */
function activate(context) {
  return {
    extendMarkdownIt(md) {
      return md.use(ctxRenderPlugin);
    },
  };
}

module.exports = { activate };
