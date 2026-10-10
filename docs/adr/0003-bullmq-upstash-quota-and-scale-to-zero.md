# ADR 0003: BullMQ Upstash Quota Protection, Pipeline Idempotency & Scale-to-Zero

## Status
Accepted

## Context
RailSignal utilizes BullMQ backed by Upstash Serverless Redis over TLS (`rediss://...`) to run background queue jobs for TfL disruption ingestion and email dispatch. Upstash's free tier imposes a strict ceiling of 10,000 commands/day. Default BullMQ worker configurations poll Redis aggressively (`drainDelay: 5s`, frequent stall checks), which would exhaust the 10,000 command quota within hours.

Additionally, in Node.js there is no native transactional outbox spanning both PostgreSQL and Redis (unlike MassTransit EF Core Outbox in .NET).

## Decision
1. **Queue Connection & Tuning**: Configure BullMQ workers with an extended idle poll backoff (`drainDelay: 60000` ms) to minimize empty-queue polling commands.
2. **Compute Topology**: Host Fastify and BullMQ workers within a unified single Node.js process (`backend/src/index.ts`). Deploy to Azure Container Apps with `minReplicas = 0`. When no HTTP traffic is present, the container scales to zero, dropping Redis commands to zero.
3. **On-Demand Demos**: When portfolio visitors invoke `POST /api/demo/send-test-digest`, ACA wakes the unified container, processes the job immediately, and sends the demo alert without waiting for scheduled jobs.
4. **Pipeline Idempotency**: In lieu of a transactional outbox, enforce idempotency at the database layer. Subscriptions track `lastNotifiedWeekendDate`. Notification workers verify that an alert has not already been dispatched for the target weekend before firing Resend calls, ensuring safe and duplicate-free re-runs.

## Consequences
- Total daily Redis commands remain under 1,000/day during normal operation.
- Single unified deployment pipeline (1 Docker container, 1 ACA resource).
- Instant demo alerts work on demand with zero delay.
- Retries and pipeline failures are fully self-healing and duplicate-proof.
