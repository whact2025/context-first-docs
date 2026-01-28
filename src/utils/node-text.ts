import type { AnyNode } from "../types/node.js";

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Very small Markdown → plain text normalizer.
 * Intended for search/similarity/snippets, not perfect rendering.
 */
export function markdownToPlainText(markdown: string): string {
  let s = markdown.replace(/\r\n/g, "\n");

  // Remove fenced code delimiters but keep code content.
  s = s.replace(/^\s*(`{3,}|~{3,}).*$/gm, "");

  // Links: [text](url) → text
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Inline code: `code` → code
  s = s.replace(/`([^`]+)`/g, "$1");

  // Headings / blockquotes / list markers
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  s = s.replace(/^\s{0,3}>\s?/gm, "");
  s = s.replace(/^\s*([-*+]|\d+\.)\s+/gm, "");

  // Emphasis markers
  s = s.replace(/[*_~]+/g, "");

  return normalizeWhitespace(s);
}

/**
 * Derive a normalized `content` string used for search/similarity/snippets.
 *
 * Rule:
 * - `description` is the canonical long-form Markdown body.
 * - `content` is derived plain text from `description` + key typed fields for this node type.
 */
export function deriveContent(node: AnyNode): string {
  const parts: string[] = [];

  if (typeof node.title === "string" && node.title.trim()) parts.push(node.title.trim());

  const body = typeof node.description === "string" ? node.description : node.content;
  if (typeof body === "string" && body.trim()) parts.push(markdownToPlainText(body));

  // Include key typed fields to improve searchability.
  if (node.type === "decision") {
    const n = node as any;
    if (typeof n.decision === "string" && n.decision.trim()) parts.push(n.decision.trim());
    if (typeof n.rationale === "string" && n.rationale.trim()) parts.push(n.rationale.trim());
    if (Array.isArray(n.alternatives) && n.alternatives.every((x: unknown) => typeof x === "string")) {
      const alt = n.alternatives.join(" ").trim();
      if (alt) parts.push(alt);
    }
  }

  if (node.type === "constraint") {
    const n = node as any;
    if (typeof n.constraint === "string" && n.constraint.trim()) parts.push(n.constraint.trim());
    if (typeof n.reason === "string" && n.reason.trim()) parts.push(n.reason.trim());
  }

  if (node.type === "question") {
    const n = node as any;
    if (typeof n.question === "string" && n.question.trim()) parts.push(n.question.trim());
    if (typeof n.answer === "string" && n.answer.trim()) parts.push(n.answer.trim());
  }

  if (node.type === "risk") {
    const n = node as any;
    if (typeof n.mitigation === "string" && n.mitigation.trim()) parts.push(n.mitigation.trim());
    if (typeof n.severity === "string") parts.push(String(n.severity));
    if (typeof n.likelihood === "string") parts.push(String(n.likelihood));
  }

  if (node.type === "task") {
    const n = node as any;
    if (typeof n.state === "string") parts.push(String(n.state));
    if (typeof n.assignee === "string" && n.assignee.trim()) parts.push(n.assignee.trim());
  }

  if (node.type === "plan") {
    const n = node as any;
    if (Array.isArray(n.steps)) {
      const stepText = n.steps
        .map((s: any) => (typeof s?.description === "string" ? s.description : ""))
        .filter(Boolean)
        .join(" ");
      if (stepText.trim()) parts.push(stepText.trim());
    }
  }

  return normalizeWhitespace(parts.join("\n"));
}

/**
 * Ensure `description` and derived `content` are consistent.
 *
 * - If `description` is missing, we treat existing `content` as the body for compatibility.
 * - `content` is always re-derived (so it can’t silently drift).
 */
export function normalizeNodeTextFields<T extends AnyNode>(node: T): T {
  const title = typeof node.title === "string" ? node.title.trim() : node.title;
  const description =
    typeof node.description === "string"
      ? node.description
      : typeof node.content === "string"
        ? node.content
        : "";

  const next = { ...node, ...(title !== undefined ? { title } : {}), description } as T;
  const content = deriveContent(next);
  return { ...next, content } as T;
}

