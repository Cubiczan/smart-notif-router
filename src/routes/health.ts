import { Router, Response } from 'express';
import net from 'node:net';
import { getDatabase } from '../models/database';
import { config } from '../config';

const router = Router();

/**
 * @openapi
 * tags:
 *   name: Health
 *   description: System health and status checks
 */

/**
 * Cheap TCP handshake against Redis — connectivity only. No AUTH is sent and
 * no data is exchanged; a healthy connect() is the protocol-health signal.
 * Bounded so a hung Redis cannot hang the health route.
 */
function probeRedis(host: string, port: number, timeoutMs = 750): Promise<{ ok: boolean; reason: string }> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (ok: boolean, reason: string) => {
      socket.destroy();
      resolve({ ok, reason });
    };
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => finish(true, 'connected'));
    socket.on('timeout', () => finish(false, 'REDIS_HANDSHAKE_TIMEOUT'));
    socket.on('error', (err: NodeJS.ErrnoException) => {
      // Reason codes only, namespaced under REDIS_ — raw error text never
      // leaves the process.
      finish(false, err.code ? `REDIS_${err.code}` : 'REDIS_UNREACHABLE');
    });
  });
}

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Health check
 *     description: >
 *       Liveness + dependency status. Always returns 200 (the route answers
 *       "is the process up"); dependency failures are surfaced in the body as
 *       per-dependency status and reason codes, and the top-level status
 *       flips to "degraded". Live model calls are never made from a health
 *       check — the AI field is configuration state, not a probe.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: System health status
 */
router.get('/', async (_req, res: Response) => {
  let dbStatus = 'connected';
  let dbOk = true;
  try {
    getDatabase().prepare('SELECT 1').get();
  } catch {
    dbOk = false;
    dbStatus = 'disconnected';
  }

  const redis = await probeRedis(config.redis.host, config.redis.port);

  res.json({
    success: true,
    data: {
      // Liveness contract: 200-always; status derives from the database
      // probe (the only hard dependency for serving requests).
      status: dbOk ? 'healthy' : 'degraded',
      version: '1.0.0',
      uptime: process.uptime(),
      database: dbStatus,
      redis: {
        status: redis.ok ? 'connected' : 'unreachable',
        reason: redis.reason,
      },
      // Configuration state only. Deliberately NOT probed with a live call:
      // health checks must not spend model tokens or depend on a model's
      // availability to report liveness.
      ai: {
        enabled: config.ai.enabled,
        engine: 'GLM-4-Plus (z-ai-web-dev-sdk)',
        probed: false,
      },
      wooxy: config.wooxy.apiKey ? 'configured' : 'not configured (mock mode)',
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
