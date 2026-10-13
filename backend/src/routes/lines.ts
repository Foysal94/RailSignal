import type { PrismaClient } from '@prisma/client';
import type { WeekendStatusQuery } from '@railsignal/shared';
import type { FastifyPluginAsync } from 'fastify';
import { getWeekendStatusSchema } from './lines.schema.js';
import { fetchWeekendStatus } from './lines.service.js';

export interface LinesRoutesOptions {
  prisma?: PrismaClient | undefined;
}

export const linesRoutes: FastifyPluginAsync<LinesRoutesOptions> = async (fastify, options) => {
  fastify.get<{ Querystring: WeekendStatusQuery }>(
    '/api/lines/weekend-status',
    {
      schema: getWeekendStatusSchema,
    },
    async (request) => {
      return fetchWeekendStatus({
        prisma: options?.prisma,
        referenceDate: request.query.referenceDate,
      });
    },
  );
};
