# ADR 0008: Materialized Disruption Notices in Normalized Prisma Child Table

## Status
Accepted

## Context
In earlier iterations, TfL disruption narrative text was stored as unstructured strings in `WeekendDisruption.corridorDescription`. While parsing structured notices (headlines, corridors, timeframes, replacement bus routes, and specific station closures) was introduced via `parseDisruptionNotices`, this parsing was initially executed at runtime on the read path:
1. Every HTTP request to `GET /api/lines/weekend-status` (`fetchWeekendStatus`).
2. Every subscriber notification batch dispatch (`mapDisruptionsToDigestItems`).
3. Every portfolio visitor test alert (`processDemoAlertJob`).

Executing multi-pass regular expressions on every HTTP query and email render introduced unnecessary CPU overhead, latency variance on the high-frequency radar status board (<5ms response target), and duplicated read-time parsing across separate HTTP and BullMQ worker subsystems.

Furthermore, per ADR 0002 (Prisma Dual-Persistence Strategy), the data model must maintain 100% dialect parity between local embedded SQLite (zero-Docker developer onboarding) and Neon Serverless PostgreSQL in cloud production, precluding the use of dialect-dependent PostgreSQL JSON operators or native array types.

## Decision
1. **Write-Path Ingestion Parsing**: Run `parseDisruptionNotices` once during the ingestion pipeline within `parseTflDisruptions` (`backend/src/clients/tfl/parser.ts`), attaching structured notices directly to `ParsedDisruption`.
2. **Normalized 1NF Child Table (`DisruptionNotice`)**: Introduce a dedicated `DisruptionNotice` relational table in `backend/prisma/schema.prisma` with `id`, `disruptionId`, `headline`, `corridor`, `timeframe`, `busRouteJson`, `detailsJson`, `rawFallback`, and an index on `disruptionId`.
3. **Cascade Deletion**: Establish a one-to-many relationship from `WeekendDisruption` to `DisruptionNotice` with `onDelete: Cascade`. When stale or cancelled disruptions are pruned during reconciliation in `projectDisruptions`, the database engine cascades and purges child notice records automatically.
4. **Dialect-Agnostic JSON Columns**: Store structured nested objects (`busRoute` and string array `details`) as serialized JSON strings (`busRouteJson: String?`, `detailsJson: String?`), preserving identical SQLite and PostgreSQL schema representations without engine-specific divergence.
5. **Atomic Transactional Reconciliation**: In `projectDisruptions`, atomically upsert `WeekendDisruption` and replace child `DisruptionNotice` records within the existing `$transaction` block.
6. **Zero Read-Time Regex**: Update `fetchWeekendStatus`, `mapDisruptionsToDigestItems`, `processDemoAlertJob`, and `matchSubscribersForWeekend` to query disruptions with `include: { notices: true }`, completely eliminating runtime regular expression execution on the read path.
7. **Pure Mapping Seam (`disruptionNotices.ts`)**: Isolate serialization (`serializeDisruptionNotice`) and deserialization (`deserializeDisruptionNotice`) into a focused, pure domain module tested in isolation.
8. **Preserve Fallback Narrative**: Retain the raw TfL string in `WeekendDisruption.corridorDescription` as a permanent fallback for unusual or unexpected text formats.

## Consequences
- **Instant Read Projections**: Status queries and weekly email renders execute instant pass-through transformations without CPU-intensive regex scanning, safeguarding sub-5ms response targets.
- **Strict ADR 0002 Compliance**: The normalized child table with cascade delete and nullable JSON strings behaves identically across SQLite and PostgreSQL, maintaining seamless zero-Docker onboarding and robust cloud migrations.
- **Architectural Cohesion**: Write-path parsing occurs at the ingestion boundary; read-path consumers interact exclusively with pre-parsed, strongly-typed domain contracts.
