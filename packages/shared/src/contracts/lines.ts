import { Type, type Static } from '@sinclair/typebox';

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
