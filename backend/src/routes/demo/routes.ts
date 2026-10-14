import type { SendTestDigestRequest } from '@railsignal/shared';
import type { Queue } from 'bullmq';
import type { FastifyPluginAsync } from 'fastify';
import { RFC_9457_TYPE } from '../../errorHandler.js';
import type { DemoAlertJobData } from '../../queues/queues.js';
import { sendTestDigestSchema } from './schema.js';
import { enqueueDemoAlert, InvalidDemoLineSelectionError } from './service.js';

export interface DemoRoutesOptions {
  demoAlertQueue?: Pick<Queue<DemoAlertJobData, void, string>, 'add'> | undefined;
}

export const demoRoutes: FastifyPluginAsync<DemoRoutesOptions> = async (fastify, options) => {
  fastify.post<{ Body: SendTestDigestRequest }>(
    '/api/demo/send-test-digest',
    {
      schema: sendTestDigestSchema,
    },
    async (request, reply) => {
      try {
        const result = await enqueueDemoAlert({
          queue: options?.demoAlertQueue,
          email: request.body.email,
          lineIds: request.body.lineIds,
          lines: request.body.lines,
        });

        return reply.status(202).send(result);
      } catch (error) {
        if (error instanceof InvalidDemoLineSelectionError) {
          const instance = request.url.split('?')[0] || request.url;
          return reply
            .type('application/problem+json')
            .status(400)
            .send({
              type: RFC_9457_TYPE,
              title: 'Bad Request',
              status: 400,
              detail: error.message,
              instance,
              invalidParams: error.invalidLines.map((id) => ({
                name: 'lineIds',
                reason: `Unknown TfL line ID: "${id}"`,
              })),
            });
        }
        throw error;
      }
    },
  );
};

export * from './schema.js';
export * from './service.js';
