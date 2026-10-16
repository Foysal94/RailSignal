import { type Static, Type } from '@sinclair/typebox';

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

export const ReplacementBusRouteSchema = Type.Object({
  serviceName: Type.String(),
  stops: Type.Array(Type.String()),
  summary: Type.String(),
  rawRoute: Type.String(),
});
export type ReplacementBusRoute = Static<typeof ReplacementBusRouteSchema>;

export const DisruptionNoticeSchema = Type.Object({
  headline: Type.String(),
  corridor: Type.String(),
  timeframe: Type.Optional(Type.String()),
  busRoute: Type.Optional(ReplacementBusRouteSchema),
  details: Type.Optional(Type.Array(Type.String())),
  rawFallback: Type.Optional(Type.String()),
});
export type DisruptionNotice = Static<typeof DisruptionNoticeSchema>;

export const WeekendDisruptionSchema = Type.Object({
  id: Type.String(),
  lineId: Type.String(),
  lineName: Type.String(),
  mode: LineModeSchema,
  statusSeverityDescription: Type.String(),
  corridorDescription: Type.String(),
  notices: Type.Optional(Type.Array(DisruptionNoticeSchema)),
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
  notices: Type.Optional(Type.Array(DisruptionNoticeSchema)),
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

export const WeekendStatusQuerySchema = Type.Object({
  referenceDate: Type.Optional(Type.String()),
});
export type WeekendStatusQuery = Static<typeof WeekendStatusQuerySchema>;
