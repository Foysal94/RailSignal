# RailSignal

> An early-warning London weekend closure radar that ingests Transport for London (TfL) planned engineering data, projects a materialized weekend line-health model, and delivers consolidated Friday morning email alerts alongside a high-contrast transit dashboard.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22%20LTS-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-000000?style=flat-square&logo=fastify)](https://fastify.dev/)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Azure](https://img.shields.io/badge/Azure-Container%20Apps-0089d6?style=flat-square&logo=microsoftazure)](https://azure.microsoft.com/)
[![Database](https://img.shields.io/badge/Database-Neon%20Postgres%20%7C%20SQLite-00e599?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Queue](https://img.shields.io/badge/Queue-BullMQ%20%7C%20Upstash%20Redis-ff4438?style=flat-square&logo=redis)](https://upstash.com/)
[![Cloud Cost](https://img.shields.io/badge/Hosting-%C2%A30%2Fmo%20Forever-emerald?style=flat-square)]()
[![Tests](https://img.shields.io/badge/Tests-226%20Passing-brightgreen?style=flat-square&logo=vitest)](https://vitest.dev/)

---

## 📑 Table of Contents

- [🌐 Live Application](#-live-application)
- [📌 Problem & Overview](#-problem--overview)
- [✨ Key Features](#-key-features)
- [🏛️ System Architecture](#️-system-architecture)
- [🛠️ Tech Stack](#️-tech-stack)
- [📂 Repository Structure](#-repository-structure)
- [⚙️ Engineering Decisions & Trade-offs](#️-engineering-decisions--trade-offs)
- [📡 API Usage & Endpoints](#-api-usage--endpoints)
- [🚀 Local Development](#-local-development)
- [🧪 Testing Strategy](#-testing-strategy)
- [☁️ Cloud Infrastructure & £0 Budget](#️-cloud-infrastructure--0-budget)

---

## 🌐 Live Application

* **Web Dashboard**: `https://railsignal.calmglacier-47209930.westeurope.azurecontainerapps.io` *(Pending Cloud Deployment — Phase 6B)*
* **API Health Check**: `https://railsignal.calmglacier-47209930.westeurope.azurecontainerapps.io/api/health`

> ℹ️ **Scale-to-Zero Notice**: The backend runs on Azure Container Apps with on-demand consumption scaling (`minReplicas = 0`) to preserve a strictly **£0/month** hosting budget. If idle, the first request may experience a ~10-second cold start while the container boots; subsequent requests respond in under 5ms.

---

## 📌 Problem & Overview

London commuters navigate the working week with high service frequency, but weekend travel regularly faces ambushes from planned track renewals, station shutdowns, and rail replacement buses across the Tube, Elizabeth line, Overground, and DLR networks.

Standard transit applications show real-time delays happening *right now*, forcing weekend travellers to manually dig through multi-screen journey planners to see if their lines are running on Saturday or Sunday.

**RailSignal** functions as an **early-warning weekend closure radar**:
1. It calculates the canonical **Weekend Window** (**Friday 19:00 to Monday 04:30 London Local Time**, accounting for GMT/BST transitions).
2. It queries date-scoped Transport for London (TfL) Status endpoints, filtering out transient live delays and capturing genuine advance engineering closures.
3. It sanitizes and parses complex multi-event narrative text into structured child disruption notices on write.
4. It delivers consolidated Friday morning email alerts to subscribers and powers a disruption-first, high-contrast web dashboard.

---

## ✨ Key Features

* **Station-First Disruption Cards**: Replaces unreadable walls of TfL text with bold station corridors (`Gospel Oak ↔ Stratford: No service`), clear timeframe pills, and replacement bus accordions with stop counts.
* **Disruption-First Priority Sorting**: Closed routes (`Planned Closure`, `Part Closure`) sort to the top with visible impact descriptions; lines operating normally display compact `No Planned Closures` badges below.
* **Consolidated Friday Email Digest**: Scheduled background worker generates mobile-responsive, bulletproof HTML email digests rendered via `@react-email` and delivered via Resend.
* **Instant Evaluator Demo Alerts**: Portfolio visitors can trigger an immediate sample digest email to their inbox (`POST /api/demo/send-test-digest`) with a single click, powered by an on-demand BullMQ queue pipeline.
* **RFC 8058 One-Click List-Unsubscribe**: Outgoing notification headers include `List-Unsubscribe` and `List-Unsubscribe-Post`, complying with Gmail and Yahoo 2024 bulk-sender deliverability mandates.
* **Accessible Transit Radar UI**: Dark slate theme (`#0B0F19`) with canonical TfL color stripes, Northern line contrast outline, WCAG 2.1 AA contrast compliance, and minimum 44px touch targets.
* **Resilient TfL Ingestion**: External API calls wrapped with `cockatiel` composite policies (exponential backoff with decorrelated jitter, 8s timeout abort signal, circuit breaker).
* **Strict £0 Hosting Ceiling**: Fully serverless architecture utilizing Azure Container Apps consumption tier, Neon PostgreSQL, Upstash Redis, and Resend free allocations.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    User(["Browser / Portfolio Visitor"])
    Subscriber(["Subscriber Email Inbox"])

    subgraph Azure_Cloud ["Azure Cloud (West Europe)"]
        subgraph ACA_Host ["Azure Container App (minReplicas = 0)"]
            Fastify["Fastify HTTP API Server\n(/api/lines, /api/subscriptions, /api/demo)"]
            Workers["BullMQ Background Workers\n(Ingestion · Notification · Demo Alert)"]
        end
        ACA_Job["ACA Scheduled Job\n(Friday 09:00 UK · syncDisruptionsRunner)"]
    end

    subgraph Cloud_Persistence ["Persistence & Queue Topology"]
        Neon[("Neon Serverless PostgreSQL\n(Subscriptions, Disruptions, Notices)")]
        Upstash[("Upstash Serverless Redis\n(TLS · BullMQ Queues · drainDelay: 60s)")]
    end

    subgraph External_Services ["External Services"]
        TfL["TfL Unified API\n(/Line/Mode/.../Status?startDate=...&endDate=...)"]
        Resend["Resend API\n(Transactional Email Delivery)"]
    end

    %% Web Traffic
    User -->|"HTTPS (React 19 Client)"| Fastify
    Fastify -->|"Read Status (<5ms)"| Neon
    Fastify -->|"Enqueue Demo Alert"| Upstash
    Fastify -->|"Upsert / Delete Subscription"| Neon

    %% Friday Ingestion Flow
    ACA_Job -->|"Trigger Ingestion Job"| Upstash
    Upstash -->|"Ingest Job"| Workers
    Workers -->|"Query Date-Scoped Status (Cockatiel)"| TfL
    Workers -->|"Parse & Materialize (1NF Notices)"| Neon
    Workers -->|"Enqueue Subscriber Notifications"| Upstash

    %% Notification Dispatch Flow
    Upstash -->|"Dispatch Job (Idempotency Check)"| Workers
    Workers -->|"Read Affected Subscribers"| Neon
    Workers -->|"Render React Email & Dispatch"| Resend
    Resend -->|"Deliver Digest (RFC 8058)"| Subscriber
    Workers -->|"Update lastNotifiedWeekendDate"| Neon
```

---

## 🛠️ Tech Stack

| Domain | Technologies & Libraries | Rationale |
| :--- | :--- | :--- |
| **Backend & Routing** | Node.js 22 LTS, Fastify 5.x, `@sinclair/typebox` | Ultra-low overhead HTTP engine with native JSON Schema validation and end-to-end typed contracts. |
| **Persistence & ORM** | Prisma ORM 6.x, Neon PostgreSQL (Cloud), SQLite (Local) | Dual-persistence strategy maintaining 1NF relational models across both engines without schema duplication. |
| **Queue & Messaging** | BullMQ 6.x, `ioredis`, Upstash Serverless Redis (TLS) | Robust background job pipelines with tuned 60s idle drain backoff to preserve serverless command quotas. |
| **External Resilience** | `cockatiel`, Transport for London Unified API | Composite retry with decorrelated jitter, timeout abort signals, and circuit breaking mirroring .NET Polly. |
| **Transactional Email** | Resend API, `@react-email/components`, `@react-email/render` | Responsive JSX email component templates with local live preview and RFC 8058 one-click unsubscribe headers. |
| **Frontend Client** | React 19, TypeScript 5 (Strict), Vite 6, Tailwind CSS 3.4, TanStack Query v5, Radix UI Dialog | Accessible single-page radar dashboard with server-state caching, loading skeletons, and accessible modals. |
| **Testing Suite** | Vitest v4, React Testing Library, Mock Service Worker (MSW) | In-memory HTTP pipeline tests (`app.inject()`), pure domain calculation tests, and realistic network mocking. |
| **DevOps & Cloud** | Azure Container Apps, Docker Multi-Stage Alpine, GitHub Actions | Zero-cost serverless container hosting with scale-to-zero compute and automated CI/CD workflows. |

---

## 📂 Repository Structure

```text
RailSignal/
├── packages/
│   └── shared/                  # Shared DTO contracts, TypeBox schemas, line definitions & parser
│       └── src/
│           ├── contracts/       # TypeBox schemas (health, lines, subscriptions, demo, jobs, errors)
│           ├── disruptionNotice.ts # Pure parser decomposing raw TfL narrative into structured notices
│           └── lines.ts         # Canonical London transit line metadata (modes, colors, contrast borders)
├── backend/                     # Fastify API server and BullMQ background worker host
│   ├── prisma/                  # Canonical schema.prisma (SQLite local / PostgreSQL cloud) and migrations
│   ├── src/
│   │   ├── index.ts             # Unified Node.js process entrypoint (boots Fastify + BullMQ workers)
│   │   ├── config.ts            # TypeBox runtime environment configuration and validation
│   │   ├── routes/              # Fastify modular route plugins (health, lines, subscriptions, demo, jobs)
│   │   ├── domain/              # Pure business logic (statusBoard.ts ranking, temporal.ts London window)
│   │   ├── workers/             # BullMQ queue workers (ingestion coordinator, notification engine, demo)
│   │   ├── clients/tfl/         # Sealed TfL client facade with internal Cockatiel resilience policies
│   │   ├── email/               # Deep EmailClient, RFC 8058 headers, and React Email templates
│   │   └── jobs/                # Standalone CLI runner (syncDisruptionsRunner.ts) for scheduled cron jobs
│   └── tests/                   # In-memory integration tests (app.inject()) and domain unit tests
├── client/                      # Single-page web client (Vite + React 19 + Tailwind CSS)
│   └── src/
│       ├── api/                 # Strongly typed API client calling backend endpoints
│       ├── hooks/               # TanStack Query custom hooks (useWeekendStatus, useCreateSubscription)
│       └── components/          # Transit radar UI, LineCard with TfL stripes, and Radix UI dialog modals
└── docs/
    ├── adr/                     # Architectural Decision Records (ADRs 0001–0008)
    └── technical-specification.md # Detailed engineering blueprint and phased roadmap
```

---

## ⚙️ Engineering Decisions & Trade-offs

### 1. Write-Path Ingestion Parsing & Materialized 1NF Child Table `([ADR 0008](docs/adr/0008-materialized-disruption-notices.md))`
* **Problem**: TfL disruption descriptions are dense run-on text paragraphs combining multiple closures and dates. Parsing these with regular expressions at query time introduced latency variance and duplicated CPU overhead on every status query and email render.
* **Decision**: Decomposed parsing to the write-path at ingestion time. Introduced a normalized relational child table `DisruptionNotice` (`headline`, `corridor`, `timeframe`, `busRouteJson`, `detailsJson`) linked to `WeekendDisruption` via cascade deletion. Nested arrays are stored as serialized JSON strings to maintain identical SQLite and PostgreSQL schema representations.
* **Outcome**: Read-path queries (`GET /api/lines/weekend-status`) execute instant pass-through transformations with zero runtime regex scanning, consistently returning in under 5ms while maintaining 100% dialect parity.

### 2. Unified Process Host with Scale-to-Zero vs. Dedicated Worker Containers `([ADR 0003](docs/adr/0003-bullmq-upstash-quota-and-scale-to-zero.md))`
* **Problem**: Running separate cloud containers for the Fastify Web API and BullMQ queue workers would double compute allocations and exceed Azure Container Apps' free consumption allowance.
* **Decision**: Hosted both Fastify HTTP routes and BullMQ queue workers within a single unified Node.js process (`backend/src/index.ts`), deployed to Azure Container Apps with `minReplicas = 0`.
* **Outcome**: Compute scales to zero when traffic is idle, consuming 0 vCPU-seconds and dropping Redis polling commands to zero, while still waking up instantly on demand when visitors invoke demo alerts.

### 3. Dual-Persistence Database Strategy: Zero-Docker Local Dev vs. Cloud Postgres `([ADR 0002](docs/adr/0002-prisma-dual-persistence.md))`
* **Problem**: Prisma fixes its database provider statically in `schema.prisma`. Unlike EF Core in .NET, pointing a SQLite schema to PostgreSQL fails at runtime, yet forcing contributors to run local Docker PostgreSQL adds unnecessary friction.
* **Decision**: Maintained a single canonical `schema.prisma` targeting `provider = "sqlite"` for local development. Introduced an automated build-time swap script (`prisma:prep-prod`) that substitutes `provider = "postgresql"` during Docker and CI pipelines before running migrations.
* **Outcome**: Developers clone and run the app immediately using local SQLite with zero Docker dependencies, while production deploys seamlessly to Neon Serverless PostgreSQL.

### 4. Deep Email Architecture & RFC 8058 Bulk-Sender Deliverability `([ADR 0007](docs/adr/0007-deep-email-delivery-client.md))`
* **Problem**: Raw HTML string email templates break across email clients (Outlook Word engine, mobile viewports), and multi-layer glue pipelines created shallow modules where callers had to understand intermediate payload transformations.
* **Decision**: Consolidated transport, React-to-HTML rendering, and Cockatiel retry policies into a deep `EmailClient` class. Isolated domain coordination in `sendDisruptionDigest` and extracted a pure RFC 8058 header utility (`buildUnsubscribeHeaders`) enforcing `List-Unsubscribe` and `List-Unsubscribe-Post`.
* **Outcome**: Bulletproof Outlook and mobile email rendering via `@react-email`, zero third-party API quota consumed during local styling via `email:dev`, and strict compliance with Gmail and Yahoo 2024 deliverability standards.

### 5. End-to-End Type Safety with TypeBox across Monorepo `([ADR 0005](docs/adr/0005-typebox-validation-and-shared-contracts.md))`
* **Problem**: TypeScript types are erased at compile time, requiring separate runtime validation libraries that frequently lead to duplicate type declarations and schema drift between backend and frontend.
* **Decision**: Adopted TypeBox (`@sinclair/typebox`) in `packages/shared` as the single source of truth for all DTOs and API contracts.
* **Outcome**: Fastify routes natively validate incoming request payloads with Ajv, serialization errors transform into standardized RFC 9457 Problem Details, and the React client imports static TypeScript types (`Static<typeof ...>`) directly without code generators.

---

## 📡 API Usage & Endpoints

| Method | Endpoint | Description | Auth / Security |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service liveness probe. | Public |
| `GET` | `/api/lines/weekend-status` | Materialized London transit status and structured closure notices. | Public (`<5ms`) |
| `POST` | `/api/subscriptions` | Create or update weekly Friday email alert subscription. | Public (TypeBox validated) |
| `DELETE` | `/api/subscriptions/:id?token=...` | Unsubscribe from alerts using immutable security token. | Token validated |
| `POST` | `/api/demo/send-test-digest` | Instant on-demand sample email digest for portfolio evaluators. | Public (Rate limited) |
| `POST` | `/api/jobs/sync-weekend-disruptions` | Trigger on-demand TfL status synchronization. | `X-Job-Secret` header |

### Sample: Get Weekend Line Status

```bash
curl -s http://localhost:3000/api/lines/weekend-status | jq .
```

```json
{
  "weekendDate": "2026-10-16",
  "windowStart": "2026-10-16T19:00:00.000+01:00",
  "windowEnd": "2026-10-19T04:30:00.000+01:00",
  "lines": [
    {
      "lineId": "mildmay",
      "lineName": "Mildmay line",
      "mode": "overground",
      "color": "#EE7C0E",
      "statusSeverityDescription": "Part Closure",
      "corridorDescription": "No service between Camden Road and Willesden Junction.",
      "hasDisruption": true,
      "notices": [
        {
          "headline": "Camden Road ↔ Willesden Junction: No service",
          "corridor": "Camden Road to Willesden Junction",
          "timeframe": "Saturday 17 and Sunday 18 October",
          "busRoute": {
            "title": "Replacement buses operate",
            "stops": ["Camden Road", "Kentish Town West", "Gospel Oak", "Hampstead Heath", "Finchley Road & Frognal", "West Hampstead", "Brondesbury", "Brondesbury Park", "Kensal Rise", "Willesden Junction"]
          }
        }
      ]
    },
    {
      "lineId": "victoria",
      "lineName": "Victoria",
      "mode": "tube",
      "color": "#0098D4",
      "statusSeverityDescription": "No Planned Closures",
      "hasDisruption": false,
      "notices": []
    }
  ],
  "lastUpdated": "2026-10-16T09:00:00.000Z"
}
```

### Sample: Instant Portfolio Demo Alert

```bash
curl -X POST http://localhost:3000/api/demo/send-test-digest \
  -H "Content-Type: application/json" \
  -d '{"email": "visitor@example.com", "lineIds": ["mildmay", "victoria"]}'
```

```json
{
  "status": "queued",
  "email": "visitor@example.com"
}
```

### Standardized Error Contract (RFC 9457 Problem Details)

All validation and route errors return RFC 9457 `application/problem+json` envelopes:

```json
{
  "type": "https://railsignal.dev/errors/validation-error",
  "title": "Bad Request",
  "status": 400,
  "detail": "Body must have required property 'lineIds'",
  "instance": "/api/subscriptions"
}
```

---

## 🚀 Local Development

The repository is built for **frictionless zero-Docker onboarding**: you do not need Docker, local Redis, or external cloud accounts to run and test the application locally.

### Prerequisites
* [Node.js 22 LTS](https://nodejs.org/) (`node -v` >= 22.0.0)
* `npm` 10+

### Quick Start (4 Steps)

```bash
# 1. Clone the repository
git clone https://github.com/Foysal94/RailSignal.git
cd RailSignal

# 2. Install dependencies across all npm workspaces
npm install

# 3. Initialize the local SQLite database
npx prisma db push --schema=backend/prisma/schema.prisma

# 4. Start backend API and React client concurrently
npm run dev
```

* **Backend API**: `http://localhost:3000` (Fastify server with automatic reload via `tsx`)
* **React Web App**: `http://localhost:5173` (Vite dev server with hot module replacement)

### Development Ergonomics & Fallbacks
* **Database**: Automatically creates a local SQLite file (`railsignal.db`) when `DATABASE_URL` is omitted.
* **Email Preview**: If `RESEND_API_KEY` is not supplied, the backend automatically logs formatted email notifications to the console instead of failing.
* **Interactive Email Designer**: Run `npm run email:dev` to launch the React Email visual preview server on `http://localhost:3002` for styling templates without sending real emails.
* **Standalone Job Runner**: Manually execute the scheduled TfL sync job locally:
  ```bash
  npm run job:sync-disruptions:dev --workspace=@railsignal/backend
  ```

---

## 🧪 Testing Strategy

The repository maintains **226 automated tests** (151 backend, 75 client) executing in under 12 seconds with zero network access and zero external cloud dependencies.

```bash
# Run all test suites across the monorepo
npm test

# Run tests with V8 code coverage reports
npm run test:coverage

# Run TypeScript typechecks across all packages
npm run typecheck

# Run Biome lint checks
npm run lint
```

### Test Architecture

1. **In-Memory Fastify Integration Tests (`backend/tests/integration/`)**:
   * Utilizes Fastify's native `app.inject()` in-memory transport.
   * Runs against an ephemeral local SQLite database (`test.db`) reset between test suites.
   * BullMQ queue connections are replaced with in-memory test doubles, testing full HTTP transport, TypeBox validation, Prisma database transactions, and queue payload assertions without external Redis.
2. **Pure Domain & Adapter Unit Tests (`backend/tests/unit/`)**:
   * Pure tests for the London operational window (`temporal.ts`), disruption status ranking (`statusBoard.ts`), and Cockatiel retry/breaker policies.
3. **Mock Service Worker (MSW) Client Tests (`client/src/`)**:
   * React component and hook tests with `@testing-library/react` and MSW (Mock Service Worker).
   * Intercepts network calls at the HTTP boundary, avoiding brittle `vi.fn()` fetch mocking and asserting real user interactions, keyboard navigation, and dialog focus traps.

---

## ☁️ Cloud Infrastructure & £0 Budget

RailSignal is designed with deliberate resource frugality to maintain a strict **£0/month forever** hosting ceiling while ensuring high availability:

| Resource | Service & Tier | Free Tier Allowance | RailSignal Consumption Strategy |
| :--- | :--- | :--- | :--- |
| **Compute** | Azure Container Apps (Consumption) | 180,000 vCPU-seconds / month | Unified single container (`minReplicas = 0`) scales to zero when traffic is idle. |
| **Scheduled Job** | Azure Container Apps Job | Free consumption minutes | Dedicated cron job (`0 9 * * 5`) triggers `syncDisruptionsRunner` once weekly on Friday morning. |
| **Database** | Neon Serverless PostgreSQL | 0.5 GB storage & free compute | Normalized relational data with indexed lookups; negligible storage footprint. |
| **Queue** | Upstash Serverless Redis | 10,000 commands / day | BullMQ workers tuned with `drainDelay: 60s` idle backoff caps daily empty-queue polling commands to <1,500/day. |
| **Email Delivery** | Resend Transactional Email | 3,000 emails / month | Consolidated weekly Friday digest with database deduplication (`lastNotifiedWeekendDate`). |
| **CI/CD** | GitHub Actions | 2,000 min / month (free for public repos) | Isolated workflows for backend container builds and client deployments. |

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).