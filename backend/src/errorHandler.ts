import { STATUS_CODES } from 'node:http';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import type { ProblemDetails } from '@railsignal/shared';

const RFC_9457_TYPE = 'https://datatracker.ietf.org/doc/html/rfc9457';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const isValidationError = Boolean(error.validation && error.validation.length > 0);
  const status = isValidationError
    ? 400
    : typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : 500;

  // Use Node's built-in STATUS_CODES dictionary for RFC 9457 title
  const title = STATUS_CODES[status] || (status >= 500 ? 'Internal Server Error' : 'Error');
  const instance = request.url.split('?')[0] || request.url;

  let detail: string;
  let invalidParams: ProblemDetails['invalidParams'];

  if (isValidationError && error.validation) {
    detail = error.message || 'Request validation failed';
    invalidParams = error.validation.map((item) => {
      const field = item.instancePath
        ? item.instancePath.replace(/^\//, '')
        : item.params && typeof item.params === 'object' && 'missingProperty' in item.params
          ? String((item.params as { missingProperty: string }).missingProperty)
          : 'body';

      return {
        name: field,
        reason: item.message || 'Invalid value',
      };
    });
    request.log.warn({ status, invalidParams, instance }, 'Request validation rejected');
  } else if (status >= 500) {
    request.log.error(error);
    detail = 'An unexpected internal server error occurred.';
  } else {
    request.log.warn({ status, message: error.message, instance }, 'Client request rejected');
    detail = error.message;
  }

  const problem: ProblemDetails = {
    type: RFC_9457_TYPE,
    title,
    status,
    detail,
    instance,
    // Only include invalidParams if present (omitted completely for non-validation errors)
    ...(invalidParams ? { invalidParams } : {}),
  };

  void reply
    .type('application/problem+json')
    .status(status)
    .send(problem);
}

export function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const instance = request.url.split('?')[0] || request.url;
  const problem: ProblemDetails = {
    type: RFC_9457_TYPE,
    title: STATUS_CODES[404] || 'Not Found',
    status: 404,
    detail: `Route ${request.method} ${instance} not found`,
    instance,
  };

  void reply
    .type('application/problem+json')
    .status(404)
    .send(problem);
}
