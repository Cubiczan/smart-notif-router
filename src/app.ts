import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import notificationsRouter from './routes/notifications';
import channelsRouter from './routes/channels';
import rulesRouter from './routes/rules';
import healthRouter from './routes/health';

const app = express();

// ── Middleware ──
// Helmet first so every response (API, Swagger UI, errors) emits baseline
// browser security headers (CSP, X-Content-Type-Options, X-Frame-Options,
// Referrer-Policy, HSTS, etc.). Fixes Aikido High SAST: Express is not
// emitting security headers.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // swagger-ui-express inlines scripts; keep docs usable.
        'script-src': ["'self'", "'unsafe-inline'"],
        // Helmet's default upgrade-insecure-requests breaks local HTTP
        // (dashboard at :3000 talking to this API, Swagger UI).
        'upgrade-insecure-requests': null,
      },
    },
    // The Next.js dashboard calls this API cross-origin.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// Restrict CORS to known origins. Configure via CORS_ORIGINS (comma-separated);
// defaults to the local dev server. An explicit allowlist replaces the previous
// wide-open `cors()` default.
const allowedOrigins = (process.env.CORS_ORIGINS || `http://localhost:${config.port}`)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin / non-browser requests (no Origin header) and any
      // explicitly allowlisted origin; reject everything else.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request logging ──
app.use((req, _res, next) => {
  const start = Date.now();
  _res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${_res.statusCode} ${duration}ms`);
  });
  next();
});

// ── Swagger / OpenAPI Documentation ──
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Smart Notification Router API',
      version: '1.0.0',
      description: `
## AI-Powered Smart Notification Router

An intelligent notification routing service that uses AI to analyze, prioritize, and route
alerts across multiple delivery channels (email via Wooxy, webhooks, SMS).

### Key Features
- **AI-Powered Priority Scoring**: GLM-4-Plus analyzes notification content and scores urgency (1-10)
- **Smart Channel Selection**: AI selects optimal delivery channels based on content type and urgency
- **Duplicate Detection**: Semantic duplicate detection prevents notification spam
- **Multi-Channel Delivery**: Email (Wooxy), Webhook, SMS with automatic channel selection
- **Routing Rules Engine**: Configurable rules for source-based or priority-based overrides
- **Real-time Analytics**: Delivery status, channel performance, and notification metrics
- **Queue Processing**: BullMQ-powered async delivery with retry logic and backoff

### Channels
| Channel | Use Case |
|---------|----------|
| **Email** (via Wooxy) | Detailed reports, summaries, non-urgent alerts |
| **Webhook** | System alerts, CI/CD events, Slack/Discord integrations |
| **SMS** | Critical/urgent alerts requiring immediate attention |

### Quick Start
\`\`\`bash
# Create a notification
curl -X POST http://localhost:3001/api/notifications \\
  -H "Content-Type: application/json" \\
  -d '{"title": "CPU Alert", "message": "Server CPU at 95%", "source": "monitoring"}'

# Get analytics
curl http://localhost:3001/api/notifications/analytics/summary
\`\`\`
      `,
      contact: {
        name: 'Smart Notif Router Team',
        email: 'dev@smartnotif.io',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Local development server',
      },
      {
        url: 'https://api.smartnotif.io',
        description: 'Production server (when deployed)',
      },
    ],
    tags: [
      { name: 'Health', description: 'System health and status checks' },
      { name: 'Notifications', description: 'AI-powered notification creation, routing, and management' },
      { name: 'Channels', description: 'Manage delivery channels (email, webhook, SMS)' },
      { name: 'Routing Rules', description: 'Manage AI routing rules' },
    ],
  },
  apis: [
    './src/routes/*.ts',
  ],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

// ── Swagger UI ──
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Smart Notification Router - API Docs',
}));

// ── Swagger JSON endpoint ──
app.get('/api/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ── Routes ──
app.use('/api/health', healthRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/rules', rulesRouter);

// ── Error handling ──
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
