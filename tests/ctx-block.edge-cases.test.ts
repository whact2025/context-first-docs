/**
 * Additional coverage tests for ctx-block helpers.
 */

import { describe, it, expect } from "@jest/globals";
import {
  extractCtxBlocks,
  parseCtxBlock,
  replaceCtxBlock,
} from "../src/markdown/ctx-block.js";

describe("ctx-block (edge cases)", () => {
  it("parseCtxBlock should return null when separator is missing", () => {
    const markdown = `\`\`\`ctx
type: decision
id: decision-001
status: accepted
no-separator-here
Some content
\`\`\``;

    const match = Array.from(markdown.matchAll(/(`{3,}|~{3,})ctx\r?\n([\s\S]*?)\1/g))[0];
    expect(match).toBeDefined();
    expect(parseCtxBlock(match, markdown)).toBeNull();
  });

  it("parseCtxBlock should return null when required fields are missing", () => {
    const markdown = `\`\`\`ctx
type: decision
id: decision-001
---
Some content
\`\`\``;

    const match = Array.from(markdown.matchAll(/(`{3,}|~{3,})ctx\r?\n([\s\S]*?)\1/g))[0];
    expect(match).toBeDefined();
    expect(parseCtxBlock(match, markdown)).toBeNull();
  });

  it("parseCtxBlock should return null for invalid type/status values", () => {
    const badType = `\`\`\`ctx
type: not-a-real-type
id: x
status: accepted
---
content
\`\`\``;
    const matchType = Array.from(badType.matchAll(/(`{3,}|~{3,})ctx\r?\n([\s\S]*?)\1/g))[0];
    expect(matchType).toBeDefined();
    expect(parseCtxBlock(matchType, badType)).toBeNull();

    const badStatus = `\`\`\`ctx
type: decision
id: x
status: pending
---
content
\`\`\``;
    const matchStatus = Array.from(badStatus.matchAll(/(`{3,}|~{3,})ctx\r?\n([\s\S]*?)\1/g))[0];
    expect(matchStatus).toBeDefined();
    expect(parseCtxBlock(matchStatus, badStatus)).toBeNull();
  });

  it("replaceCtxBlock should splice the markdown by positions", () => {
    const markdown = `Before

\`\`\`ctx
type: goal
id: goal-001
status: accepted
---
Old content
\`\`\`

After`;

    const blocks = extractCtxBlocks(markdown);
    expect(blocks).toHaveLength(1);

    const replacement = "REPLACED_BLOCK";
    const updated = replaceCtxBlock(markdown, blocks[0], replacement);

    expect(updated).toContain("Before");
    expect(updated).toContain("After");
    expect(updated).toContain(replacement);
    expect(updated).not.toContain("Old content");
  });
});

