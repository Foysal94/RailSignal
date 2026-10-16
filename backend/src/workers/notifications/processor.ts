import type { PrismaClient, Subscription, SubscriptionLine } from '@prisma/client';
import { prisma as defaultPrisma } from '../../db.js';
import type { WeekendDisruptionWithNotices } from '../../domain/disruptionNotices.js';
import {
  type SendDisruptionDigestOptions,
  type SendEmailResult,
  sendDisruptionDigest,
} from '../../email/index.js';
import { assembleDigestDisruptions, mapDisruptionsToDigestItems } from '../digestMapper.js';
import type { WorkerLogger } from '../types.js';

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

// Pure domain filtering helper isolating in-memory disruption matching per line set.
export function filterDisruptionsForLines<T extends { lineId: string }>(
  lineIds: Iterable<string>,
  disruptions: T[],
): T[] {
  const lineSet = new Set(lineIds);
  return disruptions.filter((d) => lineSet.has(d.lineId));
}

// Pure domain matching function operating entirely in memory.
// Matches subscriber records via their SubscriptionLine junction relations against active weekend disruptions.
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

// Queries active subscription projections via Prisma and coordinates domain matching.
// Traverses the SubscriptionLine junction table to find subscribers monitoring disrupted lines.
export async function matchSubscribersForWeekend(
  options: MatchSubscribersOptions,
): Promise<MatchedSubscriber<WeekendDisruptionWithNotices>[]> {
  const db = options.prisma ?? defaultPrisma;
  const weekendDate = options.weekendDate;

  const weekendDisruptions = await assembleDigestDisruptions({
    prisma: db,
    weekendDate,
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

export interface ProcessNotificationJobOptions {
  weekendDate: string;
  prisma?: PrismaClient | undefined;
  emailClient?:
    | {
        sendDisruptionDigest: (options: SendDisruptionDigestOptions) => Promise<SendEmailResult>;
      }
    | undefined;
  sendDisruptionDigest?:
    | ((options: SendDisruptionDigestOptions) => Promise<SendEmailResult>)
    | undefined;
  logger?: WorkerLogger | undefined;
}

export interface ProcessNotificationRecipientResult {
  email: string;
  subscriptionId: string;
  dispatched: boolean;
  reason?: 'already_notified' | 'dispatched' | 'failed';
  error?: string;
}

export interface ProcessNotificationJobResult {
  weekendDate: string;
  totalMatched: number;
  totalDispatched: number;
  totalSkipped: number;
  totalFailed: number;
  recipients: ProcessNotificationRecipientResult[];
}

// Orchestrates subscriber matching, idempotency enforcement, email dispatch,
// and atomic database state updates for a target weekend.
//
// Rationale (ADR 0003):
// In lieu of a distributed transactional outbox spanning PostgreSQL and Redis,
// idempotency is guaranteed at the persistence layer via lastNotifiedWeekendDate.
// Re-running this processor skips already-notified subscribers, ensuring safe BullMQ retries.
//
// Fault Isolation:
// Individual dispatch failures are tracked per recipient. Failures do not abort
// the loop immediately, preventing one bad recipient from starving other subscribers.
// If any recipient fails, an aggregate error is thrown after completing the batch
// so BullMQ's exponential backoff retries only the un-notified recipients.
export async function processNotificationJob(
  options: ProcessNotificationJobOptions,
): Promise<ProcessNotificationJobResult> {
  const db = options.prisma ?? defaultPrisma;
  const sendDigest =
    options.sendDisruptionDigest ??
    (options.emailClient
      ? options.emailClient.sendDisruptionDigest.bind(options.emailClient)
      : sendDisruptionDigest);
  const logger = options.logger ?? console;
  const weekendDate = options.weekendDate;

  logger.info(`[Notification Processor] Matching subscribers for weekend ${weekendDate}...`);

  const matchedSubscribers = await matchSubscribersForWeekend({
    prisma: db,
    weekendDate,
  });

  logger.info(
    `[Notification Processor] Found ${matchedSubscribers.length} candidate subscribers with disruptions`,
  );

  let totalDispatched = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  const recipientResults: ProcessNotificationRecipientResult[] = [];
  const errors: Error[] = [];

  for (const subscriber of matchedSubscribers) {
    // Defense-in-depth idempotency check: Skip dispatch if already notified for this weekend
    if (subscriber.lastNotifiedWeekendDate === weekendDate) {
      logger.info(
        `[Notification Processor] Skipping subscriber ${subscriber.email} (${subscriber.subscriptionId}) - already notified for ${weekendDate}`,
      );
      totalSkipped += 1;
      recipientResults.push({
        email: subscriber.email,
        subscriptionId: subscriber.subscriptionId,
        dispatched: false,
        reason: 'already_notified',
      });
      continue;
    }

    const digestItems = mapDisruptionsToDigestItems(subscriber.disruptions);

    logger.info(
      `[Notification Processor] Dispatching digest to ${subscriber.email} with ${digestItems.length} disruptions...`,
    );

    try {
      await sendDigest({
        to: subscriber.email,
        digest: {
          recipientEmail: subscriber.email,
          weekendDate,
          disruptions: digestItems,
          unsubscribeToken: subscriber.unsubscribeToken,
        },
      });

      await db.subscription.update({
        where: { id: subscriber.subscriptionId },
        data: { lastNotifiedWeekendDate: weekendDate },
      });

      totalDispatched += 1;
      recipientResults.push({
        email: subscriber.email,
        subscriptionId: subscriber.subscriptionId,
        dispatched: true,
        reason: 'dispatched',
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error(
        `[Notification Processor] Failed to dispatch digest to ${subscriber.email}: ${error.message}`,
      );
      totalFailed += 1;
      errors.push(error);
      recipientResults.push({
        email: subscriber.email,
        subscriptionId: subscriber.subscriptionId,
        dispatched: false,
        reason: 'failed',
        error: error.message,
      });
    }
  }

  logger.info(
    `[Notification Processor] Completed weekend ${weekendDate}: Dispatched ${totalDispatched}, Skipped ${totalSkipped}, Failed ${totalFailed}`,
  );

  if (errors.length > 0) {
    throw new Error(
      `Notification dispatch completed with ${errors.length} failure(s): ${errors.map((e) => e.message).join('; ')}`,
    );
  }

  return {
    weekendDate,
    totalMatched: matchedSubscribers.length,
    totalDispatched,
    totalSkipped,
    totalFailed,
    recipients: recipientResults,
  };
}
