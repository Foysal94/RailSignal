import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../../../src/db.js';
import { processDemoAlertJob } from '../../../../src/workers/demo/processor.js';

describe('Demo Alert Processor Unit Tests', () => {
  const referenceDate = new Date('2026-10-15T12:00:00Z');
  const targetWeekendDate = '2026-10-16';

  beforeEach(async () => {
    await prisma.weekendDisruption.deleteMany({
      where: { lineId: { startsWith: 'demo-' } },
    });
  });

  afterAll(async () => {
    await prisma.weekendDisruption.deleteMany({
      where: { lineId: { startsWith: 'demo-' } },
    });
    await prisma.$disconnect();
  });

  it('Should_dispatch_immediate_on_demand_test_digest_matching_selected_lines_without_modifying_subscribers', async () => {
    // 1. Seed disruption
    await prisma.weekendDisruption.create({
      data: {
        lineId: 'demo-central',
        lineName: 'Central',
        mode: 'tube',
        statusSeverityDescription: 'Part Closure',
        corridorDescription: 'No service between White City and Ealing Broadway',
        weekendDate: targetWeekendDate,
        validFrom: new Date('2026-10-16T19:00:00Z'),
        validTo: new Date('2026-10-19T03:30:00Z'),
        sourceLastUpdated: new Date('2026-10-16T10:00:00Z'),
      },
    });

    const mockEmailClient = {
      sendDisruptionDigest: vi.fn().mockResolvedValue({
        id: 'msg-demo-1',
        delivered: true,
        mocked: false,
      }),
    };

    const initialSubscriptionCount = await prisma.subscription.count();

    // 2. Process demo alert
    const result = await processDemoAlertJob({
      email: 'visitor@example.com',
      lines: ['demo-central', 'demo-jubilee'],
      referenceDate,
      prisma,
      emailClient: mockEmailClient,
    });

    expect(result.email).toBe('visitor@example.com');
    expect(result.weekendDate).toBe(targetWeekendDate);
    expect(result.totalDisruptions).toBe(1);
    expect(result.dispatched).toBe(true);

    expect(mockEmailClient.sendDisruptionDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'visitor@example.com',
        digest: expect.objectContaining({
          recipientEmail: 'visitor@example.com',
          weekendDate: targetWeekendDate,
          disruptions: expect.arrayContaining([
            expect.objectContaining({
              lineId: 'demo-central',
              corridorDescription: 'No service between White City and Ealing Broadway',
            }),
          ]),
        }),
      }),
    );

    // Assert that subscriber database state was NOT modified
    const currentSubscriptionCount = await prisma.subscription.count();
    expect(currentSubscriptionCount).toBe(initialSubscriptionCount);
  });

  it('Should_dispatch_clean_good_service_digest_when_no_disruptions_exist_for_selected_lines', async () => {
    const mockEmailClient = {
      sendDisruptionDigest: vi.fn().mockResolvedValue({
        id: 'msg-demo-clean',
        delivered: true,
        mocked: false,
      }),
    };

    const result = await processDemoAlertJob({
      email: 'clean-visitor@example.com',
      lines: ['demo-victoria'],
      referenceDate,
      prisma,
      emailClient: mockEmailClient,
    });

    expect(result.totalDisruptions).toBe(0);
    expect(result.dispatched).toBe(true);

    expect(mockEmailClient.sendDisruptionDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'clean-visitor@example.com',
        digest: expect.objectContaining({
          disruptions: [],
        }),
      }),
    );
  });

  it('Should_propagate_email_client_errors_for_bullmq_retry', async () => {
    const mockEmailClient = {
      sendDisruptionDigest: vi.fn().mockRejectedValue(new Error('Resend rate limit')),
    };

    await expect(
      processDemoAlertJob({
        email: 'error-visitor@example.com',
        lines: ['demo-central'],
        referenceDate,
        prisma,
        emailClient: mockEmailClient,
      }),
    ).rejects.toThrow('Resend rate limit');
  });
});
