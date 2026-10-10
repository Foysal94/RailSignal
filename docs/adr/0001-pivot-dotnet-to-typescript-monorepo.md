# ADR 0001: Pivot from C# .NET to TypeScript Monorepo Architecture

## Status
Accepted

## Context
RailSignal is Project 2 in the Senior Portfolio Triad. Project 1 (ElectronicLive) already proves deep C# .NET 10, ASP.NET Core Minimal APIs, EF Core, and cloud delivery. Market research into senior and founding engineering positions in the UK demonstrated overwhelming demand for backend TypeScript and Node.js alongside polyglot system design. Furthermore, hosting must maintain a strict **£0 forever** ceiling.

## Decision
Pivot RailSignal's backend from .NET 10 to a modern TypeScript / Node.js monorepo:
1. **Monorepo**: npm workspaces coordinating `packages/shared`, `backend`, and `client`.
2. **HTTP Server**: Fastify with modular route plugins.
3. **Database / ORM**: Prisma ORM with SQLite locally and Neon PostgreSQL in cloud production.
4. **Message Queue**: BullMQ over Upstash Serverless Redis (TLS).
5. **Compute**: Single container Node.js host (`backend/src/index.ts`) hosting both Fastify and BullMQ workers, deployed to Azure Container Apps (ACA) consumption tier with scale-to-zero (`minReplicas = 0`).
6. **Frontend**: React 19 + Vite + Tailwind CSS + TanStack Query v5.

## Consequences
- Single language and shared types across API and client without code generation or model drift.
- £0 hosting cost across all third-party services (Upstash Redis, Neon Postgres, ACA, Resend).
- Zero-Docker local onboarding for contributors using local SQLite.
