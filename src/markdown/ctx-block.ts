/**
 * Context block syntax for embedding semantic nodes in Markdown.
 * 
 * Syntax:
 * ```ctx
 * type: decision
 * id: decision-001
 * status: accepted
 * ---
 * Content here
 * ```
 */

import { isOneOf } from "../utils/type-guards.js";
import { NodeStatus, NodeType } from "../types/node.js";

export interface CtxBlock {
  /** The node type */
  type: NodeType;
  /** The node ID */
  id: string;
  /** Optional namespace */
  namespace?: string;
  /** Current status */
  status: NodeStatus;
  /** Optional title (short label) */
  title?: string;
  /** The content (everything after the separator) */
  content: string;
  /** Start position in source file */
  startPos: number;
  /** End position in source file */
  endPos: number;
  /** Line number where block starts */
  startLine: number;
  /** Line number where block ends */
  endLine: number;
}

// Support fenced ctx blocks using backticks or tildes, 3+ characters.
// We prefer generating with tildes so the content can safely include ``` fenced code blocks.
const CTX_BLOCK_REGEX = /(`{3,}|~{3,})ctx\r?\n([\s\S]*?)\1/g;
const CTX_HEADER_REGEX = /^type:\s*(.+)$/m;
const CTX_ID_REGEX = /^id:\s*(.+)$/m;
const CTX_NAMESPACE_REGEX = /^namespace:\s*(.+)$/m;
const CTX_STATUS_REGEX = /^status:\s*(.+)$/m;
const CTX_TITLE_REGEX = /^title:\s*(.+)$/m;
const CTX_SEPARATOR = /^---$/m;

const NODE_TYPES = [
  "goal",
  "decision",
  "constraint",
  "task",
  "risk",
  "question",
  "context",
  "plan",
  "note",
 ] as const;

const NODE_STATUSES = [
  "accepted",
  "proposed",
  "rejected",
  "superseded",
 ] as const;

const isNodeType = isOneOf(NODE_TYPES);
const isNodeStatus = isOneOf(NODE_STATUSES);

/**
 * Parse a ctx block from Markdown text.
 */
export function parseCtxBlock(match: RegExpMatchArray, sourceText: string): CtxBlock | null {
  const fullMatch = match[0];
  const blockContent = match[2];
  const matchIndex = match.index!;

  // Find the separator
  const separatorMatch = blockContent.match(CTX_SEPARATOR);
  if (!separatorMatch) {
    return null; // Invalid block format
  }

  const separatorIndex = separatorMatch.index!;
  const headerSection = blockContent.substring(0, separatorIndex).trim();
  const contentSection = blockContent.substring(separatorIndex + separatorMatch[0].length).trim();

  // Parse headers
  const typeMatch = headerSection.match(CTX_HEADER_REGEX);
  const idMatch = headerSection.match(CTX_ID_REGEX);
  const namespaceMatch = headerSection.match(CTX_NAMESPACE_REGEX);
  const statusMatch = headerSection.match(CTX_STATUS_REGEX);
  const titleMatch = headerSection.match(CTX_TITLE_REGEX);

  if (!typeMatch || !idMatch || !statusMatch) {
    return null; // Required fields missing
  }

  const typeRaw = typeMatch[1].trim();
  const statusRaw = statusMatch[1].trim();
  if (!isNodeType(typeRaw) || !isNodeStatus(statusRaw)) {
    return null; // Invalid values
  }

  // Calculate positions
  const startPos = matchIndex;
  const endPos = matchIndex + fullMatch.length;
  const startLine = sourceText.substring(0, matchIndex).split("\n").length;
  const endLine = sourceText.substring(0, endPos).split("\n").length;

  return {
    type: typeRaw,
    id: idMatch[1].trim(),
    namespace: namespaceMatch ? namespaceMatch[1].trim() : undefined,
    status: statusRaw,
    title: titleMatch ? titleMatch[1].trim() : undefined,
    content: contentSection,
    startPos,
    endPos,
    startLine,
    endLine,
  };
}

/**
 * Extract all ctx blocks from Markdown text.
 */
export function extractCtxBlocks(markdown: string): CtxBlock[] {
  const blocks: CtxBlock[] = [];
  const matches = Array.from(markdown.matchAll(CTX_BLOCK_REGEX));

  for (const match of matches) {
    const block = parseCtxBlock(match, markdown);
    if (block) {
      blocks.push(block);
    }
  }

  return blocks;
}

/**
 * Generate a ctx block from node data.
 */
export function generateCtxBlock(
  type: NodeType,
  id: string,
  status: NodeStatus,
  content: string,
  namespace?: string,
  title?: string
): string {
  const chooseFence = (body: string): string => {
    // Prefer tildes to allow ``` code fences inside content.
    let n = 3;
    while (body.includes("~".repeat(n))) n++;
    return "~".repeat(n);
  };

  const fence = chooseFence(content);
  const header = [
    `type: ${type}`,
    `id: ${id}`,
    namespace ? `namespace: ${namespace}` : null,
    `status: ${status}`,
    title ? `title: ${title}` : null,
    "---",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return `${fence}ctx\n${header}\n${content}\n${fence}`;
}

/**
 * Replace a ctx block in Markdown text.
 */
export function replaceCtxBlock(
  markdown: string,
  oldBlock: CtxBlock,
  newContent: string
): string {
  const before = markdown.substring(0, oldBlock.startPos);
  const after = markdown.substring(oldBlock.endPos);
  return before + newContent + after;
}
