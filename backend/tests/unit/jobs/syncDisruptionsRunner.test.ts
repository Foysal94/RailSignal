import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { runSyncDisruptionsCli } from '../../../src/jobs/syncDisruptionsRunner.js';

function createMocks() {
  return {
    tflClient: {
      getWeekendDisruptions: vi.fn().mockResolvedValue([
        {
          lineId: 'victoria',
          lineName: 'Victoria',
          mode: 'tube',
          statusSeverityDescription: 'Part Closure',
          corridorDescription: 'No service Highbury & Islington to Brixton',
          weekendDate: '2026-10-16',
          validFrom: '2026-10-16T19:00:00.000Z',
          validTo: '2026-10-19T03:30:00.000Z',
          sourceLastUpdated: '2026-10-16T10:00:00.000Z',
        },
      ]),
    },
    prisma: {
      $transaction: vi.fn().mockImplementation(async (cb) =>
        cb({
          weekendDisruption: {
            findMany: vi.fn().mockResolvedValue([]),
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
            upsert: vi.fn().mockResolvedValue({}),
          },
        }),
      ),
      $disconnect: vi.fn().mockResolvedValue(undefined),
    } as unknown as PrismaClient,
    notificationQueue: {
      add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    },
    closeQueues: vi.fn().mockResolvedValue(undefined),
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
    expect(mocks.tflClient.getWeekendDisruptions).toHaveBeenCalledOnce();
    expect(mocks.notificationQueue.add).toHaveBeenCalledWith(
      'dispatch-weekend-digest',
      expect.objectContaining({ weekendDate: expect.any(String) }),
      expect.objectContaining({ jobId: expect.stringContaining('dispatch-weekend-digest-') }),
    );
    expect(mocks.closeQueues).toHaveBeenCalledOnce();
    expect(mocks.prisma.$disconnect).toHaveBeenCalledOnce();
  });

  it('Should_close_resources_and_exit_1_when_ingestion_fails', async () => {
    const mocks = createMocks();
    mocks.tflClient.getWeekendDisruptions.mockRejectedValue(new Error('TfL Gateway Timeout'));

    const exitCode = await runSyncDisruptionsCli(mocks);

    expect(exitCode).toBe(1);
    expect(mocks.exit).toHaveBeenCalledWith(1);
    expect(mocks.closeQueues).toHaveBeenCalledOnce();
    expect(mocks.prisma.$disconnect).toHaveBeenCalledOnce();
  });
});
