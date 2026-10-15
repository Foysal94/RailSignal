import { describe, expect, it, vi } from 'vitest';
import {
  runSyncDisruptions,
  runSyncDisruptionsCli,
} from '../../../src/jobs/syncDisruptionsRunner.js';

function createMocks() {
  return {
    processor: vi.fn().mockResolvedValue({
      weekendDate: '2026-10-16',
      totalFetched: 3,
      totalUpserted: 3,
      disruptions: [],
    }),
    notificationQueue: {
      add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    },
    closeQueues: vi.fn().mockResolvedValue(undefined),
    prisma: {
      $disconnect: vi.fn().mockResolvedValue(undefined),
    },
    exit: vi.fn(),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  };
}

describe('Sync Disruptions CLI Runner', () => {
  it('Should_run_ingestion_enqueue_digest_close_resources_and_exit_0_on_success', async () => {
    const mocks = createMocks();

    const exitCode = await runSyncDisruptionsCli(mocks);

    expect(exitCode).toBe(0);
    expect(mocks.exit).toHaveBeenCalledWith(0);
    expect(mocks.processor).toHaveBeenCalledOnce();
    expect(mocks.notificationQueue.add).toHaveBeenCalledWith('dispatch-weekend-digest', {
      weekendDate: '2026-10-16',
    });
    expect(mocks.closeQueues).toHaveBeenCalledOnce();
    expect(mocks.prisma.$disconnect).toHaveBeenCalledOnce();
  });

  it('Should_close_resources_and_exit_1_when_ingestion_fails', async () => {
    const mocks = createMocks();
    mocks.processor.mockRejectedValue(new Error('TfL Gateway Timeout'));

    const exitCode = await runSyncDisruptionsCli(mocks);

    expect(exitCode).toBe(1);
    expect(mocks.exit).toHaveBeenCalledWith(1);
    expect(mocks.closeQueues).toHaveBeenCalledOnce();
    expect(mocks.prisma.$disconnect).toHaveBeenCalledOnce();
  });

  it('Should_skip_queue_dispatch_when_redis_url_missing_in_development', async () => {
    const mocks = createMocks();
    const { notificationQueue: _, ...devMocks } = mocks;

    const result = await runSyncDisruptions(devMocks);

    expect(result.weekendDate).toBe('2026-10-16');
    expect(mocks.processor).toHaveBeenCalledOnce();
  });
});
