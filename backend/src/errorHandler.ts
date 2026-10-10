import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import type { ProblemDetails } from '@railsignal/shared';

const HTTP_STATUS_TITLES: Readonly<Record<number, string>> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

const RFC_9457_TYPE = 'https://datatracker.ietf.org/doc/html/rfc9457';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const isValidationError = Boolean(error.validation && error.validation.length > 0);
  const status = isValidationError ? 400 : typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
  const title = HTTP_STATUS_TITLES[status] || (status >= 500 ? 'Internal Server Error' : 'Error');

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
  } else if (status >= 500) {
    request.log.error(error);
    detail = 'An unexpected internal server error occurred.';
  } else {
    detail = error.message;
  }

  const problem: ProblemDetails = {
    type: RFC_9457_TYPE,
    title,
    status,
    detail,
    instance: request.url,
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
  const problem: ProblemDetails = {
    type: RFC_9457_TYPE,
    title: 'Not Found',
    status: 404,
    detail: `Route ${request.method} ${request.url} not found`,
    instance: request.url,
  };

  void reply
    .type('application/problem+json')
    .status(404)
    .send(problem);
}
