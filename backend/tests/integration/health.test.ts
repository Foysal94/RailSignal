import { describe, it, expect, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';

describe('GET /api/health', () => {
  it('Should_return_200_and_healthy_status_when_health_endpoint_is_called', async () => {
    const app = buildApp();
    afterAll(async () => {
      await app.close();
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json()).toEqual({ status: 'healthy' });
  });
});
