# Agent API Design

This document describes the API for agents to discover and consume context from the context store.

## Overview

The Agent API provides a comprehensive interface for:
- **Discovery**: Finding relevant context by type, status, keyword, relationships
- **Consumption**: Reading context with clear distinction between accepted truth and proposals
- **Safety**: Default to accepted nodes only, explicit opt-in for proposals
- **Graph Queries**: Traverse relationships and find connected nodes

## Core Discovery API

### 1. Query Nodes by Type, Status, and Keyword

```typescript
// Basic query with type, status, and keyword
const results = await store.queryNodes({
  type: ["decision", "goal"],           // Filter by node types
  status: ["accepted"],                 // Filter by status (default: accepted only)
  search: "TypeScript",                  // Keyword search across content
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
    fields: ["content", "decision", "rationale"], // Search in specific fields
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
    fields: ["content", "decision", "rationale", "mitigation"],
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
    fields: ["content", "mitigation"],
    operator: "OR"
  },
  createdAfter: "2026-01-01",
  sortBy: "modifiedAt",
  sortOrder: "desc",
  limit: 50,
  offset: 0
});
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

## Future Enhancements

- GraphQL API for flexible querying
- REST API endpoint for HTTP access
- WebSocket API for real-time updates
- Query result caching and optimization
- Advanced graph algorithms (shortest path, centrality, etc.)
