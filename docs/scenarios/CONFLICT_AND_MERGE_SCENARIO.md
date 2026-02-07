# Conflict and Merge Scenario

This scenario illustrates two contributors making overlapping changes and how TruthLayer reconciles.

## Setup

Workspace: `acme-security`
Base revision: `rev_100`

Truth includes a policy node:

- POLICY: "Vendor Access Requirements"
  - requirement: MFA
  - requirement: time-bound access
  - owner: Security Team

## Concurrent proposals

### Proposal A (Alice): add “Just-in-time approval”
- UPDATE_NODE(policy.requirements += "JIT approval")

### Proposal B (Bob): change “time-bound access” to 12h max
- UPDATE_NODE(policy.requirements["time-bound access"] = "12 hours max")

## Merge result

Because the edits touch different fields/entries, the default strategy can auto-merge into a combined proposal:

- adds JIT approval
- updates time-bound access duration

## Hard conflict example

If Proposal C changes the same duration to “24 hours max”, it becomes a conflict:
- reviewer resolves by choosing 12h or 24h
- or by adding a decision node capturing the rationale

## Outcome

Accepted proposals are applied in order, producing new accepted revisions with AppliedMetadata.

See: [../core/REVIEW_MODE.md](../core/REVIEW_MODE.md)
