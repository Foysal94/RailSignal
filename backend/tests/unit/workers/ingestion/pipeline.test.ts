import { describe, expect, it, vi } from 'vitest';
import { config } from '../../../../src/config.js';
import { syncWeekendDisruptionsPipeline } from '../../../../src/workers/ingestion/pipeline.js';

describe('Unified Ingestion Pipeline', () => {
  it('Should_execute_processor_and_enqueue_downstream_notification_digest_job', async () => {
    const mockProcessorResult = {
      weekendDate: '2026-10-16',
      totalFetched: 3,
      totalUpserted: 2,
      disruptions: [
        { lineId: 'central', corridorDescription: 'Part Closure' },
        { lineId: 'northern', corridorDescription: 'Planned Closure' },
      ],
    };

    const mockProcessor = vi.fn().mockResolvedValue(mockProcessorResult);
    const mockQueue = {
      add: vi.fn().mockResolvedValue({ id: 'mock-notif-job' }),
    };
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    const result = await syncWeekendDisruptionsPipeline({
      referenceDate: '2026-10-15T12:00:00Z',
      processor: mockProcessor,
      notificationQueue: mockQueue,
      logger: mockLogger,
    });

    expect(result).toEqual(mockProcessorResult);
    expect(mockProcessor).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceDate: '2026-10-15T12:00:00Z',
        logger: mockLogger,
      }),
    );
    expect(mockQueue.add).toHaveBeenCalledWith('dispatch-weekend-digest', {
      weekendDate: '2026-10-16',
    });
    expect(mockLogger.info).toHaveBeenCalledWith(
      '[Ingestion Pipeline] Notification job enqueued for weekend 2026-10-16',
    );
  });

  it('Should_propagate_processor_errors_without_enqueuing_downstream_notification_jobs', async () => {
    const mockProcessor = vi.fn().mockRejectedValue(new Error('TfL upstream outage'));
    const mockQueue = {
      add: vi.fn(),
    };

    await expect(
      syncWeekendDisruptionsPipeline({
        processor: mockProcessor,
        notificationQueue: mockQueue,
      }),
    ).rejects.toThrow('TfL upstream outage');

    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('Should_skip_queue_enqueue_when_redis_unavailable_in_development_environment', async () => {
    const mockProcessorResult = {
      weekendDate: '2026-10-16',
      totalFetched: 1,
      totalUpserted: 1,
      disruptions: [],
    };
    const mockProcessor = vi.fn().mockResolvedValue(mockProcessorResult);
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    const result = await syncWeekendDisruptionsPipeline({
      processor: mockProcessor,
      logger: mockLogger,
      config: {
        ...config,
        redisUrl: undefined,
        nodeEnv: 'development',
      },
    });

    expect(result).toEqual(mockProcessorResult);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('skipping downstream notification queue enqueue in development'),
    );
  });
});
