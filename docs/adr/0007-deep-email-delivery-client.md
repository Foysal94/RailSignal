# ADR 0007: Deep Email Delivery Client and Subsystem Architecture

## Status
Accepted

## Context
The initial Phase 2B email implementation decomposed email delivery across several shallow layers: `ResendEmailClient`, `buildDigestEmailPayload` (`digestService.ts`), and `ResendTransportClient`. While intended to separate concerns, this multi-tier pipeline resulted in shallow modules where each layer did very little work, forcing callers and unit tests to understand intermediate transformation glue.

Furthermore, several architectural defects emerged:
1. **Leaky Barrel Export**: `backend/src/email/index.ts` re-exported internal implementation modules (`renderer.ts`, `resilience.ts`, and the React component `DisruptionDigest`), creating tight coupling across module boundaries.
2. **Circular Type Dependency**: `types.ts` imported `DisruptionDigestProps` from `templates/DisruptionDigest.tsx`, which imported `SAMPLE_DISRUPTION_DIGEST_PROPS` from `templates/sampleData.ts`, which imported `DisruptionDigestProps` back from `DisruptionDigest.tsx`.
3. **Spam & RFC 8058 Compliance**: Email headers for one-click list-unsubscribe (`List-Unsubscribe` and `List-Unsubscribe-Post`) were constructed ad-hoc inside the payload glue builder without isolated unit verification or strict precedence rules over caller-supplied headers.

## Decision
1. **Collapse into Deep Client**: Consolidate `ResendTransportClient` and `ResendEmailClient` into a single deep `EmailClient` class located at `backend/src/email/client.ts`. The client exposes a minimal public contract: `sendEmail(options)` and `sendDisruptionDigest(options)`. It encapsulates Resend SDK dispatch, dev-mode console fallback, and Cockatiel retry policies behind constructor options (`retryPolicy?: IPolicy` seam).
2. **Extract Pure RFC 8058 Header Helper**: Move header generation into an internal pure module (`headers.ts`) implementing `buildUnsubscribeHeaders(digest, customHeaders)` with strict precedence to satisfy Gmail and Yahoo 2024 bulk-sender deliverability mandates.
3. **Lock Down Barrel Export**: Narrow `backend/src/email/index.ts` to expose only `EmailClient`, `createEmailClient`, the lazy singleton proxy `emailClient`, and public payload types (`SendEmailOptions`, `SendEmailResult`, `SendDisruptionDigestOptions`, `DisruptionDigestProps`, `DisruptionDigestItem`). Keep renderer, resilience policies, headers, and React template components private.
4. **Break Type Cycles**: Establish a unidirectional type graph by locating domain types (`DisruptionDigestProps`, `DisruptionDigestItem`) in `types.ts` with zero internal imports.
5. **Direct Contract Testing**: Migrate unit tests to exercise `EmailClient` and `buildUnsubscribeHeaders` directly, deleting shallow service tests.

## Consequences
- **High Cohesion & Information Hiding**: Consumers in BullMQ workers and CLI jobs interact with a simple client interface without knowledge of React Email JSX compilation, RFC 8058 header formatting, or Cockatiel retry mechanics.
- **Cycle-Free Dependency Graph**: Clean unidirectional imports from `types.ts` through templates and clients.
- **Maintainable Test Suite**: Tests exercise public contracts and pure extracted helpers without mocking shallow internal boundaries.
