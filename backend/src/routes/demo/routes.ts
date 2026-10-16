import { isValidLineId, type SendTestDigestRequest, TFL_LINE_IDS } from '@railsignal/shared';
import type { Queue } from 'bullmq';
import type { FastifyPluginAsync } from 'fastify';
import { RFC_9457_TYPE } from '../../errorHandler.js';
import {
  type DemoAlertJobData,
  demoAlertQueue as defaultDemoAlertQueue,
} from '../../queues/queues.js';
import { sendTestDigestSchema } from './schema.js';

export interface DemoRoutesOptions {
  demoAlertQueue?: Pick<Queue<DemoAlertJobData, void, string>, 'add'> | undefined;
}

export const demoRoutes: FastifyPluginAsync<DemoRoutesOptions> = async (fastify, options) => {
  const queue = options?.demoAlertQueue ?? defaultDemoAlertQueue;

  fastify.post<{ Body: SendTestDigestRequest }>(
    '/api/demo/send-test-digest',
    {
      schema: sendTestDigestSchema,
    },
    async (request, reply) => {
      const selectedLines = request.body.lineIds ?? request.body.lines;
      let linesToQueue: string[];

      if (selectedLines !== undefined) {
        const invalidLines = selectedLines.filter((id) => !isValidLineId(id));
        if (invalidLines.length > 0) {
          const instance = request.url.split('?')[0] || request.url;
          return reply
            .type('application/problem+json')
            .status(400)
            .send({
              type: RFC_9457_TYPE,
              title: 'Bad Request',
              status: 400,
              detail: `Invalid TfL line IDs: ${invalidLines.join(', ')}`,
              instance,
              invalidParams: invalidLines.map((id) => ({
                name: 'lineIds',
                reason: `Unknown TfL line ID: "${id}"`,
              })),
            });
        }
        linesToQueue = selectedLines;
      } else {
        // If visitor doesn't pick specific lines, default to all tracked TfL lines
        linesToQueue = [...TFL_LINE_IDS];
      }

      const normalizedEmail = request.body.email.trim().toLowerCase();

      await queue.add('send-demo-alert', {
        email: normalizedEmail,
        lines: linesToQueue,
      });

      return reply.status(202).send({
        status: 'queued',
        email: normalizedEmail,
      });
    },
  );
};

export * from './schema.js';
