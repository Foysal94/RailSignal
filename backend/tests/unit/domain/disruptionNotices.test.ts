import type { DisruptionNotice as DbDisruptionNotice } from '@prisma/client';
import type { DisruptionNotice, ReplacementBusRoute } from '@railsignal/shared';
import { describe, expect, it } from 'vitest';
import {
  deserializeDisruptionNotice,
  serializeDisruptionNotice,
} from '../../../src/domain/disruptionNotices.js';

describe('DisruptionNotice Serialization & Deserialization Domain Seam', () => {
  const sampleBusRoute: ReplacementBusRoute = {
    serviceName: 'Replacement Bus Service A',
    stops: ['Camden Town', 'High Barnet'],
    summary: '2 stops',
    rawRoute: 'Camden Town - High Barnet',
  };

  const sampleNotice: DisruptionNotice = {
    headline: 'Camden Town ↔ High Barnet: No service',
    corridor: 'Camden Town ↔ High Barnet: No service',
    timeframe: 'Saturday & Sunday',
    busRoute: sampleBusRoute,
    details: ['Last through train at 23:45', 'Use local bus 134'],
    rawFallback: 'Northern line: No service between Camden Town and High Barnet',
  };

  it('Should_serialize_disruption_notice_into_normalized_database_columns', () => {
    const serialized = serializeDisruptionNotice(sampleNotice);

    expect(serialized).toEqual({
      headline: 'Camden Town ↔ High Barnet: No service',
      corridor: 'Camden Town ↔ High Barnet: No service',
      timeframe: 'Saturday & Sunday',
      busRouteJson: JSON.stringify(sampleBusRoute),
      detailsJson: JSON.stringify(['Last through train at 23:45', 'Use local bus 134']),
      rawFallback: 'Northern line: No service between Camden Town and High Barnet',
    });
  });

  it('Should_serialize_optional_fields_as_null_when_omitted', () => {
    const minimalNotice: DisruptionNotice = {
      headline: 'Minimal Headline',
      corridor: 'Minimal Corridor',
    };

    const serialized = serializeDisruptionNotice(minimalNotice);

    expect(serialized).toEqual({
      headline: 'Minimal Headline',
      corridor: 'Minimal Corridor',
      timeframe: null,
      busRouteJson: null,
      detailsJson: null,
      rawFallback: null,
    });
  });

  it('Should_deserialize_database_columns_into_domain_contract_notice', () => {
    const dbRecord: DbDisruptionNotice = {
      id: 'notice-uuid-1',
      disruptionId: 'disruption-uuid-1',
      headline: 'Camden Town ↔ High Barnet: No service',
      corridor: 'Camden Town ↔ High Barnet: No service',
      timeframe: 'Saturday & Sunday',
      busRouteJson: JSON.stringify(sampleBusRoute),
      detailsJson: JSON.stringify(['Last through train at 23:45', 'Use local bus 134']),
      rawFallback: 'Northern line: No service between Camden Town and High Barnet',
    };

    const deserialized = deserializeDisruptionNotice(dbRecord);

    expect(deserialized).toEqual(sampleNotice);
  });

  it('Should_deserialize_and_gracefully_fallback_when_json_columns_are_null_or_corrupt', () => {
    const corruptDbRecord: DbDisruptionNotice = {
      id: 'notice-uuid-2',
      disruptionId: 'disruption-uuid-2',
      headline: 'Corrupt Notice',
      corridor: 'Corrupt Corridor',
      timeframe: null,
      busRouteJson: '{malformed_json:',
      detailsJson: '["valid array item"]',
      rawFallback: null,
    };

    const deserialized = deserializeDisruptionNotice(corruptDbRecord);

    expect(deserialized).toEqual({
      headline: 'Corrupt Notice',
      corridor: 'Corrupt Corridor',
      details: ['valid array item'],
    });
    expect(deserialized.busRoute).toBeUndefined();
    expect(deserialized.timeframe).toBeUndefined();
    expect(deserialized.rawFallback).toBeUndefined();
  });
});
