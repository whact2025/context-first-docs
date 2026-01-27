import type { ContextStore } from "../types/context-store.js";
import type {
  AnyNode,
  ConstraintNode,
  DecisionNode,
  GoalNode,
  PlanNode,
  QuestionNode,
  RiskNode,
  TaskNode,
} from "../types/node.js";
import { projectToMarkdown } from "../markdown/projection.js";

function sortById<T extends AnyNode>(nodes: T[]): T[] {
  return [...nodes].sort((a, b) => {
    const ak = `${a.id.namespace || ""}:${a.id.id}`;
    const bk = `${b.id.namespace || ""}:${b.id.id}`;
    return ak.localeCompare(bk);
  });
}

export async function generateReadmeFromAcceptedContext(
  store: ContextStore
): Promise<string> {
  const accepted = await store.queryNodes({
    status: ["accepted"],
    limit: 1000,
    offset: 0,
  });
  const nodes = accepted.nodes;

  const goals = sortById(nodes.filter((n) => n.type === "goal") as GoalNode[]);
  const decisions = sortById(nodes.filter((n) => n.type === "decision") as DecisionNode[]);
  const plans = sortById(nodes.filter((n) => n.type === "plan") as PlanNode[]);
  const tasks = sortById(nodes.filter((n) => n.type === "task") as TaskNode[]);
  const risks = sortById(nodes.filter((n) => n.type === "risk") as RiskNode[]);
  const constraints = sortById(nodes.filter((n) => n.type === "constraint") as ConstraintNode[]);
  const questions = sortById(nodes.filter((n) => n.type === "question") as QuestionNode[]);

  const lines: string[] = [];
  lines.push("# README (generated from accepted context)");
  lines.push("");
  lines.push(
    "This document is generated from the **accepted** nodes in the context store. It’s meant as a demo-friendly, human-readable summary."
  );
  lines.push("");

  if (goals.length > 0) {
    lines.push("## Goals");
    for (const g of goals) {
      const title = g.title ?? g.content;
      const body = g.description ?? g.content;
      lines.push(`### ${title}`);
      lines.push("");
      lines.push(body);
      lines.push("");
    }
    lines.push("");
  }

  if (decisions.length > 0) {
    lines.push("## Key decisions");
    for (const d of decisions) {
      const title = d.title ?? d.decision;
      const body = d.description ?? d.rationale ?? d.content;
      lines.push(`### ${title}`);
      lines.push("");
      lines.push(body);
      lines.push("");
    }
    lines.push("");
  }

  if (plans.length > 0) {
    lines.push("## Plans");
    for (const p of plans) {
      const title = p.title ?? p.content;
      const body = p.description ?? p.content;
      lines.push(`### ${title}`);
      lines.push("");
      lines.push(body);
      lines.push("");
      if (p.steps && p.steps.length > 0) {
        lines.push("#### Steps");
        lines.push("");
        for (const step of p.steps) lines.push(`${step.order}. ${step.description}`);
        lines.push("");
      }
    }
    lines.push("");
  }

  if (tasks.length > 0) {
    lines.push("## Tasks");
    for (const t of tasks) {
      const title = t.title ?? t.content;
      const body = t.description ?? t.content;
      lines.push(`### [${t.state}] ${title}`);
      lines.push("");
      lines.push(body);
      lines.push("");
    }
    lines.push("");
  }

  if (risks.length > 0) {
    lines.push("## Risks");
    for (const r of risks) {
      const title = r.title ?? r.content;
      const body = r.description ?? r.content;
      lines.push(`### ${title}`);
      lines.push("");
      lines.push(`**Severity/Likelihood**: ${r.severity}/${r.likelihood}`);
      lines.push("");
      lines.push(body);
      lines.push("");
      if (r.mitigation) {
        lines.push("**Mitigation**:");
        lines.push("");
        lines.push(r.mitigation);
        lines.push("");
      }
    }
    lines.push("");
  }

  if (constraints.length > 0) {
    lines.push("## Constraints");
    for (const c of constraints) {
      const title = c.title ?? c.constraint ?? c.content;
      const body = c.description ?? c.reason ?? c.content;
      lines.push(`### ${title}`);
      lines.push("");
      lines.push(body);
      lines.push("");
    }
    lines.push("");
  }

  if (questions.length > 0) {
    lines.push("## Questions");
    for (const q of questions) {
      const title = q.title ?? q.question ?? q.content;
      const body = q.description ?? q.content;
      lines.push(`### ${title}`);
      lines.push("");
      lines.push(body);
      lines.push("");
      if (q.answer) {
        lines.push("**Answer**:");
        lines.push("");
        lines.push(q.answer);
        lines.push("");
      }
    }
    lines.push("");
  }

  // Traceability appendix: show raw ctx block projection
  lines.push("## Appendix: context blocks");
  lines.push("");
  lines.push(await projectToMarkdown(store));
  lines.push("");

  return lines.join("\n");
}

