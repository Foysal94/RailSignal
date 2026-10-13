import { FormatRegistry } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';
import {
  CreateSubscriptionRequestSchema,
  HealthResponseSchema,
  ProblemDetailsSchema,
  registerEmailFormat,
  WeekendStatusResponseSchema,
} from '../src/contracts.js';

describe('Shared TypeBox Contracts', () => {
  it('Should_validate_valid_health_response', () => {
    const valid = { status: 'healthy' };
    expect(Value.Check(HealthResponseSchema, valid)).toBe(true);

    const invalid = { status: 'ok' };
    expect(Value.Check(HealthResponseSchema, invalid)).toBe(false);
  });

  it('Should_validate_rfc_9457_problem_details_payload', () => {
    const valid = {
      type: 'https://datatracker.ietf.org/doc/html/rfc9457',
      title: 'Bad Request',
      status: 400,
      detail: 'Request validation failed',
      instance: '/api/subscriptions',
      invalidParams: [{ name: 'email', reason: 'Must match format email' }],
    };
    expect(Value.Check(ProblemDetailsSchema, valid)).toBe(true);
  });

  it('Should_validate_subscription_request_payload', () => {
    const valid = {
      email: 'commuter@example.co.uk',
      lineIds: ['northern', 'victoria'],
    };
    expect(Value.Check(CreateSubscriptionRequestSchema, valid)).toBe(true);

    const missingLines = {
      email: 'commuter@example.co.uk',
      lineIds: [],
    };
    expect(Value.Check(CreateSubscriptionRequestSchema, missingLines)).toBe(false);
  });

  it('Should_validate_weekend_status_response_structure', () => {
    const valid = {
      weekendDate: '2026-10-16',
      windowStart: '2026-10-16T19:00:00Z',
      windowEnd: '2026-10-19T04:30:00Z',
      lines: [
        {
          lineId: 'victoria',
          lineName: 'Victoria',
          mode: 'tube',
          color: '#0098D4',
          statusSeverityDescription: 'Good Service',
          hasDisruption: false,
          disruptions: [],
        },
      ],
      lastUpdated: '2026-10-16T09:00:00Z',
    };
    expect(Value.Check(WeekendStatusResponseSchema, valid)).toBe(true);
  });

  it('Should_register_email_format_idempotently', () => {
    // Format is already registered on module load; calling again tests the idempotency branch
    registerEmailFormat();
    expect(FormatRegistry.Has('email')).toBe(true);

    // Test registering when absent
    FormatRegistry.Delete('email');
    expect(FormatRegistry.Has('email')).toBe(false);
    registerEmailFormat();
    expect(FormatRegistry.Has('email')).toBe(true);
  });
});
