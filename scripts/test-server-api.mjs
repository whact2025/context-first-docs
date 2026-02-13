#!/usr/bin/env node
/**
 * Smoke test for the TruthLayer server REST API.
 * Usage: node scripts/test-server-api.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:3080
 * Exit 0 if all checks pass, 1 otherwise.
 *
 * Note: the server must be started with TRUTHTLAYER_DEV_TCP=true for this
 * script to work, since Node.js fetch() uses TCP and the production server
 * only speaks HTTP/3 (QUIC).
 */

const base = process.argv[2] || 'http://127.0.0.1:3080';

async function get(path) {
  const url = `${base.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  const checks = [];

  // GET /health
  try {
    const { ok, status, body } = await get('/health');
    checks.push({
      name: 'GET /health',
      pass: ok && (body?.status === 'ok' || status === 200),
      detail: status,
    });
  } catch (e) {
    checks.push({ name: 'GET /health', pass: false, detail: e.message });
  }

  // GET /nodes (default query)
  try {
    const { ok, status, body } = await get('/nodes');
    const hasNodes = Array.isArray(body?.nodes) || (body?.nodes && typeof body.nodes === 'object');
    checks.push({
      name: 'GET /nodes',
      pass: ok && (body?.nodes !== undefined || status === 200),
      detail: status,
    });
  } catch (e) {
    checks.push({ name: 'GET /nodes', pass: false, detail: e.message });
  }

  // GET /proposals (paginated: { proposals, total, limit, offset, hasMore })
  try {
    const { ok, status, body } = await get('/proposals');
    const hasProposals = Array.isArray(body?.proposals);
    checks.push({
      name: 'GET /proposals',
      pass: ok && hasProposals,
      detail: ok ? status : 'fail',
    });
  } catch (e) {
    checks.push({ name: 'GET /proposals', pass: false, detail: e.message });
  }

  const failed = checks.filter((c) => !c.pass);
  checks.forEach((c) => {
    console.log(c.pass ? 'ok' : 'FAIL', c.name, c.detail);
  });
  if (failed.length) {
    console.error(`\n${failed.length} check(s) failed`);
    process.exit(1);
  }
  console.log('\nAll API checks passed');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
