import { type Static, Type } from '@sinclair/typebox';

export const HealthResponseSchema = Type.Object({
  status: Type.Literal('healthy'),
});
export type HealthResponse = Static<typeof HealthResponseSchema>;
