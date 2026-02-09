#!/usr/bin/env node
/**
 * Runs integration tests with the Rust server started automatically.
 * Spawns the server, waits for /health, runs Jest for api-client.integration tests, then kills the server.
 *
 * Usage: node scripts/run-integration-with-server.mjs
 * Or: npm run test:integration:with-server
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const serverDir = path.join(rootDir, "server");
const BASE = "http://127.0.0.1:3080";
const HEALTH_TIMEOUT_MS = 30000;
const HEALTH_POLL_MS = 500;

async function waitForHealth() {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/health`, {
        headers: { Accept: "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.status === "ok") return true;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, HEALTH_POLL_MS));
  }
  return false;
}

function killServer(child) {
  if (!child || !child.pid) return;
  try {
    child.kill("SIGTERM");
  } catch {
    // ignore
  }
  if (process.platform === "win32") {
    try {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        shell: true,
      });
    } catch {
      // ignore
    }
  } else {
    try {
      child.kill("SIGKILL");
    } catch {
      // ignore
    }
  }
}

async function main() {
  console.log("Starting Rust server (in-memory store)...");
  const serverProcess = spawn("cargo", ["run"], {
    cwd: serverDir,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  serverProcess.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  serverProcess.stdout?.on("data", (chunk) => {
    // optional: log first few lines to help debug
  });

  const ready = await waitForHealth();
  if (!ready) {
    killServer(serverProcess);
    console.error("Server did not become ready in time. Stderr:\n", stderr.slice(-2000));
    process.exit(1);
  }
  console.log("Server ready at", BASE);

  let jestExitCode = 1;
  try {
    const jest = spawn(
      "node",
      [
        "--experimental-vm-modules",
        path.join(rootDir, "node_modules", "jest", "bin", "jest.js"),
        "--testPathPattern=api-client.integration",
      ],
      {
        cwd: rootDir,
        stdio: "inherit",
        env: { ...process.env, TRUTHTLAYER_SERVER_URL: BASE },
      }
    );
    jestExitCode = await new Promise((resolve) => {
      jest.on("exit", (code) => resolve(code ?? 1));
    });
  } finally {
    console.log("Stopping server...");
    killServer(serverProcess);
    await new Promise((r) => setTimeout(r, 500));
  }

  process.exit(jestExitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
