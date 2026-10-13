import { type Static, Type } from '@sinclair/typebox';

export const SendTestDigestRequestSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  lineIds: Type.Optional(Type.Array(Type.String())),
  lines: Type.Optional(Type.Array(Type.String())),
});
export type SendTestDigestRequest = Static<typeof SendTestDigestRequestSchema>;

export const SendTestDigestResponseSchema = Type.Object({
  status: Type.Literal('queued'),
  email: Type.Optional(Type.String({ format: 'email' })),
});
export type SendTestDigestResponse = Static<typeof SendTestDigestResponseSchema>;

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
