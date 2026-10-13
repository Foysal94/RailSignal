import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../db.js';
import { getUpcomingWeekendWindow } from '../../domain/temporal.js';
import { resendClient as defaultEmailClient, type ResendEmailClient } from '../../email/index.js';
import { mapDisruptionsToDigestItems } from '../notifications/processor.js';
import type { WorkerLogger } from '../types.js';

export interface ProcessDemoAlertJobOptions {
  email: string;
  lines: string[];
  referenceDate?: Date | string | undefined;
  prisma?: PrismaClient | undefined;
  emailClient?: Pick<ResendEmailClient, 'sendDisruptionDigest'> | undefined;
  logger?: WorkerLogger | undefined;
}

export interface ProcessDemoAlertJobResult {
  email: string;
  weekendDate: string;
  totalDisruptions: number;
  dispatched: boolean;
}

/**
 * Dispatches an immediate, on-demand test alert digest for website portfolio visitors.
 * Queries active weekend disruptions matching the visitor's selected lines and dispatches
 * via the email client without persisting or modifying any subscriber database state.
 */
export async function processDemoAlertJob(
  options: ProcessDemoAlertJobOptions,
): Promise<ProcessDemoAlertJobResult> {
  const db = options.prisma ?? defaultPrisma;
  const emailClient = options.emailClient ?? defaultEmailClient;
  const logger = options.logger ?? console;

  const referenceDate = options.referenceDate ? new Date(options.referenceDate) : undefined;
  const targetWindow = getUpcomingWeekendWindow({ referenceDate });
  const weekendDate = targetWindow.weekendDate;

  logger.info(
    `[Demo Alert Processor] Fetching disruptions for lines [${options.lines.join(', ')}] on weekend ${weekendDate}...`,
  );

  const disruptions = await db.weekendDisruption.findMany({
    where: {
      weekendDate,
      lineId: { in: options.lines },
    },
    orderBy: [{ lineName: 'asc' }, { corridorDescription: 'asc' }],
  });

  const digestItems = mapDisruptionsToDigestItems(disruptions);

  logger.info(
    `[Demo Alert Processor] Dispatching demo digest to ${options.email} with ${digestItems.length} disruptions...`,
  );

  // Immediate on-demand dispatch (no unsubscribe token needed since visitors are not subscribers)
  await emailClient.sendDisruptionDigest({
    to: options.email,
    subject: `RailSignal Weekend Radar (Demo): ${weekendDate}`,
    digest: {
      recipientEmail: options.email,
      weekendDate,
      disruptions: digestItems,
    },
  });

  logger.info(`[Demo Alert Processor] Successfully dispatched demo digest to ${options.email}`);

  return {
    email: options.email,
    weekendDate,
    totalDisruptions: digestItems.length,
    dispatched: true,
  };
}
