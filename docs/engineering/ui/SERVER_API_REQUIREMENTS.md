# Server API Requirements for TruthLayer IDE

This document is a detailed gap analysis of the Rust server API as required by the TruthLayer IDE extensions. It covers the current API surface, identifies gaps per extension, and specifies the fixes and additions needed before UI work can begin.

See `docs/engineering/ui/UI_ENGINEERING_PLAN.md` for the master engineering plan and dependency ordering.

---

## 1. Current API Surface

### Endpoints

| Method | Path | Params/Body | Response | Role | Status |
| --- | --- | --- | --- | --- | --- |
| GET | `/health` | - | `{ status: "ok" }` | None | Implemented |
| GET | `/nodes` | `?status=&limit=&offset=` | `{ nodes, total, limit, offset, hasMore }` | Reader | Partial (limited filters) |
| GET | `/nodes/:id` | Path: `id` (or `namespace:id`) | `ContextNode` or redacted node | Reader | Implemented |
| GET | `/nodes/:id/provenance` | Path: `id` | `{ resourceId, events: AuditEvent[] }` | Reader | Implemented |
| GET | `/proposals` | `?limit=&offset=` | `{ proposals, total, limit, offset, hasMore }` | Reader | Partial (open only) |
| GET | `/proposals/:id` | Path: `id` | `Proposal` | Reader | Implemented |
| GET | `/proposals/:id/reviews` | Path: `id` | `Review[]` | Reader | Implemented |
| POST | `/proposals` | Body: `Proposal` | `Proposal` | Contributor | Implemented |
| PATCH | `/proposals/:id` | Body: partial `Proposal` | `Proposal` | Contributor | Implemented |
| POST | `/proposals/:id/review` | Body: `Review` | `Review` | Reviewer (human only) | Implemented |
| POST | `/proposals/:id/apply` | Body: `{ appliedBy? }` | `Proposal` (applied) | Applier (human only) | Implemented |
| POST | `/proposals/:id/withdraw` | - | `Proposal` (withdrawn) | Contributor (author) | Implemented |
| POST | `/reset` | - | `{ status: "reset" }` | Admin | Implemented |
| GET | `/audit` | `?actor=&action=&resource_id=&from=&to=&limit=&offset=` | `AuditEvent[]` | Admin | Implemented |
| GET | `/audit/export` | `?format=json|csv` | File download | Admin | Implemented |
| GET | `/admin/dsar/export` | `?subject=` | `{ subject, auditEvents }` | Admin | Implemented |
| POST | `/admin/dsar/erase` | Body: `{ subject }` | Audit event (stub) | Admin | Implemented (stub) |

### Authentication

- **Mechanism**: JWT (HS256) via `Authorization: Bearer <token>`
- **Claims**: `sub` (actor ID), `actor_type` ("human" | "agent" | "system"), `roles` (string array), `exp` (Unix timestamp)
- **Env vars**: `AUTH_DISABLED` (bypass auth for dev), `AUTH_SECRET` (shared secret)
- **RBAC hierarchy**: Reader < Contributor < Reviewer < Applier < Admin
- **Agent restrictions**: `reject_agent()` blocks agents from review and apply endpoints

---

## 2. Type Serialization Bugs

The following Rust types are **missing** `#[serde(rename_all = "camelCase")]`, causing snake_case JSON keys that don't match TS type definitions.

### Comment (server/src/types/mod.rs or proposal.rs)

```
Rust field          -> JSON key (current)  -> TS expects
created_at          -> created_at          -> createdAt
resolved_at         -> resolved_at         -> resolvedAt
resolved_by         -> resolved_by         -> resolvedBy
operation_id        -> operation_id        -> operationId
```

**Fix**: Add `#[serde(rename_all = "camelCase")]` to the `Comment` struct.

### CommentAnchor (server/src/types/mod.rs or proposal.rs)

```
Rust field          -> JSON key (current)  -> TS expects
node_id             -> node_id             -> nodeId
```

**Fix**: Add `#[serde(rename_all = "camelCase")]` to the `CommentAnchor` struct.

### RelationshipMetadata (server/src/types/mod.rs or node.rs)

```
Rust field          -> JSON key (current)  -> TS expects
created_at          -> created_at          -> createdAt
created_by          -> created_by          -> createdBy
```

**Fix**: Add `#[serde(rename_all = "camelCase")]` to the `RelationshipMetadata` struct.

**Task**: task-107

---

## 3. Gaps per Extension

### 3.1 `truthlayer.governance`

| Requirement | Current Status | Gap | Task |
| --- | --- | --- | --- |
| List proposals by status (open, accepted, rejected, withdrawn, applied) | `GET /proposals` returns open only | Add `status` query param | task-108 |
| Filter proposals by author | Not supported | Add `createdBy` query param | task-108 |
| Filter proposals by affected node types | Not supported | Add `nodeTypes` query param | task-108 |
| Filter proposals by tags | Not supported | Add `tags` query param | task-108 |
| Get proposal comments | Via `getProposal().comments` | Add `GET /proposals/:id/comments` | task-111 |
| Add proposal comment | Via `PATCH /proposals/:id` with `{ comments }` | Add `POST /proposals/:id/comments` | task-111 |
| Detect conflicts | Store has `detect_conflicts` but no HTTP route | Add `GET /proposals/:id/conflicts` | task-074 |
| Merge proposals | Store has `merge_proposals` but no HTTP route | Add `POST /proposals/merge` | task-074 |
| Stale proposal warning | Store has `is_proposal_stale` but no HTTP route | Return warning on review/apply | task-074 |
| Real-time updates | No push mechanism | SSE over HTTP/3 (no fallback): `GET /events?workspace={id}` SSE endpoint for proposal_updated, review_submitted, config_changed, audit_event. Reuses agent loop SSE infrastructure. | task-098 |

### 3.2 `truthlayer.ctx-language`

No server dependencies. All features work from local file parsing.

### 3.3 `truthlayer.ctx-preview`

No server dependencies. Extends Markdown preview rendering.

### 3.4 `truthlayer.audit`

| Requirement | Current Status | Gap | Task |
| --- | --- | --- | --- |
| Query audit events | `GET /audit` exists | No `RustServerClient` method | task-109 |
| Export audit log | `GET /audit/export` exists | No `RustServerClient` method | task-109 |
| View node provenance | `GET /nodes/:id/provenance` exists | No `RustServerClient` method | task-109 |
| DSAR export | `GET /admin/dsar/export` exists | No `RustServerClient` method | task-109 |
| DSAR erase | `POST /admin/dsar/erase` exists (stub) | No `RustServerClient` method | task-109 |

### 3.5 `truthlayer.config`

| Requirement | Current Status | Gap | Task |
| --- | --- | --- | --- |
| Read policy config | Not implemented | `GET /admin/config/policies` | task-097 |
| Update policy config | Not implemented | `PUT /admin/config/policies` | task-097 |
| Read retention config | Not implemented | `GET /admin/config/retention` | task-097 |
| Update retention config | Not implemented | `PUT /admin/config/retention` | task-097 |
| Read server config | Not implemented | `GET /admin/config/server` | task-097 |
| Hot-reload config | Not implemented | `POST /admin/config/reload` | task-097 |

All config extension features are blocked by task-097.

### 3.6 `truthlayer.agent` (Thin Client — Server-Side Agent Loop)

The agent extension follows the **Cursor-pattern architecture**: the extension is a thin chat client that renders streamed conversation events. The server runs the full agent loop — receiving user messages, building prompts, calling frontier models through the compliance gateway, executing tool calls in-process, and streaming the conversation back. The extension never calls frontier models directly.

| Requirement | Current Status | Gap | Task |
| --- | --- | --- | --- |
| **Server-side agent loop** (`POST /agent/chat` SSE stream) | Not implemented | Full agent loop: prompt building, compliance gateway, LLM call, tool execution, SSE streaming | **task-112** |
| **Workflow templates** (`GET /agent/templates`) | Not implemented | List available templates (Draft Proposal, Risk Assessment, etc.) | **task-112** |
| **Agent sessions** (`GET /agent/sessions`) | Not implemented | Active/recent session listing | **task-112** |
| Compliance gateway integration | Phase 8 (task-085 through task-094) | Agent loop must route all model calls through gateway | task-085 |
| Full node query (search, tags, relationships) | `GET /nodes` only supports status/limit/offset | Extend query params for richer agent context retrieval | task-073 |
| Provenance/reasoning chain traversal | No HTTP endpoints | Traversal APIs for explain/impact analysis workflows | Phase 4 |

**Critical dependency**: The server-side agent loop (task-112) is the convergence point of the Contextualize module (Phase 5) and AI Compliance Gateway (Phase 8). Basic agent functionality requires at minimum: model routing config (task-091), prompt inspection (task-087), response filtering (task-088), and external call audit logging (task-089). Advanced workflows (impact analysis, compliance check, explain decision) additionally require full NodeQuery (task-073) and traversal APIs.

---

## 4. Required Server Changes

### 4.1 Proposal Query Enhancement (task-108)

**Current**: `GET /proposals?limit=&offset=` returns only open proposals.

**Required**: `GET /proposals?status=&createdBy=&tags=&nodeTypes=&limit=&offset=`

| New Param | Type | Description |
| --- | --- | --- |
| `status` | string (comma-separated) | Filter by proposal status: `open`, `accepted`, `rejected`, `withdrawn`, `applied`. Default: all statuses. |
| `createdBy` | string | Filter by proposal author (actor ID) |
| `tags` | string (comma-separated) | Filter by proposal tags |
| `nodeTypes` | string (comma-separated) | Filter by node types affected by proposal operations |

**Implementation**: Update `query_proposals` in the `ContextStore` trait to accept these filters. Update `GET /proposals` route handler in `routes.rs` to parse and pass them. Both InMemoryStore and FileStore must implement the filter logic.

### 4.2 Dedicated Comments API (task-111)

**Current**: Comments are embedded in the `Proposal` object and modified via `PATCH /proposals/:id`.

**Required**:

| Method | Path | Body | Response | Role |
| --- | --- | --- | --- | --- |
| GET | `/proposals/:id/comments` | - | `Comment[]` | Reader |
| POST | `/proposals/:id/comments` | `{ author, content, anchor?, operationId? }` | `Comment` | Contributor |

**Rationale**: The governance extension needs to add and display comments independently of proposal updates. The current `PATCH` approach requires sending the full proposal object to add a single comment, which is error-prone and doesn't support concurrent comment additions.

### 4.3 Config Management API (task-097)

| Method | Path | Body | Response | Role |
| --- | --- | --- | --- | --- |
| GET | `/admin/config/policies` | - | `PolicyRule[]` | Admin |
| PUT | `/admin/config/policies` | `PolicyRule[]` | `PolicyRule[]` | Admin |
| GET | `/admin/config/retention` | - | `RetentionConfig` | Admin |
| PUT | `/admin/config/retention` | `RetentionConfig` | `RetentionConfig` | Admin |
| GET | `/admin/config/server` | - | `ServerConfig` (sensitive fields redacted) | Admin |
| POST | `/admin/config/reload` | - | `{ status: "reloaded" }` | Admin |

All config write endpoints must:
- Validate the new configuration before applying
- Record an audit event with the old and new configuration
- Apply the change without server restart (`reload` applies in-memory config updates)

### 4.4 TS Client Method Additions (task-109)

Methods to add to `RustServerClient` in `src/api-client.ts`:

```typescript
// Audit
queryAudit(params: AuditQueryParams): Promise<AuditEvent[]>
exportAudit(format: 'json' | 'csv'): Promise<Blob | string>

// Provenance
getProvenance(nodeId: string): Promise<ProvenanceResponse>

// DSAR
dsarExport(subject: string): Promise<DsarExportResponse>
dsarErase(subject: string): Promise<void>

// Config (after task-097)
getConfigPolicies(): Promise<PolicyRule[]>
updateConfigPolicies(rules: PolicyRule[]): Promise<PolicyRule[]>
getConfigRetention(): Promise<RetentionConfig>
updateConfigRetention(config: RetentionConfig): Promise<RetentionConfig>
getConfigServer(): Promise<ServerConfig>
reloadConfig(): Promise<void>
```

### 4.5 Server-Side Agent Loop Endpoints (task-112)

**Architecture**: The TruthLayer agent extension follows the Cursor-pattern: thin client in the IDE, server runs the agent loop. The extension sends user messages to the server, and the server handles all model interaction through the compliance gateway.

| Method | Path | Body | Response | Role |
| --- | --- | --- | --- | --- |
| POST | `/agent/chat` | `{ message, conversationHistory?, template?, context? }` | SSE stream (see event types below) | Contributor |
| GET | `/agent/templates` | - | `AgentTemplate[]` | Reader |
| GET | `/agent/sessions` | `?limit=&offset=` | `AgentSession[]` | Reader (own sessions) / Admin (all) |

**`POST /agent/chat` SSE event types**:

| Event | Payload | Description |
| --- | --- | --- |
| `token` | `{ text: string }` | Incremental text token from model response |
| `tool_call` | `{ name, arguments, callId }` | Model is invoking a tool (display in chat) |
| `tool_result` | `{ callId, result }` | Tool execution result |
| `citation` | `{ nodeId, nodeType, title, verified: bool, reason?: string }` | Verified node reference for clickable link; `verified: false` if node doesn't exist or content doesn't support claim |
| `grounding` | `{ segmentIndex, tier: "grounded"\|"derived"\|"ungrounded"\|"contradicted", confidence: number, nodeIds?: string[], conflict?: string }` | Truth anchoring classification for a response segment (decision-037) |
| `grounding_summary` | `{ totalSegments, grounded, derived, ungrounded, contradicted, overallConfidence, citedNodes: string[], uncitedClaims: string[] }` | Aggregate grounding analysis for the complete turn |
| `confirm` | `{ action, payload, groundingTier?: string, citedNodes?: string[] }` | Request user confirmation (e.g. before creating proposal); includes grounding metadata so user sees how well-anchored the proposed action is |
| `error` | `{ message, code }` | Error during processing |
| `done` | `{ sessionId, tokenCount, groundingSummary?: GroundingSummary }` | Conversation turn complete; includes final grounding summary |

**Server-side agent loop flow**:
1. Receive user message + conversation history + optional workflow template
2. Retrieve relevant context from ContextStore (based on template or conversation)
3. Build prompt: system context + tool definitions + user message
4. Call configured frontier model **through compliance gateway** (task-085):
   - Prompt inspection: scan against sensitivity labels, redact content above threshold
   - EgressControl: enforce destination allowlist/denylist
   - Audit: log the outbound call (provider, model, prompt hash, sensitivity classification)
5. Receive model response through compliance gateway (response filtering, task-088)
6. If response contains tool calls: execute them in-process against ContextStore
7. If tool call is truth-changing (create_proposal): emit `confirm` event, wait for user confirmation
8. Feed tool results back to model (loop to step 4)
9. Stream all events to client as SSE
10. Log complete interaction in audit log (user identity, session ID, all events)

**Agent identity and restrictions**:
- Agent acts on behalf of the authenticated user but with `actor_type: "agent"` restrictions
- Cannot review or apply proposals (server rejects per question-035)
- Model configuration (allowed models, API keys, rate limits, cost caps) is server-side admin config (task-091)

**Implementation**: Builds on Contextualize module (Phase 5: retrieval, prompt building) and AI Compliance Gateway (Phase 8: interception, policy, audit). The agent loop engine is a new component in the Rust server that orchestrates the LLM call → tool execution → LLM callback cycle.

### 4.6 Redacted Node Type Support (task-110)

Add to TypeScript `AnyNode` type:

```typescript
// In src/types/node.ts or equivalent
interface RedactedNodeFields {
  redacted?: boolean;
  reason?: string;  // e.g. "sensitivity"
}

// AnyNode should extend or intersect with RedactedNodeFields
type AnyNode = BaseNodeFields & RedactedNodeFields & { ... };
```

The server sends redacted nodes when an agent's sensitivity level is below the node's sensitivity. Extensions must:
- Check `node.redacted` before rendering content fields
- Display a "Content redacted" placeholder with the reason
- Not attempt to access `content`, `description`, or other body fields on redacted nodes

---

## 5. Cross-References

| Document | Relevance |
| --- | --- |
| `docs/engineering/ui/UI_ENGINEERING_PLAN.md` | Master plan, dependency gates, extension specs |
| `docs/engineering/ui/EXTENSION_ARCHITECTURE.md` | Shared patterns, data flow, testing |
| `docs/core/UI_SPEC.md` | Required governance UI specification |
| `docs/core/AGENT_API.md` | Agent API contract, NodeQuery spec |
| `PLAN.md` Phase 9 | Task tracking |
| `server/src/api/routes.rs` | Current route implementations |
| `server/src/types/mod.rs` | Rust type definitions |
| `src/api-client.ts` | TypeScript client implementation |
| `src/types/` | TypeScript type definitions |
