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
