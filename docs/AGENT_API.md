# Agent API Design

This document describes the API for agents to discover and consume the **approved solution model** from the context store, and to collaborate safely by creating **proposals** (not direct edits).

## Overview

The Agent API provides a comprehensive interface for:
- **Discovery**: Finding relevant context by type, status, keyword, relationships
- **Consumption**: Reading context with clear distinction between accepted truth and proposals
- **Safety**: Default to accepted nodes only, explicit opt-in for proposals
- **Graph Queries**: Traverse relationships and find connected nodes

In ACAL terms: agents are contributors operating under review-mode governance. Their output is designed to be reviewable, commentable (including anchored feedback), and approve-able into truth.

### Review mode (writing is proposals)

Agents (and humans) do not directly mutate accepted nodes. They:

1. create proposals (`createProposal`)
2. wait for reviews (`submitReview`)
3. apply accepted proposals (`applyProposal`)

See `docs/REVIEW_MODE.md` for the invariant and allowed status transitions.

### Text fields (important for search)

- `description`: canonical long-form **Markdown** body (what humans author; what ctx blocks import/export)
- `content`: deterministic derived **plain-text index** (computed from `description` + key typed fields) used for keyword search/similarity/snippets
- `title`: optional short label (recommended for search and display)

## Core Discovery API

### 1. Query Nodes by Type, Status, and Keyword

```typescript
// Basic query with type, status, and keyword
const results = await store.queryNodes({
  type: ["decision", "goal"],           // Filter by node types
  status: ["accepted"],                 // Filter by status (default: accepted only)
  search: "TypeScript",                  // Keyword search (uses derived `content` index by default)
  limit: 50,                             // Pagination
  offset: 0                              // Pagination offset
});
```

### 2. Advanced Search Options

```typescript
// Advanced search with multiple criteria
const results = await store.queryNodes({
  type: ["decision"],
  status: ["accepted", "proposed"],      // Include both accepted and proposed
  search: {
    query: "TypeScript strict mode",     // Full-text search query
    fields: ["title", "content", "description", "decision", "rationale"], // Search in specific fields
    operator: "AND" | "OR"               // Search operator (default: AND)
  },
  tags: ["architecture", "typescript"],  // Filter by tags
  namespace: "frontend",                 // Filter by namespace
  createdBy: "alice",                    // Filter by creator
  createdAfter: "2026-01-01",           // Date range filtering
  createdBefore: "2026-12-31",
  sortBy: "createdAt",                   // Sort options
  sortOrder: "desc",                     // "asc" | "desc"
  limit: 20,
  offset: 0
});
```

### 3. Graph Traversal Queries

```typescript
// Find nodes related to a specific node
const related = await store.queryNodes({
  relatedTo: { id: "decision-001" },    // Find nodes related to this node
  relationshipTypes: ["depends-on", "implements"], // Filter by relationship types
  depth: 2,                              // Traversal depth (1 = direct, 2 = 2 hops, etc.)
  direction: "outgoing" | "incoming" | "both" // Traversal direction
});

// Find all descendants (hierarchical)
const descendants = await store.queryNodes({
  descendantsOf: { id: "goal-001" },    // Find all descendants
  relationshipType: "parent-child"       // Use parent-child relationships
});

// Find all dependencies
const dependencies = await store.queryNodes({
  dependenciesOf: { id: "task-005" },    // Find all dependencies
  relationshipType: "depends-on"
});
```

### 4. Relationship Queries

```typescript
// Find nodes with specific relationships
const results = await store.queryNodes({
  type: ["task"],
  hasRelationship: {
    type: "implements",                  // Must have this relationship type
    targetType: ["decision"]              // Target must be one of these types
  },
  status: ["accepted"]
});

// Find nodes that block or are blocked by others
const blocking = await store.queryNodes({
  type: ["risk", "task"],
  hasRelationship: {
    type: "blocks",
    direction: "outgoing"                 // Nodes that block others
  }
});
```

## API Reference

### `queryNodes(query: NodeQuery): Promise<NodeQueryResult>`

Query nodes with comprehensive filtering and search capabilities.

#### NodeQuery Interface

```typescript
export interface NodeQuery {
  // Type filtering
  type?: NodeType[];                     // Filter by node types
  
  // Status filtering (default: ["accepted"] for safety)
  status?: NodeStatus[];                 // Filter by status
  
  // Keyword/Full-text search
  search?: string | SearchOptions;       // Simple string or advanced search
  
  // Tag filtering
  tags?: string[];                       // Must have all specified tags
  
  // Namespace filtering
  namespace?: string;                    // Filter by namespace
  
  // Creator filtering
  createdBy?: string;                    // Filter by creator
  modifiedBy?: string;                   // Filter by last modifier
  
  // Date range filtering
  createdAfter?: string;                 // ISO date string
  createdBefore?: string;
  modifiedAfter?: string;
  modifiedBefore?: string;
  
  // Relationship filtering
  relatedTo?: NodeId;                    // Find nodes related to this node
  relationshipTypes?: RelationshipType[]; // Filter by relationship types
  depth?: number;                        // Traversal depth (default: 1)
  direction?: "outgoing" | "incoming" | "both";
  
  // Hierarchical queries
  descendantsOf?: NodeId;                // Find all descendants
  ancestorsOf?: NodeId;                  // Find all ancestors
  relationshipType?: RelationshipType;   // For hierarchical queries
  
  // Dependency queries
  dependenciesOf?: NodeId;               // Find all dependencies
  dependentsOf?: NodeId;                 // Find all dependents
  
  // Relationship existence
  hasRelationship?: {
    type?: RelationshipType;             // Must have this relationship type
    targetType?: NodeType[];             // Target must be one of these types
    direction?: "outgoing" | "incoming" | "both";
  };
  
  // Sorting
  sortBy?: "createdAt" | "modifiedAt" | "type" | "status" | "relevance";
  sortOrder?: "asc" | "desc";            // Default: "desc" for dates, "asc" for others
  
  // Pagination
  limit?: number;                        // Default: 50, max: 1000
  offset?: number;                       // Default: 0
}

export interface SearchOptions {
  query: string;                         // Search query string
  fields?: string[];                     // Fields to search (default: all text fields)
  operator?: "AND" | "OR";               // Search operator (default: "AND")
  fuzzy?: boolean;                       // Enable fuzzy matching (default: false)
  caseSensitive?: boolean;               // Case-sensitive search (default: false)
}

export interface NodeQueryResult {
  nodes: AnyNode[];                      // Matching nodes
  total: number;                         // Total count (before pagination)
  limit: number;                         // Applied limit
  offset: number;                        // Applied offset
  hasMore: boolean;                      // Whether more results exist
}
```

## Usage Examples

### Example 1: Find All Accepted Decisions About TypeScript

```typescript
const decisions = await store.queryNodes({
  type: ["decision"],
  status: ["accepted"],
  search: "TypeScript",
  sortBy: "createdAt",
  sortOrder: "desc"
});
```

### Example 2: Find All Open Proposals for Tasks

```typescript
const proposals = await store.queryNodes({
  type: ["task"],
  status: ["proposed"],                   // Explicitly include proposals
  sortBy: "createdAt",
  sortOrder: "desc"
});
```

### Example 3: Find All Tasks That Implement a Decision

```typescript
const tasks = await store.queryNodes({
  type: ["task"],
  status: ["accepted"],
  hasRelationship: {
    type: "implements",
    targetType: ["decision"],
    direction: "outgoing"
  }
});
```

### Example 4: Find All Dependencies of a Task

```typescript
const deps = await store.queryNodes({
  dependenciesOf: { id: "task-005" },
  relationshipType: "depends-on",
  status: ["accepted"]
});
```

### Example 5: Full-Text Search Across Multiple Fields

```typescript
const results = await store.queryNodes({
  search: {
    query: "authentication security",
    fields: ["title", "content", "description", "decision", "rationale", "mitigation"],
    operator: "AND"
  },
  status: ["accepted"],
  sortBy: "relevance",                   // Sort by search relevance
  limit: 20
});
```

### Example 6: Find Related Nodes (Graph Traversal)

```typescript
// Find all nodes related to a decision (2 hops deep)
const related = await store.queryNodes({
  relatedTo: { id: "decision-001" },
  relationshipTypes: ["depends-on", "implements", "references"],
  depth: 2,                              // 2 hops deep
  direction: "both",                     // Both incoming and outgoing
  status: ["accepted"]
});
```

### Example 7: Complex Query with Multiple Filters

```typescript
const results = await store.queryNodes({
  type: ["risk", "task"],
  status: ["accepted", "proposed"],
  tags: ["security", "authentication"],
  namespace: "backend",
  search: {
    query: "API key",
    fields: ["title", "content", "description", "mitigation"],
    operator: "OR"
  },
  createdAfter: "2026-01-01",
  sortBy: "modifiedAt",
  sortOrder: "desc",
  limit: 50,
  offset: 0
});
```

### Example 8: Chain-of-Thought Reasoning - Follow Decision Logic

```typescript
// Agent wants to understand why a decision was made
// Traverse: goal → decision → task → risk
const reasoning = await store.traverseReasoningChain(
  { id: "goal-001" },
  {
    path: [
      { relationshipType: "references", targetType: ["decision"] },
      { relationshipType: "implements", targetType: ["task"] },
      { relationshipType: "blocks", targetType: ["risk"] }
    ],
    accumulateContext: true,
    includeRationale: true
  }
);

// Agent can now reason:
// "Goal X led to Decision Y because [rationale]. 
//  This decision is implemented by Tasks A, B, C.
//  However, Risk Z blocks Task B, which means..."
```

### Example 9: Progressive Context Building

```typescript
// Agent starts with a task and builds full context
const context = await store.buildContextChain(
  { id: "task-005" },
  {
    relationshipSequence: ["implements", "depends-on", "references"],
    maxDepth: 2,
    includeReasoning: true,
    stopOn: ["risk", "constraint"],
    accumulate: true
  }
);

// Agent accumulates:
// - What decision this task implements
// - What goals that decision serves
// - What other tasks this depends on
// - What risks or constraints might block it
// All with reasoning at each step
```

### Example 10: Query with Chain-of-Thought

```typescript
// Agent queries for tasks, then follows reasoning chains
const results = await store.queryWithReasoning({
  query: {
    type: ["task"],
    status: ["accepted"],
    search: "authentication"
  },
  reasoning: {
    enabled: true,
    followRelationships: ["implements", "depends-on", "references"],
    includeRationale: true,
    buildChain: true,
    maxDepth: 2
  }
});

// Agent gets:
// - Direct results: tasks matching "authentication"
// - Reasoning chains: what decisions led to these tasks
// - Accumulated context: goals, risks, constraints discovered
// - Reasoning path: step-by-step logic for each chain
```

## Agent Safety Features

### Default Behavior: Accepted Only

By default, queries return only accepted nodes (truth):

```typescript
// This returns only accepted nodes
const nodes = await store.queryNodes({
  type: ["decision"]
});
// Equivalent to: status: ["accepted"]
```

### Explicit Opt-in for Proposals

To include proposals, explicitly specify:

```typescript
// Include proposals explicitly
const nodes = await store.queryNodes({
  type: ["decision"],
  status: ["accepted", "proposed"]      // Explicit opt-in
});
```

### Clear Status Indicators

All returned nodes include explicit status:

```typescript
const node = await store.getNode({ id: "decision-001" });
console.log(node.status);                // "accepted" | "proposed" | "rejected" | "superseded"
```

## Chain-of-Thought Traversal

Agents can traverse the graph following logical reasoning chains, building up context progressively as they reason about collected contexts.

### Reasoning Path Traversal

Follow logical chains of reasoning through the graph:

```typescript
// Traverse reasoning chain: goal → decision → task → risk
const reasoningChain = await store.traverseReasoningChain(
  { id: "goal-001" },
  {
    // Follow logical relationship sequence
    path: [
      { relationshipType: "references", targetType: ["decision"] },
      { relationshipType: "implements", targetType: ["task"] },
      { relationshipType: "blocks", targetType: ["risk"] }
    ],
    // Accumulate context as we traverse
    accumulateContext: true,
    // Include reasoning metadata
    includeRationale: true
  }
);

// Result includes:
// - nodes: Array of nodes in the reasoning chain
// - path: The actual path taken through the graph
// - accumulatedContext: Progressive context built up during traversal
// - reasoningSteps: Step-by-step reasoning with rationale
```

### Progressive Context Building

Build up context progressively as you traverse:

```typescript
// Start with a goal and build context chain
const contextChain = await store.buildContextChain(
  { id: "goal-001" },
  {
    // Follow these relationship types in order
    relationshipSequence: ["references", "implements", "depends-on"],
    // Maximum depth for each relationship type
    maxDepth: 3,
    // Include rationale and alternatives at each step
    includeReasoning: true,
    // Stop if we hit a risk or constraint
    stopOn: ["risk", "constraint"],
    // Accumulate context progressively
    accumulate: true
  }
);

// Result structure:
interface ContextChain {
  startNode: AnyNode;
  chains: ReasoningChain[];
  accumulatedContext: {
    goals: AnyNode[];
    decisions: AnyNode[];
    tasks: AnyNode[];
    risks: AnyNode[];
    constraints: AnyNode[];
  };
  reasoningPath: ReasoningStep[];
}

interface ReasoningStep {
  step: number;
  node: AnyNode;
  relationship: NodeRelationship;
  rationale?: string;        // Why this step is relevant
  alternatives?: AnyNode[]; // Alternative paths considered
  context: string;          // Context accumulated so far
}
```

### Follow Decision Reasoning

Follow the reasoning behind a decision:

```typescript
// Follow decision reasoning: what goal led to it, what alternatives were considered, what tasks implement it
const decisionReasoning = await store.followDecisionReasoning(
  { id: "decision-001" },
  {
    includeGoals: true,           // Include goals that led to this decision
    includeAlternatives: true,    // Include rejected alternatives
    includeImplementations: true, // Include tasks that implement it
    includeRisks: true,          // Include risks that affect it
    includeConstraints: true,     // Include constraints that apply
    depth: 2                      // How deep to traverse
  }
);
```

### Discover Related Reasoning

Discover logically related context even if not directly connected:

```typescript
// Find all context related to a topic through reasoning chains
const relatedReasoning = await store.discoverRelatedReasoning(
  { id: "decision-001" },
  {
    // Search for related context through multiple hops
    relationshipTypes: ["references", "depends-on", "implements", "blocks"],
    // Include nodes that share similar context
    includeSemanticallySimilar: true,
    // Build reasoning chain showing how they're related
    buildReasoningChain: true,
    // Maximum traversal depth
    maxDepth: 3
  }
);
```

### Chain-of-Thought Query

Query with chain-of-thought reasoning:

```typescript
// Query with reasoning chain
const results = await store.queryWithReasoning({
  // Start query
  query: {
    type: ["task"],
    status: ["accepted"],
    search: "authentication"
  },
  // Follow reasoning chains from results
  reasoning: {
    enabled: true,
    // Follow these relationship types
    followRelationships: ["implements", "depends-on", "references"],
    // Include rationale at each step
    includeRationale: true,
    // Build context chain
    buildChain: true,
    // Maximum depth
    maxDepth: 2
  }
});

// Result includes:
// - primaryResults: Direct query results
// - reasoningChains: Chains of reasoning from each result
// - accumulatedContext: All context discovered through reasoning
// - reasoningPath: Step-by-step reasoning for each chain
```

## Graph Query Capabilities

### Relationship Traversal

The API supports graph traversal queries:

```typescript
// Find path between two nodes
const path = await store.findPath(
  { id: "task-001" },
  { id: "goal-001" },
  { relationshipTypes: ["depends-on", "implements"] }
);

// Find all nodes in a subgraph
const subgraph = await store.getSubgraph(
  { id: "decision-001" },
  { depth: 3, relationshipTypes: ["depends-on", "references"] }
);
```

### Relationship Queries

```typescript
// Get all relationships for a node
const relationships = await store.getNodeRelationships({ id: "decision-001" });

// Get nodes connected by specific relationship type
const connected = await store.getConnectedNodes(
  { id: "decision-001" },
  "implements"
);
```

## Performance Considerations

- **Pagination**: Always use pagination for large result sets (default limit: 50)
- **Indexing**: Graph structure enables efficient relationship queries
- **Caching**: Consider caching frequently accessed queries
- **Search**: Full-text search may be slower on large datasets; use specific filters when possible

## Error Handling

```typescript
try {
  const results = await store.queryNodes({
    type: ["decision"],
    search: "TypeScript"
  });
} catch (error) {
  if (error instanceof QueryError) {
    console.error("Query error:", error.message);
  }
}
```

## Chain-of-Thought Reasoning Use Cases

### Use Case 1: Understanding Decision Rationale

```typescript
// Agent needs to understand why a decision was made
const decisionReasoning = await store.followDecisionReasoning(
  { id: "decision-001" },
  {
    includeGoals: true,        // What goal led to this?
    includeAlternatives: true,  // What alternatives were rejected?
    includeImplementations: true, // What tasks implement it?
    includeRisks: true,        // What risks affect it?
    includeConstraints: true   // What constraints apply?
  }
);

// Agent can now provide comprehensive reasoning:
// "Decision X was made to achieve Goal Y. 
//  Alternatives A and B were rejected because [rationale].
//  It's implemented by Tasks 1, 2, 3.
//  Risk Z might affect it, and Constraint C applies."
```

### Use Case 2: Impact Analysis

```typescript
// Agent needs to understand impact of changing a decision
const impact = await store.discoverRelatedReasoning(
  { id: "decision-001" },
  {
    relationshipTypes: ["implements", "depends-on", "references"],
    includeSemanticallySimilar: true,
    buildReasoningChain: true,
    maxDepth: 3
  }
);

// Agent discovers:
// - All tasks that implement this decision
// - All tasks that depend on those tasks
// - Related decisions that might be affected
// - Reasoning chains showing how they connect
```

### Use Case 3: Risk Assessment

```typescript
// Agent needs to assess risks for a goal
const riskAssessment = await store.traverseReasoningChain(
  { id: "goal-001" },
  {
    path: [
      { relationshipType: "references", targetType: ["decision"] },
      { relationshipType: "implements", targetType: ["task"] },
      { relationshipType: "blocks", targetType: ["risk"] }
    ],
    accumulateContext: true,
    includeRationale: true
  }
);

// Agent builds reasoning:
// "Goal X requires Decision Y, which is implemented by Tasks A, B, C.
//  Risk Z blocks Task B, which means Goal X might not be fully achieved.
//  Mitigation strategy M addresses Risk Z by..."
```

## Future Enhancements

- GraphQL API for flexible querying
- REST API endpoint for HTTP access
- WebSocket API for real-time updates
- Query result caching and optimization
- Advanced graph algorithms (shortest path, centrality, etc.)
- Machine learning for semantic similarity detection
- Reasoning path optimization and pruning
- Context summarization for long reasoning chains
