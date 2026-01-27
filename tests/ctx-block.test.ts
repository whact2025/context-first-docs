/**
 * Tests for ctx block parsing and generation.
 */

import { describe, it, expect } from "@jest/globals";
import {
  extractCtxBlocks,
  generateCtxBlock,
  parseCtxBlock,
} from "../src/markdown/ctx-block.js";

describe("ctx-block", () => {
  const sampleMarkdown = `# Decisions

\`\`\`ctx
type: decision
id: decision-001
status: accepted
title: Use TypeScript
---
**Decision**: Use TypeScript.

**Rationale**: Type safety is important.
\`\`\`

Some other content here.

\`\`\`ctx
type: goal
id: goal-001
namespace: architecture
status: proposed
---
Build a scalable system.
\`\`\`
`;

  it("should extract ctx blocks from Markdown", () => {
    const blocks = extractCtxBlocks(sampleMarkdown);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("decision");
    expect(blocks[0].id).toBe("decision-001");
    expect(blocks[0].status).toBe("accepted");
    expect(blocks[0].title).toBe("Use TypeScript");
    expect(blocks[1].type).toBe("goal");
    expect(blocks[1].namespace).toBe("architecture");
  });

  it("should generate ctx blocks", () => {
    const block = generateCtxBlock(
      "decision",
      "decision-002",
      "accepted",
      "Use Rust for performance."
    );
    expect(block).toContain("~~~ctx");
    expect(block).toContain("type: decision");
    expect(block).toContain("id: decision-002");
    expect(block).toContain("status: accepted");
    expect(block).toContain("Use Rust for performance.");
  });

  it("should generate ctx blocks with namespace", () => {
    const block = generateCtxBlock(
      "goal",
      "goal-001",
      "accepted",
      "Build scalable system.",
      "architecture"
    );
    expect(block).toContain("namespace: architecture");
  });

  it("should allow markdown (including code fences) inside the content/description", () => {
    const markdownInside = `This description is Markdown.

\`\`\`ts
export function hello() {
  return "world";
}
\`\`\`
`;

    const block = generateCtxBlock(
      "note",
      "note-001",
      "accepted",
      markdownInside,
      undefined,
      "Note with code"
    );

    // Generated ctx blocks use ~~~ fences specifically so the body can contain ``` fences.
    expect(block).toContain("~~~ctx");
    expect(block).toContain("title: Note with code");
    expect(block).toContain("```ts");

    const extracted = extractCtxBlocks(block);
    expect(extracted).toHaveLength(1);
    expect(extracted[0].title).toBe("Note with code");
    expect(extracted[0].content).toContain("```ts");
  });
});
