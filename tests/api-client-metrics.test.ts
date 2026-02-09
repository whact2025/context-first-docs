/**
 * Tests that the API client records HTTP client metrics (count + duration) with
 * expected names and attributes. Uses a mocked @opentelemetry/api metrics API
 * so we can assert add/record were called.
 */

import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";

const mockAdd = jest.fn<() => void>();
const mockRecord = jest.fn<() => void>();

beforeAll(async () => {
  await jest.unstable_mockModule("@opentelemetry/api", () => {
    const actual = jest.requireActual("@opentelemetry/api") as typeof import("@opentelemetry/api");
    return {
      ...actual,
      metrics: {
        getMeter: (_name: string, _version?: string) => ({
          createCounter: (_n: string, _opts?: unknown) => ({ add: mockAdd }),
          createHistogram: (_n: string, _opts?: unknown) => ({ record: mockRecord }),
        }),
      },
    };
  });
});

describe("API client HTTP metrics", () => {
  let RustServerClient: typeof import("../src/api-client.js").RustServerClient;
  let fetchSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(async () => {
    jest.resetModules();
    const mod = await import("../src/api-client.js");
    RustServerClient = mod.RustServerClient;
    fetchSpy = jest.spyOn(globalThis, "fetch");
    mockAdd.mockClear();
    mockRecord.mockClear();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("records http.client.request.count and duration on successful request", async () => {
    const client = new RustServerClient("http://127.0.0.1:3080");
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: { id: "n1" }, type: "goal", status: "accepted", content: "x", metadata: {} }),
    } as Response);

    await client.getNode({ id: "n1" });

    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith(1, { "http.method": "GET", "http.status_code": 200 });
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord).toHaveBeenCalledWith(
      expect.any(Number),
      { "http.method": "GET", "http.status_code": 200 }
    );
  });

  it("records metrics once on HTTP error response (no double-record)", async () => {
    const client = new RustServerClient("http://127.0.0.1:3080");
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.resolve({ error: "server error" }),
    } as Response);

    await expect(client.getNode({ id: "any" })).rejects.toThrow();

    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith(1, { "http.method": "GET", "http.status_code": 500 });
    expect(mockRecord).toHaveBeenCalledTimes(1);
  });
});
