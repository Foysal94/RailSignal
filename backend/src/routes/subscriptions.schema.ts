import {
  CreateSubscriptionRequestSchema,
  ProblemDetailsSchema,
  SubscriptionResponseSchema,
  UnsubscribeParamsSchema,
  UnsubscribeQuerySchema,
} from '@railsignal/shared';
import { Type } from '@sinclair/typebox';

export const createSubscriptionSchema = {
  body: CreateSubscriptionRequestSchema,
  response: {
    200: SubscriptionResponseSchema,
    201: SubscriptionResponseSchema,
    400: ProblemDetailsSchema,
    500: ProblemDetailsSchema,
  },
};

export const deleteSubscriptionSchema = {
  params: UnsubscribeParamsSchema,
  querystring: UnsubscribeQuerySchema,
  response: {
    204: Type.Null(),
    400: ProblemDetailsSchema,
    403: ProblemDetailsSchema,
    404: ProblemDetailsSchema,
    500: ProblemDetailsSchema,
  },
};
