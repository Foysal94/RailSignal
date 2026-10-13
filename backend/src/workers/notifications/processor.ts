import type { PrismaClient, WeekendDisruption } from '@prisma/client';
import { getTflLineById, type LineMode } from '@railsignal/shared';
import { prisma as defaultPrisma } from '../../db.js';
import { resendClient as defaultEmailClient, type ResendEmailClient } from '../../email/index.js';
import type { DisruptionDigestItem } from '../../email/templates/DisruptionDigest.js';
import type { WorkerLogger } from '../types.js';
import { matchSubscribersForWeekend } from './matcher.js';

export interface ProcessNotificationJobOptions {
  weekendDate: string;
  prisma?: PrismaClient | undefined;
  emailClient?: Pick<ResendEmailClient, 'sendDisruptionDigest'> | undefined;
  logger?: WorkerLogger | undefined;
}

export interface ProcessNotificationRecipientResult {
  email: string;
  subscriptionId: string;
  dispatched: boolean;
  reason?: 'already_notified' | 'dispatched';
}

export interface ProcessNotificationJobResult {
  weekendDate: string;
  totalMatched: number;
  totalDispatched: number;
  totalSkipped: number;
  recipients: ProcessNotificationRecipientResult[];
}

/**
 * Transforms database disruption records into email template items with brand colors and styling metadata.
 */
export function mapDisruptionsToDigestItems(
  disruptions: WeekendDisruption[],
): DisruptionDigestItem[] {
  return disruptions.map((disruption) => {
    const lineMeta = getTflLineById(disruption.lineId);
    return {
      lineId: disruption.lineId,
      lineName: disruption.lineName,
      mode: (lineMeta?.mode ?? disruption.mode) as LineMode,
      ...(lineMeta?.color ? { color: lineMeta.color } : {}),
      ...(lineMeta?.contrastBorder !== undefined
        ? { contrastBorder: lineMeta.contrastBorder }
        : {}),
      statusSeverityDescription: disruption.statusSeverityDescription,
      corridorDescription: disruption.corridorDescription,
    };
  });
}

/**
 * Orchestrates subscriber matching, idempotency enforcement, email dispatch,
 * and atomic database state updates for a target weekend.
 *
 * Rationale (ADR 0003):
 * In lieu of a distributed transactional outbox spanning PostgreSQL and Redis,
 * idempotency is guaranteed at the persistence layer via lastNotifiedWeekendDate.
 * Re-running this processor skips already-notified subscribers, ensuring safe BullMQ retries.
 */
export async function processNotificationJob(
  options: ProcessNotificationJobOptions,
): Promise<ProcessNotificationJobResult> {
  const db = options.prisma ?? defaultPrisma;
  const emailClient = options.emailClient ?? defaultEmailClient;
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
  const recipientResults: ProcessNotificationRecipientResult[] = [];

  for (const subscriber of matchedSubscribers) {
    // Idempotency check: Skip dispatch if subscriber was already notified for this weekend
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

    // Dispatch personalized digest via email client
    await emailClient.sendDisruptionDigest({
      to: subscriber.email,
      digest: {
        recipientEmail: subscriber.email,
        weekendDate,
        disruptions: digestItems,
        unsubscribeToken: subscriber.unsubscribeToken,
      },
    });

    // Atomically mark subscription as notified in database upon successful dispatch
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
  }

  logger.info(
    `[Notification Processor] Completed weekend ${weekendDate}: Dispatched ${totalDispatched}, Skipped ${totalSkipped}`,
  );

  return {
    weekendDate,
    totalMatched: matchedSubscribers.length,
    totalDispatched,
    totalSkipped,
    recipients: recipientResults,
  };
}
