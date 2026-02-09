# OpenTelemetry (OTEL) logging and tracing

The TypeScript client and Rust server support **correlated distributed tracing** via OpenTelemetry. When configured, the client injects W3C trace context (`traceparent`, `tracestate`) into every request; the server continues the same trace and exports spans to a configurable OTLP endpoint.

## Configurable endpoint

- **Environment variable:** `OTEL_EXPORTER_OTLP_ENDPOINT`
- **Scope:** Set for both the TS client and the Rust server so they send traces to the same backend.
- **Format:** Base URL without path (e.g. `https://ingestion.example.com` or `http://localhost:4318`). The client/server append `/v1/traces` for the trace endpoint when required by the exporter.

Optional:

- `OTEL_SERVICE_NAME` — Service name reported in telemetry (default: `truthlayer-client` for TS, `truthlayer-server` for Rust).
- **Rust server only:** `OTEL_CONSOLE_SPANS=true` — Print spans to stdout (for local dev). Can be used with or without `OTEL_EXPORTER_OTLP_ENDPOINT`.

## Azure deployments (Azure Monitor)

For Azure, send traces to **Azure Monitor Application Insights** or to an OTLP-capable agent that forwards to Azure Monitor.

### Option 1: Application Insights via connection string (recommended for Azure)

Application Insights is typically configured via **connection string**, not a raw OTLP URL. Two common patterns:

1. **Azure Container Apps (managed OTEL agent)**  
   Configure the environment’s OpenTelemetry agent to use Application Insights. The agent receives OTLP from your app and forwards to App Insights. Set the environment’s `appInsightsConfiguration.connectionString` and enable traces; the agent injects `OTEL_EXPORTER_OTLP_ENDPOINT` (and related vars) so your app can send OTLP to the agent. No need to set `OTEL_EXPORTER_OTLP_ENDPOINT` in the app if using the managed agent’s default behavior.

2. **Direct OTLP to an endpoint**  
   If you have an OTLP endpoint that accepts traces (e.g. OpenTelemetry Collector or a gateway that forwards to Application Insights), set:

   ```bash
   OTEL_EXPORTER_OTLP_ENDPOINT=https://your-otlp-endpoint
   ```

   For Azure Monitor ingestion, use the endpoint provided by your collector or Azure’s ingestion URL if you use one that speaks OTLP.

### Option 2: OpenTelemetry Collector in front of Application Insights

Run an OpenTelemetry Collector that exports to Application Insights. Point the app at the collector’s OTLP endpoint:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
```

## Grafana (and other OTLP backends)

For **Grafana Cloud** or a **self-hosted Grafana** OTLP endpoint:

1. In Grafana Cloud: create a stack and get the **OTLP** (or “OTLP Endpoint”) URL and any required headers (e.g. API key).
2. Set the base URL:

   ```bash
   OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-xxx.grafana.net
   ```

   If Grafana requires an API key, configure it per your OTLP client (e.g. via `OTEL_EXPORTER_OTLP_HEADERS` if your client supports it, or in the collector).

3. Self-hosted: use your Grafana Alloy / OTLP receiver URL (e.g. `http://alloy:4318`).

Other OTLP-compatible backends (e.g. Jaeger, Honeycomb, New Relic) work the same way: set `OTEL_EXPORTER_OTLP_ENDPOINT` to the base URL of the OTLP receiver.

## Console span exporter (Rust server, local dev)

Set **`OTEL_CONSOLE_SPANS=true`** (or `1`) to print spans to stdout. Useful when developing without an OTLP backend.

- Use **without** `OTEL_EXPORTER_OTLP_ENDPOINT`: spans only go to the console.
- Use **with** `OTEL_EXPORTER_OTLP_ENDPOINT`: spans go to both the console and the OTLP endpoint.

Example:

```bash
OTEL_CONSOLE_SPANS=true cargo run
```

## Behavior when not set

- If **neither** `OTEL_EXPORTER_OTLP_ENDPOINT` nor `OTEL_CONSOLE_SPANS` is set:
  - **TS client:** Does not register a tracer; `injectTraceHeaders()` returns an empty object (no trace headers).
  - **Rust server:** Does not init the OTEL pipeline or the trace-context layer; no export and no propagation.
- No extra dependencies or runtime cost when OTEL is disabled.

## Correlated traces (client → server)

1. **TS client** (`src/telemetry.ts`, `src/api-client.ts`): When the endpoint is set, the client creates a tracer and, for each HTTP call, starts a span (`HTTP GET`, `HTTP POST`, etc.) with attributes `http.method` and `http.url`, then injects W3C `traceparent`/`tracestate` from that span’s context into the request headers.
2. **Rust server** (`server/src/telemetry.rs`, `server/src/main.rs`): When OTEL is enabled, the server:
   - Builds an OTLP (and optionally console) trace pipeline and sets the global tracer provider.
   - Uses a Tower layer to extract `traceparent`/`tracestate` and set the OpenTelemetry context so server spans are children of the client trace.
   - Uses a second Tower layer to create one **request** span per HTTP request (name `request`, attributes `http.method`, `http.target`).
   - Uses `tracing-opentelemetry` so these `tracing` spans are exported as OTEL spans.

Result: one trace per request—client span (e.g. `HTTP GET`) → server span (`request`) with the same trace ID—visible in Azure Monitor, Grafana, or the console when `OTEL_CONSOLE_SPANS=true`.

## HTTP metrics (client and server)

When OTEL is enabled, both the TS client and the Rust server emit **standard HTTP metrics** to the same OTLP endpoint (metrics path `/v1/metrics`).

| Source | Metric name                    | Type          | Attributes                        | Description                  |
| ------ | ------------------------------ | ------------- | --------------------------------- | ---------------------------- |
| Client | `http.client.request.count`    | Counter       | `http.method`, `http.status_code` | Total outgoing HTTP requests |
| Client | `http.client.request.duration` | Histogram (s) | `http.method`, `http.status_code` | Request duration in seconds  |
| Server | `http.server.request.count`    | Counter       | `http.method`, `http.status_code` | Total incoming HTTP requests |
| Server | `http.server.request.duration` | Histogram (s) | `http.method`, `http.status_code` | Request duration in seconds  |

- **Client** (`src/telemetry.ts`, `src/api-client.ts`): A global `MeterProvider` is registered with OTLP (same base URL as traces, metrics at `/v1/metrics`). Each `fetchJson` call records count and duration after the response (or on failure with `http.status_code` 0 for network errors).
- **Server** (`server/src/telemetry.rs`): `HttpServerMetricsLayer` records count and duration per request. Metrics are exported via the same OTLP/metrics pipeline (and optionally to the console when console export is enabled).

Use these in dashboards for request rates, error rates (e.g. `status_code >= 400`), and latency percentiles.

## References

- [Azure: Collect and read OpenTelemetry data in Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/opentelemetry-agents)
- [Azure: Configure Azure Monitor OpenTelemetry](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-configuration)
- [Grafana: Send OTLP data](https://grafana.com/docs/grafana-cloud/connect-data/otlp/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
