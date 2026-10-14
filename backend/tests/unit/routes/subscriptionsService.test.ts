import type { PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  createOrUpdateSubscription,
  deleteSubscription,
  InvalidLineIdError,
} from '../../../src/routes/subscriptions/service.js';

describe('Subscriptions Service Unit Tests', () => {
  it('Should_throw_InvalidLineIdError_when_unknown_line_id_provided', async () => {
    await expect(
      createOrUpdateSubscription({
        email: 'test@example.com',
        lineIds: ['unknown-line-id'],
      }),
    ).rejects.toThrow(InvalidLineIdError);
  });

  it('Should_return_not_found_when_deleting_non_existent_subscription', async () => {
    const mockPrisma = {
      subscription: {
        findUnique: async () => null,
      },
    } as unknown as PrismaClient;

    const result = await deleteSubscription({
      prisma: mockPrisma,
      id: 'missing-id',
      token: 'any-token',
    });

    expect(result.status).toBe('not_found');
  });

  it('Should_return_forbidden_when_token_does_not_match', async () => {
    const mockPrisma = {
      subscription: {
        findUnique: async () => ({
          id: 'sub-1',
          unsubscribeToken: 'correct-token',
        }),
      },
    } as unknown as PrismaClient;

    const result = await deleteSubscription({
      prisma: mockPrisma,
      id: 'sub-1',
      token: 'wrong-token',
    });

    expect(result.status).toBe('forbidden');
  });

  it('Should_delete_and_return_deleted_when_token_matches', async () => {
    let deletedId: string | undefined;
    const mockPrisma = {
      subscription: {
        findUnique: async () => ({
          id: 'sub-1',
          unsubscribeToken: 'correct-token',
        }),
        delete: async ({ where }: { where: { id: string } }) => {
          deletedId = where.id;
          return {};
        },
      },
    } as unknown as PrismaClient;

    const result = await deleteSubscription({
      prisma: mockPrisma,
      id: 'sub-1',
      token: 'correct-token',
    });

    expect(result.status).toBe('deleted');
    expect(deletedId).toBe('sub-1');
  });
});
