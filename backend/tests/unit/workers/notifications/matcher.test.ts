import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../../../src/db.js';
import {
  filterDisruptionsForLines,
  matchSubscribersForWeekend,
} from '../../../../src/workers/notifications/matcher.js';

describe('Subscriber Matching Domain Logic (SubscriptionLine Junction)', () => {
  const weekendDate = '2026-10-16';

  beforeEach(async () => {
    await prisma.subscription.deleteMany({
      where: { email: { contains: 'matcher-test' } },
    });
    await prisma.weekendDisruption.deleteMany({
      where: { lineId: { startsWith: 'matcher-' } },
    });
  });

  afterAll(async () => {
    await prisma.subscription.deleteMany({
      where: { email: { contains: 'matcher-test' } },
    });
    await prisma.weekendDisruption.deleteMany({
      where: { lineId: { startsWith: 'matcher-' } },
    });
    await prisma.$disconnect();
  });

  it('Should_filter_disruptions_to_only_those_monitored_by_given_lines', () => {
    const disruptions = [
      { lineId: 'matcher-central', corridorDescription: 'Part Closure' },
      { lineId: 'matcher-northern', corridorDescription: 'Planned Closure' },
      { lineId: 'matcher-jubilee', corridorDescription: 'Minor Delays' },
    ];

    const result = filterDisruptionsForLines(['matcher-central', 'matcher-jubilee'], disruptions);

    expect(result).toHaveLength(2);
    expect(result.map((d) => d.lineId)).toEqual(['matcher-central', 'matcher-jubilee']);
  });

  it('Should_match_subscribers_whose_selected_lines_have_active_weekend_disruptions', async () => {
    // 1. Seed weekend disruptions
    await prisma.weekendDisruption.createMany({
      data: [
        {
          lineId: 'matcher-central',
          lineName: 'Central',
          mode: 'tube',
          statusSeverityDescription: 'Part Closure',
          corridorDescription: 'No service between White City and Ealing Broadway',
          weekendDate,
          validFrom: new Date('2026-10-16T19:00:00Z'),
          validTo: new Date('2026-10-19T03:30:00Z'),
          sourceLastUpdated: new Date('2026-10-16T10:00:00Z'),
        },
        {
          lineId: 'matcher-district',
          lineName: 'District',
          mode: 'tube',
          statusSeverityDescription: 'Planned Closure',
          corridorDescription: 'No service between Earls Court and Wimbledon',
          weekendDate,
          validFrom: new Date('2026-10-16T19:00:00Z'),
          validTo: new Date('2026-10-19T03:30:00Z'),
          sourceLastUpdated: new Date('2026-10-16T10:00:00Z'),
        },
      ],
    });

    // 2. Seed subscribers:
    // Sub 1 monitors disrupted 'matcher-central'
    const sub1 = await prisma.subscription.create({
      data: {
        email: 'matcher-test-1@example.com',
        lines: {
          create: [{ lineId: 'matcher-central' }],
        },
      },
    });

    // Sub 2 monitors undisturbed 'matcher-bakerloo'
    await prisma.subscription.create({
      data: {
        email: 'matcher-test-2@example.com',
        lines: {
          create: [{ lineId: 'matcher-bakerloo' }],
        },
      },
    });

    // Sub 3 monitors disrupted 'matcher-central' AND 'matcher-district' AND undisturbed 'matcher-victoria'
    const sub3 = await prisma.subscription.create({
      data: {
        email: 'matcher-test-3@example.com',
        lines: {
          create: [
            { lineId: 'matcher-central' },
            { lineId: 'matcher-district' },
            { lineId: 'matcher-victoria' },
          ],
        },
      },
    });

    // 3. Execute matching logic
    const matched = await matchSubscribersForWeekend({
      prisma,
      weekendDate,
    });

    expect(matched).toHaveLength(2);

    const matchedSub1 = matched.find((m) => m.subscriptionId === sub1.id);
    expect(matchedSub1).toBeDefined();
    expect(matchedSub1?.email).toBe('matcher-test-1@example.com');
    expect(matchedSub1?.disruptions).toHaveLength(1);
    expect(matchedSub1?.disruptions[0].lineId).toBe('matcher-central');

    const matchedSub3 = matched.find((m) => m.subscriptionId === sub3.id);
    expect(matchedSub3).toBeDefined();
    expect(matchedSub3?.email).toBe('matcher-test-3@example.com');
    expect(matchedSub3?.disruptions).toHaveLength(2);
    expect(matchedSub3?.disruptions.map((d) => d.lineId).sort()).toEqual([
      'matcher-central',
      'matcher-district',
    ]);
  });

  it('Should_return_empty_array_when_no_disruptions_exist_for_target_weekend', async () => {
    // Seed subscriber
    await prisma.subscription.create({
      data: {
        email: 'matcher-test-empty@example.com',
        lines: {
          create: [{ lineId: 'matcher-central' }],
        },
      },
    });

    const matched = await matchSubscribersForWeekend({
      prisma,
      weekendDate: '2026-10-23', // Weekend with no disruptions
    });

    expect(matched).toEqual([]);
  });
});
