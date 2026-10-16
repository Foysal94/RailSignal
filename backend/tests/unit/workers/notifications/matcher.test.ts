import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../../../src/db.js';
import {
  filterDisruptionsForLines,
  matchSubscribersForWeekend,
  matchSubscribersToDisruptions,
} from '../../../../src/workers/notifications/processor.js';

describe('Subscriber Matching Domain Logic (SubscriptionLine Junction)', () => {
  const weekendDate = '2026-10-16';

  describe('Pure In-Memory Domain Matching (No I/O)', () => {
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

    it('Should_purely_match_subscribers_via_junction_lines_in_memory_without_database', () => {
      const disruptions = [
        { lineId: 'central', corridorDescription: 'Part Closure' },
        { lineId: 'district', corridorDescription: 'Planned Closure' },
      ];

      const mockSubscriptions = [
        {
          id: 'sub-1',
          email: 'sub1@example.com',
          unsubscribeToken: 'tok-1',
          lastNotifiedWeekendDate: null,
          lines: [{ lineId: 'central' }],
        },
        {
          id: 'sub-2',
          email: 'sub2@example.com',
          unsubscribeToken: 'tok-2',
          lastNotifiedWeekendDate: null,
          lines: [{ lineId: 'victoria' }], // Not disrupted
        },
        {
          id: 'sub-3',
          email: 'sub3@example.com',
          unsubscribeToken: 'tok-3',
          lastNotifiedWeekendDate: null,
          lines: [{ lineId: 'central' }, { lineId: 'district' }, { lineId: 'piccadilly' }],
        },
      ];

      const matched = matchSubscribersToDisruptions(mockSubscriptions, disruptions);

      expect(matched).toHaveLength(2);

      const matchedSub1 = matched.find((m) => m.subscriptionId === 'sub-1');
      expect(matchedSub1).toBeDefined();
      expect(matchedSub1?.disruptions).toHaveLength(1);
      expect(matchedSub1?.disruptions[0].lineId).toBe('central');

      const matchedSub3 = matched.find((m) => m.subscriptionId === 'sub-3');
      expect(matchedSub3).toBeDefined();
      expect(matchedSub3?.disruptions).toHaveLength(2);
      expect(matchedSub3?.disruptions.map((d) => d.lineId).sort()).toEqual(['central', 'district']);
    });
  });

  describe('Database Persistence Query Coordination', () => {
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

    it('Should_match_subscribers_whose_selected_lines_have_active_weekend_disruptions', async () => {
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

      const sub1 = await prisma.subscription.create({
        data: {
          email: 'matcher-test-1@example.com',
          lines: {
            create: [{ lineId: 'matcher-central' }],
          },
        },
      });

      await prisma.subscription.create({
        data: {
          email: 'matcher-test-2@example.com',
          lines: {
            create: [{ lineId: 'matcher-bakerloo' }],
          },
        },
      });

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
        weekendDate: '2026-10-23',
      });

      expect(matched).toEqual([]);
    });
  });
});
