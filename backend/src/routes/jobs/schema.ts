import {
  ProblemDetailsSchema,
  SyncWeekendDisruptionsRequestSchema,
  SyncWeekendDisruptionsResponseSchema,
} from '@railsignal/shared';
import { Type } from '@sinclair/typebox';

export const syncWeekendDisruptionsSchema = {
  headers: Type.Object({
    'x-job-secret': Type.Optional(Type.String()),
  }),
  body: Type.Optional(SyncWeekendDisruptionsRequestSchema),
  response: {
    202: SyncWeekendDisruptionsResponseSchema,
    401: ProblemDetailsSchema,
    500: ProblemDetailsSchema,
  },
};
