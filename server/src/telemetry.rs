//! OpenTelemetry: OTLP trace export and W3C trace context propagation.
//! When OTEL_EXPORTER_OTLP_ENDPOINT is set, the server exports spans and continues
//! the trace from the TypeScript client (traceparent/tracestate headers).

use axum::http::HeaderMap;
use opentelemetry::propagation::{Extractor, TextMapPropagator};
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::propagation::TraceContextPropagator;
use std::{
    future::Future,
    pin::Pin,
    sync::OnceLock,
    task::{Context as TaskContext, Poll},
    time::Instant,
};
use tracing::Instrument;

/// W3C trace context propagator (traceparent, tracestate).
static W3C_PROPAGATOR: OnceLock<TraceContextPropagator> = OnceLock::new();

/// Extracts W3C trace headers from HTTP HeaderMap for propagation (opentelemetry 0.31 Extractor).
struct HeaderExtractor<'a> {
    traceparent: Option<std::borrow::Cow<'a, str>>,
    tracestate: Option<std::borrow::Cow<'a, str>>,
}

impl HeaderExtractor<'_> {
    fn from_headers(headers: &HeaderMap) -> HeaderExtractor<'_> {
        let traceparent = headers
            .get("traceparent")
            .and_then(|v| v.to_str().ok())
            .map(std::borrow::Cow::Borrowed);
        let tracestate = headers
            .get("tracestate")
            .and_then(|v| v.to_str().ok())
            .map(std::borrow::Cow::Borrowed);
        HeaderExtractor {
            traceparent,
            tracestate,
        }
    }
}

impl Extractor for HeaderExtractor<'_> {
    fn get(&self, key: &str) -> Option<&str> {
        match key {
            "traceparent" => self.traceparent.as_deref(),
            "tracestate" => self.tracestate.as_deref(),
            _ => None,
        }
    }

    fn keys(&self) -> Vec<&str> {
        let mut v = Vec::with_capacity(2);
        if self.traceparent.is_some() {
            v.push("traceparent");
        }
        if self.tracestate.is_some() {
            v.push("tracestate");
        }
        v
    }
}

/// Tower layer that extracts W3C trace context from request headers and sets it as current
/// OpenTelemetry context so server spans become children of the client trace.
#[derive(Clone, Default)]
pub struct TraceContextLayer;

impl<S> tower::Layer<S> for TraceContextLayer {
    type Service = TraceContextService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        TraceContextService { inner }
    }
}

/// Wraps a future and attaches the given OpenTelemetry context at each poll, so the context
/// is visible during execution without holding a !Send guard across await.
struct WithOtelContext<F> {
    inner: Pin<Box<F>>,
    otel_cx: opentelemetry::Context,
}

impl<F, T, E> Future for WithOtelContext<F>
where
    F: Future<Output = Result<T, E>>,
{
    type Output = Result<T, E>;

    fn poll(mut self: Pin<&mut Self>, cx: &mut TaskContext<'_>) -> Poll<Self::Output> {
        let _guard = self.otel_cx.clone().attach();
        self.inner.as_mut().poll(cx)
    }
}

/// Service that wraps an inner service and attaches extracted trace context to the request.
#[derive(Clone)]
pub struct TraceContextService<S> {
    inner: S,
}

impl<S, ReqBody, ResBody> tower::Service<axum::http::Request<ReqBody>> for TraceContextService<S>
where
    S: tower::Service<axum::http::Request<ReqBody>, Response = axum::http::Response<ResBody>>
        + Clone
        + Send
        + 'static,
    S::Future: Send + 'static,
    ReqBody: Send + 'static,
    ResBody: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = std::pin::Pin<
        Box<dyn std::future::Future<Output = Result<Self::Response, Self::Error>> + Send>,
    >;

    fn poll_ready(
        &mut self,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: axum::http::Request<ReqBody>) -> Self::Future {
        let propagator = W3C_PROPAGATOR.get_or_init(TraceContextPropagator::new);
        let extractor = HeaderExtractor::from_headers(req.headers());
        let parent_cx = opentelemetry::Context::current();
        let otel_cx = propagator.extract_with_context(&parent_cx, &extractor);

        let inner_future = self.inner.call(req);
        Box::pin(WithOtelContext {
            inner: Box::pin(inner_future),
            otel_cx,
        })
    }
}

/// Tower layer that creates one tracing span per request (name "request", attributes http.method, http.target).
/// Export via tracing-opentelemetry so client→server trace is visible. Apply when OTEL is enabled (after TraceContextLayer).
#[derive(Clone, Default)]
pub struct RequestSpanLayer;

impl<S> tower::Layer<S> for RequestSpanLayer {
    type Service = RequestSpanService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        RequestSpanService { inner }
    }
}

/// Service that wraps each request in a tracing span.
#[derive(Clone)]
pub struct RequestSpanService<S> {
    inner: S,
}

impl<S, ReqBody, ResBody> tower::Service<axum::http::Request<ReqBody>> for RequestSpanService<S>
where
    S: tower::Service<axum::http::Request<ReqBody>, Response = axum::http::Response<ResBody>>
        + Clone
        + Send
        + 'static,
    S::Future: Send + 'static,
    ReqBody: Send + 'static,
    ResBody: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(
        &mut self,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: axum::http::Request<ReqBody>) -> Self::Future {
        let method = req.method().to_string();
        let target = req.uri().path().to_string();
        let span = tracing::info_span!(
            "request",
            http.method = %method,
            http.target = %target,
        );
        let fut = self.inner.call(req);
        Box::pin(fut.instrument(span))
    }
}

/// Tower layer that records standard HTTP server metrics: request count and duration (by method and status).
/// Uses OpenTelemetry metric names: http.server.request.duration (s), http.server.request.count.
#[derive(Clone, Default)]
pub struct HttpServerMetricsLayer;

impl<S> tower::Layer<S> for HttpServerMetricsLayer {
    type Service = HttpServerMetricsService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        HttpServerMetricsService { inner }
    }
}

/// Future that records HTTP server metrics when the inner response is ready.
struct RecordServerMetrics<F> {
    inner: Pin<Box<F>>,
    method: String,
    start: Instant,
    done: bool,
}

impl<F, ResBody, E> Future for RecordServerMetrics<F>
where
    F: Future<Output = Result<axum::http::Response<ResBody>, E>>,
{
    type Output = F::Output;

    fn poll(mut self: Pin<&mut Self>, cx: &mut TaskContext<'_>) -> Poll<Self::Output> {
        if self.done {
            return Poll::Pending;
        }
        match self.inner.as_mut().poll(cx) {
            Poll::Ready(Ok(res)) => {
                self.done = true;
                let status = res.status().as_u16();
                let duration_secs = self.start.elapsed().as_secs_f64();
                let meter = opentelemetry::global::meter("truthlayer-server");
                let attrs = [
                    opentelemetry::KeyValue::new("http.method", self.method.clone()),
                    opentelemetry::KeyValue::new("http.status_code", status as i64),
                ];
                let counter = meter.u64_counter("http.server.request.count").build();
                counter.add(1, &attrs);
                let histogram = meter
                    .f64_histogram("http.server.request.duration")
                    .with_unit("s")
                    .build();
                histogram.record(duration_secs, &attrs);
                Poll::Ready(Ok(res))
            }
            Poll::Ready(Err(e)) => {
                self.done = true;
                let status = 0i64; // error, no status
                let duration_secs = self.start.elapsed().as_secs_f64();
                let meter = opentelemetry::global::meter("truthlayer-server");
                let attrs = [
                    opentelemetry::KeyValue::new("http.method", self.method.clone()),
                    opentelemetry::KeyValue::new("http.status_code", status),
                ];
                let counter = meter.u64_counter("http.server.request.count").build();
                counter.add(1, &attrs);
                let histogram = meter
                    .f64_histogram("http.server.request.duration")
                    .with_unit("s")
                    .build();
                histogram.record(duration_secs, &attrs);
                Poll::Ready(Err(e))
            }
            Poll::Pending => Poll::Pending,
        }
    }
}

/// Service that records HTTP server metrics per request.
#[derive(Clone)]
pub struct HttpServerMetricsService<S> {
    inner: S,
}

impl<S, ReqBody, ResBody> tower::Service<axum::http::Request<ReqBody>>
    for HttpServerMetricsService<S>
where
    S: tower::Service<axum::http::Request<ReqBody>, Response = axum::http::Response<ResBody>>
        + Clone
        + Send
        + 'static,
    S::Future: Send + 'static,
    ReqBody: Send + 'static,
    ResBody: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(
        &mut self,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: axum::http::Request<ReqBody>) -> Self::Future {
        let method = req.method().to_string();
        let start = Instant::now();
        let fut = self.inner.call(req);
        Box::pin(RecordServerMetrics {
            inner: Box::pin(fut),
            method,
            start,
            done: false,
        })
    }
}

/// Build trace pipeline (optional OTLP, optional console) and set global tracer provider.
/// Returns the SdkTracerProvider (caller must keep it alive for process lifetime).
/// - `otlp_endpoint`: when `Some`, export spans to this OTLP endpoint.
/// - `service_name`: overridden by OTEL_SERVICE_NAME (default: truthlayer-server).
/// - `enable_console`: when true, also print spans to stdout (for local dev; set OTEL_CONSOLE_SPANS=true).
pub fn init_tracer(
    otlp_endpoint: Option<&str>,
    service_name: Option<&str>,
    enable_console: bool,
) -> Result<opentelemetry_sdk::trace::SdkTracerProvider, Box<dyn std::error::Error + Send + Sync>> {
    let service_name = service_name
        .map(String::from)
        .or_else(|| std::env::var("OTEL_SERVICE_NAME").ok())
        .unwrap_or_else(|| "truthlayer-server".to_string());

    let resource = opentelemetry_sdk::Resource::builder_empty()
        .with_attributes([opentelemetry::KeyValue::new("service.name", service_name)])
        .build();

    let mut builder =
        opentelemetry_sdk::trace::SdkTracerProvider::builder().with_resource(resource);

    if enable_console {
        builder = builder.with_simple_exporter(opentelemetry_stdout::SpanExporter::default());
    }

    if let Some(endpoint) = otlp_endpoint {
        let endpoint = endpoint.trim().trim_end_matches('/');
        let endpoint = if endpoint.ends_with("/v1/traces") {
            endpoint.to_string()
        } else {
            format!("{}/v1/traces", endpoint)
        };
        let otlp_exporter = opentelemetry_otlp::SpanExporter::builder()
            .with_http()
            .with_endpoint(&endpoint)
            .with_protocol(opentelemetry_otlp::Protocol::HttpBinary)
            .build()
            .map_err(|e| format!("OTLP exporter: {}", e))?;
        builder = builder.with_batch_exporter(otlp_exporter);
    }

    let tracer_provider = builder.build();

    opentelemetry::global::set_tracer_provider(tracer_provider.clone());
    opentelemetry::global::set_text_map_propagator(TraceContextPropagator::new());

    Ok(tracer_provider)
}

/// Build metrics pipeline (optional OTLP, optional console) and set global meter provider.
/// Uses same OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_CONSOLE_SPANS as tracing; metrics go to /v1/metrics.
pub fn init_meter_provider(
    otlp_endpoint: Option<&str>,
    service_name: Option<&str>,
    enable_console: bool,
) -> Result<opentelemetry_sdk::metrics::SdkMeterProvider, Box<dyn std::error::Error + Send + Sync>>
{
    let service_name = service_name
        .map(String::from)
        .or_else(|| std::env::var("OTEL_SERVICE_NAME").ok())
        .unwrap_or_else(|| "truthlayer-server".to_string());

    let resource = opentelemetry_sdk::Resource::builder_empty()
        .with_attributes([opentelemetry::KeyValue::new("service.name", service_name)])
        .build();

    let mut builder =
        opentelemetry_sdk::metrics::SdkMeterProvider::builder().with_resource(resource);

    if enable_console {
        builder = builder.with_periodic_exporter(opentelemetry_stdout::MetricExporter::default());
    }

    if let Some(endpoint) = otlp_endpoint {
        let endpoint = endpoint.trim().trim_end_matches('/');
        let metrics_endpoint = if endpoint.ends_with("/v1/metrics") {
            endpoint.to_string()
        } else if endpoint.ends_with("/v1/traces") {
            endpoint.replace("/v1/traces", "/v1/metrics")
        } else {
            format!("{}/v1/metrics", endpoint)
        };
        let otlp_exporter = opentelemetry_otlp::MetricExporter::builder()
            .with_http()
            .with_endpoint(&metrics_endpoint)
            .with_protocol(opentelemetry_otlp::Protocol::HttpBinary)
            .build()
            .map_err(|e| format!("OTLP metrics exporter: {}", e))?;
        builder = builder.with_periodic_exporter(otlp_exporter);
    }

    let meter_provider = builder.build();
    opentelemetry::global::set_meter_provider(meter_provider.clone());

    Ok(meter_provider)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, Response, StatusCode};
    use std::future::Future;
    use std::pin::Pin;
    use std::task::{Context, Poll};
    use tower::Layer;

    #[test]
    fn init_tracer_without_endpoint_succeeds() {
        // No OTLP endpoint: only resource and optional console; no network.
        let result = init_tracer(None, Some("test-service"), false);
        assert!(result.is_ok());
    }

    #[test]
    fn init_meter_provider_without_endpoint_succeeds() {
        // No OTLP endpoint: only resource and optional console; no network.
        let result = init_meter_provider(None, Some("test-service"), false);
        assert!(result.is_ok());
    }

    /// Minimal service that returns 200 OK. Returns a Send future so layer tests work.
    #[derive(Clone)]
    struct OkService;

    impl tower::Service<Request<Body>> for OkService {
        type Response = Response<Body>;
        type Error = std::convert::Infallible;
        type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

        fn poll_ready(&mut self, _cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
            Poll::Ready(Ok(()))
        }

        fn call(&mut self, _req: Request<Body>) -> Self::Future {
            Box::pin(async move {
                Ok(Response::builder()
                    .status(StatusCode::OK)
                    .body(Body::empty())
                    .unwrap())
            })
        }
    }

    async fn oneshot<S, Req>(mut svc: S, req: Req) -> S::Response
    where
        S: tower::Service<Req>,
        S::Future: Send,
        S::Error: std::fmt::Debug,
    {
        tower::util::ServiceExt::ready(&mut svc)
            .await
            .unwrap()
            .call(req)
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn trace_context_layer_extracts_headers_and_returns_inner_response() {
        let svc = TraceContextLayer.layer(OkService);
        let req = Request::builder()
            .uri("/test")
            .header(
                "traceparent",
                "00-0af7651916cd43dd8448eb211c80319c-b9c7c989f97918e1-01",
            )
            .body(Body::empty())
            .unwrap();
        let res = oneshot(svc, req).await;
        assert_eq!(res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn trace_context_layer_works_without_trace_headers() {
        let svc = TraceContextLayer.layer(OkService);
        let req = Request::builder().uri("/test").body(Body::empty()).unwrap();
        let res = oneshot(svc, req).await;
        assert_eq!(res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn request_span_layer_wraps_request_and_returns_inner_response() {
        let svc = RequestSpanLayer.layer(OkService);
        let req = Request::builder()
            .uri("/nodes")
            .method("GET")
            .body(Body::empty())
            .unwrap();
        let res = oneshot(svc, req).await;
        assert_eq!(res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn http_server_metrics_layer_returns_inner_response() {
        let svc = HttpServerMetricsLayer.layer(OkService);
        let req = Request::builder()
            .uri("/health")
            .method("GET")
            .body(Body::empty())
            .unwrap();
        let res = oneshot(svc, req).await;
        assert_eq!(res.status(), StatusCode::OK);
    }
}
