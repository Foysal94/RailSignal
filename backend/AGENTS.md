# Backend Directives: RailSignal Fastify & Node.js API

## Commands
- Dev Server: `npm run dev` (inside `/backend`)
- Run Tests: `npm run test`
- Database Migrations: `npx prisma migrate dev`
- Run Scheduled Job: `node dist/index.js --job sync-disruptions`

## Architecture & Boundaries
- **Fastify Plugins:** Endpoints reside in `src/routes/` as Fastify plugins. Routes are HTTP transport adapters only: read routes query Prisma directly; trigger routes enqueue BullMQ jobs.
- **External Clients:** External integrations live in `src/clients/` (TfL API client with retries/backoff). Never call third-party APIs directly inside route handlers.
- **Workers & Jobs:** Ingestion pipelines and notifications live in `src/workers/` as BullMQ workers. Scheduled runners live in `src/jobs/`.
- **Persistence:** Dual SQLite (local development) and PostgreSQL (Neon cloud) via Prisma ORM.
- **Validation & Errors:** Validate requests with Fastify schemas returning RFC 9457 (`application/problem+json`).

## Style & Coding Standards
- **Returns & Primitives:** Return typed interfaces/objects; never positional array tuples `[data, error]`. No artificial `Result<T>` wrappers.
- **Parameters:** For methods with 3+ arguments, use a single typed options object instead of positional arguments.
- **Comments (Why, Never What):** Forbid tautological comments (`// fetch data`, `// return result`). Only comment the "why" (TfL API quirks, temporal window edge cases). No redundant JSDoc comments on self-typed signatures.
- **No Test Visibility Widening:** Never export private helper functions purely to test them. Test orchestration through route integration or public worker handlers.

## Testing Standards
- Runner: Vitest with Fastify `app.inject()` for in-memory integration testing.
- Test Naming: Every test case must follow `Should_...`.
- Assert observable state and side effects; avoid mocking internal implementations.
