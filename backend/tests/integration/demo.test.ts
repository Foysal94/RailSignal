import Fastify from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { demoRoutes } from '../../src/routes/demo/routes.js';
import { createTestContext, type TestContext } from '../support/testContext.js';

describe('POST /api/demo/send-test-digest', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
  });

  beforeEach(() => {
    context.demoAlertQueue.clear();
  });

  afterAll(async () => {
    await context.close();
  });

  it('Should_enqueue_demo_alert_and_return_202_accepted_when_payload_is_valid', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/demo/send-test-digest',
      payload: {
        email: 'Portfolio-Visitor@example.com',
        lineIds: ['bakerloo', 'victoria'],
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.headers['content-type']).toContain('application/json');

    const body = response.json();
    expect(body.status).toBe('queued');
    expect(body.email).toBe('portfolio-visitor@example.com');

    // Verify in-memory BullMQ double captured job payload with zero Redis dependency
    expect(context.demoAlertQueue.jobs).toHaveLength(1);
    const enqueuedJob = context.demoAlertQueue.jobs[0];
    expect(enqueuedJob.name).toMatch(/demo/i);
    expect(enqueuedJob.data).toEqual({
      email: 'portfolio-visitor@example.com',
      lines: ['bakerloo', 'victoria'],
    });
  });

  it('Should_support_lines_payload_property_as_alternative_to_lineIds', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/demo/send-test-digest',
      payload: {
        email: 'lines-test@example.com',
        lines: ['central'],
      },
    });

    expect(response.statusCode).toBe(202);
    expect(context.demoAlertQueue.jobs).toHaveLength(1);
    expect(context.demoAlertQueue.jobs[0].data.lines).toEqual(['central']);
  });

  it('Should_fallback_to_all_lines_when_line_selection_is_omitted', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/demo/send-test-digest',
      payload: {
        email: 'portfolio-visitor@example.com',
      },
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    expect(body.status).toBe('queued');

    expect(context.demoAlertQueue.jobs).toHaveLength(1);
    const enqueuedJob = context.demoAlertQueue.jobs[0];
    expect(enqueuedJob.data.email).toBe('portfolio-visitor@example.com');
    expect(enqueuedJob.data.lines).toEqual(
      expect.arrayContaining(['bakerloo', 'central', 'dlr', 'elizabeth']),
    );
  });

  it('Should_reject_with_rfc_9457_when_email_is_malformed', async () => {
    const response = await context.app.inject({
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
    expect(context.demoAlertQueue.jobs).toHaveLength(0);
  });

  it('Should_reject_with_rfc_9457_when_lineIds_contains_unknown_line', async () => {
    const response = await context.app.inject({
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
    expect(context.demoAlertQueue.jobs).toHaveLength(0);
  });

  it('Should_register_with_default_options_when_options_are_omitted', async () => {
    const plainApp = Fastify();
    await plainApp.register(demoRoutes);
    await plainApp.ready();
    await plainApp.close();
  });
});
