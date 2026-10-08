# Technical Specification: RailSignal

## 1. System Overview

* **Project Name**: `RailSignal` (internal TypeScript package: `@railsignal/backend`, `@railsignal/client`, `@railsignal/shared`).
* **Core Problem**: London commuters travel smoothly during the working week, but face weekend travel ambushes from planned TfL track maintenance, station shutdowns, and rail replacement buses.
* **Core Solution**: A subscription and early-warning closure radar that ingests TfL planned engineering data, projects a weekend line-health read model, and delivers consolidated Friday email alerts.
* **Hosting Cost**: Strictly **£0 forever** (Upstash Serverless Redis free tier, Azure Container Apps free consumption, Neon PostgreSQL / SQLite, Resend free transactional email).
* **Architecture Pattern**: Unified single-process Node.js host (`backend/src/index.ts`) combining Fastify HTTP route plugins and BullMQ queue workers to minimize overhead and maximize Azure Container Apps (ACA) free tier allocation.

---

## 2. Solution & Monorepo Structure

Configured as a modern TypeScript monorepo using npm/pnpm workspaces:

```text
RailSignal/
├── package.json                        # Root workspace coordinator
├── tsconfig.base.json                  # Shared TypeScript compiler options
├── .github/
│   └── workflows/
│       ├── backend-ci-cd.yml           # CI/CD: Node build, Vitest, Docker build, ACA deploy
│       └── client-ci-cd.yml            # CI/CD: Client build, Vitest, lint, typecheck
├── docs/                               # Architecture blueprints and specifications
│   ├── adr/                            # Architecture Decision Records
│   └── technical-specification.md
├── infra/                              # Terraform (Zero-cost Azure resources)
│   ├── main.tf
│   ├── container_app.tf
│   ├── variables.tf
│   └── outputs.tf
├── packages/
│   └── shared/                         # Shared DTOs, Enums & Line Identifiers
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── lines.ts                # Canonical London line IDs (tube, elizabeth-line, dlr, overground)
│           └── contracts.ts            # Shared API response/request DTO contracts
├── backend/                            # Fastify & Node.js API + BullMQ Worker Root
│   ├── AGENTS.md                       # Backend specific agent directives
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma               # Prisma schema (SQLite local dev / Postgres cloud)
│   │   └── migrations/
│   ├── src/
│   │   ├── index.ts                    # Entry point: Boots Fastify server + BullMQ workers
│   │   ├── config.ts                   # Environment variables & runtime validation
│   │   ├── db.ts                       # PrismaClient singleton instance
│   │   ├── routes/                     # Fastify modular route plugins
│   │   │   ├── health.ts               # GET /api/health
│   │   │   ├── lines.ts                # GET /api/lines/weekend-status
│   │   │   ├── subscriptions.ts        # POST/DELETE /api/subscriptions
│   │   │   ├── demo.ts                 # POST /api/demo/send-test-digest
│   │   │   └── jobs.ts                 # POST /api/jobs/sync-weekend-disruptions
│   │   ├── queues/                     # BullMQ Queue definitions & Redis connection
│   │   │   ├── connection.ts           # Upstash Redis ioredis connection factory
│   │   │   ├── queues.ts               # ingestionQueue, notificationQueue
│   │   │   └── jobs.ts                 # Job payload interfaces
│   │   ├── workers/                    # BullMQ Worker processors
│   │   │   ├── ingestionWorker.ts      # Calls TfL, normalizes weekend window, saves to DB
│   │   │   └── notificationWorker.ts   # Matches subscribers, sends Resend digest
│   │   ├── clients/                    # External HTTP clients
│   │   │   └── tflClient.ts            # TfL Unified API typed client with retry logic
│   │   ├── email/                      # Email notifications
│   │   │   ├── resendClient.ts         # Resend SDK wrapper
│   │   │   └── templates/              # HTML alert templates
│   │   └── jobs/                       # Standalone CLI job runner
│   │       └── syncDisruptionsRunner.ts# Invoked via `node dist/index.js --job sync-disruptions`
│   └── tests/
│       ├── unit/                       # TfL parsing, date calculations, validation
│       └── integration/                # Fastify app.inject() endpoint & pipeline tests
└── client/                             # Single-page web client (Vite + React 19 + Tailwind)
    ├── AGENTS.md                       # Frontend specific agent directives
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── src/
    │   ├── api/
    │   │   └── client.ts
    │   ├── components/
    │   │   ├── NetworkStatusGrid.tsx   # Live weekend status cards for each line
    │   │   ├── SubscriptionForm.tsx    # Email + line selector checkbox group
    │   │   └── TestAlertModal.tsx      # Instant test digest trigger
    │   └── App.tsx
    └── tailwind.config.js
```

---

## 3. Database Schema & Dual Persistence Strategy

### 3.1 Zero-Docker Local Development vs. Production Cloud
* **Local Development**: Default connection points to a local SQLite database (`file:./railsignal.db`). Zero Docker or remote account needed.
* **Production Cloud**: Connection string points to Neon Serverless PostgreSQL (`postgresql://...`).
* **Prisma Schema Strategy**: Prisma uses `provider = "sqlite"` locally and targets PostgreSQL in production builds. Data structures are strictly SQLite-compatible (arrays like `subscribedLineIds` serialized as JSON strings).

### 3.2 Prisma Models (`backend/prisma/schema.prisma`)

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Subscription {
  id                String   @id @default(uuid())
  email             String   @unique
  subscribedLineIds String   // JSON stringified array of line IDs (e.g. '["northern","victoria"]')
  unsubscribeToken  String   @default(uuid())
  createdAt         DateTime @default(now())

  @@index([email])
}

model WeekendDisruption {
  id                        String   @id @default(uuid())
  lineId                    String
  lineName                  String
  mode                      String   // "tube", "elizabeth-line", "overground", "dlr"
  statusSeverityDescription String   // "Part Closure", "Planned Closure", etc.
  corridorDescription       String   // E.g. "No service between Camden Town and High Barnet"
  weekendDate               String   // ISO Date "YYYY-MM-DD"
  validFrom                 DateTime
  validTo                   DateTime
  sourceLastUpdated         DateTime
  projectedAt               DateTime @default(now())

  @@index([lineId])
  @@index([weekendDate])
}
```

---

## 4. Messaging Architecture & Queue Topology (BullMQ + Upstash Redis)

### 4.1 Queue & Connection Setup
* **Engine**: BullMQ powered by **Upstash Serverless Redis** over TLS (`rediss://...`).
* **Local Development**: Connects directly to free Upstash Redis database (zero local Docker container required).
* **Production**: Connects to production Upstash Redis instance (£0 forever within 10,000 commands/day tier).

### 4.2 Queues & Job Flow
1. **`ingest-disruptions-queue`**:
   - Triggered every Friday at 09:00 UK time (via ACA Scheduled Job or manual API trigger).
   - Worker fetches TfL disruptions, normalizes them against the upcoming weekend window (Friday 19:00 to Monday 04:30), upserts `WeekendDisruption` records in Prisma, and enqueues jobs to `notification-dispatch-queue`.
2. **`notification-dispatch-queue`**:
   - Consumes disruption events per affected subscriber.
   - Generates consolidated HTML email digests and dispatches via Resend API.
3. **`demo-alert-queue`**:
   - Handles on-demand test alert requests (`POST /api/demo/send-test-digest`).
   - Dispatches an immediate test email to the requester without notifying real subscribers.

### 4.3 Resilience & Dead-Letter Handling
* **Automatic Retries**: BullMQ configured with 3 retries, exponential backoff, and random jitter:
  ```ts
  {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
  ```
* **Failed Job Isolation**: Failed jobs move to BullMQ's failed set (dead-letter) for inspection and logging.

---

## 5. External Adapters

### 5.1 TfL Unified API Client (`src/clients/tflClient.ts`)
* Endpoint: `https://api.tfl.gov.uk/Line/Mode/tube,elizabeth-line,overground,dlr/Disruption`
* Retries: 3 attempts with exponential backoff on network failures.
* Filter: Disruptions strictly overlapping the upcoming weekend window: Friday 19:00 to Monday 04:30 UK local time.

### 5.2 Transactional Email Dispatcher (`src/email/resendClient.ts`)
* Provider: Resend (free tier: 3,000 emails/month).
* Templates: Responsive HTML templates rendering line-by-line status cards and one-click unsubscribe links.

---

## 6. HTTP API Endpoints (Fastify)

Routes registered as Fastify plugins under `src/routes/`:

* `GET /api/health`:
  - Returns `{ "status": "healthy" }`.
* `GET /api/lines/weekend-status`:
  - Queries `WeekendDisruption` table from Prisma (< 5ms response).
* `POST /api/subscriptions`:
  - Body: `{ "email": "user@example.com", "lineIds": ["northern", "victoria"] }`.
  - Creates or updates subscriber in database.
* `DELETE /api/subscriptions/:id?token=:token`:
  - Unsubscribe action linked from email footers.
* `POST /api/demo/send-test-digest`:
  - Body: `{ "email": "test@example.com", "lineIds": ["northern"] }`.
  - Enqueues test alert job; returns `{ "status": "queued" }`.
* `POST /api/jobs/sync-weekend-disruptions`:
  - Header: `X-Job-Secret: <secret>`.
  - Authenticated endpoint to trigger the ingestion pipeline.

* **Error Handling & RFC 9457**:
  - Global error handler (`fastify.setErrorHandler`) produces sanitized RFC 9457 Problem Details (`application/problem+json`).

---

## 7. Cloud Hosting Strategy (£0 Forever)

* **Compute**: Azure Container Apps (ACA) consumption tier (180,000 vCPU-seconds free per month; scales to zero when idle).
* **Scheduled Job**: ACA Scheduled Job resource (`azurerm_container_app_job`) runs `node dist/index.js --job sync-disruptions` every Friday at 09:00 UK time.
* **Database**: Neon Serverless PostgreSQL free tier.
* **Queue**: Upstash Serverless Redis free tier.
* **Email**: Resend free tier.

---

## 8. Test Strategy & Structure

* **Test Framework**: Vitest (used across both `backend` and `client`).
* **Backend Unit Tests**:
  - Fast execution: Domain validation, TfL response parsing, date calculations, email template rendering.
* **Backend Integration Tests**:
  - Fastify's native `app.inject()` tests HTTP routes in memory without binding network ports.
  - In-memory database & mocked BullMQ queues.

---

## 9. Implementation Roadmap (Phases)

* **Phase 1: Monorepo Foundation & Tooling**:
  - Setup root `package.json` workspaces (`backend`, `client`, `packages/shared`).
  - Fastify server baseline with `GET /api/health` and RFC 9457 error handler.
  - Prisma schema definition and local SQLite setup.
* **Phase 2: External Adapters**:
  - TfL Unified API typed client with retry logic.
  - Resend email dispatcher and HTML templates.
* **Phase 3: Event-Driven Queue Pipeline**:
  - BullMQ queue setup with Upstash Redis connection.
  - Ingestion worker and Notification worker implementations.
* **Phase 4: API Routes & CLI Jobs**:
  - Implement line status, subscription, demo, and scheduled trigger endpoints.
  - Implement standalone CLI runner (`--job sync-disruptions`).
* **Phase 5: Frontend Web Client**:
  - React 19 + Vite + Tailwind + TanStack Query status board and modals.
* **Phase 6: End-to-End Tests & CI/CD**:
  - Integration test suite and GitHub Actions workflow.
