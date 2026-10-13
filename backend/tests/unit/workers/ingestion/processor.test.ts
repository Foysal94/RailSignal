import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TflClient } from '../../../../src/clients/tfl/client.js';
import type { ParsedDisruption } from '../../../../src/clients/tfl/types.js';
import { prisma } from '../../../../src/db.js';
import { processIngestionJob } from '../../../../src/workers/ingestion/processor.js';

describe('Ingestion Processor Unit Tests', () => {
  beforeEach(async () => {
    await prisma.weekendDisruption.deleteMany({
      where: { lineId: 'processor-victoria' },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const mockDisruption: ParsedDisruption = {
    lineId: 'processor-victoria',
    lineName: 'Victoria',
    mode: 'tube',
    statusSeverityDescription: 'Planned Closure',
    corridorDescription: 'No service between Highbury & Islington and Brixton',
    weekendDate: '2026-10-16',
    validFrom: '2026-10-16T19:00:00.000Z',
    validTo: '2026-10-19T03:30:00.000Z',
    sourceLastUpdated: '2026-10-16T12:00:00.000Z',
  };

  it('Should_fetch_disruptions_from_tfl_client_and_project_them_into_database', async () => {
    const mockTflClient: Pick<TflClient, 'getWeekendDisruptions'> = {
      getWeekendDisruptions: vi.fn().mockResolvedValue([mockDisruption]),
    };

    const result = await processIngestionJob({
      tflClient: mockTflClient,
      prisma,
      referenceDate: new Date('2026-10-15T10:00:00Z'),
    });

    expect(result.weekendDate).toBe('2026-10-16');
    expect(result.totalFetched).toBe(1);
    expect(result.totalUpserted).toBe(1);
    expect(result.disruptions).toHaveLength(1);
    expect(result.disruptions[0].lineId).toBe('processor-victoria');

    const persisted = await prisma.weekendDisruption.findFirst({
      where: { lineId: 'processor-victoria' },
    });
    expect(persisted).not.toBeNull();
    expect(persisted?.corridorDescription).toBe(mockDisruption.corridorDescription);
  });

  it('Should_handle_empty_disruptions_payload_cleanly', async () => {
    const mockTflClient: Pick<TflClient, 'getWeekendDisruptions'> = {
      getWeekendDisruptions: vi.fn().mockResolvedValue([]),
    };

    const result = await processIngestionJob({
      tflClient: mockTflClient,
      prisma,
      referenceDate: new Date('2026-10-15T10:00:00Z'),
    });

    expect(result.weekendDate).toBe('2026-10-16');
    expect(result.totalFetched).toBe(0);
    expect(result.totalUpserted).toBe(0);
    expect(result.disruptions).toHaveLength(0);

    const count = await prisma.weekendDisruption.count({
      where: { lineId: 'processor-victoria' },
    });
    expect(count).toBe(0);
  });

  it('Should_propagate_tfl_client_errors_for_bullmq_retry_mechanism', async () => {
    const mockTflClient: Pick<TflClient, 'getWeekendDisruptions'> = {
      getWeekendDisruptions: vi.fn().mockRejectedValue(new Error('TfL upstream 503 error')),
    };

    await expect(
      processIngestionJob({
        tflClient: mockTflClient,
        prisma,
      }),
    ).rejects.toThrow('TfL upstream 503 error');
  });
});
