import type { FastifyPluginAsync } from 'fastify';
import { HealthResponseSchema } from '@railsignal/shared';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/health',
    {
      schema: {
        response: {
          200: HealthResponseSchema,
        },
      },
    },
    async () => {
      return { status: 'healthy' };
    }
  );
};
