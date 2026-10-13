import type { PrismaClient, WeekendDisruption } from '@prisma/client';
import { prisma as defaultPrisma } from '../../db.js';

export interface MatchedSubscriber {
  subscriptionId: string;
  email: string;
  unsubscribeToken: string;
  lastNotifiedWeekendDate: string | null;
  subscribedLineIds: string[];
  disruptions: WeekendDisruption[];
}

export interface MatchSubscribersOptions {
  prisma?: PrismaClient | undefined;
  weekendDate: string;
}

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
 * Pure domain matching logic querying active Subscription records via the SubscriptionLine junction table.
 * Matches subscribers whose selected lines have active disruptions for the target weekend.
 */
export async function matchSubscribersForWeekend(
  options: MatchSubscribersOptions,
): Promise<MatchedSubscriber[]> {
  const db = options.prisma ?? defaultPrisma;
  const weekendDate = options.weekendDate;

  // 1. Fetch all materialized disruption projections for the target weekend
  const weekendDisruptions = await db.weekendDisruption.findMany({
    where: { weekendDate },
    orderBy: [{ lineName: 'asc' }, { corridorDescription: 'asc' }],
  });

  // Short-circuit: when no lines are disrupted for the weekend, zero subscriber digests are needed
  if (weekendDisruptions.length === 0) {
    return [];
  }

  // Extract distinct line IDs with disruptions to limit junction table search space
  const disruptedLineIds = Array.from(new Set(weekendDisruptions.map((d) => d.lineId)));

  // 2. Query active subscriptions whose selected lines intersect the disrupted line set
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

  // 3. Compile matched subscribers with their specific relevant disruptions
  return subscriptions.map((subscription) => {
    const subscribedLineIds = subscription.lines.map((l) => l.lineId);
    const subscriberDisruptions = filterDisruptionsForLines(subscribedLineIds, weekendDisruptions);

    return {
      subscriptionId: subscription.id,
      email: subscription.email,
      unsubscribeToken: subscription.unsubscribeToken,
      lastNotifiedWeekendDate: subscription.lastNotifiedWeekendDate,
      subscribedLineIds,
      disruptions: subscriberDisruptions,
    };
  });
}
