import {
  ProblemDetailsSchema,
  SendTestDigestRequestSchema,
  SendTestDigestResponseSchema,
} from '@railsignal/shared';

export const sendTestDigestSchema = {
  body: SendTestDigestRequestSchema,
  response: {
    202: SendTestDigestResponseSchema,
    400: ProblemDetailsSchema,
    500: ProblemDetailsSchema,
  },
};
