import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WebApplicationFactory } from './webApplicationFactory.js';

describe('POST /api/jobs/sync-weekend-disruptions', () => {
  let factory: WebApplicationFactory;
  const validSecret = 'super-secret-job-key-1234';

  beforeAll(async () => {
    factory = await WebApplicationFactory.create({
      config: { jobSecret: validSecret },
    });
  });

  beforeEach(() => {
    factory.ingestQueue.clear();
  });

  afterAll(async () => {
    await factory.close();
  });

  it('Should_return_401_problem_details_when_x_job_secret_header_is_missing', async () => {
    const response = await factory.inject({
      method: 'POST',
      url: '/api/jobs/sync-weekend-disruptions',
      payload: {},
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');

    const body = response.json();
    expect(body.title).toBe('Unauthorized');
    expect(body.status).toBe(401);
    expect(factory.ingestQueue.jobs).toHaveLength(0);
  });

  it('Should_return_401_problem_details_when_x_job_secret_header_is_incorrect', async () => {
    const response = await factory.inject({
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
    expect(factory.ingestQueue.jobs).toHaveLength(0);
  });

  it('Should_enqueue_ingestion_job_and_return_202_when_secret_is_valid', async () => {
    const response = await factory.inject({
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

    expect(factory.ingestQueue.jobs).toHaveLength(1);
    const enqueuedJob = factory.ingestQueue.jobs[0];
    expect(enqueuedJob.name).toMatch(/sync|ingest/i);
    expect(enqueuedJob.data).toEqual({
      referenceDate: '2026-10-16',
      force: true,
    });
  });
});
