import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WebApplicationFactory } from './webApplicationFactory.js';

describe('POST /api/demo/send-test-digest', () => {
  let factory: WebApplicationFactory;

  beforeAll(async () => {
    factory = await WebApplicationFactory.create();
  });

  beforeEach(() => {
    factory.demoAlertQueue.clear();
  });

  afterAll(async () => {
    await factory.close();
  });

  it('Should_enqueue_demo_alert_and_return_202_accepted_when_payload_is_valid', async () => {
    const response = await factory.inject({
      method: 'POST',
      url: '/api/demo/send-test-digest',
      payload: {
        email: 'portfolio-visitor@example.com',
        lineIds: ['bakerloo', 'victoria'],
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.headers['content-type']).toContain('application/json');

    const body = response.json();
    expect(body.status).toBe('queued');

    // Verify in-memory BullMQ double captured job payload with zero Redis dependency
    expect(factory.demoAlertQueue.jobs).toHaveLength(1);
    const enqueuedJob = factory.demoAlertQueue.jobs[0];
    expect(enqueuedJob.name).toMatch(/demo/i);
    expect(enqueuedJob.data).toEqual({
      email: 'portfolio-visitor@example.com',
      lines: ['bakerloo', 'victoria'],
    });
  });

  it('Should_fallback_to_all_lines_when_line_selection_is_omitted', async () => {
    const response = await factory.inject({
      method: 'POST',
      url: '/api/demo/send-test-digest',
      payload: {
        email: 'portfolio-visitor@example.com',
      },
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    expect(body.status).toBe('queued');

    expect(factory.demoAlertQueue.jobs).toHaveLength(1);
    const enqueuedJob = factory.demoAlertQueue.jobs[0];
    expect(enqueuedJob.data.email).toBe('portfolio-visitor@example.com');
    expect(enqueuedJob.data.lines).toEqual(
      expect.arrayContaining(['bakerloo', 'central', 'dlr', 'elizabeth']),
    );
  });

  it('Should_reject_with_rfc_9457_when_email_is_malformed', async () => {
    const response = await factory.inject({
      method: 'POST',
      url: '/api/demo/send-test-digest',
      payload: {
        email: 'not-an-email',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.json();
    expect(body.title).toBe('Bad Request');
    expect(body.invalidParams).toBeDefined();
    expect(factory.demoAlertQueue.jobs).toHaveLength(0);
  });

  it('Should_reject_with_rfc_9457_when_lineIds_contains_unknown_line', async () => {
    const response = await factory.inject({
      method: 'POST',
      url: '/api/demo/send-test-digest',
      payload: {
        email: 'test@example.com',
        lineIds: ['non-existent-line'],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.json();
    expect(body.title).toBe('Bad Request');
    expect(body.invalidParams).toBeDefined();
    expect(body.invalidParams[0].name).toBe('lineIds');
    expect(factory.demoAlertQueue.jobs).toHaveLength(0);
  });
});
