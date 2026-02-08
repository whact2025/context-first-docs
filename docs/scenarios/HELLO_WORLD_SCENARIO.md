# Hello World Scenario (End-to-End)

This is an end-to-end walkthrough: accepted truth → proposal → review → apply → projection.

## 1) Create a workspace

`workspaceId = "demo-product"`

## 2) Start with accepted truth (rev_1)

Nodes:

- GOAL: "Reduce onboarding time by 30%"
- DECISION: "Adopt a single source of truth for onboarding steps"
  Edges:
- DECISION SUPPORTS GOAL

## 3) Agent drafts a proposal

Proposal:

- baseRevisionId = rev_1
- title: "Add onboarding checklist and owner"

Operations:

1. CREATE_NODE (PROCESS_STEP): "Create accounts"
2. CREATE_NODE (PROCESS_STEP): "Request access"
3. CREATE_EDGE: PROCESS_STEP DEPENDS_ON PROCESS_STEP
4. UPDATE_NODE (GOAL): add owner + metric

Proposal status: SUBMITTED

## 4) Human review

Reviewer:

- comments on "Request access" step: clarify SLA
- requests changes → proposal updated
- approves review (status APPROVED)
  Proposal status becomes ACCEPTED

## 5) Apply

Applier runs apply:

- creates new accepted revision rev_2
- stamps AppliedMetadata:
  - appliedAt
  - appliedBy
  - appliedFromReviewId
  - appliedFromProposalId
  - appliedToRevisionId=rev_2
  - previousRevisionId=rev_1

## 6) Projection

Generate `README.md` projection for rev_2.

Outcome:

- onboarding truth is now stable and safe for agents and humans

Next:

- Implement UI flows per [UI Specification](../core/UI_SPEC.md)
