/**
 * Bidirectional Markdown ↔ context synchronization.
 * 
 * The system:
 * - imports edits as proposals
 * - exports accepted truth back to Markdown deterministically
 * - rewrites only the sections it owns
 */

import {
  AnyNode,
  ContextNode,
  NodeId,
  NodeStatus,
} from "../types/node.js";
import { Proposal, CreateOperation, UpdateOperation } from "../types/proposal.js";
import { ContextStore, NodeQuery } from "../types/context-store.js";
import { extractCtxBlocks, generateCtxBlock, replaceCtxBlock, CtxBlock } from "./ctx-block.js";

export interface ProjectionOptions {
  /** Whether to include proposed nodes */
  includeProposed?: boolean;
  /** Whether to include rejected nodes */
  includeRejected?: boolean;
  /** Namespace filter */
  namespace?: string;
}

/**
 * Project accepted nodes to Markdown.
 * This is deterministic - same nodes always produce same Markdown.
 */
export async function projectToMarkdown(
  store: ContextStore,
  options: ProjectionOptions = {}
): Promise<string> {
  const status: NodeStatus[] = ["accepted"];
  if (options.includeProposed) status.push("proposed");
  if (options.includeRejected) status.push("rejected");

  const query: NodeQuery = { status };

  if (options.namespace) {
    query.namespace = options.namespace;
  }

  const result = await store.queryNodes(query);

  // Group nodes by type for organization
  const nodesByType = new Map<string, AnyNode[]>();
  for (const node of result.nodes) {
    const type = node.type;
    if (!nodesByType.has(type)) {
      nodesByType.set(type, []);
    }
    nodesByType.get(type)!.push(node);
  }

  // Generate Markdown sections
  const sections: string[] = [];

  // Add nodes grouped by type
  for (const [type, typeNodes] of nodesByType.entries()) {
    sections.push(`## ${type.charAt(0).toUpperCase() + type.slice(1)}s\n`);
    for (const node of typeNodes) {
      const block = generateCtxBlock(
        node.type,
        node.id.id,
        node.status,
        node.content,
        node.id.namespace
      );
      sections.push(block);
      sections.push(""); // Empty line between blocks
    }
  }

  return sections.join("\n");
}

/**
 * Import Markdown edits as proposals.
 * Detects changes to ctx blocks and creates proposals.
 */
export async function importFromMarkdown(
  store: ContextStore,
  markdown: string,
  author: string,
  sourceFile?: string
): Promise<Proposal[]> {
  const proposals: Proposal[] = [];
  const blocks = extractCtxBlocks(markdown);

  for (const block of blocks) {
    const nodeId: NodeId = {
      id: block.id,
      namespace: block.namespace,
    };

    // Check if node exists
    const existingNode = await store.getNode(nodeId);

    if (!existingNode) {
      // New node - create proposal
      const proposal = createProposalForNewNode(block, author, sourceFile);
      proposals.push(proposal);
    } else {
      // Existing node - check for changes
      const changes = detectChanges(existingNode, block);
      if (changes.length > 0) {
        const proposal = createProposalForUpdate(
          existingNode,
          block,
          changes,
          author,
          sourceFile
        );
        proposals.push(proposal);
      }
    }
  }

  return proposals;
}

/**
 * Create a proposal for a new node.
 */
function createProposalForNewNode(
  block: CtxBlock,
  author: string,
  sourceFile?: string
): Proposal {
  const now = new Date().toISOString();
  // Note: block.id is the stable node id; we don't need a separate nodeId here.

  const type = block.type;
  const status = block.status;

  // This is a simplified version - in reality, we'd parse the content
  // based on the node type to create the proper node structure
  const node: ContextNode = {
    id: {
      id: block.id,
      namespace: block.namespace,
    },
    type,
    status,
    content: block.content,
    ...(sourceFile ? { sourceFiles: [sourceFile] } : {}),
    metadata: {
      createdAt: now,
      createdBy: author,
      modifiedAt: now,
      modifiedBy: author,
      version: 1,
    },
  };

  const operation: CreateOperation = {
    id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: "create",
    order: 0,
    node,
  };

  return {
    id: `proposal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    status: "open",
    operations: [operation],
    metadata: {
      createdAt: now,
      createdBy: author,
      modifiedAt: now,
      modifiedBy: author,
      ...(sourceFile ? { rationale: `Imported from ${sourceFile}` } : {}),
    },
  };
}

/**
 * Detect changes between existing node and block.
 */
function detectChanges(existingNode: AnyNode, block: CtxBlock): string[] {
  const changes: string[] = [];

  if (existingNode.content !== block.content) {
    changes.push("content");
  }

  if (existingNode.status !== block.status) {
    changes.push("status");
  }

  return changes;
}

/**
 * Create a proposal for updating an existing node.
 */
function createProposalForUpdate(
  existingNode: AnyNode,
  block: CtxBlock,
  changes: string[],
  author: string,
  sourceFile?: string
): Proposal {
  const now = new Date().toISOString();

  const status = block.status;

  const operation: UpdateOperation = {
    id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: "update",
    order: 0,
    nodeId: existingNode.id,
    changes: {
      ...(changes.includes("content") && { content: block.content }),
      ...(changes.includes("status") && { status }),
    },
  };

  return {
    id: `proposal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    status: "open",
    operations: [operation],
    metadata: {
      createdAt: now,
      createdBy: author,
      modifiedAt: now,
      modifiedBy: author,
      ...(sourceFile ? { rationale: `Updated from ${sourceFile}` } : {}),
    },
  };
}

/**
 * Merge Markdown with context store.
 * Updates only ctx blocks, preserves other content.
 */
export async function mergeMarkdownWithContext(
  markdown: string,
  store: ContextStore,
  options: ProjectionOptions = {}
): Promise<string> {
  const blocks = extractCtxBlocks(markdown);
  let result = markdown;

  const allowed: NodeStatus[] = ["accepted"];
  if (options.includeProposed) allowed.push("proposed");
  if (options.includeRejected) allowed.push("rejected");

  // Process blocks in reverse order to maintain positions
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    const nodeId: NodeId = {
      id: block.id,
      namespace: block.namespace,
    };

    const node = await store.getNode(nodeId);
    if (
      node &&
      allowed.includes(node.status) &&
      (!options.namespace || node.id.namespace === options.namespace)
    ) {
      // Replace with accepted truth
      const newBlock = generateCtxBlock(
        node.type,
        node.id.id,
        node.status,
        node.content,
        node.id.namespace
      );
      result = replaceCtxBlock(result, block, newBlock);
    }
  }

  return result;
}
