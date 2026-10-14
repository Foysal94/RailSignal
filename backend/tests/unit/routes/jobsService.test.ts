import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import type { IngestJobData, IngestJobResult } from '../../../src/queues/queues.js';
import { enqueueSyncDisruptionsJob } from '../../../src/routes/jobs/index.js';

describe('Jobs Service Unit Tests', () => {
  it('Should_return_unauthorized_when_expected_secret_is_undefined', async () => {
    const mockQueue = {
      add: vi.fn(),
    } as unknown as Queue<IngestJobData, IngestJobResult, string>;

    const result = await enqueueSyncDisruptionsJob({
      queue: mockQueue,
      expectedSecret: undefined,
      providedSecret: 'test-secret',
    });

    expect(result).toEqual({ status: 'unauthorized' });
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('Should_return_unauthorized_when_provided_secret_does_not_match', async () => {
    const mockQueue = {
      add: vi.fn(),
    } as unknown as Queue<IngestJobData, IngestJobResult, string>;

    const result = await enqueueSyncDisruptionsJob({
      queue: mockQueue,
      expectedSecret: 'secret-a',
      providedSecret: 'secret-b',
    });

    expect(result).toEqual({ status: 'unauthorized' });
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('Should_enqueue_ingest_job_and_return_jobId_when_secrets_match', async () => {
    const mockQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-999' }),
    } as unknown as Queue<IngestJobData, IngestJobResult, string>;

    const result = await enqueueSyncDisruptionsJob({
      queue: mockQueue,
      expectedSecret: 'secret-match',
      providedSecret: 'secret-match',
      referenceDate: '2026-10-16',
      force: true,
    });

    expect(result).toEqual({
      status: 'queued',
      jobId: 'job-999',
    });

    expect(mockQueue.add).toHaveBeenCalledWith('sync-weekend-disruptions', {
      referenceDate: '2026-10-16',
      force: true,
    });
  });
});
