import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from '../support/testContext.js';

describe('CORS Middleware', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext({
      config: {
        clientOrigin: 'https://custom-railsignal.com',
      },
    });
  });

  afterAll(async () => {
    await context.close();
  });

  it('Should_allow_requests_from_azure_static_web_apps_origin', async () => {
    const swaOrigin = 'https://wonderful-water-0c5b1fe0f.4.azurestaticapps.net';
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/health',
      headers: {
        origin: swaOrigin,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(swaOrigin);
  });

  it('Should_allow_requests_from_localhost_vite_dev_server', async () => {
    const localOrigin = 'http://localhost:5173';
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/health',
      headers: {
        origin: localOrigin,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(localOrigin);
  });

  it('Should_allow_requests_from_custom_client_origin', async () => {
    const customOrigin = 'https://custom-railsignal.com';
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/health',
      headers: {
        origin: customOrigin,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(customOrigin);
  });

  it('Should_return_access_control_allow_methods_on_preflight_options_request', async () => {
    const response = await context.app.inject({
      method: 'OPTIONS',
      url: '/api/lines/weekend-status',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-methods']).toBeDefined();
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  it('Should_not_allow_requests_from_unauthorized_origins', async () => {
    const unauthorizedOrigin = 'https://malicious-site.example.com';
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/health',
      headers: {
        origin: unauthorizedOrigin,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
