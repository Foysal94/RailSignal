# Backend Directives: RailSignal Fastify & Node.js API

## Commands
- Dev Server: `npm run dev` (inside `/backend`)
- Run Tests: `npm run test`
- Database Migrations: `npx prisma migrate dev`
- Run Scheduled Job: `node dist/jobs/syncDisruptionsRunner.js` (or `npm run job:sync-disruptions`)
- Lint & Format: Execute at monorepo root via `npm run lint` / `npm run format`

## Architecture & Boundaries
- **Fastify Plugins:** Endpoints reside in `src/routes/` as Fastify plugins. Routes are HTTP transport adapters only: read routes query Prisma directly; trigger routes enqueue BullMQ jobs.
- **External Clients:** External integrations live in `src/clients/` (TfL API client with retries/backoff). Never call third-party APIs directly inside route handlers.
- **Workers & Jobs:** Ingestion pipelines and notifications live in `src/workers/` as BullMQ workers. Scheduled runners live in `src/jobs/`.
- **Persistence:** Dual SQLite (local development) and PostgreSQL (Neon cloud) via Prisma ORM.
- **Validation & Errors:** Validate requests with Fastify schemas returning RFC 9457 (`application/problem+json`).
- **Modularity & SRP:** A file must have one reason to change. Never co-locate external I/O/transport, domain business rules, and payload transformation in the same file. Ticket paths define public entry points; decompose internal concerns into cohesive sibling modules.

## Style & Coding Standards
- **Returns & Primitives:** Return typed interfaces/objects; never positional array tuples `[data, error]`. No artificial `Result<T>` wrappers.
- **Parameters:** For methods with 3+ arguments, use a single typed options object instead of positional arguments.
- **Comments (Why, Never What):** Zero tautological comments (`// fetch data`). Mandatory rationale comments for non-obvious logic: vendor quirks, framework traps, temporal edge cases, or domain heuristics.
- **Encapsulation & Extraction:** Never expose private class members or route handlers purely for test access. If unexported helper logic requires dedicated unit testing, extract it into a focused pure module (e.g., date math, payload parsers) and test that module's public contract directly.

## Testing Standards
- Runner: Vitest with Fastify `app.inject()` for in-memory integration testing.
- Test Naming: Every test case must follow `Should_...`.
- Assert observable state and side effects; avoid mocking internal implementations.
