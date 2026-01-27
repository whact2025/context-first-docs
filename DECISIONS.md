# Architecture Decisions

This document tracks key architectural decisions made during the context-first-docs project.

```ctx
type: decision
id: decision-001
status: accepted
---
**Decision**: Use Markdown as the human interface, not as the source of truth.

**Rationale**: 
- Markdown is familiar to developers and renders well on GitHub/GitLab
- Git workflows work naturally with Markdown files
- However, Markdown alone is not structured enough for agent consumption
- Solution: Markdown is a projection of the canonical context store

**Alternatives Considered**:
- YAML/JSON as the interface (too technical, poor readability)
- Custom format (requires new tooling, harder adoption)
- Database-only (loses Git integration)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-002
status: accepted
---
**Decision**: Use ctx blocks for semantic sections in Markdown.

**Rationale**:
- Lightweight syntax that doesn't break Markdown rendering
- Stable IDs survive rebases and merges
- Clear separation between system-managed and human-edited content
- Can be ignored by tools that don't understand context blocks

**Alternatives Considered**:
- HTML comments (not visible, harder to work with)
- Frontmatter (only works at file level, not section level)
- Custom Markdown extensions (requires parser modifications)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-003
status: accepted
---
**Decision**: The project itself must be self-referential and use its own system.

**Rationale**:
- Demonstrates the approach in practice
- Serves as a living example for users
- Validates that the system works for real-world use
- Forces us to "eat our own dog food"

**Alternatives Considered**:
- Separate example project (less authentic, harder to maintain)
- Traditional documentation (defeats the purpose)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-004
status: accepted
---
**Decision**: Use TypeScript for type safety and better developer experience.

**Rationale**:
- Strong typing helps prevent errors in the context graph
- Better IDE support and autocomplete
- Easier to maintain as the system grows
- Type definitions serve as documentation

**Alternatives Considered**:
- JavaScript (less type safety)
- Rust/Go (higher barrier to entry, overkill for v1)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-005
status: accepted
---
**Decision**: Store context in Git as JSON files, committed to the repository.

**Rationale**:
- Git diffs on structured data are more meaningful than Markdown diffs
- Easier to query and process programmatically
- Markdown files are generated deterministically from the store
- Enables advanced features like cross-references and validation
- JSON provides excellent git diffs and merge conflict resolution
- One file per node/proposal enables scalable, queryable storage
- Committed to git provides full version history and collaboration

**Storage Structure**:
```
.context/
├── nodes/
│   ├── {type}-{id}.json      # One file per node
├── proposals/
│   ├── proposal-{id}.json    # One file per proposal
├── reviews/
│   └── review-{id}.json      # One file per review
└── index.json                # Metadata and indexes
```

**Format Choice**: JSON over YAML because:
- More machine-friendly and deterministic
- Better tooling support
- Excellent git diffs
- Standard format widely supported

**Git Integration**: Context store is committed to git (not ignored) for:
- Full version history
- Collaboration via git workflows
- Review context changes in PRs
- Git-based backup and distribution

**Alternatives Considered**:
- YAML (more human-readable but less strict, whitespace-sensitive)
- Single monolithic file (poor git diffs, merge conflicts)
- Git-ignored storage (loses version history and collaboration)
- Database/external service (loses git integration)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-006
status: accepted
---
**Decision**: Context persistence is independent of git commits. Git commits only occur when proposals are accepted/implemented.

**Rationale**:
- Authored content (proposals, risks, questions) should persist immediately upon creation
- Authors can work and iterate without requiring git commits
- Git commits represent implementation/completion, not authorship
- Enables asynchronous workflows where context evolves independently of code changes
- Similar to Jira where issues exist independently and commits reference them

**Implementation**:
- Context store persists to file system (JSON/YAML) immediately when proposals/nodes are created
- Git commits are tracked and linked to proposals via checkin semantics
- Commit messages can reference proposals (e.g., "Implements proposal-123")
- System tracks which commits correspond to which proposals/nodes
- Markdown projection happens on commit, but context store is always up-to-date

**Alternatives Considered**:
- Requiring git commits for persistence (too restrictive, breaks async workflows)
- Git as the only persistence mechanism (loses independence, harder to query)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-007
status: accepted
---
**Decision**: Installation into existing repositories must be clean and non-invasive.

**Rationale**:
- Developers should be able to adopt the system without disrupting existing workflows
- Existing repositories should continue to work normally without the system
- Installation should be opt-in and incremental
- Minimal footprint reduces adoption friction

**Requirements**:
- Only adds `.context/` directory (already in .gitignore)
- No forced changes to existing files
- Context files (CONTEXT.md, DECISIONS.md, etc.) are optional
- Existing Markdown files work unchanged - ctx blocks are additive
- Can be installed incrementally (file by file)
- Can be removed without breaking anything
- Installation CLI should be simple and reversible

**Installation Process**:
1. Run `npx context-first-docs init` (or similar)
2. Creates `.context/` directory structure
3. Installs pre-baked Cursor rules to `.cursor/rules/` directory
4. Optionally creates template context files
5. Updates `.gitignore` if needed (only adds `.context/` entry)
6. No changes to existing files unless explicitly requested

**Alternatives Considered**:
- Requiring changes to existing files (too invasive, breaks adoption)
- Separate repository for context (loses integration, harder to maintain)
- Database/external service (loses git integration, adds dependencies)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-008
status: accepted
---
**Decision**: VS Code/Cursor extension is required, not optional, for v1.

**Rationale**:
- In-editor review is essential for the "Google Docs review mode" experience
- Context awareness in the IDE enables developers to see proposals, decisions, and risks while coding
- Seamless authoring workflow - create proposals and review without leaving the editor
- Critical for adoption - developers need integrated tooling, not separate CLI tools
- Enables real-time context queries and proposal creation from within the editor
- Makes the system practical for daily use, not just documentation

**Required Features**:
- ctx block syntax highlighting and validation
- In-editor proposal creation and editing
- Review UI for accepting/rejecting proposals
- Context queries (show related decisions, risks, tasks)
- Integration with git for commit tracking
- Visual indicators for proposal status and review state

**Alternatives Considered**:
- Making it optional (loses core value proposition, reduces adoption)
- CLI-only approach (too disconnected from workflow, higher friction)
- Web-based UI only (requires context switching, breaks flow)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-010
status: accepted
---
**Decision**: Integration must support reverse engineering merge requests/PRs in pre-existing repositories.

**Rationale**:
- Enables migration of existing projects to context-first system
- Captures historical decisions and rationale from PR/MR comments
- Extracts proposals, decisions, and risks from existing code review discussions
- Preserves institutional knowledge that exists only in PR/MR history
- Makes adoption easier for mature projects with extensive PR history
- Allows teams to build context graph retroactively from existing discussions

**Capabilities**:
- Analyze PR/MR titles, descriptions, and commit messages for decision patterns
- Extract decisions and rationale from PR/MR comments and discussions
- Identify rejected alternatives from comment threads
- Convert PR/MR discussions into proposals with proper status (accepted/rejected)
- Link extracted context to commits and code changes
- Handle both merged and closed PRs/MRs
- Support GitHub and GitLab APIs

**Process**:
1. Connect to repository via GitHub/GitLab API
2. Analyze PR/MR history (titles, descriptions, comments, commits)
3. Extract semantic content (decisions, risks, proposals, rationale)
4. Create context nodes and proposals from extracted content
5. Link to commits and code changes
6. Import into context store

**Use Cases**:
- Migrating existing projects to context-first system
- Building context graph from historical PR/MR discussions
- Capturing decisions that were made in PR comments but never documented
- Extracting risks and concerns raised during code review
- Preserving rationale for architectural decisions

**Alternatives Considered**:
- Manual migration only (too time-consuming, loses historical context)
- Starting fresh without historical context (loses valuable institutional knowledge)
- External tools for PR analysis (adds dependencies, less integrated)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-011
status: accepted
---
**Decision**: The system must support designated contributors and approvers with role-based access control.

**Rationale**:
- Enables proper governance and quality control
- Prevents unauthorized changes to accepted context
- Supports organizational hierarchies and responsibilities
- Allows fine-grained control over who can create vs approve proposals
- Enables multi-approval workflows for critical decisions
- Integrates with GitLab/GitHub permission models

**Role Model**:
- **Contributors**: Can create proposals and nodes, but cannot approve
- **Approvers**: Can review and approve/reject proposals, can also create proposals
- **Admins**: Full access, can manage users and roles

**Capabilities**:
- Configure designated contributors per project/namespace
- Configure designated approvers per project/namespace
- Support per-node-type approvers (e.g., architecture decisions require senior engineers)
- Support multi-approval requirements (e.g., critical risks need 2 approvals)
- Track who approved proposals (for audit trail)
- Validate permissions before allowing actions
- Integrate with GitLab/GitHub user/group permissions

**Implementation**:
- Role configuration stored in `.context/roles.json` (or similar)
- User roles can be synced from GitLab/GitHub groups
- Permission checks before proposal creation, review, and approval
- Review records include reviewer role and approval status
- Proposal metadata tracks required and actual approvers

**Use Cases**:
- Architecture decisions require senior engineer approval
- Risk proposals need security team approval
- Contributors can propose changes but approvers must review
- Multi-approval for critical decisions (e.g., 2 senior engineers)
- Admin-only actions (managing users, changing roles)

**Alternatives Considered**:
- No access control (too permissive, allows unauthorized changes)
- Single approver model (too restrictive, doesn't scale)
- External permission system only (loses integration, harder to manage)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-012
status: accepted
---
**Decision**: Approval of proposals must trigger automatic creation of issues.

**Rationale**:
- Approved proposals represent decisions that need implementation
- Automatically creating issues ensures nothing falls through the cracks
- Links approval decisions to actionable work items
- Enables tracking of implementation progress
- Supports workflow automation and reduces manual work
- Makes it clear what needs to be done after approval
- "Issues" is familiar terminology (GitHub Issues, Jira Issues, etc.)

**Workflow**:
1. Proposal is reviewed and approved
2. System checks if proposal has issue configuration
3. Issues are automatically created based on templates or custom configuration
4. Issues can be created as task nodes in the context store
5. Issues are linked back to the proposal and approval

**Issue Types**:
- **Implementation tasks**: Work needed to implement the approved proposal
- **Follow-up items**: Related work or next steps
- **Review tasks**: Items that need review or verification
- **Custom issues**: Proposal-specific items

**Configuration**:
- Proposals can specify issue templates to use
- Issue templates define what issues to create based on proposal type/content
- Custom issues can be defined per proposal
- Issues can be created as task nodes in context store
- Issues can have assignees, due dates, dependencies, priorities

**Examples**:
- Approved decision proposal → Creates implementation issue
- Approved risk proposal → Creates mitigation issue
- Approved constraint proposal → Creates compliance verification issue
- Approved plan proposal → Creates issues for each plan step

**Integration**:
- Issues created as task nodes can be queried and tracked
- Issues link back to originating proposal
- Issues can reference related nodes (decisions, risks, etc.)
- Issues can be assigned to contributors
- Issues can have dependencies on other tasks
- Can integrate with external issue trackers (GitHub Issues, Jira, Linear)

**Alternatives Considered**:
- Manual issue creation (too much work, things get forgotten)
- No issue creation (loses connection between approval and implementation)
- External task management only (loses integration, harder to track)
- Using "actions" terminology (less familiar, "issues" is standard)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-013
status: accepted
---
**Decision**: Markdown files support both read-only and editable modes based on user role. All Markdown edits must sync back to context store and update referencing nodes.

**Rationale**:
- Different roles need different access levels
- Contributors need to edit Markdown files directly
- Approvers/reviewers may only need read access
- Ensures context store stays in sync with Markdown
- Changes must propagate to all nodes that reference edited content

**Role-Based Modes**:
- **Contributors**: Can edit Markdown files (ctx blocks and other content)
- **Approvers**: Can edit Markdown files (for review and changes)
- **Read-only users**: Can view but not edit (if such role exists)
- **Admins**: Full edit access

**Sync Requirements**:
- Markdown edits to ctx blocks → Import as proposals → Sync to context store
- Markdown edits to non-ctx content → Track changes → Update referencing nodes
- Context store changes → Export to Markdown → Update all affected files
- Referencing nodes must be updated when referenced content changes
- Sync must be bidirectional and consistent

**Referencing Context**:
- When a node references another node (via relations), changes to referenced node must update referencer
- When Markdown content is referenced by multiple nodes, all must be updated
- Cross-references between files must be maintained
- Reference integrity must be preserved during sync

**Workflow**:
1. User edits Markdown file (based on role permissions)
2. System detects changes (ctx blocks and other content)
3. Changes imported as proposals (for ctx blocks)
4. Non-ctx content changes tracked and synced
5. Referencing nodes updated if referenced content changed
6. Context store updated with accepted changes
7. All affected Markdown files regenerated

**Alternatives Considered**:
- Read-only only (too restrictive, breaks familiar workflows)
- Editable only (loses control, harder to prevent drift)
- No sync back (loses bidirectional consistency)
- Manual sync only (too much work, error-prone)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-014
status: accepted
---
**Decision**: Use hybrid reconciliation approach for handling concurrent edits to the same ctx block.

**Rationale**:
- No single strategy fits all use cases
- Need balance between automation and control
- Must prevent data loss while allowing parallel work
- Field-level conflicts are often resolvable automatically
- True conflicts require human judgment

**Hybrid Strategy Components**:

1. **Conflict Detection** (Proposal-Based):
   - Detect conflicts at proposal creation time
   - Check if other open proposals modify the same nodes
   - Mark proposals as "conflicting" if conflicts detected
   - Track conflicting proposal relationships

2. **Field-Level Merging**:
   - Auto-merge non-conflicting fields automatically
   - Detect field-level conflicts (same field changed differently)
   - Preserve all non-conflicting changes
   - Flag conflicting fields for manual resolution

3. **Optimistic Locking**:
   - Track node version numbers (increment on each change)
   - Proposals reference base version they're modifying
   - Reject proposals if node version changed (stale)
   - Require proposal update to latest version before approval

4. **Manual Resolution**:
   - True conflicts require human review
   - Reviewers see all conflicting proposals side-by-side
   - Reviewer creates merged proposal or chooses one
   - System applies reviewer's resolution

5. **Proposal Superseding**:
   - Allow proposals to explicitly supersede others
   - Track proposal relationships and chains
   - When superseding proposal approved, mark superseded as superseded
   - Preserve full proposal history

**Workflow**:
1. User creates proposal → System checks for conflicts with open proposals
2. System records base versions of nodes being modified
3. If no conflicts → Normal review workflow
4. If field-level conflicts → Auto-merge non-conflicting fields, flag conflicts
5. If true conflicts → Mark proposal as "hasConflicts", require resolution
6. When applying proposal → Check node versions match base versions
7. If versions changed → Reject as stale, require update
8. Reviewer resolves conflicts → Creates merged proposal or chooses one
9. System applies resolution with version validation

**Configuration**:
- Per-node-type conflict strategies (can override default)
- Per-namespace conflict strategies
- Global default strategy
- Configurable auto-merge behavior

**Examples**:
- Proposal A changes `content` field, Proposal B changes `status` → Auto-merge (no conflict)
- Proposal A changes `content` to "X", Proposal B changes `content` to "Y" → Conflict, manual resolution
- Proposal created when node version is 5, but node is now version 7 → Reject as stale

**Alternatives Considered**:
- Single strategy only (too rigid, doesn't fit all cases)
- No conflict detection (allows data corruption)
- Always manual resolution (too slow, blocks workflow)
- Always auto-merge (risky, may lose important changes)
- Lock-based only (blocks parallel work unnecessarily)

**Decided At**: 2026-01-26
```

```ctx
type: decision
id: decision-015
status: accepted
---
**Decision**: Use a graph model with typed relationships instead of strict hierarchical nesting.

**Rationale**:
- More flexible than rigid parent-child hierarchies
- Can represent multiple relationship types (hierarchical, dependencies, references, etc.)
- Enables powerful graph queries and traversal
- Supports complex multi-dimensional relationships
- Can evolve relationship types without schema changes
- Better for AI agents to understand context and relationships
- Hierarchical views can be projected from graph when needed

**Graph Model Structure**:
- **Nodes**: Vertices in the graph (goals, decisions, tasks, etc.)
- **Edges**: Typed relationships between nodes
- **Edge Types**: Support multiple relationship types:
  - `parent-child`: Hierarchical relationships (sub-decisions, subtasks)
  - `depends-on`: Dependencies (task dependencies, decision dependencies)
  - `references`: References (decisions referencing goals, tasks referencing decisions)
  - `supersedes`: Replacement relationships (new decision supersedes old)
  - `related-to`: General relationships
  - `implements`: Implementation relationships (task implements decision)
  - `blocks`: Blocking relationships (risk blocks task)
  - `mitigates`: Mitigation relationships (task mitigates risk)

**Implementation Approach**:
- Replace simple `relations?: NodeId[]` with typed edge structure
- Store edges as separate entities or embedded in nodes (both approaches viable)
- Support graph queries: "find all descendants", "find all dependencies", "find path between nodes"
- Provide hierarchical projection APIs for UI/display purposes
- Maintain reverse index (`referencedBy`) for efficient traversal

**Benefits Over Strict Nesting**:
- No rigid parent-child constraints
- Can represent complex relationships (e.g., task depends on decision AND references goal)
- Enables relationship analysis and traversal
- Supports both hierarchical and non-hierarchical structures
- Extensible - can add new relationship types without breaking changes

**Alternatives Considered**:
- Strict hierarchical nesting (too rigid, limits flexibility)
- Simple untyped relations array (loses semantic meaning, harder to query)
- Separate relationship tables (more complex, but could be considered for very large graphs)
- Property graph with edge properties (more powerful but more complex, may be overkill)

**Decided At**: 2026-01-26
```
