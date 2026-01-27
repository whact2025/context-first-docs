# Storage Options for Git/GitLab Hosting

This document outlines storage options for the context store that can be hosted directly in git/GitLab repositories.

## Overview

The context store needs to be:
- **Git-friendly**: Text-based formats that diff well
- **Queryable**: Easy to process programmatically
- **Human-readable**: Developers can inspect and understand
- **Versioned**: Git provides versioning and history
- **Accessible**: Works with GitHub/GitLab web interfaces

## Storage Format Options

### Option 1: JSON Files (Recommended)

**Structure**:
```
.context/
├── nodes/
│   ├── decision-001.json
│   ├── risk-002.json
│   └── task-003.json
├── proposals/
│   ├── proposal-001.json
│   └── proposal-002.json
├── reviews/
│   └── review-001.json
└── index.json
```

**Pros**:
- ✅ Excellent git diffs - line-by-line changes are clear
- ✅ Machine-readable - easy to parse and query
- ✅ Standard format - widely supported
- ✅ Deterministic - same data = same file
- ✅ Works with GitHub/GitLab web UI (can view JSON files)
- ✅ Good for programmatic access

**Cons**:
- ❌ Less human-readable than YAML
- ❌ No comments in JSON (but metadata fields can document)

**Git Diff Example**:
```diff
 {
   "id": "decision-001",
   "type": "decision",
   "status": "accepted",
-  "content": "Use TypeScript",
+  "content": "Use TypeScript with strict mode",
   "metadata": {
     "modifiedAt": "2026-01-26T10:00:00Z"
   }
 }
```

### Option 2: YAML Files

**Structure**:
```
.context/
├── nodes/
│   ├── decision-001.yaml
│   ├── risk-002.yaml
│   └── task-003.yaml
├── proposals/
│   └── proposal-001.yaml
└── index.yaml
```

**Pros**:
- ✅ Human-readable - easier to read and edit manually
- ✅ Supports comments - can document inline
- ✅ Good git diffs - clear line-by-line changes
- ✅ Works with GitHub/GitLab web UI
- ✅ More compact than JSON for nested structures

**Cons**:
- ❌ Less strict than JSON (whitespace-sensitive, indentation matters)
- ❌ Slightly harder to parse programmatically
- ❌ Can have ambiguity issues (though rare)

**Git Diff Example**:
```yaml
 id: decision-001
 type: decision
 status: accepted
-content: Use TypeScript
+content: Use TypeScript with strict mode
 metadata:
   modifiedAt: 2026-01-26T10:00:00Z
```

### Option 3: Hybrid Approach (JSON + YAML)

**Structure**:
```
.context/
├── nodes/
│   ├── decision-001.json      # Machine-readable
│   └── decision-001.yaml       # Human-readable (optional)
├── proposals/
│   └── proposal-001.json
└── index.json
```

**Pros**:
- ✅ Best of both worlds
- ✅ JSON for programmatic access
- ✅ YAML for human editing (optional)

**Cons**:
- ❌ Duplication - need to keep in sync
- ❌ More complex - two formats to maintain

**Recommendation**: Use JSON as primary, generate YAML on-demand if needed.

### Option 4: Single Monolithic File

**Structure**:
```
.context/
└── store.json  # or store.yaml
```

**Pros**:
- ✅ Single file - simple structure
- ✅ Atomic updates - all or nothing
- ✅ Easy to backup/copy

**Cons**:
- ❌ Poor git diffs - entire file changes on any update
- ❌ Merge conflicts - harder to resolve
- ❌ Not scalable - large files are slow
- ❌ Poor performance - must parse entire file

**Recommendation**: ❌ Not recommended for git-hosted storage.

### Option 5: Directory-per-Type Structure

**Structure**:
```
.context/
├── decisions/
│   ├── decision-001.json
│   └── decision-002.json
├── risks/
│   └── risk-001.json
├── proposals/
│   └── proposal-001.json
└── index.json
```

**Pros**:
- ✅ Organized by node type
- ✅ Easy to navigate
- ✅ Can filter by type easily

**Cons**:
- ❌ More directory structure to manage
- ❌ Cross-type queries require multiple directories

**Recommendation**: ✅ Good option, especially for larger projects.

## Git/GitLab Specific Considerations

### Git LFS (Large File Storage)

**When to use**:
- If storing large binary attachments
- If context store grows very large (>100MB)

**Structure**:
```
.context/
├── nodes/
│   └── decision-001.json
├── attachments/          # Git LFS
│   └── diagram.png
└── index.json
```

**Pros**:
- ✅ Handles large files
- ✅ Reduces repository size

**Cons**:
- ❌ Requires Git LFS setup
- ❌ Additional complexity
- ❌ May not be needed for text-based context

**Recommendation**: Only if storing large binary files.

### GitLab Wiki Integration

**Option**: Store context in GitLab Wiki

**Pros**:
- ✅ Built-in GitLab feature
- ✅ Web-based editing
- ✅ Version history

**Cons**:
- ❌ Separate from code repository
- ❌ Less integrated with git workflow
- ❌ Harder to query programmatically

**Recommendation**: ❌ Not recommended - loses git integration.

### GitLab Pages / GitHub Pages

**Option**: Generate static site from context store

**Structure**:
```
.context/          # Source data
docs/              # Generated site (GitLab Pages)
└── index.html
```

**Pros**:
- ✅ Human-readable web interface
- ✅ Can be generated from JSON/YAML
- ✅ Searchable and browsable

**Cons**:
- ❌ Generated content, not source of truth
- ❌ Additional build step

**Recommendation**: ✅ Good for documentation site, but context store should be in `.context/`.

## Recommended Approach

### Primary Storage: JSON Graph Format (Default)

```
.context/
├── graph.json                 # Primary graph storage (nodes + edges)
├── nodes/
│   ├── {node-id}.json         # Individual node files (for granular access)
├── proposals/
│   ├── {proposal-id}.json     # One file per proposal
├── reviews/
│   └── {review-id}.json       # One file per review
└── index.json                 # Metadata and indexes
```

**Graph Format Structure**:
```json
{
  "nodes": [
    {
      "id": "decision-001",
      "type": "decision",
      "status": "accepted",
      "content": "Use TypeScript",
      "metadata": {
        "createdAt": "2026-01-26T10:00:00Z",
        "createdBy": "user1",
        "version": 1
      }
    }
  ],
  "edges": [
    {
      "source": "task-002",
      "target": "decision-001",
      "type": "implements",
      "metadata": {
        "createdAt": "2026-01-26T10:00:00Z"
      }
    }
  ]
}
```

**Rationale**:
1. ✅ **Graph-native**: Matches graph model (see `decision-015`), enables efficient relationship queries
2. ✅ **Git-friendly**: Excellent diffs, clear history, reviewable in PRs
3. ✅ **Queryable**: Native graph structure enables efficient traversal and path finding
4. ✅ **Versioned**: Git provides full version history
5. ✅ **Accessible**: GitHub/GitLab web UI can display JSON
6. ✅ **Merge-friendly**: Conflicts are isolated to graph structure
7. ✅ **Self-contained**: All data in Git, no external services (see `constraint-005`)
8. ✅ **Compatible**: Extends current JSON structure, maintains compatibility

### File Naming Convention

- **Nodes**: `{type}-{id}.json` (e.g., `decision-001.json`, `risk-002.json`)
- **Proposals**: `proposal-{id}.json`
- **Reviews**: `review-{id}.json`

### Index File Structure

```json
{
  "version": "1.0",
  "lastUpdated": "2026-01-26T10:00:00Z",
  "nodes": {
    "decision-001": {
      "file": "nodes/decision-001.json",
      "type": "decision",
      "status": "accepted",
      "updatedAt": "2026-01-26T10:00:00Z"
    }
  },
  "proposals": {
    "proposal-001": {
      "file": "proposals/proposal-001.json",
      "status": "open",
      "createdAt": "2026-01-26T09:00:00Z"
    }
  }
}
```

## Git Ignore Considerations

**Current `.gitignore`**:
```
.context/nodes/
.context/proposals/
.context/reviews/
.context/index.json
```

**Decision**: Should `.context/` be committed to git?

### Option A: Commit to Git (Recommended)

**Pros**:
- ✅ Full version history in git
- ✅ Works with GitHub/GitLab web UI
- ✅ Backup and collaboration via git
- ✅ Can review context changes in PRs
- ✅ Git provides versioning and history

**Cons**:
- ❌ Repository size grows (but JSON is small)
- ❌ Need to handle merge conflicts

**Recommendation**: ✅ **Commit to git** - benefits outweigh costs.

### Option B: Git Ignore (Current)

**Pros**:
- ✅ Keeps repository clean
- ✅ No merge conflicts on context

**Cons**:
- ❌ No version history in git
- ❌ Can't review context changes in PRs
- ❌ Loses git-based collaboration
- ❌ Requires separate backup strategy

**Recommendation**: ❌ **Don't ignore** - commit to git for full benefits.

## Migration Path

1. **Phase 1**: Implement file-based store (JSON)
2. **Phase 2**: Remove `.context/` from `.gitignore`
3. **Phase 3**: Commit context store to git
4. **Phase 4**: Update workflows to handle context in git

## Graph/Document Databases as Optional Enhancement

Given the graph model with typed relationships (see `decision-015`), graph/document databases could provide performance benefits for large-scale deployments.

### Graph Databases (Neo4j, ArangoDB, etc.)

**When to consider**:
- Very large repositories (thousands of nodes)
- Complex graph queries and traversal needs
- Performance requirements for relationship queries
- Need for advanced graph algorithms (shortest path, centrality, etc.)

**Pros**:
- ✅ Native graph query support (Cypher, AQL, Gremlin)
- ✅ Optimized graph traversal and path finding
- ✅ Relationship indexing and querying
- ✅ Better performance for complex graph queries
- ✅ Built-in graph algorithms

**Cons**:
- ❌ Requires external infrastructure
- ❌ Not git-friendly (binary or complex formats)
- ❌ Loses git integration and PR reviewability
- ❌ Additional operational complexity
- ❌ Not suitable for v1 (violates non-invasive installation requirement)

**Hybrid Approach**:
- JSON files in Git remain source of truth
- Graph DB syncs from JSON files (one-way: Git → DB)
- Graph DB used for complex queries and traversal
- Graph DB can be rebuilt from JSON files at any time
- No data loss if graph DB unavailable

**Example Architecture**:
```
.context/              # Source of truth (JSON files in Git)
├── nodes/
│   └── decision-001.json
└── index.json

[Optional Sync Layer]
    ↓
Graph Database        # Query/index layer (optional)
├── Nodes (vertices)
├── Relationships (edges)
└── Indexes
```

### Document Databases (MongoDB, CouchDB, etc.)

**When to consider**:
- Need flexible schema for evolving node types
- Prefer document-based storage over graph
- Already using document DB in infrastructure

**Pros**:
- ✅ Flexible schema
- ✅ Good for nested document structures
- ✅ Can store relationships as embedded documents
- ✅ Good query capabilities

**Cons**:
- ❌ Less optimal than graph DBs for graph queries
- ❌ Requires external infrastructure
- ❌ Not git-friendly
- ❌ Loses git integration
- ❌ Not suitable for v1

**Recommendation**: Graph databases are better suited than document databases for the graph model, but both are optional enhancements for scale.

### Implementation Strategy

**Phase 1 (v1)**: JSON files in Git only
- Meets all requirements (git-friendly, non-invasive, reviewable)
- Sufficient for most use cases

**Phase 2 (Future Enhancement)**: Optional graph database backend
- Design context store interface to support multiple backends
- Implement graph DB adapter that syncs from JSON files
- Graph DB used for complex queries, JSON files remain source of truth
- Can be enabled/disabled per repository

**Architecture Considerations**:
- Context store interface should abstract storage backend
- Graph DB adapter implements same interface
- Sync mechanism: JSON files → Graph DB (one-way)
- Query layer can choose backend based on query complexity

## Graph Databases That Can Be Stored in Git

**Security/Privacy Requirement**: Keep all context within the organization, no data leak to external services.

### Text-Based Graph Formats (Git-Native)

These formats can be stored directly in Git as text files, providing full version control and reviewability:

#### 1. GraphML (Graph Markup Language)

**Format**: XML-based text format for graphs

**Pros**:
- ✅ **Git-friendly**: Pure text/XML, excellent diffs
- ✅ **Human-readable**: Can be viewed and edited
- ✅ **Comprehensive**: Supports nodes, edges, attributes, hierarchical graphs
- ✅ **Standard**: Widely supported by graph tools
- ✅ **Self-contained**: All data in Git, no external services
- ✅ **Reviewable**: Can review graph changes in PRs

**Cons**:
- ❌ Verbose (XML overhead)
- ❌ Requires parsing for queries (no native query language)
- ❌ Performance: Must load entire graph for queries

**Example Structure**:
```xml
<graphml>
  <graph id="context-graph" edgedefault="directed">
    <node id="decision-001">
      <data key="type">decision</data>
      <data key="status">accepted</data>
      <data key="content">Use TypeScript</data>
    </node>
    <node id="task-002">
      <data key="type">task</data>
      <data key="status">accepted</data>
    </node>
    <edge id="e1" source="task-002" target="decision-001">
      <data key="relationship">implements</data>
    </edge>
  </graph>
</graphml>
```

**Storage Location**: `.context/graph.graphml` (committed to Git)

#### 2. DOT (GraphViz Format)

**Format**: Text-based graph description language

**Pros**:
- ✅ **Git-friendly**: Pure text, excellent diffs
- ✅ **Human-readable**: Very readable syntax
- ✅ **Simple**: Lightweight format
- ✅ **Self-contained**: All data in Git
- ✅ **Reviewable**: Can review in PRs

**Cons**:
- ❌ Limited metadata support
- ❌ Primarily for visualization, less structured for queries
- ❌ No native query language

**Example Structure**:
```
digraph context_graph {
  "decision-001" [type=decision, status=accepted];
  "task-002" [type=task, status=accepted];
  "task-002" -> "decision-001" [relationship=implements];
}
```

**Storage Location**: `.context/graph.dot` (committed to Git)

#### 3. GEXF (Graph Exchange XML Format)

**Format**: XML-based format for network representation

**Pros**:
- ✅ **Git-friendly**: XML text format, good diffs
- ✅ **Rich metadata**: Supports attributes, dynamics, hierarchies
- ✅ **Standard**: Used by Gephi and other tools
- ✅ **Self-contained**: All data in Git
- ✅ **Reviewable**: Can review in PRs

**Cons**:
- ❌ Verbose (XML overhead)
- ❌ Requires parsing for queries
- ❌ Performance: Must load entire graph

**Example Structure**:
```xml
<gexf>
  <graph mode="static" defaultedgetype="directed">
    <nodes>
      <node id="decision-001" label="Use TypeScript">
        <attvalues>
          <attvalue for="type" value="decision"/>
          <attvalue for="status" value="accepted"/>
        </attvalues>
      </node>
    </nodes>
    <edges>
      <edge id="e1" source="task-002" target="decision-001" type="directed">
        <attvalues>
          <attvalue for="relationship" value="implements"/>
        </attvalues>
      </edge>
    </edges>
  </graph>
</gexf>
```

**Storage Location**: `.context/graph.gexf` (committed to Git)

#### 4. JSON Graph Format (Custom)

**Format**: Extend current JSON structure to include graph representation

**Pros**:
- ✅ **Git-friendly**: Already using JSON, excellent diffs
- ✅ **Consistent**: Same format as node files
- ✅ **Queryable**: Can use existing JSON parsing
- ✅ **Self-contained**: All data in Git
- ✅ **Reviewable**: Can review in PRs
- ✅ **No format conversion**: Direct mapping from node structure

**Cons**:
- ❌ Custom format (not standard)
- ❌ Must implement graph queries ourselves

**Example Structure**:
```json
{
  "nodes": [
    {
      "id": "decision-001",
      "type": "decision",
      "status": "accepted",
      "content": "Use TypeScript"
    }
  ],
  "edges": [
    {
      "source": "task-002",
      "target": "decision-001",
      "type": "implements"
    }
  ]
}
```

**Storage Location**: `.context/graph.json` (committed to Git)

#### 5. GraphQL Schema Definition Language (SDL)

**Format**: GraphQL Schema Definition Language - text-based schema and data format

**Pros**:
- ✅ **Git-friendly**: Pure text format, excellent diffs
- ✅ **Human-readable**: Very readable syntax, more readable than JSON
- ✅ **Type-safe**: Built-in type system with validation
- ✅ **Self-documenting**: Schema serves as documentation
- ✅ **Standard**: Widely supported, mature specification
- ✅ **Self-contained**: All data in Git
- ✅ **Reviewable**: Can review in PRs
- ✅ **Query language**: Native GraphQL query support (if using GraphQL runtime)
- ✅ **Comments**: Supports comments for documentation

**Cons**:
- ❌ Primarily designed for schema definition, not data storage
- ❌ Would need custom extensions to represent instance data
- ❌ Less common as a storage format (typically used for schemas)
- ❌ Requires GraphQL parser/runtime for full functionality

**Example Structure** (Schema + Data):

```graphql
# Schema Definition
type Decision implements Node {
  id: ID!
  type: NodeType!
  status: NodeStatus!
  content: String!
  decision: String!
  rationale: String!
  alternatives: [String!]
  decidedAt: String
  metadata: NodeMetadata!
  relationships: [Relationship!]!
}

type Task implements Node {
  id: ID!
  type: NodeType!
  status: NodeStatus!
  content: String!
  state: TaskState!
  assignee: String
  dueDate: String
  dependencies: [ID!]!
  metadata: NodeMetadata!
  relationships: [Relationship!]!
}

type Relationship {
  type: RelationshipType!
  target: ID!
  reverseType: RelationshipType
  metadata: RelationshipMetadata
}

enum NodeType {
  GOAL
  DECISION
  CONSTRAINT
  TASK
  RISK
  QUESTION
  CONTEXT
  PLAN
  NOTE
}

enum NodeStatus {
  ACCEPTED
  PROPOSED
  REJECTED
  SUPERSEDED
}

enum RelationshipType {
  PARENT_CHILD
  DEPENDS_ON
  REFERENCES
  SUPERSEDES
  IMPLEMENTS
  BLOCKS
  MITIGATES
  RELATED_TO
}

# Instance Data (using GraphQL-like syntax or custom format)
# Option 1: Using GraphQL queries/mutations format
mutation CreateDecision {
  createDecision(input: {
    id: "decision-001"
    type: DECISION
    status: ACCEPTED
    content: "Use TypeScript"
    decision: "Use TypeScript for type safety"
    rationale: "Type safety prevents common errors"
    metadata: {
      createdAt: "2026-01-26T10:00:00Z"
      createdBy: "alice"
      version: 1
    }
    relationships: [{
      type: IMPLEMENTS
      target: "goal-001"
    }]
  })
}

# Option 2: Custom SDL-based data format
type Decision_decision_001 {
  id: "decision-001"
  type: DECISION
  status: ACCEPTED
  content: "Use TypeScript"
  decision: "Use TypeScript for type safety"
  rationale: "Type safety prevents common errors"
  metadata: {
    createdAt: "2026-01-26T10:00:00Z"
    createdBy: "alice"
    version: 1
  }
  relationships: [
    {
      type: IMPLEMENTS
      target: "goal-001"
    }
  ]
}
```

**Storage Structure**:
```
.context/
├── schema.graphql          # GraphQL schema definition
├── nodes/
│   ├── decision-001.graphql  # Individual node files
│   ├── task-002.graphql
│   └── goal-001.graphql
├── proposals/
│   └── proposal-001.graphql
└── index.graphql           # Index/metadata
```

**Alternative: GraphQL SDL for Schema + JSON for Data**

Hybrid approach:
- **Schema**: GraphQL SDL (`.context/schema.graphql`) - human-readable, versioned
- **Data**: JSON files (`.context/graph.json`) - efficient, standard
- **Benefits**: Best of both worlds - schema is readable, data is efficient

**Storage Location**: `.context/schema.graphql` + `.context/nodes/*.graphql` (committed to Git)

**Recommendation**: GraphQL SDL is excellent for **schema definition** but less ideal for **data storage**. Consider:
- **Option A**: GraphQL SDL for schema + JSON for data (hybrid)
- **Option B**: Pure JSON Graph format (current approach)
- **Option C**: Custom GraphQL-based data format (requires custom parser)

### Embedded Graph Databases (File-Based)

These databases store data in files but may use binary formats:

#### 1. Kuzu (Embedded Graph Database)

**Format**: Columnar disk-based format (binary, but files can be versioned)

**Pros**:
- ✅ **Embedded**: In-process, no external service
- ✅ **File-based**: Stores data in files (can be committed to Git)
- ✅ **Performance**: Optimized for graph queries
- ✅ **Cypher support**: Native graph query language
- ✅ **Self-hosted**: All data stays in organization
- ✅ **Open source**: MIT licensed

**Cons**:
- ❌ Binary format (not human-readable, poor git diffs)
- ❌ Files may be large (less git-friendly)
- ❌ Requires Kuzu library to query

**Storage Location**: `.context/kuzu/` directory (committed to Git, but binary)

**Use Case**: Optional performance enhancement, JSON remains source of truth

#### 2. SQLite with Graph Extensions

**Format**: SQLite database file (binary, but can be versioned)

**Pros**:
- ✅ **Embedded**: Single file, no external service
- ✅ **File-based**: Can be committed to Git
- ✅ **SQL queries**: Standard SQL for queries
- ✅ **Self-hosted**: All data stays in organization
- ✅ **Mature**: Well-established technology

**Cons**:
- ❌ Binary format (not human-readable, poor git diffs)
- ❌ Not optimized for graph queries (relational model)
- ❌ Requires SQLite library

**Storage Location**: `.context/graph.db` (committed to Git, but binary)

**Use Case**: Less optimal than dedicated graph databases

### Recommendation: Graph Format as Default Storage

**Primary Storage**: JSON Graph Format (`.context/graph.json`) - **Default, Required**
- ✅ Graph-native storage matches graph model (see `decision-015`)
- ✅ Fully git-friendly, human-readable and reviewable
- ✅ No external services required
- ✅ All data in Git repository
- ✅ Perfect for security/privacy requirements (see `constraint-005`)
- ✅ Enables efficient relationship queries and traversal
- ✅ Extends current JSON structure, maintains compatibility

**Individual Node Files**: `.context/nodes/{id}.json` (for granular access)
- ✅ Can be generated from graph.json or maintained separately
- ✅ Git-friendly and reviewable
- ✅ Self-contained in Git
- ✅ Useful for granular access and smaller diffs

**Optional Performance Layer**: Embedded database (Kuzu, SQLite)
- ✅ File-based, can be committed to Git
- ✅ Self-hosted, no external services
- ✅ Used only for query performance optimization
- ✅ Syncs from JSON Graph (one-way: Graph → DB)
- ✅ Can be rebuilt from JSON Graph at any time
- ⚠️ Binary format (less git-friendly, but acceptable for optional layer)

### Security/Privacy Benefits

**All approaches keep data within organization**:
- ✅ No cloud services required
- ✅ No external APIs
- ✅ All data in Git repository
- ✅ Can use self-hosted Git (GitLab, Gitea, etc.)
- ✅ Full control over data location and access

**Git-hosted graph formats** (GraphML, DOT, GEXF, JSON Graph):
- ✅ Fully reviewable in PRs
- ✅ Excellent git diffs
- ✅ Human-readable
- ✅ No binary blobs

**Embedded databases** (Kuzu, SQLite):
- ✅ Files stored in Git (binary, but versioned)
- ✅ No external service required
- ✅ Can be self-hosted entirely
- ⚠️ Less git-friendly (binary), but acceptable for optional performance layer

## GraphQL SDL as Storage Format

### Overview

GraphQL Schema Definition Language (SDL) is a text-based format that could be used for storing graph data in Git. However, GraphQL SDL is primarily designed for **schema definition**, not **data storage**.

### Two Approaches

#### Approach 1: GraphQL SDL for Schema + JSON for Data (Hybrid)

**Structure**:
```
.context/
├── schema.graphql          # GraphQL schema definition (human-readable)
├── graph.json              # Graph data in JSON format (efficient)
├── nodes/
│   └── {id}.json          # Individual node files
└── index.json             # Metadata and indexes
```

**Benefits**:
- ✅ Schema is human-readable and self-documenting
- ✅ Data storage is efficient (JSON)
- ✅ Schema changes are easy to review in PRs
- ✅ Type safety through schema validation
- ✅ Best of both worlds

**Example Schema**:
```graphql
# .context/schema.graphql
type Decision implements Node {
  id: ID!
  type: NodeType!
  status: NodeStatus!
  content: String!
  decision: String!
  rationale: String!
  alternatives: [String!]
  decidedAt: String
  metadata: NodeMetadata!
  relationships: [Relationship!]!
}

type Relationship {
  type: RelationshipType!
  target: ID!
  reverseType: RelationshipType
  metadata: RelationshipMetadata
}

enum NodeType {
  GOAL
  DECISION
  CONSTRAINT
  TASK
  RISK
  QUESTION
  CONTEXT
  PLAN
  NOTE
}

enum NodeStatus {
  ACCEPTED
  PROPOSED
  REJECTED
  SUPERSEDED
}

enum RelationshipType {
  PARENT_CHILD
  DEPENDS_ON
  REFERENCES
  SUPERSEDES
  IMPLEMENTS
  BLOCKS
  MITIGATES
  RELATED_TO
}
```

**Data remains in JSON** (as per current decision-005), but schema is defined in GraphQL SDL.

#### Approach 2: Pure GraphQL SDL for Data (Custom Format)

**Structure**:
```
.context/
├── schema.graphql          # Schema definition
├── nodes/
│   ├── decision-001.graphql # Node instances
│   └── task-002.graphql
└── relationships.graphql   # Relationship definitions
```

**Custom Data Format** (extending GraphQL SDL):
```graphql
# .context/nodes/decision-001.graphql
node Decision_decision_001 {
  id: "decision-001"
  type: DECISION
  status: ACCEPTED
  content: "Use TypeScript"
  decision: "Use TypeScript for type safety"
  rationale: "Type safety prevents common errors"
  alternatives: ["Use JavaScript", "Use Python"]
  decidedAt: "2026-01-26T10:00:00Z"
  metadata: {
    createdAt: "2026-01-26T10:00:00Z"
    createdBy: "alice"
    version: 1
  }
  relationships: [
    {
      type: IMPLEMENTS
      target: "goal-001"
    }
  ]
}
```

**Pros**:
- ✅ Very human-readable
- ✅ Self-documenting (schema + data together)
- ✅ Excellent git diffs
- ✅ Type validation through schema

**Cons**:
- ❌ Requires custom parser (not standard GraphQL)
- ❌ Less efficient than JSON for large datasets
- ❌ Not a standard use of GraphQL SDL
- ❌ More complex implementation

### Recommendation

**For Schema Definition**: GraphQL SDL is excellent
- Use `.context/schema.graphql` to define the schema
- Human-readable, self-documenting, easy to review
- Schema changes are clear in PRs

**For Data Storage**: JSON Graph format (current approach)
- More efficient for data storage
- Standard format, widely supported
- Better tooling and ecosystem
- Easier to query programmatically

**Hybrid Approach** (Recommended if using GraphQL):
- Schema: GraphQL SDL (`.context/schema.graphql`)
- Data: JSON Graph format (`.context/graph.json`)
- Best of both worlds: readable schema, efficient data

## Summary

**Recommended Storage**: **JSON Graph format in `.context/graph.json`, committed to git**

- **Primary**: JSON Graph format (`.context/graph.json`) - default storage for all collected data
- Graph structure with nodes and edges enables efficient relationship queries
- Individual node files in `.context/nodes/` for granular access
- Committed to git for versioning and collaboration
- Excellent git diffs and merge conflict resolution
- Works with GitHub/GitLab web interfaces
- Easy to query and process programmatically with graph structure
- All data stays within organization (self-hosted Git, no external services)

**Optional Enhancement**: GraphQL SDL for Schema
- Use `.context/schema.graphql` to define schema (human-readable)
- Data remains in JSON Graph format (efficient)
- Schema serves as documentation and validation contract

**Performance Enhancement** (Optional):
- Embedded file-based databases (Kuzu, SQLite) can sync from JSON Graph for query performance
- Graph format remains source of truth in Git
- Database files stored in `.context/` directory, committed to Git
- Can be rebuilt from JSON Graph at any time

This approach provides the best balance of git-friendliness, graph-native storage, queryability, and collaboration, with all data staying within the organization.
