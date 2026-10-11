import { Type, type Static } from '@sinclair/typebox';

export const ProblemInvalidParamSchema = Type.Object({
  name: Type.String(),
  reason: Type.String(),
});
export type ProblemInvalidParam = Static<typeof ProblemInvalidParamSchema>;

export const ProblemDetailsSchema = Type.Object({
  type: Type.String(),
  title: Type.String(),
  status: Type.Integer({ minimum: 100, maximum: 599 }),
  detail: Type.Optional(Type.String()),
  instance: Type.Optional(Type.String()),
  invalidParams: Type.Optional(Type.Array(ProblemInvalidParamSchema)),
});
export type ProblemDetails = Static<typeof ProblemDetailsSchema>;
