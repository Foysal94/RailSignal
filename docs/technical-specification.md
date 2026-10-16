# Technical Specification: RailSignal

## 1. System Overview

* **Project Name**: `RailSignal` (TypeScript monorepo: `@railsignal/backend`, `@railsignal/client`, `@railsignal/shared`).
* **Core Problem**: London commuters travel reliably during the working week, but face weekend travel ambushes from planned TfL track maintenance, station shutdowns, and rail replacement buses.
* **Core Solution**: A subscription and early-warning closure radar that ingests TfL planned engineering data, projects a weekend line-health read model, and delivers consolidated Friday email alerts alongside a high-contrast web dashboard.
* **Hosting Cost**: Strictly **£0 forever** (Upstash Serverless Redis free tier, Azure Container Apps free consumption tier, Neon PostgreSQL free tier, Resend free transactional email).
* **Architecture Pattern**: Unified single-process Node.js host (`backend/src/index.ts`) combining Fastify HTTP route plugins and BullMQ queue workers to minimize compute overhead and maximize Azure Container Apps (ACA) free-tier allocation (`minReplicas = 0`).

---

## 2. Monorepo Solution Structure

Configured as a modern TypeScript monorepo using npm workspaces:

```text
RailSignal/
├── package.json                        # Root workspace coordinator
├── tsconfig.base.json                  # Shared TypeScript compiler options (Strict, ES2022)
├── CONTEXT.md                          # Domain glossary
├── .github/
│   └── workflows/
│       ├── backend-ci-cd.yml           # CI/CD: Node build, Vitest, Docker build, ACA deploy
│       └── client-ci-cd.yml            # CI/CD: Client build, Vitest, lint, typecheck
├── docs/                               # Architecture blueprints and specifications
│   ├── adr/                            # Architecture Decision Records
│   │   ├── 0001-pivot-dotnet-to-typescript-monorepo.md
│   │   ├── 0002-prisma-dual-persistence.md
│   │   ├── 0003-bullmq-upstash-quota-and-scale-to-zero.md
│   │   ├── 0004-cockatiel-resilience-and-react-email.md
│   │   ├── 0005-typebox-validation-and-shared-contracts.md
│   │   ├── 0006-frontend-design-system-and-ui-architecture.md
│   │   ├── 0007-deep-email-delivery-client.md
│   │   └── 0008-materialized-disruption-notices.md
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
│           └── contracts.ts            # TypeBox shared API request/response schemas & static DTOs
├── backend/                            # Fastify & Node.js API + BullMQ Worker Root
│   ├── AGENTS.md                       # Backend specific agent directives
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile                      # Multi-stage production container with provider swap
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
│   │   │   ├── connection.ts           # Upstash Redis ioredis connection factory (TLS, drainDelay: 60s)
│   │   │   ├── queues.ts               # ingestQueue, notificationQueue, demoAlertQueue
│   │   │   └── jobs.ts                 # Job payload interfaces
│   │   ├── workers/                    # BullMQ Worker processors
│   │   │   ├── ingestionWorker.ts      # Calls TfL, normalizes weekend window, saves to DB
│   │   │   ├── notificationWorker.ts   # Matches subscribers, sends Resend digest with deduplication
│   │   │   └── demoAlertWorker.ts      # On-demand test alert processor
│   │   ├── clients/                    # External HTTP clients
│   │   │   └── tfl/                    # Sealed TfL client module (deep facade, internal parser & resilience)
│   │   │       ├── client.ts           # Deep TflClient class (URL building, fetch, private resilience)
│   │   │       ├── parser.ts           # Heuristic disruption parser, line matcher & deduplicator
│   │   │       ├── resilience.ts       # Cockatiel retry, breaker & timeout policies
│   │   │       ├── types.ts            # Internal TfL DTOs (RawTflDisruption) & ParsedDisruption
│   │   │       └── index.ts            # Sealed public barrel (TflClient, ParsedDisruption, TflHttpError)
│   │   ├── domain/                     # Core domain business rules
│   │   │   ├── temporal.ts             # Europe/London weekend operational window calculator
│   │   │   └── disruptionNotices.ts    # Materialized disruption notice serialization & domain mapping
│   │   ├── email/                      # Email notifications
│   │   │   ├── client.ts               # Deep EmailClient module (Resend SDK, retries, console mock)
│   │   │   ├── digest.ts               # Domain email dispatcher (DisruptionDigest coordination)
│   │   │   ├── headers.ts              # RFC 8058 one-click list-unsubscribe headers
│   │   │   ├── renderer.ts             # React Email pure JSX compilation
│   │   │   ├── resilience.ts           # Cockatiel exponential backoff retry policy
│   │   │   ├── types.ts                # Email and digest payload types
│   │   │   ├── index.ts                # Narrow barrel exports (EmailClient & payload types)
│   │   │   └── templates/              # @react-email templates
│   │   │       └── DisruptionDigest.tsx# Responsive JSX email template
│   │   └── jobs/                       # Standalone CLI job runner
│   │       └── syncDisruptionsRunner.ts# Dedicated standalone script (`node dist/jobs/syncDisruptionsRunner.js`)
│   └── tests/
│       ├── unit/                       # TfL parsing, London date calculations, cockatiel policies
│       └── integration/                # Fastify app.inject() endpoint & pipeline tests with local test.db
└── client/                             # Single-page web client (Vite + React 19 + Tailwind + Radix UI)
    ├── AGENTS.md                       # Frontend specific agent directives
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── src/
    │   ├── api/
    │   │   └── client.ts               # Typed client calling backend API
    │   ├── hooks/
    │   │   └── useWeekendStatus.ts     # TanStack Query v5 hook (gated on isFetching)
    │   ├── components/
    │   │   ├── layout/
    │   │   │   └── Header.tsx          # Branding, temporal window badge, dual CTAs
    │   │   ├── NetworkStatusGrid.tsx   # Clean single-stream line status cards (sorted by disruption)
    │   │   ├── LineCard.tsx            # Line status card with TfL color stripe & corridor text
    │   │   ├── SubscriptionModal.tsx   # Radix UI dialog for email subscription
    │   │   └── TestAlertModal.tsx      # Radix UI dialog for instant test alert
    │   └── App.tsx
    └── tailwind.config.js
```

---

## 3. Database Schema & Dual-Persistence Strategy

### 3.1 Zero-Docker Local Development vs. Production Cloud
* **Local Development**: Points to a local SQLite database (`file:./railsignal.db`). Zero Docker or remote account needed.
* **Production Cloud**: Points to Neon Serverless PostgreSQL (`postgresql://...`).
* **Automated Build-Time Provider Swap**: `schema.prisma` defaults to `provider = "sqlite"`. A pre-build script (`prisma:prep-prod`) in `backend/package.json` replaces `provider = "sqlite"` with `provider = "postgresql"` inside Docker and CI before running `prisma generate` and `prisma migrate deploy` (see ADR 0002).

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
  id                      String             @id @default(uuid())
  email                   String             @unique
  unsubscribeToken        String             @unique @default(uuid())
  lastNotifiedWeekendDate String?            // ISO Date string "YYYY-MM-DD" for alert deduplication/idempotency
  createdAt               DateTime           @default(now())
  lines                   SubscriptionLine[]
}

model SubscriptionLine {
  id             String       @id @default(uuid())
  subscriptionId String
  lineId         String
  subscription   Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@unique([subscriptionId, lineId])
  @@index([lineId])
}

model WeekendDisruption {
  id                        String             @id @default(uuid())
  lineId                    String
  lineName                  String
  mode                      String             // "tube", "elizabeth-line", "overground", "dlr"
  statusSeverityDescription String             // "Part Closure", "Planned Closure", etc.
  corridorDescription       String             // E.g. "No service between Camden Town and High Barnet"
  weekendDate               String             // ISO Date "YYYY-MM-DD"
  validFrom                 DateTime
  validTo                   DateTime
  sourceLastUpdated         DateTime
  projectedAt               DateTime           @default(now())
  notices                   DisruptionNotice[]

  @@index([lineId])
  @@index([weekendDate])
  @@unique([lineId, weekendDate, corridorDescription])
}

model DisruptionNotice {
  id           String            @id @default(uuid())
  disruptionId String
  headline     String
  corridor     String
  timeframe    String?
  busRouteJson String?           // Serialized ReplacementBusRoute JSON or null
  detailsJson  String?           // Serialized string[] of secondary bullet points
  rawFallback  String?
  disruption   WeekendDisruption @relation(fields: [disruptionId], references: [id], onDelete: Cascade)

  @@index([disruptionId])
}
```

---

## 4. Messaging Architecture & Queue Topology (BullMQ + Upstash Redis)

### 4.1 Connection & Free-Tier Quota Protection
* **Engine**: BullMQ powered by **Upstash Serverless Redis** over TLS (`rediss://...`) via `ioredis`.
* **Quota Management**: Upstash free tier allows 10,000 commands/day. Workers are configured with `drainDelay: 60000` (1 minute empty-queue polling backoff).
* **Scale-to-Zero**: Azure Container Apps runs with `minReplicas = 0`. When no web traffic is active, ACA stops the container, reducing Redis command consumption to 0.

### 4.2 Queues & Job Flow
1. **`ingest-disruptions-queue`**:
   - Triggered every Friday at 09:00 UK time (via ACA Scheduled Job or manual API trigger).
   - Worker fetches TfL disruptions via `tflClient`, normalizes against the upcoming weekend window (Friday 19:00 to Monday 04:30 London local time), parses and materializes structured `DisruptionNotice` child records alongside `WeekendDisruption` in Prisma via atomic transactions (ADR 0008), and enqueues jobs to `notification-dispatch-queue`. Downstream read paths query pre-materialized notices directly without runtime regex parsing.
2. **`notification-dispatch-queue`**:
   - Consumes disruption events per affected subscriber.
   - Enforces idempotency: verifies `lastNotifiedWeekendDate !== currentWeekendDate` before sending email.
   - Generates responsive HTML email digests via `@react-email` and dispatches via Resend API.
   - Updates `lastNotifiedWeekendDate` in Prisma upon successful dispatch.
3. **`demo-alert-queue`**:
   - Handles on-demand test alert requests (`POST /api/demo/send-test-digest`).
   - Dispatches an immediate test email to the requester without modifying subscriber state.

---

## 5. External Adapters & Contracts

### 5.1 Sealed TfL Unified API Client Module (`src/clients/tfl/`)
* **Endpoint**: `https://api.tfl.gov.uk/Line/Mode/tube,elizabeth-line,overground,dlr/Disruption`
* **Architecture**: Deep module exposing minimal public entry point (`TflClient`, `tflClient`, `TflHttpError`, `ParsedDisruption`). All raw DTOs (`RawTflDisruption`, `RawTflAffectedRoute`), regex parsing helpers, and internal resilience policy constructors remain completely hidden behind internal module seams.
* **Resilience Policy (`cockatiel`)**: 
  - Retry: 3 attempts with exponential backoff and decorrelated jitter.
  - Timeout: 8000ms abort signal.
  - Circuit Breaker: 5 consecutive failures opens circuit for 30 seconds.
  - Policies are fully encapsulated; `TflClientOptions` accepts test controls (`disableResilience?: boolean`, `fetchFn?: typeof fetch`) to bypass latency without exposing Cockatiel `IPolicy` instances.
* **Domain Temporal Window Calculator (`src/domain/temporal.ts`)**: 
  - Pure domain temporal module calculating the **Friday 19:00 to Monday 04:30 UK local time** (`Europe/London`) operational weekend window using `date-fns` and `@date-fns/tz`.
  - Decoupled from third-party client code, serving both TfL ingestion filtering and future scheduling/digest jobs. Accurately resolves GMT/BST boundaries.

### 5.2 Transactional Email Dispatcher (`src/email/`)
* **Architecture**: Deep `EmailClient` transport module (`client.ts`) collapsing Resend SDK dispatch, JSX compilation, console mock fallback, and Cockatiel retries into `sendEmail`, decoupled from the domain email dispatcher (`digest.ts`) exposing `sendDisruptionDigest` with internal pure helpers for JSX rendering (`renderer.ts`), retry policies (`resilience.ts`), and RFC 8058 unsubscribe header generation (`headers.ts`).
* **Provider**: Resend API (free tier: 3,000 emails/month).
* **Templates**: Built with `@react-email/components` (`templates/DisruptionDigest.tsx`). Produces accessible, bulletproof HTML with inline CSS compatible with Outlook and mobile clients.
* **Deliverability & Spam Compliance**: Automatic RFC 8058 one-click list-unsubscribe headers (`List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`) to satisfy Gmail and Yahoo bulk sender requirements.
* **Resilience**: Cockatiel exponential backoff retry policy with decorrelated jitter (ADR 0004) absorbing Resend rate limits (429) and network stalls.
* **Local Development Preview**: Local preview server via `npm run email:dev` ensures zero Resend API quota is consumed during template styling.
* **Mock Fallback**: In local dev, if `RESEND_API_KEY` is omitted, the client logs rendered email output to the console instead of failing.

### 5.3 Shared Contracts & Validation (`packages/shared`)
* **Library**: TypeBox (`@sinclair/typebox`).
* Request and response schemas (`SubscriptionRequestSchema`, `WeekendStatusResponseSchema`) defined in `packages/shared/src/contracts.ts`.
* Inferred TypeScript types (`Static<typeof ...>`) shared directly across `backend` and `client`.
* Errors formatted as RFC 9457 `application/problem+json` via global Fastify error handler.

---

## 6. HTTP API Endpoints (Fastify)

* `GET /api/health`: Returns `{ "status": "healthy" }`.
* `GET /api/lines/weekend-status`: Queries `WeekendDisruption` table from Prisma (<5ms response).
* `POST /api/subscriptions`: Validates payload `{ email, lineIds }` via TypeBox, creates or updates subscriber.
* `DELETE /api/subscriptions/:id?token=:token`: Unsubscribes user using immutable token.
* `POST /api/demo/send-test-digest`: Enqueues on-demand demo alert; returns `{ "status": "queued" }`.
* `POST /api/jobs/sync-weekend-disruptions`: Protected by `X-Job-Secret` header; enqueues ingestion job.

---

## 7. Frontend Visual Architecture & Design System (Clean Transit Radar)

See [ADR 0006](file:///Users/foysalahmed/Code/RailSignal/docs/adr/0006-frontend-design-system-and-ui-architecture.md).

### 7.1 Visual Palette & Design Tokens
* **Theme**: Deep slate/navy dark mode (`#0B0F19` page background, `#111827` card background, `border-slate-800`).
* **Line Color Accents**: Left accent border stripe (4px width) using official TfL hex colors.
* **Northern Line Accessibility**: Black stripe (`#000000`) rendered with a 1px `border-neutral-500` outline to guarantee 4.5:1 contrast against dark card surfaces.
* **WCAG 2.1 AA Contrast**: Footer copy uses `text-slate-400` (`#94a3b8`) on `#0B0F19` background yielding a 5.81:1 contrast ratio, comfortably exceeding the WCAG 2.1 AA 4.5:1 minimum threshold.
* **Responsive Dialog Framing**: Dialog containers enforce `w-[calc(100%-2rem)] max-w-lg mx-auto` to preserve 1rem lateral breathing room against physical glass edges on 375px mobile viewports.
* **Status Badges**:
  * `Planned Closure`: Red (`bg-red-950/80 text-red-300 border border-red-800`).
  * `Part Closure` / `Minor Delays`: Amber (`bg-amber-950/80 text-amber-300 border border-amber-800`).
  * `No Planned Closures` (formerly `Good Service`): Emerald (`bg-emerald-950/80 text-emerald-300 border border-emerald-800`). Updated copy explicitly clarifies that the system is an early-warning engineering works radar rather than live mid-week running telemetry.

### 7.2 Header & Dual Action Bar
* **Branding**: `RailSignal` logo with live pulsing status indicator.
* **Top-Right CTAs**:
  * `[Send Test Alert]`: Solid blue accent button (`bg-blue-600 hover:bg-blue-500 text-white min-h-[44px]`). Opens `TestAlertModal`.
  * `[Friday Alerts]`: Outline button (`border border-slate-700 hover:bg-slate-800 text-slate-200 min-h-[44px]`). Opens `SubscriptionModal`.

### 7.3 Hero & Information Architecture
* **Hero Subheader Badge**: Positioned directly above the disruption cards to prominently anchor the upcoming operational window with dynamic calendar dates formatted from `data.weekendDate` (e.g., `Weekend Radar: Fri 16 Oct 19:00 – Mon 19 Oct 04:30`). Prevents commuters scanning the feed from mistaking forecasted weekend closures for today's live train status.
* **Transit Acronym Preservation**: Domain modes preserve explicit acronym casing, rendering `DLR` in uppercase rather than capitalized `Dlr`.
* **Stream Summary Counter**: Displays `{count} Planned Closures This Weekend` (or `No planned closures this weekend`) alongside `{count} lines evaluated`.
* **Priority Sorting**: Lines with planned closures automatically sort to the top with visible corridor disruption descriptions (*"No service between Victoria and Brixton during maintenance"*).
* **Normal Service**: Lines with `No Planned Closures` sort alphabetically below.

### 7.4 Modal Interaction & Submission Flow
* **Accessibility & Initial Focus**: Dialogs automatically route focus to the email input field upon opening via the Dialog primitive's `initialFocusRef`, rather than defaulting focus to the Close ("X") button.
* **Unified Validation & Error Placement**:
  - Email format validation provides real-time `onBlur` feedback and form submit verification.
  - Form errors avoid duplicate stacked banners: email format errors are rendered exclusively as a single, accessible alert directly under the email input with `aria-invalid` and `aria-describedby` associations.
  - Top modal alert banners are reserved strictly for non-input errors (line selection validation, network/server failures).
  - 0-Line Validation: Both `SubscriptionModal` and `TestAlertModal` mandate that at least one transit line must be selected before dispatch, blocking submission with `"At least one line must be selected."` and preventing empty line arrays from falling back to all 19 lines.
* **Line Selection Parity & Counter**: Both modals feature a "Select All" checkbox toggle alongside a live counter badge (`X/19 lines selected`), ensuring consistent line selection ergonomics across subscription and demo alert workflows.
* **Mobile Scroll Trap Prevention**: Inner transit lines checklist utilizes adaptive max heights (`max-h-36 sm:max-h-52`) with `overscroll-contain` alongside a sticky bottom actions bar (`sticky bottom-0 bg-radar-card`), ensuring submission controls remain accessible on short mobile landscape viewports and virtual keyboards (<=480px height).
* **Self-Contained Confirmation**: Submitting either modal (`TestAlertModal` or `SubscriptionModal`) replaces the form with a rich, in-dialog success confirmation card with clear action buttons ("Send Another" / "Close"). The dialog remains open so commuters can read next steps without jarring auto-dismissal or redundant floating toast popups.

---

## 8. Cloud Hosting Strategy (£0 Forever)

* **Compute**: Azure Container Apps (ACA) consumption tier (180,000 vCPU-seconds free per month; scales to zero when idle).
* **Scheduled Job**: ACA Scheduled Job (`azurerm_container_app_job`) runs `node dist/jobs/syncDisruptionsRunner.js` every Friday at 09:00 UK time.
* **Database**: Neon Serverless PostgreSQL free tier.
* **Queue**: Upstash Serverless Redis free tier.
* **Email**: Resend free tier.

---

## 9. Test Strategy

* **Runner**: Vitest across all workspaces.
* **Backend Unit Tests**: Date window calculations (`date-fns`), cockatiel retry policies, and DTO validations.
* **Backend Integration Tests**:
  - In-memory execution using Fastify `app.inject()`.
  - Isolated local SQLite database (`test.db`) reset between test runs.
  - In-memory queue doubles replacing BullMQ Redis connections.
  - Test naming follows strict `Should_...` convention.
* **Client Tests**: React Testing Library + MSW (Mock Service Worker) for network mocking; no raw `vi.fn()` fetch mocking.

---

## 10. Phased Implementation Roadmap

* **Phase 1: Foundation, Shared Contracts & Persistence**
  * **Phase 1A: Monorepo Workspaces, Shared Contracts & Fastify Baseline**: Setup workspaces, `packages/shared` (`lines.ts`, `contracts.ts`), Fastify baseline, RFC 9457 handler, Vitest smoke test.
  * **Phase 1B: Prisma Persistence, Models & Dual-Database Setup**: Prisma schema, `Subscription` & `WeekendDisruption` models, SQLite migrations, `src/db.ts` singleton, and `prisma:prep-prod` build script.
* **Phase 2: External Adapters**
  * **Phase 2A: Resilient TfL API Client**: Typed TfL client with `cockatiel` resilience and `date-fns` London weekend filter.
  * **Phase 2B: Transactional Email Client & Templates**: `@react-email` templates and Resend client with local mock fallback.
  * **Phase 2B.2: Email Subsystem Deepening & Pipeline Collapse (Architecture Refactoring)**: Deepen the email delivery pipeline by merging `ResendEmailClient`, `buildDigestEmailPayload`, and `ResendTransportClient` into a single deep `EmailClient` module, isolating internal seams, narrowing barrel exports, and resolving template type cycles (ADR 0007).
* **Phase 3: Queue Pipeline & Background Workers**
  * **Phase 3A: BullMQ Upstash Pipeline & Ingestion Worker**: Redis connection factory (TLS, `drainDelay: 60s`), `ingestionWorker.ts` with idempotent Prisma upserts.
  * **Phase 3B: Notification & Demo Dispatch Worker**: `notificationWorker.ts` with `lastNotifiedWeekendDate` deduplication, and `demoAlertWorker.ts`.
* **Phase 4: Fastify Route Plugins & CLI Jobs**
  * **Phase 4A: Fastify Route Plugins with TypeBox Validation**: Endpoints (`/api/lines/weekend-status`, `/api/subscriptions`, `/api/demo/send-test-digest`, `/api/jobs/sync-weekend-disruptions`).
  * **Phase 4B: Standalone CLI Job Runner**: `src/jobs/syncDisruptionsRunner.ts` (`node dist/jobs/syncDisruptionsRunner.js`).
* **Phase 5: Frontend Web Client (React 19)**
  * **Phase 5A: React 19 Frontend Shell & Weekend Status Board**: Clean Transit Radar layout, header with temporal badge and dual CTAs, `NetworkStatusGrid` with disruption-first sorting, left TfL color border stripes, Northern line contrast outline, TanStack Query v5 with `isFetching`.
  * **Phase 5B: Interactive Modals with Radix UI**: `TestAlertModal` (`POST /api/demo/send-test-digest`) and `SubscriptionModal` (`POST /api/subscriptions`) using `@radix-ui/react-dialog`.
* **Phase 6: Integration Suite & CI/CD**
  * **Phase 6A: In-Memory Integration Test Suite**: Fastify `app.inject()` + local SQLite `test.db` + mocked queues.
  * **Phase 6B: Production Dockerfile & CI/CD Workflows**: Multi-stage `Dockerfile` and GitHub Actions workflows deploying to ACA.
