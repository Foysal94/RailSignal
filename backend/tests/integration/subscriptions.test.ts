import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { WebApplicationFactory } from './webApplicationFactory.js';

describe('Subscriptions API Endpoints', () => {
  let factory: WebApplicationFactory;
  const testEmail = 'subscriber-test@example.com';

  beforeAll(async () => {
    factory = await WebApplicationFactory.create();
  });

  beforeEach(async () => {
    await factory.resetDatabase();
  });

  afterAll(async () => {
    await factory.close();
  });

  describe('POST /api/subscriptions', () => {
    it('Should_create_new_subscription_and_lines_when_valid_payload_provided', async () => {
      const response = await factory.inject({
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

      // Verify observable SQLite database state via factory.prisma
      const dbRecord = await factory.prisma.subscription.findUnique({
        where: { email: testEmail },
        include: { lines: true },
      });
      expect(dbRecord).not.toBeNull();
      expect(dbRecord?.lines.map((l) => l.lineId)).toEqual(
        expect.arrayContaining(['bakerloo', 'victoria']),
      );
    });

    it('Should_update_existing_subscription_idempotently_when_same_email_subscribes_again', async () => {
      // Initial subscription creation
      const firstResponse = await factory.inject({
        method: 'POST',
        url: '/api/subscriptions',
        payload: {
          email: testEmail,
          lineIds: ['bakerloo'],
        },
      });
      expect([200, 201]).toContain(firstResponse.statusCode);
      const firstBody = firstResponse.json();

      // Second submission with updated line preferences
      const updateResponse = await factory.inject({
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
      const response = await factory.inject({
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
      const response = await factory.inject({
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
      const response = await factory.inject({
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
      // Seed subscription directly in SQLite via factory.prisma
      const sub = await factory.prisma.subscription.create({
        data: {
          email: testEmail,
          lines: {
            create: [{ lineId: 'central' }, { lineId: 'piccadilly' }],
          },
        },
        include: { lines: true },
      });

      const response = await factory.inject({
        method: 'DELETE',
        url: `/api/subscriptions/${sub.id}?token=${sub.unsubscribeToken}`,
      });

      expect([200, 204]).toContain(response.statusCode);

      // Verify cascading deletion in SQLite
      const foundSub = await factory.prisma.subscription.findUnique({
        where: { id: sub.id },
      });
      expect(foundSub).toBeNull();

      const foundLines = await factory.prisma.subscriptionLine.findMany({
        where: { subscriptionId: sub.id },
      });
      expect(foundLines).toHaveLength(0);
    });

    it('Should_return_403_when_unsubscribe_token_is_incorrect', async () => {
      const sub = await factory.prisma.subscription.create({
        data: {
          email: testEmail,
          lines: {
            create: [{ lineId: 'central' }],
          },
        },
      });

      const response = await factory.inject({
        method: 'DELETE',
        url: `/api/subscriptions/${sub.id}?token=invalid-wrong-token`,
      });

      expect(response.statusCode).toBe(403);
      expect(response.headers['content-type']).toContain('application/problem+json');

      const body = response.json();
      expect(body.title).toBe('Forbidden');
    });

    it('Should_return_404_when_subscription_id_does_not_exist', async () => {
      const response = await factory.inject({
        method: 'DELETE',
        url: '/api/subscriptions/non-existent-uuid-1234?token=sample-token',
      });

      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toContain('application/problem+json');
    });

    it('Should_return_400_when_token_query_parameter_is_missing', async () => {
      const response = await factory.inject({
        method: 'DELETE',
        url: '/api/subscriptions/some-uuid',
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toContain('application/problem+json');
    });
  });
});
