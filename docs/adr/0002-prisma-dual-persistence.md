# ADR 0002: Prisma Dual-Persistence Strategy (SQLite Locally vs. Neon PostgreSQL in Cloud)

## Status
Accepted

## Context
RailSignal requires zero-Docker local onboarding (developers clone and run immediately using an embedded SQLite file) while deploying against Neon Serverless PostgreSQL in production. 

Unlike EF Core in .NET which allows runtime provider swapping (`options.UseSqlite()` vs `options.UseNpgsql()`), Prisma ORM fixes its database provider statically inside `prisma/schema.prisma` (`provider = "sqlite"`). Pointing a Prisma schema targeting `sqlite` to a PostgreSQL connection string fails at runtime.

## Decision
1. Maintain a single canonical `backend/prisma/schema.prisma` targeting `provider = "sqlite"` for local development.
2. Structure all models and data types to be normalized and strictly compatible across both SQLite and PostgreSQL dialects. Model multi-value associations using relational junction tables (`SubscriptionLine` with cascade delete and compound unique constraints) rather than dialect-dependent array types or denormalized JSON strings, maintaining First Normal Form (1NF) and enabling high-performance indexed B-tree lookups during digest dispatch across both engines.
3. Introduce an automated pre-build script (`prisma:prep-prod`) in `backend/package.json` that replaces `provider = "sqlite"` with `provider = "postgresql"` during cloud Docker builds and CI pipelines prior to executing `prisma generate` and `prisma migrate deploy`.

## Consequences
- Preserves 100% zero-Docker local onboarding with zero setup overhead.
- Eliminates schema duplication across multiple `.prisma` files.
- Automated and fully encapsulated in the production `Dockerfile`.
