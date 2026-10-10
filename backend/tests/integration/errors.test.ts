import { describe, it, expect, afterAll } from 'vitest';
import { Type } from '@sinclair/typebox';
import { buildApp } from '../../src/app.js';

describe('RFC 9457 Problem Details Error Handling', () => {
  it('Should_return_rfc_9457_problem_details_when_route_is_not_found', async () => {
    const app = buildApp();
    afterAll(async () => {
      await app.close();
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/not-a-real-route',
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');

    const body = response.json();
    expect(body).toMatchObject({
      title: 'Not Found',
      status: 404,
      instance: '/api/not-a-real-route',
    });
    expect(body.type).toBeDefined();
    expect(body.detail).toBeDefined();
  });

  it('Should_return_rfc_9457_problem_details_with_invalid_params_when_validation_fails', async () => {
    const app = buildApp();

    // Register a test route with TypeBox validation
    app.post(
      '/api/test-validation',
      {
        schema: {
          body: Type.Object({
            email: Type.String({ format: 'email' }),
          }),
        },
      },
      async () => ({ ok: true })
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/test-validation',
      payload: { email: 'not-an-email' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');

    const body = response.json();
    expect(body).toMatchObject({
      title: 'Bad Request',
      status: 400,
      instance: '/api/test-validation',
    });
    expect(body.invalidParams).toBeDefined();
    expect(Array.isArray(body.invalidParams)).toBe(true);
    expect(body.invalidParams.length).toBeGreaterThan(0);
  });

  it('Should_return_sanitized_rfc_9457_problem_details_when_internal_error_occurs', async () => {
    const app = buildApp();

    app.get('/api/test-internal-error', async () => {
      throw new Error('Database password failed: supersecret123');
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/test-internal-error',
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toContain('application/problem+json');

    const body = response.json();
    expect(body).toMatchObject({
      title: 'Internal Server Error',
      status: 500,
      instance: '/api/test-internal-error',
    });
    // Ensure sensitive message or stack traces are not leaked
    expect(response.payload).not.toContain('supersecret123');
  });
});
