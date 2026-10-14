# ADR 0007: Deep Email Delivery Client and Subsystem Architecture

## Status
Accepted

## Context
The initial Phase 2B email implementation decomposed email delivery across several shallow layers: `ResendEmailClient`, `buildDigestEmailPayload` (`digestService.ts`), and `ResendTransportClient`. While intended to separate concerns, this multi-tier pipeline resulted in shallow modules where each layer did very little work, forcing callers and unit tests to understand intermediate transformation glue.

Furthermore, several architectural defects emerged:
1. **Leaky Barrel Export**: `backend/src/email/index.ts` re-exported internal implementation modules (`renderer.ts`, `resilience.ts`, and the React component `DisruptionDigest`), creating tight coupling across module boundaries.
2. **Circular Type Dependency**: `types.ts` imported `DisruptionDigestProps` from `templates/DisruptionDigest.tsx`, which imported `SAMPLE_DISRUPTION_DIGEST_PROPS` from `templates/sampleData.ts`, which imported `DisruptionDigestProps` back from `DisruptionDigest.tsx`.
3. **Spam & RFC 8058 Compliance**: Email headers for one-click list-unsubscribe (`List-Unsubscribe` and `List-Unsubscribe-Post`) were constructed ad-hoc inside the payload glue builder without isolated unit verification or strict precedence rules over caller-supplied headers.
4. **SRP & God-Object Risk**: Collapsing domain template assembly directly into a transport `EmailClient` violates Single Responsibility and risks God-object accumulation as additional notification types (e.g. Phase 3B Demo alerts) are introduced.

## Decision
1. **Deep Transport Client (`client.ts`)**: Consolidate Resend SDK dispatch, dev-mode console fallback, React-to-HTML compilation, and Cockatiel retry policies into a single deep `EmailClient` class. Expose a minimal transport contract (`sendEmail`). The transport client has zero coupling to specific transit templates or TfL domains.
2. **Domain Email Dispatcher (`digest.ts`)**: Isolate domain template coordination in `digest.ts` exposing `sendDisruptionDigest(options, client?)`. It coordinates `DisruptionDigest` React element creation, default subject fallback, and RFC 8058 deliverability headers before delegating dispatch to `EmailClient`.
3. **Extract Pure RFC 8058 Header Helper (`headers.ts`)**: Move header generation into an internal pure module implementing `buildUnsubscribeHeaders(digest, customHeaders)` with case-insensitive collision filtering and bracket normalization to satisfy Gmail and Yahoo 2024 bulk-sender deliverability mandates.
4. **Lock Down Barrel Export (`index.ts`)**: Narrow `backend/src/email/index.ts` to expose only `EmailClient`, `createEmailClient`, lazy singleton proxy `emailClient`, `sendDisruptionDigest`, and canonical payload types (`SendEmailOptions`, `SendEmailResult`, `SendDisruptionDigestOptions`, `DisruptionDigestProps`, `DisruptionDigestItem`). Keep renderer, resilience policies, headers, and React template components private.
5. **Break Type Cycles (`types.ts`)**: Establish a unidirectional type graph by locating domain types (`DisruptionDigestProps`, `DisruptionDigestItem`) in `types.ts` with zero internal imports.
6. **Direct Contract Testing**: Migrate unit tests to exercise `EmailClient`, `sendDisruptionDigest`, and `buildUnsubscribeHeaders` directly.

## Consequences
- **High Cohesion & Clear Seams**: Infrastructure transport (`client.ts`) and domain presentation (`digest.ts`) each have exactly one reason to change, honoring monorepo SRP directives.
- **Scalable Notification Domain**: New notification types (e.g. demo alerts, subscription confirmations) can be added as cohesive domain dispatchers without modifying or bloating the network transport client.
- **Cycle-Free Dependency Graph**: Clean unidirectional imports from `types.ts` through templates, domain dispatchers, and clients.
- **Maintainable Test Suite**: Tests exercise public contracts and pure extracted helpers without mocking shallow internal boundaries.
