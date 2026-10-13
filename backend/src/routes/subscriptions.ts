import type { PrismaClient } from '@prisma/client';
import type {
  CreateSubscriptionRequest,
  UnsubscribeParams,
  UnsubscribeQuery,
} from '@railsignal/shared';
import type { FastifyPluginAsync } from 'fastify';
import { createSubscriptionSchema, deleteSubscriptionSchema } from './subscriptions.schema.js';
import {
  createOrUpdateSubscription,
  deleteSubscription,
  InvalidLineIdError,
} from './subscriptions.service.js';

const RFC_9457_TYPE = 'https://datatracker.ietf.org/doc/html/rfc9457';

export interface SubscriptionsRoutesOptions {
  prisma?: PrismaClient | undefined;
}

export const subscriptionsRoutes: FastifyPluginAsync<SubscriptionsRoutesOptions> = async (
  fastify,
  options,
) => {
  fastify.post<{ Body: CreateSubscriptionRequest }>(
    '/api/subscriptions',
    {
      schema: createSubscriptionSchema,
    },
    async (request, reply) => {
      try {
        const result = await createOrUpdateSubscription({
          prisma: options?.prisma,
          email: request.body.email,
          lineIds: request.body.lineIds,
        });

        const statusCode = result.isNew ? 201 : 200;
        return reply.status(statusCode).send(result.subscription);
      } catch (error) {
        if (error instanceof InvalidLineIdError) {
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
              invalidParams: error.invalidLineIds.map((id) => ({
                name: 'lineIds',
                reason: `Unknown TfL line ID: "${id}"`,
              })),
            });
        }
        throw error;
      }
    },
  );

  fastify.delete<{ Params: UnsubscribeParams; Querystring: UnsubscribeQuery }>(
    '/api/subscriptions/:id',
    {
      schema: deleteSubscriptionSchema,
    },
    async (request, reply) => {
      const instance = request.url.split('?')[0] || request.url;
      const result = await deleteSubscription({
        prisma: options?.prisma,
        id: request.params.id,
        token: request.query.token,
      });

      if (result.status === 'not_found') {
        return reply
          .type('application/problem+json')
          .status(404)
          .send({
            type: RFC_9457_TYPE,
            title: 'Not Found',
            status: 404,
            detail: `Subscription ${request.params.id} not found`,
            instance,
          });
      }

      if (result.status === 'forbidden') {
        return reply.type('application/problem+json').status(403).send({
          type: RFC_9457_TYPE,
          title: 'Forbidden',
          status: 403,
          detail: 'Invalid unsubscribe token',
          instance,
        });
      }

      return reply.status(204).send();
    },
  );
};
