import { type Static, Type } from '@sinclair/typebox';

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

export const UnsubscribeParamsSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
});
export type UnsubscribeParams = Static<typeof UnsubscribeParamsSchema>;

export const UnsubscribeQuerySchema = Type.Object({
  token: Type.String({ minLength: 1 }),
});
export type UnsubscribeQuery = Static<typeof UnsubscribeQuerySchema>;
