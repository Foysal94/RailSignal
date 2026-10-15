import type { Queue } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { DemoAlertJobData } from '../../src/queues/queues.js';

describe('POST /api/demo/send-test-digest', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('Should_enqueue_demo_alert_and_return_202_accepted_when_payload_is_valid', async () => {
    const mockQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-demo-123' }),
    } as unknown as Queue<DemoAlertJobData, void, string>;

    app = buildApp({
      demoAlertQueue: mockQueue,
    });

    const response = await app.inject({
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

    expect(mockQueue.add).toHaveBeenCalledWith(expect.stringMatching(/demo/i), {
      email: 'portfolio-visitor@example.com',
      lines: ['bakerloo', 'victoria'],
    });
  });

  it('Should_fallback_to_all_lines_when_line_selection_is_omitted', async () => {
    const mockQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-demo-456' }),
    } as unknown as Queue<DemoAlertJobData, void, string>;

    app = buildApp({
      demoAlertQueue: mockQueue,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/demo/send-test-digest',
      payload: {
        email: 'portfolio-visitor@example.com',
      },
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    expect(body.status).toBe('queued');

    expect(mockQueue.add).toHaveBeenCalledWith(
      expect.stringMatching(/demo/i),
      expect.objectContaining({
        email: 'portfolio-visitor@example.com',
        lines: expect.arrayContaining(['bakerloo', 'central', 'dlr', 'elizabeth']),
      }),
    );
  });

  it('Should_reject_with_rfc_9457_when_email_is_malformed', async () => {
    app = buildApp();

    const response = await app.inject({
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
  });

  it('Should_reject_with_rfc_9457_when_lineIds_contains_unknown_line', async () => {
    app = buildApp();

    const response = await app.inject({
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
  });
});
