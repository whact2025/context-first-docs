# Reconciliation Strategies

TruthLayer reconciles concurrent edits at **semantic** (field and node) granularity. The store exposes **detectConflicts**, **isProposalStale**, and **mergeProposals**; resolution can be automatic (field-level merge) or human-led via proposal review.

## API

- **detectConflicts(proposalId)**: Compares the proposal’s operations with other open proposals. Returns:
  - `conflicts`: array of **ProposalConflict** (proposals [id1, id2], conflictingNodes, conflictingFields?, severity, autoResolvable).
  - `mergeable`: proposal IDs that do not conflict (or only touch different fields).
  - `needsResolution`: proposal IDs that conflict and need human or policy-driven resolution.
- **isProposalStale(proposalId)**: True if the base revision or target nodes have changed since the proposal was created (optimistic locking); used to warn or block apply.
- **mergeProposals(proposalIds)**: Attempts field-level merge; returns **MergeResult**: merged, conflicts (field, nodeId, proposal1Value, proposal2Value), autoMerged.

## Conflict severity

- **field**: same node, different fields → often auto-mergeable (different fields) or one value chosen.
- **node**: same node, same field(s) or structural ops (create/delete/move) → typically need human or policy.
- **critical**: sensitive node types (e.g. POLICY, SECURITY) or policy-defined critical scope → block auto-merge; require explicit resolution.

## Default strategy

- **Field-level merge**: updates to different fields on the same node can be auto-merged into a combined proposal.
- **Conflict when same field** is changed to different values; or **delete vs update**; or **move vs update** (depending on node type); or **edge collisions** (relationship graph changes).
- **Human resolution**: via proposal review — produce a new proposal that selects one change, combines compatible changes, or adds a decision node capturing the resolution.

## ConflictStrategy and configuration

- **detect-only**: only detect; do not auto-merge.
- **field-level-merge**: auto-merge non-conflicting fields; flag rest for resolution.
- **manual-resolution**: always require human resolution for any conflict.
- **last-write-wins / first-write-wins**: policy-defined for specific scopes.
- **priority-based**: use proposal priority (e.g. critical > high > medium > low).
- **supersede**: one proposal explicitly supersedes another (recorded in proposal metadata).
- **optimistic-lock**: reject or warn when proposal is stale (isProposalStale).

**ConflictConfiguration** can set defaultStrategy, per-node-type strategies, autoMergeFields (bool), requireManualResolution (bool), useOptimisticLocking (bool).

## Guardrails

- Critical node types (POLICY, SECURITY) can require stricter conflict rules or always manual resolution.
- Policy engine can block auto-merge for sensitive scopes.
- Audit log records conflict detection and merge outcomes.

See example: [CONFLICT_AND_MERGE_SCENARIO.md](../scenarios/CONFLICT_AND_MERGE_SCENARIO.md)
