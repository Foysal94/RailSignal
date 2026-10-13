import { describe, expect, it, vi } from 'vitest';
import {
  runSyncDisruptions,
  runSyncDisruptionsCli,
} from '../../../src/jobs/syncDisruptionsRunner.js';

describe('Sync Disruptions CLI Runner', () => {
  it('Should_orchestrate_ingestion_and_enqueue_downstream_notification_job_on_success', async () => {
    const mockNotificationQueue = {
      add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
    };

    const mockResult = {
      weekendDate: '2026-10-16',
      totalFetched: 5,
      totalUpserted: 3,
      disruptions: [{ lineId: 'central', corridorDescription: 'Part Closure' }],
    };

    const mockProcessor = vi.fn().mockResolvedValue(mockResult);
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    const result = await runSyncDisruptions({
      processor: mockProcessor,
      notificationQueue: mockNotificationQueue,
      logger: mockLogger,
      referenceDate: '2026-10-15T10:00:00Z',
    });

    expect(result).toEqual(mockResult);
    expect(mockProcessor).toHaveBeenCalledWith({
      referenceDate: '2026-10-15T10:00:00Z',
      logger: mockLogger,
    });
    expect(mockNotificationQueue.add).toHaveBeenCalledWith('dispatch-weekend-digest', {
      weekendDate: '2026-10-16',
    });
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Starting TfL weekend disruptions synchronization'),
    );
  });

  it('Should_skip_notification_queue_dispatch_when_redis_url_missing_in_development', async () => {
    const mockProcessor = vi.fn().mockResolvedValue({
      weekendDate: '2026-10-16',
      totalFetched: 2,
      totalUpserted: 2,
      disruptions: [],
    });
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    const result = await runSyncDisruptions({
      processor: mockProcessor,
      logger: mockLogger,
      referenceDate: '2026-10-15T10:00:00Z',
    });

    expect(result.weekendDate).toBe('2026-10-16');
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'REDIS_URL not configured; skipping downstream notification queue enqueue',
      ),
    );
  });

  it('Should_close_connections_and_exit_with_code_0_on_cli_success', async () => {
    const mockNotificationQueue = {
      add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
    };
    const mockProcessor = vi.fn().mockResolvedValue({
      weekendDate: '2026-10-16',
      totalFetched: 1,
      totalUpserted: 1,
      disruptions: [],
    });
    const mockCloseQueues = vi.fn().mockResolvedValue(undefined);
    const mockPrisma = {
      $disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const mockExit = vi.fn();
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    const exitCode = await runSyncDisruptionsCli({
      processor: mockProcessor,
      notificationQueue: mockNotificationQueue,
      closeQueues: mockCloseQueues,
      prisma: mockPrisma as never,
      logger: mockLogger,
      exit: mockExit,
    });

    expect(exitCode).toBe(0);
    expect(mockExit).toHaveBeenCalledWith(0);
    expect(mockCloseQueues).toHaveBeenCalled();
    expect(mockPrisma.$disconnect).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Synchronization completed successfully'),
    );
  });

  it('Should_format_error_logs_close_connections_and_exit_with_code_1_on_failure', async () => {
    const mockProcessor = vi.fn().mockRejectedValue(new Error('TfL API Gateway Timeout'));
    const mockCloseQueues = vi.fn().mockResolvedValue(undefined);
    const mockPrisma = {
      $disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const mockExit = vi.fn();
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    const exitCode = await runSyncDisruptionsCli({
      processor: mockProcessor,
      closeQueues: mockCloseQueues,
      prisma: mockPrisma as never,
      logger: mockLogger,
      exit: mockExit,
    });

    expect(exitCode).toBe(1);
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockCloseQueues).toHaveBeenCalled();
    expect(mockPrisma.$disconnect).toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        '[Sync Disruptions Runner] Synchronization failed: TfL API Gateway Timeout',
      ),
      expect.any(Object),
    );
  });
});
