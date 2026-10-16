import type { PrismaClient } from '@prisma/client';
import type { WeekendStatusQuery } from '@railsignal/shared';
import type { FastifyPluginAsync } from 'fastify';
import { prisma as defaultPrisma } from '../../db.js';
import { projectWeekendStatusBoard } from '../../domain/statusBoard.js';
import { getUpcomingWeekendWindow } from '../../domain/temporal.js';
import { getWeekendStatusSchema } from './schema.js';

export interface LinesRoutesOptions {
  prisma?: PrismaClient | undefined;
}

export const linesRoutes: FastifyPluginAsync<LinesRoutesOptions> = async (fastify, options) => {
  const db = options?.prisma ?? defaultPrisma;

  fastify.get<{ Querystring: WeekendStatusQuery }>(
    '/api/lines/weekend-status',
    {
      schema: getWeekendStatusSchema,
    },
    async (request) => {
      const referenceDate = request.query.referenceDate
        ? new Date(request.query.referenceDate)
        : undefined;
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
    },
  );
};

export * from './schema.js';
