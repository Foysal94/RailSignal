import type { SyncWeekendDisruptionsRequest } from '@railsignal/shared';
import type { Queue } from 'bullmq';
import type { FastifyPluginAsync } from 'fastify';
import { type AppConfig, config as defaultConfig } from '../../config.js';
import { RFC_9457_TYPE } from '../../errorHandler.js';
import {
  ingestQueue as defaultIngestQueue,
  type IngestJobData,
  type IngestJobResult,
} from '../../queues/queues.js';
import { syncWeekendDisruptionsSchema } from './schema.js';

export interface JobsRoutesOptions {
  ingestQueue?: Pick<Queue<IngestJobData, IngestJobResult, string>, 'add'> | undefined;
  config?: AppConfig | undefined;
}

export const jobsRoutes: FastifyPluginAsync<JobsRoutesOptions> = async (fastify, options) => {
  const currentConfig = options?.config ?? defaultConfig;
  const queue = options?.ingestQueue ?? defaultIngestQueue;

  fastify.post<{ Body?: SyncWeekendDisruptionsRequest }>(
    '/api/jobs/sync-weekend-disruptions',
    {
      schema: syncWeekendDisruptionsSchema,
    },
    async (request, reply) => {
      const instance = request.url.split('?')[0] || request.url;
      const providedSecret = request.headers['x-job-secret'] as string | undefined;
      const expectedSecret = currentConfig.jobSecret;

      if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
        return reply.type('application/problem+json').status(401).send({
          type: RFC_9457_TYPE,
          title: 'Unauthorized',
          status: 401,
          detail: 'Missing or invalid X-Job-Secret header',
          instance,
        });
      }

      const job = await queue.add('sync-weekend-disruptions', {
        referenceDate: request.body?.referenceDate,
        force: request.body?.force,
      });

      return reply.status(202).send({
        status: 'queued',
        ...(job.id ? { jobId: String(job.id) } : {}),
      });
    },
  );
};

export * from './schema.js';
