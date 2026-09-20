# 🧠 Smart Notification Router

> **AI-Powered Multi-Channel Alert Routing Engine**
> Route, prioritize, and personalize notifications across email, webhooks, and SMS using AI-driven intelligence.

![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-20+-green)
![Docker](https://img.shields.io/badge/docker-compose-ready-blue)
![TypeScript](https://img.shields.io/badge/typescript-5.7-blue)

---

## 🎯 Overview

Smart Notification Router is an intelligent notification routing platform that uses AI to analyze incoming alerts, score their urgency, detect duplicates, select optimal delivery channels, and deliver them — all in real-time. Built with Express.js, SQLite, BullMQ, and integrates with **Wooxy** for transactional email delivery.

### The Problem

Modern teams receive notifications from dozens of sources: monitoring systems, CI/CD pipelines, CRMs, security tools, and more. These alerts flood email inboxes, get lost in Slack channels, and critical ones go unnoticed. Teams waste hours manually routing, deduplicating, and prioritizing alerts.

### The Solution

Smart Notification Router acts as an intelligent middleware that:
1. **Receives** notifications from any source via REST API
2. **Analyzes** each notification using AI (GLM-4-Plus) to score urgency (1-10)
3. **Routes** to the optimal channel(s): email (Wooxy), webhooks (Slack/Discord), or SMS
4. **Deduplicates** semantically similar alerts to prevent notification fatigue
5. **Delivers** with priority-aware formatting and tone adjustment
6. **Tracks** delivery status with full analytics and audit logs

---

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Any Source  │────▶│   Smart Router    │────▶│  Wooxy Email  │
│  (API call)  │     │   (Express.js)    │     │  (Transactional)│
└─────────────┘     │                    │     ├──────────────┤
                    │  ┌──────────────┐  │────▶│   Webhook     │
┌─────────────┐     │  │  AI Engine   │  │     │  (Slack/etc)  │
│  Routing     │────▶│  │  (GLM-4-Plus)│  │     ├──────────────┤
│  Rules       │     │  └──────────────┘  │────▶│     SMS      │
└─────────────┘     │                    │     │  (Twilio)     │
                    │  ┌──────────────┐  │     └──────────────┘
                    │  │  BullMQ      │  │
                    │  │  (Redis)     │  │     ┌──────────────┐
                    │  └──────────────┘  │────▶│   SQLite DB   │
                    └──────────────────┘     │  (Analytics)   │
                                             └──────────────┘
```

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Priority Scoring** | GLM-4-Plus analyzes notification content and assigns urgency scores (1-10) mapped to low/normal/urgent/critical |
| 📬 **Smart Channel Selection** | AI selects optimal delivery channel based on content type, urgency, and context |
| 🔍 **Duplicate Detection** | Semantic analysis detects near-duplicate notifications to prevent alert fatigue |
| 📧 **Wooxy Email Integration** | Full Wooxy API v3.0 integration for transactional email with priority-based queuing |
| 🔗 **Webhook Delivery** | HTTP POST delivery to Slack, Discord, PagerDuty, or any webhook endpoint |
| 📱 **SMS Support** | Urgent/critical alerts routed to SMS (Twilio-ready, mock for demo) |
| 📋 **Routing Rules Engine** | Configurable rules for source-based, keyword-based, or priority-based channel overrides |
| 📊 **Real-time Analytics** | Delivery metrics by status, priority, channel, and time range |
| ⚡ **Async Processing** | BullMQ + Redis queue with retry logic, backoff, and concurrency control |
| 🐳 **Docker Ready** | Full docker-compose setup with API, Dashboard, and Redis |
| 📖 **Swagger/OpenAPI** | Complete API documentation with interactive Swagger UI |
| 🧪 **Postman Collection** | Ready-to-import Postman collection with all endpoints and examples |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (for containerized deployment)

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/icohangar-ops/smart-notif-router.git
cd smart-notif-router

# Copy environment file
cp .env.example .env
# Edit .env with your Wooxy API key

# Start all services
docker compose -f docker/docker-compose.yml up -d

# API available at http://localhost:3001
# Dashboard at http://localhost:3000
# Swagger docs at http://localhost:3001/api/docs
```

### Option 2: Local Development

```bash
# Install dependencies
npm install

# Set environment variables
export WOOXY_API_KEY=your_key_here
export AI_ENABLED=true

# Start the API server
npm run dev

# In another terminal, start the dashboard
cd dashboard
npm install
npm run dev
```

---

## 📡 API Endpoints

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/notifications` | Create & route a notification (AI-analyzed) |
| `GET` | `/api/notifications` | List notifications (filterable) |
| `GET` | `/api/notifications/:id` | Get notification with delivery logs |
| `DELETE` | `/api/notifications/:id` | Delete notification |
| `POST` | `/api/notifications/:id/retry` | Retry a failed notification |
| `GET` | `/api/notifications/analytics/summary` | Get aggregated analytics |

### Channels
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/channels` | List all delivery channels |
| `POST` | `/api/channels` | Create a channel |
| `PUT` | `/api/channels/:id` | Update a channel |
| `DELETE` | `/api/channels/:id` | Delete a channel |

### Routing Rules
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/rules` | List routing rules |
| `POST` | `/api/rules` | Create a routing rule |
| `PUT` | `/api/rules/:id` | Update a routing rule |
| `DELETE` | `/api/rules/:id` | Delete a routing rule |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check (DB, Redis, AI status) |
| `GET` | `/api/docs` | Swagger UI (interactive API docs) |
| `GET` | `/api/docs.json` | OpenAPI specification JSON |

---

## 💡 Usage Examples

> Authentication: write endpoints (`POST /api/notifications`, `DELETE /api/notifications/:id`,
> `POST /api/notifications/:id/retry`) require a bearer token. Send
> `Authorization: Bearer <API_KEY>`, where `API_KEY` matches the value configured in the
> environment. Read-only `GET` endpoints are unauthenticated.

### Send a Critical Server Alert

```bash
curl -X POST http://localhost:3001/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "title": "Server CPU Critical",
    "message": "Production server prod-web-03 CPU at 98% for 20 minutes.",
    "source": "datadog",
    "recipient": {
      "email": "ops@company.com",
      "phone": "+1234567890"
    }
  }'
```

The AI engine will:
1. Analyze the content → Score priority 9/10 (critical)
2. Select channels → Email + SMS (urgent content warrants multi-channel)
3. Detect duplicates → Check for semantic similarity
4. Deliver → Send styled email via Wooxy + SMS via Twilio

### Route CI/CD Build Failure to Webhook

```bash
curl -X POST http://localhost:3001/api/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "title": "Build #4521 Failed",
    "message": "Frontend build failed. TypeScript error in Dashboard.tsx:42",
    "source": "github-actions",
    "channel_override": ["webhook"],
    "recipient": {
      "webhook_url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
    }
  }'
```

### Get Analytics

```bash
curl http://localhost:3001/api/notifications/analytics/summary
```

---

## 🧪 Postman Collection

Import `postman/smart-notif-router.postman_collection.json` into Postman to get:
- All API endpoints pre-configured
- Sample requests for every scenario
- Auto-populated notification ID variable
- Organized by resource (Notifications, Channels, Rules, Health)

---

## 🐳 Docker Architecture

```yaml
# docker/docker-compose.yml
services:
  api:        # Express.js API (port 3001)
  redis:      # BullMQ queue backend (port 6379)
  dashboard:  # Next.js dashboard (port 3000)
```

All services are configured with health checks, automatic restarts, and persistent volumes.

---

## 📁 Project Structure

```
smart-notif-router/
├── src/                          # API source code
│   ├── config/                   # Configuration (env vars)
│   ├── models/                   # SQLite database schema & types
│   ├── services/
│   │   ├── ai-router.service.ts  # AI priority scoring & routing (GLM-4-Plus)
│   │   ├── wooxy.service.ts      # Wooxy email API v3.0 integration
│   │   ├── webhook.service.ts    # HTTP webhook delivery
│   │   ├── sms.service.ts        # SMS delivery (Twilio-ready mock)
│   │   └── notification.service.ts  # Core notification orchestration
│   ├── workers/
│   │   └── delivery.worker.ts    # BullMQ async delivery worker
│   ├── routes/                   # Express routes with Swagger docs
│   │   ├── notifications.ts
│   │   ├── channels.ts
│   │   ├── rules.ts
│   │   └── health.ts
│   ├── middleware/
│   │   └── error-handler.ts
│   ├── app.ts                    # Express app setup
│   └── index.ts                  # Entry point
├── dashboard/                    # Next.js 16 dashboard
│   └── src/app/
│       ├── layout.tsx
│       └── page.tsx              # Dashboard UI
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.dashboard
│   └── docker-compose.yml
├── postman/
│   └── smart-notif-router.postman_collection.json
├── .env.example
├── .gitignore
├── tsconfig.json
├── package.json
└── README.md
```

---

## 🔧 Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `3001` | API server port |
| `API_KEY` | (empty) | Bearer token required for write endpoints; when unset, those endpoints fail closed with 503 |
| `CORS_ORIGINS` | `http://localhost:3001` | Comma-separated allowlist of browser origins for CORS |
| `WOOXY_API_KEY` | (empty) | Wooxy API key (required for real email) |
| `WOOXY_FROM_EMAIL` | `noreply@smartnotif.io` | Sender email address |
| `WOOXY_FROM_NAME` | `Smart Notif Router` | Sender display name |
| `REDIS_HOST` | `localhost` | Redis host for BullMQ |
| `REDIS_PORT` | `6379` | Redis port |
| `DB_PATH` | `./data/notifications.db` | SQLite database path |
| `AI_ENABLED` | `true` | Enable/disable AI routing engine |
| `NODE_ENV` | `development` | Node environment |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **API Framework** | Express.js 4.x with TypeScript 5.7 |
| **AI Engine** | GLM-4-Plus via z-ai-web-dev-sdk |
| **Email Delivery** | Wooxy API v3.0 |
| **Database** | SQLite (better-sqlite3) |
| **Queue** | BullMQ + Redis 7 |
| **Dashboard** | Next.js 16 + Tailwind CSS |
| **API Docs** | Swagger/OpenAPI 3.0 (swagger-jsdoc + swagger-ui-express) |
| **Containers** | Docker + Docker Compose |
| **Testing** | Postman Collection |

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

## Propagation decisions (SecOps/Gov wave C)

### Row 17 — ReBAC gateway: REVERSED (verified against current state)

The entire authentication surface is one static shared secret: `requireAuth` in src/middleware/auth.ts reads a single `API_KEY` env var at module load, fails closed with 503 when unset, and answers 401 to any other Bearer token. There are no users, roles, or tenants — one shared token equals a subject population of one, and a ReBAC gateway would re-express a constant as a relation.

**Revisit trigger:** per-user identities or role-differentiated notification permissions appear. Then adopt the canonical ReBAC gateway; the fail-closed posture of the current middleware is already the shape the canonical package expects.

### Rows 18 / 19 — degradation ladder and protocol health probes: adoption identified, NOT yet implemented

Both rows apply (Express route wrappers around live notification-delivery calls are the canonical surface). Recorded as the open adoption work for this repo in the wave-C report; not silently claimed as done.
