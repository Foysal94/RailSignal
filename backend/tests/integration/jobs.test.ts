import Fastify from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { IngestJobData, IngestJobResult } from '../../src/queues/queues.js';
import { jobsRoutes } from '../../src/routes/jobs/routes.js';
import { InMemoryQueueDouble } from '../support/inMemoryQueueDouble.js';
import { createTestContext, type TestContext } from '../support/testContext.js';

describe('POST /api/jobs/sync-weekend-disruptions', () => {
  let context: TestContext;
  const validSecret = 'super-secret-job-key-1234';

  beforeAll(async () => {
    context = await createTestContext({
      config: { jobSecret: validSecret },
    });
  });

  beforeEach(() => {
    context.ingestQueue.clear();
  });

  afterAll(async () => {
    await context.close();
  });

  it('Should_return_401_problem_details_when_x_job_secret_header_is_missing', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/jobs/sync-weekend-disruptions',
      payload: {},
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');

    const body = response.json();
    expect(body.title).toBe('Unauthorized');
    expect(body.status).toBe(401);
    expect(context.ingestQueue.jobs).toHaveLength(0);
  });

  it('Should_return_401_problem_details_when_x_job_secret_header_is_incorrect', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/jobs/sync-weekend-disruptions',
      headers: {
        'x-job-secret': 'wrong-secret-key',
      },
      payload: {},
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');

    const body = response.json();
    expect(body.title).toBe('Unauthorized');
    expect(body.status).toBe(401);
    expect(context.ingestQueue.jobs).toHaveLength(0);
  });

  it('Should_enqueue_ingestion_job_and_return_202_when_secret_is_valid', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: '/api/jobs/sync-weekend-disruptions',
      headers: {
        'x-job-secret': validSecret,
      },
      payload: {
        referenceDate: '2026-10-16',
        force: true,
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.headers['content-type']).toContain('application/json');

    const body = response.json();
    expect(body.status).toBe('queued');
    expect(body.jobId).toBeDefined();

    expect(context.ingestQueue.jobs).toHaveLength(1);
    const enqueuedJob = context.ingestQueue.jobs[0];
    expect(enqueuedJob.name).toMatch(/sync|ingest/i);
    expect(enqueuedJob.data).toEqual({
      referenceDate: '2026-10-16',
      force: true,
    });
  });

  it('Should_return_401_problem_details_when_server_job_secret_is_not_configured', async () => {
    const unconfiguredContext = await createTestContext({
      config: { jobSecret: undefined },
    });
    try {
      const response = await unconfiguredContext.app.inject({
        method: 'POST',
        url: '/api/jobs/sync-weekend-disruptions',
        headers: {
          'x-job-secret': 'any-secret',
        },
        payload: {},
      });

      expect(response.statusCode).toBe(401);
      expect(response.headers['content-type']).toContain('application/problem+json');
      const body = response.json();
      expect(body.title).toBe('Unauthorized');
      expect(body.status).toBe(401);
    } finally {
      await unconfiguredContext.close();
    }
  });

  it('Should_register_with_default_options_when_options_are_omitted', async () => {
    const plainApp = Fastify();
    await plainApp.register(jobsRoutes);
    await plainApp.ready();
    await plainApp.close();
  });

  it('Should_handle_job_without_id_gracefully', async () => {
    const customQueue = new InMemoryQueueDouble<IngestJobData, IngestJobResult>();
    customQueue.add = async (name, data) => {
      const job = await InMemoryQueueDouble.prototype.add.call(customQueue, name, data);
      return { ...job, id: undefined as unknown as string };
    };
    const customContext = await createTestContext({
      config: { jobSecret: validSecret },
      ingestQueue: customQueue,
    });
    try {
      const response = await customContext.app.inject({
        method: 'POST',
        url: '/api/jobs/sync-weekend-disruptions',
        headers: { 'x-job-secret': validSecret },
        payload: {},
      });
      expect(response.statusCode).toBe(202);
      const body = response.json();
      expect(body.status).toBe('queued');
      expect(body.jobId).toBeUndefined();
    } finally {
      await customContext.close();
    }
  });
});
