/**
 * OpenTelemetry setup for correlated tracing and metrics (client → server).
 * Configurable endpoint: Azure Monitor, Grafana, or any OTLP backend.
 *
 * Env:
 * - OTEL_EXPORTER_OTLP_ENDPOINT: OTLP HTTP base endpoint (traces → /v1/traces, metrics → /v1/metrics).
 * - OTEL_SERVICE_NAME: Service name for the client (default: truthlayer-client).
 *
 * When OTEL_EXPORTER_OTLP_ENDPOINT is not set, tracing and metrics are no-op.
 */

const OTEL_ENDPOINT =
  typeof process !== "undefined" ? process.env.OTEL_EXPORTER_OTLP_ENDPOINT : undefined;
const OTEL_SERVICE_NAME =
  (typeof process !== "undefined" ? process.env.OTEL_SERVICE_NAME : undefined) ?? "truthlayer-client";

let initialized = false;

function metricsUrl(): string | undefined {
  if (!OTEL_ENDPOINT) return undefined;
  const base = OTEL_ENDPOINT.trim().replace(/\/$/, "");
  return base.endsWith("/v1/metrics") ? base : `${base}/v1/metrics`;
}

/**
 * Initialize OpenTelemetry tracer, meter provider, and global propagator (W3C Trace Context).
 * Safe to call multiple times. No-op if OTEL_EXPORTER_OTLP_ENDPOINT is not set.
 */
export async function initTelemetry(): Promise<void> {
  if (initialized || !OTEL_ENDPOINT) return;
  try {
    const api = await import("@opentelemetry/api");
    const { NodeTracerProvider } = await import("@opentelemetry/sdk-trace-node");
    const { BatchSpanProcessor } = await import("@opentelemetry/sdk-trace-base");
    const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
    const { resourceFromAttributes } = await import("@opentelemetry/resources");
    const { ATTR_SERVICE_NAME } = await import("@opentelemetry/semantic-conventions");
    const { W3CTraceContextPropagator } = await import("@opentelemetry/core");

    const resource = resourceFromAttributes({ [ATTR_SERVICE_NAME]: OTEL_SERVICE_NAME });

    const tracerProvider = new NodeTracerProvider({
      resource,
      spanProcessors: [
        new BatchSpanProcessor(new OTLPTraceExporter({ url: OTEL_ENDPOINT })),
      ],
    });
    tracerProvider.register();
    api.trace.setGlobalTracerProvider(tracerProvider);
    api.propagation.setGlobalPropagator(new W3CTraceContextPropagator());

    const url = metricsUrl();
    if (url) {
      const { MeterProvider, PeriodicExportingMetricReader } = await import(
        "@opentelemetry/sdk-metrics"
      );
      const { OTLPMetricExporter } = (await import(
        "@opentelemetry/exporter-metrics-otlp-http"
      )) as { OTLPMetricExporter: new (opts: { url: string }) => import("@opentelemetry/sdk-metrics").PushMetricExporter };
      const meterProvider = new MeterProvider({
        resource,
        readers: [
          new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({ url }),
            exportIntervalMillis: 60_000,
          }),
        ],
      });
      api.metrics.setGlobalMeterProvider(meterProvider);
    }

    initialized = true;
  } catch {
    // Optional dependency or misconfiguration; tracing disabled
  }
}

/**
 * Inject W3C trace context into a headers-like object for outgoing HTTP requests.
 * Call this and merge the result into fetch() headers so the server can continue the trace.
 * Returns {} if OTEL is not initialized (no-op).
 */
export async function injectTraceHeaders(): Promise<Record<string, string>> {
  if (!OTEL_ENDPOINT) return {};
  try {
    const api = await import("@opentelemetry/api");
    const carrier: Record<string, string> = {};
    api.propagation.inject(api.context.active(), carrier);
    return carrier;
  } catch {
    return {};
  }
}
