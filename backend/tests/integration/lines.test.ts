import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from '../support/testContext.js';

describe('GET /api/lines/weekend-status', () => {
  let context: TestContext;
  const weekendDate = '2026-10-16';

  beforeAll(async () => {
    context = await createTestContext();
  });

  beforeEach(async () => {
    await context.resetDatabase();
  });

  afterAll(async () => {
    await context.close();
  });

  it('Should_return_all_tfl_lines_with_good_service_when_no_disruptions_exist', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: `/api/lines/weekend-status?referenceDate=${weekendDate}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');

    const body = response.json();
    expect(body.weekendDate).toBe(weekendDate);
    expect(body.lines).toHaveLength(19);

    for (const line of body.lines) {
      expect(line.hasDisruption).toBe(false);
      expect(line.statusSeverityDescription).toBe('No Planned Closures');
      expect(line.disruptions).toHaveLength(0);
    }
  });

  it('Should_prioritize_disrupted_lines_at_top_when_disruptions_exist', async () => {
    await context.prisma.weekendDisruption.create({
      data: {
        lineId: 'central',
        lineName: 'Central',
        mode: 'tube',
        statusSeverityDescription: 'Part Closure',
        corridorDescription: 'No service between White City and Ealing Broadway',
        weekendDate,
        validFrom: new Date('2026-10-16T19:00:00Z'),
        validTo: new Date('2026-10-19T03:30:00Z'),
        sourceLastUpdated: new Date('2026-10-16T10:00:00Z'),
        notices: {
          create: [
            {
              headline: 'White City ↔ Ealing Broadway: No service',
              corridor: 'White City ↔ Ealing Broadway: No service',
              rawFallback: 'No service between White City and Ealing Broadway',
            },
          ],
        },
      },
    });

    await context.prisma.weekendDisruption.create({
      data: {
        lineId: 'victoria',
        lineName: 'Victoria',
        mode: 'tube',
        statusSeverityDescription: 'Planned Closure',
        corridorDescription: 'Entire line closed for resignalling',
        weekendDate,
        validFrom: new Date('2026-10-16T19:00:00Z'),
        validTo: new Date('2026-10-19T03:30:00Z'),
        sourceLastUpdated: new Date('2026-10-16T10:00:00Z'),
        notices: {
          create: [
            {
              headline: 'Entire line closed for resignalling',
              corridor: 'Entire line closed for resignalling',
              rawFallback: 'Entire line closed for resignalling',
            },
          ],
        },
      },
    });

    const response = await context.app.inject({
      method: 'GET',
      url: `/api/lines/weekend-status?referenceDate=${weekendDate}`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    const firstLine = body.lines[0];
    const secondLine = body.lines[1];

    expect(firstLine.hasDisruption).toBe(true);
    expect(secondLine.hasDisruption).toBe(true);
    expect(['central', 'victoria']).toContain(firstLine.lineId);
    expect(['central', 'victoria']).toContain(secondLine.lineId);
    expect(firstLine.notices).toBeDefined();
    expect(firstLine.notices?.length).toBeGreaterThanOrEqual(1);
    expect(firstLine.disruptions[0]?.notices).toBeDefined();

    const nonDisrupted = body.lines.slice(2);
    for (const line of nonDisrupted) {
      expect(line.hasDisruption).toBe(false);
      expect(line.statusSeverityDescription).toBe('No Planned Closures');
    }
  });
});
