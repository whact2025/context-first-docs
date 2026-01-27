import type { ContextStore } from "../types/context-store.js";
import { importFromMarkdown, projectToMarkdown } from "../markdown/projection.js";
import type { Proposal } from "../types/proposal.js";
import { generateReadmeFromAcceptedContext } from "./readme.js";

export type GuidedFieldType = "text" | "textarea";

export interface GuidedField {
  id: string;
  label: string;
  type: GuidedFieldType;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}

export type GuidedStep =
  | {
      kind: "form";
      id: string;
      title: string;
      fields: GuidedField[];
    }
  | {
      kind: "auto";
      id: string;
      title: string;
      run: (ctx: { store: ContextStore; inputs: Record<string, string> }) => Promise<unknown>;
    };

export interface GuidedScenario {
  id: string;
  title: string;
  description: string;
  steps: GuidedStep[];
}

export interface GuidedScenarioSummary {
  id: string;
  title: string;
  description: string;
}

export function listGuidedScenarios(): GuidedScenarioSummary[] {
  return GUIDED_SCENARIOS.map(({ steps: _steps, ...meta }) => meta);
}

export function getGuidedScenario(id: string): GuidedScenario | undefined {
  return GUIDED_SCENARIOS.find((s) => s.id === id);
}

const SAMPLE_MARKDOWN = `## Demo ctx block

~~~ctx
type: goal
id: goal-demo
status: accepted
title: Guided demo goal
---
This goal is authored in Markdown, and the **description supports Markdown**, including code blocks.

\`\`\`ts
export function demo() {
  return "hello";
}
\`\`\`
~~~
`;

const GUIDED_SCENARIOS: GuidedScenario[] = [
  {
    id: "guided-markdown-authoring",
    title: "Guided: Markdown authoring → proposals → apply → projection → README",
    description:
      "Paste/edit ctx blocks. The runner imports them as proposals, applies them, shows projected Markdown, then generates a README from accepted nodes.",
    steps: [
      {
        kind: "form",
        id: "markdown",
        title: "Provide Markdown (with one or more ctx blocks)",
        fields: [
          {
            id: "markdown",
            label: "Markdown",
            type: "textarea",
            required: true,
            defaultValue: SAMPLE_MARKDOWN,
          },
          {
            id: "author",
            label: "Author",
            type: "text",
            required: true,
            defaultValue: "demo-user",
          },
          {
            id: "sourceFile",
            label: "Source file label",
            type: "text",
            required: false,
            defaultValue: "GUIDED.md",
          },
        ],
      },
      {
        kind: "auto",
        id: "import",
        title: "Import Markdown → proposals (auto-accept + apply)",
        run: async ({ store, inputs }) => {
          const markdown = inputs.markdown || "";
          const author = inputs.author || "demo-user";
          const sourceFile = inputs.sourceFile || undefined;

          const proposals = await importFromMarkdown(store, markdown, author, sourceFile);
          const applied: string[] = [];

          for (const p of proposals) {
            await store.createProposal(p);
            await store.updateProposal(p.id, { status: "accepted" });
            await store.applyProposal(p.id);
            applied.push(p.id);
          }

          return {
            proposals: proposals.map((p: Proposal) => ({
              id: p.id,
              status: p.status,
              operations: p.operations.map((op) => ({ type: op.type, order: op.order })),
            })),
            appliedProposalIds: applied,
          };
        },
      },
      {
        kind: "auto",
        id: "project",
        title: "Project accepted truth → Markdown",
        run: async ({ store }) => {
          const markdownAfter = await projectToMarkdown(store);
          return { markdownAfter };
        },
      },
      {
        kind: "auto",
        id: "readme",
        title: "Generate README from accepted context",
        run: async ({ store }) => {
          const readmeMarkdown = await generateReadmeFromAcceptedContext(store);
          return { readmeMarkdown };
        },
      },
    ],
  },
];

