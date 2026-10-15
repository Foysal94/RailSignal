import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebApplicationFactory } from './webApplicationFactory.js';

describe('GET /api/health', () => {
  let factory: WebApplicationFactory;

  beforeAll(async () => {
    factory = await WebApplicationFactory.create();
  });

  afterAll(async () => {
    await factory.close();
  });

  it('Should_return_200_and_healthy_status_when_health_endpoint_is_called', async () => {
    const response = await factory.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.json()).toEqual({ status: 'healthy' });
  });
});
