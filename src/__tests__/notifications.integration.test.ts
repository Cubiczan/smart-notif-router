/**
 * Integration tests for the critical notification path.
 *
 * Dependency-free: uses Node's built-in test runner (node:test) + assert, and
 * drives the real Express app over an ephemeral HTTP port with global fetch.
 * Run with:  npx tsx --test src/__tests__/notifications.integration.test.ts
 *
 * The test environment forces AI_ENABLED=false (exercises the heuristic
 * fallback router), sets a known API_KEY (auth), and uses a throwaway sqlite
 * file so runs are isolated.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';

const API_KEY = 'test-secret-token';
const DB_FILE = path.join(os.tmpdir(), `snr-test-${process.pid}-${Date.now()}.db`);

// Configure env BEFORE importing the app / db / config modules.
process.env.AI_ENABLED = 'false';
process.env.API_KEY = API_KEY;
process.env.DB_PATH = DB_FILE;

let server: http.Server;
let baseUrl: string;

before(async () => {
  const { initDatabase } = await import('../models/database');
  initDatabase();
  const { default: app } = await import('../app');
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const { closeDatabase } = await import('../models/database');
  closeDatabase();
  for (const f of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
});

const authHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${API_KEY}`,
};

test('API responses emit Helmet security headers', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(res.headers.get('x-dns-prefetch-control'), 'off');
  assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
  const csp = res.headers.get('content-security-policy');
  assert.ok(csp, 'Content-Security-Policy must be set');
  assert.match(csp, /default-src 'self'/);
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('POST /api/notifications without auth is rejected (401)', async () => {
  const res = await fetch(`${baseUrl}/api/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'no auth', message: 'should be blocked' }),
  });
  assert.equal(res.status, 401);
});

test('POST /api/notifications returns 201 and exercises the AI fallback', async () => {
  const res = await fetch(`${baseUrl}/api/notifications`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Routine update',
      message: 'Nightly backup completed successfully.',
      channel_override: ['email'], // email mock-sends without a real API key
    }),
  });
  assert.equal(res.status, 201);
  const json: any = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.data.notification.id);
  // AI disabled => heuristic fallback router produced the analysis.
  assert.equal(json.data.aiAnalysis.reasoning, 'Fallback heuristic routing (AI unavailable)');
});

test('a failed delivery sets status="failed"', async () => {
  // Force a webhook delivery to an unroutable URL so the attempt fails.
  const res = await fetch(`${baseUrl}/api/notifications`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Webhook to nowhere',
      message: 'This delivery should fail.',
      channel_override: ['webhook'],
      recipient: { webhook_url: 'http://127.0.0.1:1/never' },
    }),
  });
  assert.equal(res.status, 201);
  const json: any = await res.json();
  assert.equal(json.data.notification.status, 'failed');
  assert.equal(json.data.delivery[0].success, false);
});

test('retry endpoint reuses the id and APPENDS delivery logs', async () => {
  // Create a failing notification first.
  const createRes = await fetch(`${baseUrl}/api/notifications`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Retry me',
      message: 'first attempt fails',
      channel_override: ['webhook'],
      recipient: { webhook_url: 'http://127.0.0.1:1/never' },
    }),
  });
  const created: any = await createRes.json();
  const id = created.data.notification.id;
  assert.equal(created.data.notification.status, 'failed');

  // Inspect log count before retry.
  const beforeRes = await fetch(`${baseUrl}/api/notifications/${id}`);
  const before: any = await beforeRes.json();
  const logsBefore = before.data.delivery_logs.length;
  assert.ok(logsBefore >= 1);

  // Retry (auth-gated). Should reuse the same id and append, not recreate.
  const retryRes = await fetch(`${baseUrl}/api/notifications/${id}/retry`, {
    method: 'POST',
    headers: authHeaders,
  });
  assert.equal(retryRes.status, 200);
  const retried: any = await retryRes.json();
  assert.equal(retried.data.notification.id, id, 'retry must reuse the same notification id');

  // The original notification row still exists and now has MORE logs.
  const afterRes = await fetch(`${baseUrl}/api/notifications/${id}`);
  const after: any = await afterRes.json();
  assert.equal(afterRes.status, 200, 'original notification must still exist after retry');
  assert.ok(
    after.data.delivery_logs.length > logsBefore,
    `expected appended logs (before=${logsBefore}, after=${after.data.delivery_logs.length})`,
  );
});
