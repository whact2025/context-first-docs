/**
 * Tests for OpenTelemetry client setup (tracing and metrics).
 * When OTEL_EXPORTER_OTLP_ENDPOINT is not set, init is no-op and injectTraceHeaders returns {}.
 */

import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
import {
  initTelemetry,
  injectTraceHeaders,
} from "../src/telemetry.js";

describe("telemetry", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    savedEnv.OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME;
  });

  afterEach(() => {
    if (savedEnv.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined) {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = savedEnv.OTEL_EXPORTER_OTLP_ENDPOINT;
    } else {
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    }
    if (savedEnv.OTEL_SERVICE_NAME !== undefined) {
      process.env.OTEL_SERVICE_NAME = savedEnv.OTEL_SERVICE_NAME;
    } else {
      delete process.env.OTEL_SERVICE_NAME;
    }
  });

  describe("initTelemetry", () => {
    it("resolves without throwing when OTEL_EXPORTER_OTLP_ENDPOINT is not set", async () => {
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
      await expect(initTelemetry()).resolves.toBeUndefined();
    });

    it("resolves when called multiple times (idempotent)", async () => {
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
      await initTelemetry();
      await expect(initTelemetry()).resolves.toBeUndefined();
    });
  });

  describe("injectTraceHeaders", () => {
    it("resolves to a plain object", async () => {
      const headers = await injectTraceHeaders();
      expect(headers).toBeDefined();
      expect(typeof headers).toBe("object");
      expect(Array.isArray(headers)).toBe(false);
    });

    it("resolves to a record with string keys and string values (suitable for fetch headers)", async () => {
      const headers = await injectTraceHeaders();
      for (const [k, v] of Object.entries(headers)) {
        expect(typeof k).toBe("string");
        expect(typeof v).toBe("string");
      }
      // When OTEL_EXPORTER_OTLP_ENDPOINT was unset at process start, headers is {}
      expect(Object.keys(headers).every((k) => typeof headers[k] === "string")).toBe(true);
    });
  });
});
