import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import { test, before, after } from 'node:test';

// Row 19 health probe tests. Env is configured BEFORE importing app modules
// (same pattern as notifications.integration.test.ts).
const API_KEY = 'test-secret-token';
const DB_FILE = `/tmp/snr-health-test-${process.pid}-${Date.now()}.db`;

process.env.AI_ENABLED = 'false';
process.env.API_KEY = API_KEY;
process.env.DB_PATH = DB_FILE;
// Point Redis at a port with no listener so the probe must fail closed and
// report a reason code instead of hanging or lying.
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '41953';

let server: import('node:http').Server;
let baseUrl: string;

before(async () => {
  const { initDatabase } = await import('../models/database');
  initDatabase();
  const { default: app } = await import('../app');
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
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

test('health reports healthy with a live DB and a reason code for unreachable redis', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const json: any = await res.json();
  assert.equal(json.data.status, 'healthy'); // DB is up; redis unreachability degrades per-dependency, not liveness
  assert.equal(json.data.database, 'connected');
  assert.equal(json.data.redis.status, 'unreachable');
  assert.ok(json.data.redis.reason, 'redis failure must carry a reason code');
  assert.match(json.data.redis.reason, /^REDIS_/); // codes only, never raw error text
});

test('health never leaks internal URLs or probe details', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  const text = await res.text();
  assert.ok(!text.includes('redis://'), 'must not expose internal connection URLs');
  assert.ok(!text.includes('Error'), 'must not leak raw error strings');
});

test('AI health is configuration state, never a live probe', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  const json: any = await res.json();
  assert.equal(json.data.ai.probed, false);
  assert.equal(typeof json.data.ai.enabled, 'boolean');
  assert.ok(json.data.ai.engine, 'engine name documents what WOULD be used');
});

test('health stays 200-always (liveness contract) even when a dependency fails', async () => {
  // redis is unreachable in this environment by construction; the route
  // must still answer 200 with the failure encoded in the body.
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
});
