import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/db.js';

describe('GET /api/lines/weekend-status', () => {
  let app: FastifyInstance;
  const weekendDate = '2026-10-16';

  beforeEach(async () => {
    await prisma.weekendDisruption.deleteMany({
      where: { weekendDate },
    });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  afterAll(async () => {
    await prisma.weekendDisruption.deleteMany({
      where: { weekendDate },
    });
    await prisma.$disconnect();
  });

  it('Should_return_all_tfl_lines_with_good_service_when_no_disruptions_exist', async () => {
    app = buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/lines/weekend-status?referenceDate=${weekendDate}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');

    const body = response.json();
    expect(body.weekendDate).toBe(weekendDate);
    expect(body.lines).toHaveLength(19);

    // When clear, all lines should report No Planned Closures
    for (const line of body.lines) {
      expect(line.hasDisruption).toBe(false);
      expect(line.statusSeverityDescription).toBe('No Planned Closures');
      expect(line.disruptions).toHaveLength(0);
    }
  });

  it('Should_prioritize_disrupted_lines_at_top_when_disruptions_exist', async () => {
    // Seed test disruption for Central and Victoria lines
    await prisma.weekendDisruption.createMany({
      data: [
        {
          lineId: 'central',
          lineName: 'Central',
          mode: 'tube',
          statusSeverityDescription: 'Part Closure',
          corridorDescription: 'No service between White City and Ealing Broadway',
          weekendDate,
          validFrom: new Date('2026-10-16T19:00:00Z'),
          validTo: new Date('2026-10-19T03:30:00Z'),
          sourceLastUpdated: new Date('2026-10-16T10:00:00Z'),
        },
        {
          lineId: 'victoria',
          lineName: 'Victoria',
          mode: 'tube',
          statusSeverityDescription: 'Planned Closure',
          corridorDescription: 'Entire line closed for resignalling',
          weekendDate,
          validFrom: new Date('2026-10-16T19:00:00Z'),
          validTo: new Date('2026-10-19T03:30:00Z'),
          sourceLastUpdated: new Date('2026-10-16T10:00:00Z'),
        },
      ],
    });

    app = buildApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/lines/weekend-status?referenceDate=${weekendDate}`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    // Disrupted lines should be placed first
    const firstLine = body.lines[0];
    const secondLine = body.lines[1];

    expect(firstLine.hasDisruption).toBe(true);
    expect(secondLine.hasDisruption).toBe(true);
    expect(['central', 'victoria']).toContain(firstLine.lineId);
    expect(['central', 'victoria']).toContain(secondLine.lineId);

    // Remaining lines should report No Planned Closures
    const nonDisrupted = body.lines.slice(2);
    for (const line of nonDisrupted) {
      expect(line.hasDisruption).toBe(false);
      expect(line.statusSeverityDescription).toBe('No Planned Closures');
    }
  });
});
