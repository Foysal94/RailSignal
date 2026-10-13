import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/db.js';

describe('Subscriptions API Endpoints', () => {
  let app: FastifyInstance;
  const testEmail = 'subscriber-test@example.com';

  beforeEach(async () => {
    await prisma.subscription.deleteMany({
      where: { email: { contains: 'test@example.com' } },
    });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  afterAll(async () => {
    await prisma.subscription.deleteMany({
      where: { email: { contains: 'test@example.com' } },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/subscriptions', () => {
    it('Should_create_new_subscription_and_lines_when_valid_payload_provided', async () => {
      app = buildApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/subscriptions',
        payload: {
          email: testEmail,
          lineIds: ['bakerloo', 'victoria'],
        },
      });

      expect([200, 201]).toContain(response.statusCode);
      expect(response.headers['content-type']).toContain('application/json');

      const body = response.json();
      expect(body.id).toBeDefined();
      expect(body.email).toBe(testEmail);
      expect(body.subscribedLineIds).toEqual(expect.arrayContaining(['bakerloo', 'victoria']));
      expect(body.createdAt).toBeDefined();

      // Verify observable database state
      const dbRecord = await prisma.subscription.findUnique({
        where: { email: testEmail },
        include: { lines: true },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.lines.map((l) => l.lineId)).toEqual(
        expect.arrayContaining(['bakerloo', 'victoria']),
      );
    });

    it('Should_update_existing_subscription_idempotently_when_same_email_subscribes_again', async () => {
      app = buildApp();

      // Initial create
      const firstResponse = await app.inject({
        method: 'POST',
        url: '/api/subscriptions',
        payload: {
          email: testEmail,
          lineIds: ['bakerloo'],
        },
      });
      expect([200, 201]).toContain(firstResponse.statusCode);
      const firstBody = firstResponse.json();

      // Second call updates lines
      const updateResponse = await app.inject({
        method: 'POST',
        url: '/api/subscriptions',
        payload: {
          email: testEmail,
          lineIds: ['central', 'jubilee', 'northern'],
        },
      });
      expect([200, 201]).toContain(updateResponse.statusCode);
      const updateBody = updateResponse.json();

      expect(updateBody.id).toBe(firstBody.id);
      expect(updateBody.subscribedLineIds).toEqual(
        expect.arrayContaining(['central', 'jubilee', 'northern']),
      );
      expect(updateBody.subscribedLineIds).not.toContain('bakerloo');
    });

    it('Should_reject_with_rfc_9457_when_email_is_invalid', async () => {
      app = buildApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/subscriptions',
        payload: {
          email: 'not-a-valid-email',
          lineIds: ['bakerloo'],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toContain('application/problem+json');
      const body = response.json();
      expect(body.title).toBe('Bad Request');
      expect(body.invalidParams).toBeDefined();
    });

    it('Should_reject_with_rfc_9457_when_lineIds_is_empty', async () => {
      app = buildApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/subscriptions',
        payload: {
          email: testEmail,
          lineIds: [],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toContain('application/problem+json');
    });

    it('Should_reject_with_rfc_9457_when_lineIds_contains_unknown_id', async () => {
      app = buildApp();

      const response = await app.inject({
        method: 'POST',
        url: '/api/subscriptions',
        payload: {
          email: testEmail,
          lineIds: ['not-a-real-line'],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toContain('application/problem+json');
      const body = response.json();
      expect(body.invalidParams).toBeDefined();
      expect(body.invalidParams[0].name).toBe('lineIds');
    });
  });

  describe('DELETE /api/subscriptions/:id?token=...', () => {
    it('Should_cascade_delete_subscription_when_valid_id_and_token_provided', async () => {
      app = buildApp();

      // Seed subscription
      const sub = await prisma.subscription.create({
        data: {
          email: testEmail,
          lines: {
            create: [{ lineId: 'central' }, { lineId: 'piccadilly' }],
          },
        },
        include: { lines: true },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/subscriptions/${sub.id}?token=${sub.unsubscribeToken}`,
      });

      expect([200, 204]).toContain(response.statusCode);

      // Verify deletion in database
      const foundSub = await prisma.subscription.findUnique({
        where: { id: sub.id },
      });
      expect(foundSub).toBeNull();

      const foundLines = await prisma.subscriptionLine.findMany({
        where: { subscriptionId: sub.id },
      });
      expect(foundLines).toHaveLength(0);
    });

    it('Should_return_403_when_unsubscribe_token_is_incorrect', async () => {
      app = buildApp();

      const sub = await prisma.subscription.create({
        data: {
          email: testEmail,
          lines: {
            create: [{ lineId: 'central' }],
          },
        },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/subscriptions/${sub.id}?token=invalid-wrong-token`,
      });

      expect(response.statusCode).toBe(403);
      expect(response.headers['content-type']).toContain('application/problem+json');

      const body = response.json();
      expect(body.title).toBe('Forbidden');
    });

    it('Should_return_404_when_subscription_id_does_not_exist', async () => {
      app = buildApp();

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/subscriptions/non-existent-uuid-1234?token=sample-token',
      });

      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toContain('application/problem+json');
    });

    it('Should_return_400_when_token_query_parameter_is_missing', async () => {
      app = buildApp();

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/subscriptions/some-uuid',
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toContain('application/problem+json');
    });
  });
});
