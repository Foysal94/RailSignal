import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { WebApplicationFactory } from './webApplicationFactory.js';

describe('GET /api/lines/weekend-status', () => {
  let factory: WebApplicationFactory;
  const weekendDate = '2026-10-16';

  beforeAll(async () => {
    factory = await WebApplicationFactory.create();
  });

  beforeEach(async () => {
    await factory.resetDatabase();
  });

  afterAll(async () => {
    await factory.close();
  });

  it('Should_return_all_tfl_lines_with_good_service_when_no_disruptions_exist', async () => {
    const response = await factory.inject({
      method: 'GET',
      url: `/api/lines/weekend-status?referenceDate=${weekendDate}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');

    const body = response.json();
    expect(body.weekendDate).toBe(weekendDate);
    expect(body.lines).toHaveLength(19);

    // When clear, all lines should report Good Service
    for (const line of body.lines) {
      expect(line.hasDisruption).toBe(false);
      expect(line.statusSeverityDescription).toBe('Good Service');
      expect(line.disruptions).toHaveLength(0);
    }
  });

  it('Should_prioritize_disrupted_lines_at_top_when_disruptions_exist', async () => {
    // Seed test disruptions in SQLite via factory.prisma
    await factory.prisma.weekendDisruption.createMany({
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

    const response = await factory.inject({
      method: 'GET',
      url: `/api/lines/weekend-status?referenceDate=${weekendDate}`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    // Disrupted lines must be placed first
    const firstLine = body.lines[0];
    const secondLine = body.lines[1];

    expect(firstLine.hasDisruption).toBe(true);
    expect(secondLine.hasDisruption).toBe(true);
    expect(['central', 'victoria']).toContain(firstLine.lineId);
    expect(['central', 'victoria']).toContain(secondLine.lineId);

    // Remaining lines should report Good Service
    const nonDisrupted = body.lines.slice(2);
    for (const line of nonDisrupted) {
      expect(line.hasDisruption).toBe(false);
      expect(line.statusSeverityDescription).toBe('Good Service');
    }
  });
});
