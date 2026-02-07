/**
 * Markdown-it plugin: render ```ctx code blocks with metadata + body as Markdown.
 *
 * When the fence language is `ctx`, the block is split on `---`:
 * - Lines before `---`: metadata (type, id, status, etc.) shown as a small caption.
 * - Lines after `---`: rendered as Markdown (bold, lists, etc.) instead of raw code.
 *
 * If there is no `---`, the whole block is treated as metadata only.
 *
 * Use: md.use(ctxRenderPlugin)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Match first "---" on its own line (content starts with "type: ...", not with newline)
const CTX_SEP = /\r?\n---\r?\n/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseMetadata(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of header.split(/\r?\n/)) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

interface TokenLike {
  info?: string;
  content?: string;
}

function renderCtxBlock(token: TokenLike, md: { render: (src: string) => string }): string {
  const raw = token.content || "";
  const sepMatch = raw.match(CTX_SEP);
  const metadataRaw = sepMatch ? raw.substring(0, sepMatch.index!).trim() : raw.trim();
  const bodyRaw = sepMatch ? raw.substring(sepMatch.index! + sepMatch[0].length).trim() : "";

  const meta = parseMetadata(metadataRaw);
  const metaHtml =
    Object.keys(meta).length > 0
      ? `<div class="ctx-meta">${Object.entries(meta)
        .map(([k, v]) => `<span class="ctx-meta-${k}">${escapeHtml(k)}: ${escapeHtml(v)}</span>`)
        .join(" ")}</div>`
      : "";

  // md.render() uses the same markdown-it instance, so nested ```ctx and other fenced code blocks render recursively
  const bodyHtml = bodyRaw
    ? `<div class="ctx-body">${md.render(bodyRaw)}</div>`
    : "";

  return `<div class="ctx-block">${metaHtml}${bodyHtml}</div>\n`;
}

type FenceRule = (
  tokens: TokenLike[],
  idx: number,
  options: any,
  env: any,
  self: { renderToken: (...args: any[]) => string }
) => string;

/**
 * Install the ctx fence renderer on the given markdown-it instance.
 * When a fence has language `ctx`, metadata is shown and optional body (after ---) is rendered as Markdown.
 */
export function ctxRenderPlugin(md: any): void {
  const renderer = md.renderer;
  if (!renderer?.rules) return;
  const defaultFence: FenceRule | undefined = renderer.rules.fence;
  renderer.rules.fence = function (
    tokens: TokenLike[],
    idx: number,
    options: any,
    env: any,
    self: { renderToken: (...args: any[]) => string }
  ): string {
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
}
