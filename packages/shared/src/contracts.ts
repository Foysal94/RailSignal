import { Type, FormatRegistry, type Static } from '@sinclair/typebox';

// Register standard JSON Schema email format for TypeBox value checking
if (!FormatRegistry.Has('email')) {
  FormatRegistry.Set('email', (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

// --- Health ---
export const HealthResponseSchema = Type.Object({
  status: Type.Literal('healthy'),
});
export type HealthResponse = Static<typeof HealthResponseSchema>;

// --- RFC 9457 Problem Details ---
export const ProblemInvalidParamSchema = Type.Object({
  name: Type.String(),
  reason: Type.String(),
});
export type ProblemInvalidParam = Static<typeof ProblemInvalidParamSchema>;

export const ProblemDetailsSchema = Type.Object({
  type: Type.String(),
  title: Type.String(),
  status: Type.Integer({ minimum: 100, maximum: 599 }),
  detail: Type.Optional(Type.String()),
  instance: Type.Optional(Type.String()),
  invalidParams: Type.Optional(Type.Array(ProblemInvalidParamSchema)),
});
export type ProblemDetails = Static<typeof ProblemDetailsSchema>;

// --- Line Mode & Line Definitions ---
export const LineModeSchema = Type.Union([
  Type.Literal('tube'),
  Type.Literal('elizabeth-line'),
  Type.Literal('overground'),
  Type.Literal('dlr'),
]);
export type LineMode = Static<typeof LineModeSchema>;

export const TflLineSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  mode: LineModeSchema,
  color: Type.String(),
  contrastBorder: Type.Optional(Type.Boolean()),
});
export type TflLine = Static<typeof TflLineSchema>;

// --- Weekend Disruptions & Status Projections ---
export const WeekendDisruptionSchema = Type.Object({
  id: Type.String(),
  lineId: Type.String(),
  lineName: Type.String(),
  mode: LineModeSchema,
  statusSeverityDescription: Type.String(),
  corridorDescription: Type.String(),
  weekendDate: Type.String(),
  validFrom: Type.String(),
  validTo: Type.String(),
  sourceLastUpdated: Type.String(),
  projectedAt: Type.String(),
});
export type WeekendDisruption = Static<typeof WeekendDisruptionSchema>;

export const WeekendStatusItemSchema = Type.Object({
  lineId: Type.String(),
  lineName: Type.String(),
  mode: LineModeSchema,
  color: Type.String(),
  contrastBorder: Type.Optional(Type.Boolean()),
  statusSeverityDescription: Type.String(),
  corridorDescription: Type.Optional(Type.String()),
  hasDisruption: Type.Boolean(),
  disruptions: Type.Array(WeekendDisruptionSchema),
});
export type WeekendStatusItem = Static<typeof WeekendStatusItemSchema>;

export const WeekendStatusResponseSchema = Type.Object({
  weekendDate: Type.String(),
  windowStart: Type.String(),
  windowEnd: Type.String(),
  lines: Type.Array(WeekendStatusItemSchema),
  lastUpdated: Type.String(),
});
export type WeekendStatusResponse = Static<typeof WeekendStatusResponseSchema>;

// --- Subscriptions ---
export const CreateSubscriptionRequestSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  lineIds: Type.Array(Type.String(), { minItems: 1 }),
});
export type CreateSubscriptionRequest = Static<typeof CreateSubscriptionRequestSchema>;

export const SubscriptionResponseSchema = Type.Object({
  id: Type.String(),
  email: Type.String({ format: 'email' }),
  subscribedLineIds: Type.Array(Type.String()),
  createdAt: Type.String(),
});
export type SubscriptionResponse = Static<typeof SubscriptionResponseSchema>;

// --- Demo Alerts ---
export const SendTestDigestRequestSchema = Type.Object({
  email: Type.String({ format: 'email' }),
});
export type SendTestDigestRequest = Static<typeof SendTestDigestRequestSchema>;

export const SendTestDigestResponseSchema = Type.Object({
  status: Type.Literal('queued'),
  email: Type.String({ format: 'email' }),
});
export type SendTestDigestResponse = Static<typeof SendTestDigestResponseSchema>;

// --- Sync Jobs ---
export const SyncWeekendDisruptionsResponseSchema = Type.Object({
  status: Type.Literal('queued'),
  jobId: Type.Optional(Type.String()),
});
export type SyncWeekendDisruptionsResponse = Static<typeof SyncWeekendDisruptionsResponseSchema>;
