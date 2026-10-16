import { describe, expect, it, vi } from 'vitest';
import { runSyncDisruptionsCli } from '../../../src/jobs/syncDisruptionsRunner.js';

function createMocks() {
  return {
    pipeline: vi.fn().mockResolvedValue({
      weekendDate: '2026-10-16',
      totalFetched: 3,
      totalUpserted: 3,
      disruptions: [],
    }),
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
    expect(mocks.pipeline).toHaveBeenCalledOnce();
    expect(mocks.closeQueues).toHaveBeenCalledOnce();
    expect(mocks.prisma.$disconnect).toHaveBeenCalledOnce();
  });

  it('Should_close_resources_and_exit_1_when_ingestion_fails', async () => {
    const mocks = createMocks();
    mocks.pipeline.mockRejectedValue(new Error('TfL Gateway Timeout'));

    const exitCode = await runSyncDisruptionsCli(mocks);

    expect(exitCode).toBe(1);
    expect(mocks.exit).toHaveBeenCalledWith(1);
    expect(mocks.closeQueues).toHaveBeenCalledOnce();
    expect(mocks.prisma.$disconnect).toHaveBeenCalledOnce();
  });
});
