# ADR 0004: HTTP Resilience with Cockatiel and Email Templating with React Email

## Status
Accepted

## Context
1. **HTTP Resilience**: The TfL Unified API experiences transient 429 rate limits, 503 service disruptions, and occasional socket stalls. A naive `try/catch` retry loop lacks decorrelated jitter, timeout abort signals, status code discrimination, and circuit breaking. In .NET, Polly v8 solves this.
2. **Email Formatting**: Raw HTML string templates are notoriously fragile across email clients (Outlook Word engine, Gmail table nesting, CSS inlining). Hand-rolled string templates cannot be previewed locally without firing live API calls to Resend, which exhausts the 3,000 email/month free tier during styling.

## Decision
1. **Resilience Policy**: Adopt `cockatiel` (the battle-tested TypeScript equivalent of .NET Polly). Implement composite resilience policies combining exponential backoff with decorrelated jitter, request timeouts, and circuit breaking for all calls to TfL.
2. **Email Templating**: Adopt `@react-email/components` and `@react-email/render` to build responsive, accessible email digest layouts using React JSX components. Leverage the built-in local preview server (`npx email dev`) during development to preview and style templates in real-time with zero Resend quota consumption.

## Consequences
- Enterprise-grade resilience mirroring .NET Polly architecture.
- Outlook and mobile-friendly email layouts without raw table string hacks.
- Zero email quota wasted during development and visual testing.
