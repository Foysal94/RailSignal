import type { PrismaClient } from '@prisma/client';
import {
  type CreateSubscriptionRequest,
  isValidLineId,
  type UnsubscribeParams,
  type UnsubscribeQuery,
} from '@railsignal/shared';
import type { FastifyPluginAsync } from 'fastify';
import { prisma as defaultPrisma } from '../../db.js';
import { RFC_9457_TYPE } from '../../errorHandler.js';
import { createSubscriptionSchema, deleteSubscriptionSchema } from './schema.js';

export interface SubscriptionsRoutesOptions {
  prisma?: PrismaClient | undefined;
}

export const subscriptionsRoutes: FastifyPluginAsync<SubscriptionsRoutesOptions> = async (
  fastify,
  options,
) => {
  const db = options?.prisma ?? defaultPrisma;

  fastify.post<{ Body: CreateSubscriptionRequest }>(
    '/api/subscriptions',
    {
      schema: createSubscriptionSchema,
    },
    async (request, reply) => {
      const normalizedEmail = request.body.email.trim().toLowerCase();
      const uniqueLineIds = Array.from(new Set(request.body.lineIds));

      const invalidLineIds = uniqueLineIds.filter((id) => !isValidLineId(id));
      if (invalidLineIds.length > 0) {
        const instance = request.url.split('?')[0] || request.url;
        return reply
          .type('application/problem+json')
          .status(400)
          .send({
            type: RFC_9457_TYPE,
            title: 'Bad Request',
            status: 400,
            detail: `Invalid TfL line IDs: ${invalidLineIds.join(', ')}`,
            instance,
            invalidParams: invalidLineIds.map((id) => ({
              name: 'lineIds',
              reason: `Unknown TfL line ID: "${id}"`,
            })),
          });
      }

      const existing = await db.subscription.findUnique({
        where: { email: normalizedEmail },
        include: { lines: true },
      });

      if (existing) {
        // Atomic synchronization: remove obsolete lines and insert new line selection
        await db.$transaction([
          db.subscriptionLine.deleteMany({
            where: { subscriptionId: existing.id },
          }),
          db.subscriptionLine.createMany({
            data: uniqueLineIds.map((lineId) => ({
              subscriptionId: existing.id,
              lineId,
            })),
          }),
        ]);

        return reply.status(200).send({
          id: existing.id,
          email: existing.email,
          subscribedLineIds: uniqueLineIds,
          createdAt: existing.createdAt.toISOString(),
        });
      }

      const created = await db.subscription.create({
        data: {
          email: normalizedEmail,
          lines: {
            create: uniqueLineIds.map((lineId) => ({ lineId })),
          },
        },
        include: { lines: true },
      });

      return reply.status(201).send({
        id: created.id,
        email: created.email,
        subscribedLineIds: uniqueLineIds,
        createdAt: created.createdAt.toISOString(),
      });
    },
  );

  fastify.delete<{ Params: UnsubscribeParams; Querystring: UnsubscribeQuery }>(
    '/api/subscriptions/:id',
    {
      schema: deleteSubscriptionSchema,
    },
    async (request, reply) => {
      const instance = request.url.split('?')[0] || request.url;
      const { id } = request.params;
      const { token } = request.query;

      const subscription = await db.subscription.findUnique({
        where: { id },
      });

      if (!subscription) {
        return reply
          .type('application/problem+json')
          .status(404)
          .send({
            type: RFC_9457_TYPE,
            title: 'Not Found',
            status: 404,
            detail: `Subscription ${id} not found`,
            instance,
          });
      }

      if (subscription.unsubscribeToken !== token) {
        return reply.type('application/problem+json').status(403).send({
          type: RFC_9457_TYPE,
          title: 'Forbidden',
          status: 403,
          detail: 'Invalid unsubscribe token',
          instance,
        });
      }

      // Schema foreign key defines onDelete: Cascade, purging SubscriptionLine records automatically
      await db.subscription.delete({
        where: { id },
      });

      return reply.status(204).send();
    },
  );
};

export * from './schema.js';
