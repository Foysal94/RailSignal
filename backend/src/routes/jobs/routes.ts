import type { SyncWeekendDisruptionsRequest } from '@railsignal/shared';
import type { Queue } from 'bullmq';
import type { FastifyPluginAsync } from 'fastify';
import { type AppConfig, config as defaultConfig } from '../../config.js';
import { RFC_9457_TYPE } from '../../errorHandler.js';
import type { IngestJobData, IngestJobResult } from '../../queues/queues.js';
import { syncWeekendDisruptionsSchema } from './schema.js';
import { enqueueSyncDisruptionsJob } from './service.js';

export interface JobsRoutesOptions {
  ingestQueue?: Pick<Queue<IngestJobData, IngestJobResult, string>, 'add'> | undefined;
  config?: AppConfig | undefined;
}

export const jobsRoutes: FastifyPluginAsync<JobsRoutesOptions> = async (fastify, options) => {
  const currentConfig = options?.config ?? defaultConfig;

  fastify.post<{ Body?: SyncWeekendDisruptionsRequest }>(
    '/api/jobs/sync-weekend-disruptions',
    {
      schema: syncWeekendDisruptionsSchema,
    },
    async (request, reply) => {
      const instance = request.url.split('?')[0] || request.url;
      const providedSecret = request.headers['x-job-secret'] as string | undefined;

      const result = await enqueueSyncDisruptionsJob({
        queue: options?.ingestQueue,
        expectedSecret: currentConfig.jobSecret,
        providedSecret,
        referenceDate: request.body?.referenceDate,
        force: request.body?.force,
      });

      if (result.status === 'unauthorized') {
        return reply.type('application/problem+json').status(401).send({
          type: RFC_9457_TYPE,
          title: 'Unauthorized',
          status: 401,
          detail: 'Missing or invalid X-Job-Secret header',
          instance,
        });
      }

      return reply.status(202).send(result);
    },
  );
};

export * from './schema.js';
export * from './service.js';
