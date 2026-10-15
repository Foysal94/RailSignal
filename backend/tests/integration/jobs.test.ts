import type { Queue } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { AppConfig } from '../../src/config.js';
import type { IngestJobData, IngestJobResult } from '../../src/queues/queues.js';

describe('POST /api/jobs/sync-weekend-disruptions', () => {
  let app: FastifyInstance;
  const mockConfig = {
    jobSecret: 'super-secret-job-key-1234',
  } as unknown as AppConfig;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('Should_return_401_problem_details_when_x_job_secret_header_is_missing', async () => {
    app = buildApp({
      config: mockConfig,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/jobs/sync-weekend-disruptions',
      payload: {},
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');

    const body = response.json();
    expect(body.title).toBe('Unauthorized');
    expect(body.status).toBe(401);
  });

  it('Should_return_401_problem_details_when_x_job_secret_header_is_incorrect', async () => {
    app = buildApp({
      config: mockConfig,
    });

    const response = await app.inject({
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
  });

  it('Should_enqueue_ingestion_job_and_return_202_when_secret_is_valid', async () => {
    const mockQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-ingest-789' }),
    } as unknown as Queue<IngestJobData, IngestJobResult, string>;

    app = buildApp({
      config: mockConfig,
      ingestQueue: mockQueue,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/jobs/sync-weekend-disruptions',
      headers: {
        'x-job-secret': 'super-secret-job-key-1234',
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
    expect(body.jobId).toBe('job-ingest-789');

    expect(mockQueue.add).toHaveBeenCalledWith(expect.stringMatching(/sync|ingest/i), {
      referenceDate: '2026-10-16',
      force: true,
    });
  });
});
