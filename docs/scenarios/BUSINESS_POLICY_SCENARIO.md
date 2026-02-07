# Business Policy Scenario (Non-Software Truth)

This scenario demonstrates TruthLayer managing a real business policy.

## Context

Workspace: `acme-procurement`
Base revision: `rev_40`

Accepted truth includes:
- POLICY: "Expense Reimbursement Policy"
  - max meal reimbursement: $60
  - receipts required over $25
  - exceptions require manager approval

## Proposal: adjust meal max and add regional rule

A contributor drafts a proposal:
- increase meal max to $75
- add a rule: “in high-cost cities, max is $90”
- add metric node: “policy compliance rate”
- add evidence node: “benchmark survey”

Operations include:
- UPDATE_NODE on POLICY fields
- CREATE_NODE for EVIDENCE and METRIC
- CREATE_EDGE: EVIDENCE SUPPORTS POLICY

## Review

Finance reviewer:
- requests clarification on “high-cost cities” definition
- adds comment anchored to the new field
Contributor updates proposal with a list/criteria reference.

Policy requires 2 approvals:
- Finance + HR

## Apply

Applier applies the accepted proposal:
- new accepted revision `rev_41`
- AppliedMetadata recorded
- projection exported to a readable policy document for employees

Outcome:
- policy is governed, auditable, and safe for agent retrieval (e.g., travel assistant).
