import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../db.js';
import { getUpcomingWeekendWindow } from '../../domain/temporal.js';
import {
  type SendDisruptionDigestOptions,
  type SendEmailResult,
  sendDisruptionDigest,
} from '../../email/index.js';
import { mapDisruptionsToDigestItems } from '../digestMapper.js';
import type { WorkerLogger } from '../types.js';

export interface ProcessDemoAlertJobOptions {
  email: string;
  lines: string[];
  referenceDate?: Date | string | undefined;
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
  const sendDigest =
    options.sendDisruptionDigest ??
    (options.emailClient
      ? options.emailClient.sendDisruptionDigest.bind(options.emailClient)
      : sendDisruptionDigest);
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
    include: { notices: true },
    orderBy: [{ lineName: 'asc' }, { corridorDescription: 'asc' }],
  });

  const digestItems = mapDisruptionsToDigestItems(disruptions);

  logger.info(
    `[Demo Alert Processor] Dispatching demo digest to ${options.email} with ${digestItems.length} disruptions...`,
  );

  // Visitors are not subscribers; list-unsubscribe headers are omitted
  await sendDigest({
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
