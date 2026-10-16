import type { PrismaClient } from '@prisma/client';
import type { WeekendStatusResponse } from '@railsignal/shared';
import { prisma as defaultPrisma } from '../../db.js';
import { projectWeekendStatusBoard } from '../../domain/statusBoard.js';
import { getUpcomingWeekendWindow } from '../../domain/temporal.js';

export interface FetchWeekendStatusOptions {
  prisma?: PrismaClient | undefined;
  referenceDate?: string | Date | undefined;
}

// Queries the WeekendDisruption read model and delegates status board projection to pure domain logic.
export async function fetchWeekendStatus(
  options: FetchWeekendStatusOptions = {},
): Promise<WeekendStatusResponse> {
  const db = options.prisma ?? defaultPrisma;
  const referenceDate = options.referenceDate ? new Date(options.referenceDate) : undefined;
  const targetWindow = getUpcomingWeekendWindow({ referenceDate });
  const weekendDate = targetWindow.weekendDate;

  // Single indexed read query against materialized read model (<5ms response target)
  const dbDisruptions = await db.weekendDisruption.findMany({
    where: { weekendDate },
    include: { notices: true },
    orderBy: [{ lineName: 'asc' }, { corridorDescription: 'asc' }],
  });

  return projectWeekendStatusBoard({
    disruptions: dbDisruptions,
    targetWindow,
  });
}

export * from '../../domain/statusBoard.js';
