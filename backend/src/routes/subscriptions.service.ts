import type { PrismaClient } from '@prisma/client';
import { isValidLineId, type SubscriptionResponse } from '@railsignal/shared';
import { prisma as defaultPrisma } from '../db.js';

export interface CreateSubscriptionServiceOptions {
  prisma?: PrismaClient | undefined;
  email: string;
  lineIds: string[];
}

export interface CreateSubscriptionResult {
  isNew: boolean;
  subscription: SubscriptionResponse;
}

export interface DeleteSubscriptionServiceOptions {
  prisma?: PrismaClient | undefined;
  id: string;
  token: string;
}

export type DeleteSubscriptionResult =
  | { status: 'deleted' }
  | { status: 'not_found' }
  | { status: 'forbidden' };

export class InvalidLineIdError extends Error {
  constructor(public readonly invalidLineIds: string[]) {
    super(`Invalid TfL line IDs: ${invalidLineIds.join(', ')}`);
    this.name = 'InvalidLineIdError';
  }
}

/**
 * Idempotently creates or updates a subscriber record and their monitored line associations.
 */
export async function createOrUpdateSubscription(
  options: CreateSubscriptionServiceOptions,
): Promise<CreateSubscriptionResult> {
  const db = options.prisma ?? defaultPrisma;
  const normalizedEmail = options.email.trim().toLowerCase();
  const uniqueLineIds = Array.from(new Set(options.lineIds));

  // Reject payloads with unknown TfL line IDs
  const invalidIds = uniqueLineIds.filter((id) => !isValidLineId(id));
  if (invalidIds.length > 0) {
    throw new InvalidLineIdError(invalidIds);
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

    return {
      isNew: false,
      subscription: {
        id: existing.id,
        email: existing.email,
        subscribedLineIds: uniqueLineIds,
        createdAt: existing.createdAt.toISOString(),
      },
    };
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

  return {
    isNew: true,
    subscription: {
      id: created.id,
      email: created.email,
      subscribedLineIds: uniqueLineIds,
      createdAt: created.createdAt.toISOString(),
    },
  };
}

/**
 * Verifies the immutable unsubscribe token and cascades deletion of subscriber record.
 */
export async function deleteSubscription(
  options: DeleteSubscriptionServiceOptions,
): Promise<DeleteSubscriptionResult> {
  const db = options.prisma ?? defaultPrisma;
  const { id, token } = options;

  const subscription = await db.subscription.findUnique({
    where: { id },
  });

  if (!subscription) {
    return { status: 'not_found' };
  }

  if (subscription.unsubscribeToken !== token) {
    return { status: 'forbidden' };
  }

  // Schema foreign key defines onDelete: Cascade, purging SubscriptionLine records automatically
  await db.subscription.delete({
    where: { id },
  });

  return { status: 'deleted' };
}
