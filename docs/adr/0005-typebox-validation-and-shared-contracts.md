# ADR 0005: TypeBox for Runtime Schema Validation and Shared Contracts

## Status
Accepted

## Context
TypeScript type declarations and interfaces are erased at compile time. At runtime, Node.js and Fastify receive raw JSON payloads over HTTP that require schema validation. Fastify internally uses Ajv and JSON Schema for request validation, serialization, and OpenAPI documentation.

We require a single source of truth for DTOs in `packages/shared` that delivers both runtime validation on the backend and static compile-time types for both the backend and React client without translation wrappers.

## Decision
Adopt **TypeBox** (`@sinclair/typebox`) as the canonical schema definition library across `packages/shared`:
1. Define request and response schemas (e.g. `CreateSubscriptionSchema`, `WeekendStatusResponseSchema`) using TypeBox `Type.Object(...)`.
2. Infer TypeScript types using `Static<typeof ...>` for use as DTO contracts across `backend` and `client`.
3. Register schemas directly into Fastify routes via Fastify's native JSON Schema validation pipeline.
4. Transform validation errors inside `fastify.setErrorHandler` into standardized RFC 9457 Problem Details (`application/problem+json`).

## Consequences
- Native Fastify compatibility with zero translation performance overhead.
- Automatic compile-time typing for the React client from the exact same schema.
- Automatic support for Swagger / OpenAPI documentation generation.
