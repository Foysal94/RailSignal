import {
  ProblemDetailsSchema,
  WeekendStatusQuerySchema,
  WeekendStatusResponseSchema,
} from '@railsignal/shared';

export const getWeekendStatusSchema = {
  querystring: WeekendStatusQuerySchema,
  response: {
    200: WeekendStatusResponseSchema,
    400: ProblemDetailsSchema,
    500: ProblemDetailsSchema,
  },
};
