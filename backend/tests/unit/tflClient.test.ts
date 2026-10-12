import { describe, it, expect, vi } from 'vitest';
import { TflClient, createTflResiliencePolicy, TflHttpError } from '../../src/clients/tflClient.js';

describe('TfL Client - HTTP Transport Orchestration', () => {
  it('Should_fetch_and_return_raw_disruptions_passing_app_key_and_headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: '1', description: 'Test disruption' }]), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const client = new TflClient({
      baseUrl: 'https://api.tfl.gov.uk',
      appKey: 'test-app-key',
      fetchFn: mockFetch as unknown as typeof fetch,
      policy: createTflResiliencePolicy({ maxRetries: 0 }),
    });

    const raw = await client.fetchRawDisruptions();

    expect(raw).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.tfl.gov.uk/Line/Mode/tube,elizabeth-line,overground,dlr/Disruption?app_key=test-app-key',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
    );
  });

  it('Should_throw_TflHttpError_with_response_status_when_api_responds_with_error', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('Service Unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
      })
    );

    const client = new TflClient({
      fetchFn: mockFetch as unknown as typeof fetch,
      policy: createTflResiliencePolicy({ maxRetries: 0 }),
    });

    await expect(client.fetchRawDisruptions()).rejects.toThrow(TflHttpError);
  });

  it('Should_fetch_and_return_parsed_weekend_disruptions_end_to_end', async () => {
    const sampleDisruptions = [
      {
        description: 'Jubilee Line: No service between Waterloo and Stanmore.',
        closureText: 'partClosure',
        affectedRoutes: [
          {
            lineId: 'jubilee',
            validFrom: '2026-07-11T00:00:00Z',
            validTo: '2026-07-12T23:59:00Z',
          },
        ],
      },
    ];

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(sampleDisruptions), {
        status: 200,
        statusText: 'OK',
      })
    );

    const client = new TflClient({
      fetchFn: mockFetch as unknown as typeof fetch,
      policy: createTflResiliencePolicy({ maxRetries: 0 }),
    });

    const disruptions = await client.getWeekendDisruptions({
      referenceDate: new Date('2026-07-10T10:00:00Z'),
    });

    expect(disruptions).toHaveLength(1);
    expect(disruptions[0]?.lineId).toBe('jubilee');
    expect(disruptions[0]?.mode).toBe('tube');
    expect(disruptions[0]?.statusSeverityDescription).toBe('Part Closure');
    expect(disruptions[0]?.corridorDescription).toBe('No service between Waterloo and Stanmore.');
  });
});
