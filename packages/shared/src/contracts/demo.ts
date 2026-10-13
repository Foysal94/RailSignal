import { type Static, Type } from '@sinclair/typebox';

export const SendTestDigestRequestSchema = Type.Object({
  email: Type.String({ format: 'email' }),
});
export type SendTestDigestRequest = Static<typeof SendTestDigestRequestSchema>;

export const SendTestDigestResponseSchema = Type.Object({
  status: Type.Literal('queued'),
  email: Type.String({ format: 'email' }),
});
export type SendTestDigestResponse = Static<typeof SendTestDigestResponseSchema>;

export const SyncWeekendDisruptionsResponseSchema = Type.Object({
  status: Type.Literal('queued'),
  jobId: Type.Optional(Type.String()),
});
export type SyncWeekendDisruptionsResponse = Static<typeof SyncWeekendDisruptionsResponseSchema>;
