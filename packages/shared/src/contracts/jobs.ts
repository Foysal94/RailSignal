import { type Static, Type } from '@sinclair/typebox';

export const SyncWeekendDisruptionsRequestSchema = Type.Object({
  referenceDate: Type.Optional(Type.String()),
  force: Type.Optional(Type.Boolean()),
});
export type SyncWeekendDisruptionsRequest = Static<typeof SyncWeekendDisruptionsRequestSchema>;

export const SyncWeekendDisruptionsResponseSchema = Type.Object({
  status: Type.Literal('queued'),
  jobId: Type.Optional(Type.String()),
});
export type SyncWeekendDisruptionsResponse = Static<typeof SyncWeekendDisruptionsResponseSchema>;
