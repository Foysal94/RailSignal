import type { PrismaClient, Subscription, SubscriptionLine } from '@prisma/client';
import { prisma as defaultPrisma } from '../../db.js';
import type { WeekendDisruptionWithNotices } from '../../domain/disruptionNotices.js';

export interface MatchedSubscriber<TDisruption = WeekendDisruptionWithNotices> {
  subscriptionId: string;
  email: string;
  unsubscribeToken: string;
  lastNotifiedWeekendDate: string | null;
  subscribedLineIds: string[];
  disruptions: TDisruption[];
}

export interface MatchSubscribersOptions {
  prisma?: PrismaClient | undefined;
  weekendDate: string;
}

export type SubscriptionWithLines = Subscription & {
  lines: SubscriptionLine[];
};

/**
 * Pure domain filtering helper isolating in-memory disruption matching per line set.
 */
export function filterDisruptionsForLines<T extends { lineId: string }>(
  lineIds: Iterable<string>,
  disruptions: T[],
): T[] {
  const lineSet = new Set(lineIds);
  return disruptions.filter((d) => lineSet.has(d.lineId));
}

/**
 * Pure domain matching function operating entirely in memory.
 * Matches subscriber records via their SubscriptionLine junction relations against active weekend disruptions.
 */
export function matchSubscribersToDisruptions<
  S extends {
    id: string;
    email: string;
    unsubscribeToken: string;
    lastNotifiedWeekendDate: string | null;
    lines: Array<{ lineId: string }>;
  },
  D extends { lineId: string },
>(subscriptions: S[], disruptions: D[]): MatchedSubscriber<D>[] {
  const matched: MatchedSubscriber<D>[] = [];

  for (const subscription of subscriptions) {
    const subscribedLineIds = subscription.lines.map((l) => l.lineId);
    const subscriberDisruptions = filterDisruptionsForLines(subscribedLineIds, disruptions);

    if (subscriberDisruptions.length > 0) {
      matched.push({
        subscriptionId: subscription.id,
        email: subscription.email,
        unsubscribeToken: subscription.unsubscribeToken,
        lastNotifiedWeekendDate: subscription.lastNotifiedWeekendDate,
        subscribedLineIds,
        disruptions: subscriberDisruptions,
      });
    }
  }

  return matched;
}

/**
 * Queries active subscription projections via Prisma and coordinates domain matching.
 * Traverses the SubscriptionLine junction table to find subscribers monitoring disrupted lines.
 */
export async function matchSubscribersForWeekend(
  options: MatchSubscribersOptions,
): Promise<MatchedSubscriber<WeekendDisruptionWithNotices>[]> {
  const db = options.prisma ?? defaultPrisma;
  const weekendDate = options.weekendDate;

  const weekendDisruptions = await db.weekendDisruption.findMany({
    where: { weekendDate },
    include: { notices: true },
    orderBy: [{ lineName: 'asc' }, { corridorDescription: 'asc' }],
  });

  if (weekendDisruptions.length === 0) {
    return [];
  }

  const disruptedLineIds = Array.from(new Set(weekendDisruptions.map((d) => d.lineId)));

  const subscriptions = await db.subscription.findMany({
    where: {
      lines: {
        some: {
          lineId: {
            in: disruptedLineIds,
          },
        },
      },
    },
    include: {
      lines: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return matchSubscribersToDisruptions(subscriptions, weekendDisruptions);
}
