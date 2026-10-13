import { describe, expect, it } from 'vitest';
import {
  BrokenCircuitError,
  createTflResiliencePolicy,
  isTransientError,
  TaskCancelledError,
  TflHttpError,
} from '../../../../src/clients/tfl/resilience.js';

describe('TfL Resilience - Cockatiel Policy & Error Handling', () => {
  it('Should_classify_429_and_5xx_and_network_drops_as_transient', () => {
    expect(
      isTransientError(new TflHttpError({ status: 503, statusText: 'Service Unavailable' })),
    ).toBe(true);
    expect(
      isTransientError(new TflHttpError({ status: 429, statusText: 'Too Many Requests' })),
    ).toBe(true);
    expect(
      isTransientError(new TflHttpError({ status: 500, statusText: 'Internal Server Error' })),
    ).toBe(true);
    expect(isTransientError(new TaskCancelledError('Timed out'))).toBe(true);
    expect(isTransientError(new Error('fetch failed: ECONNREFUSED'))).toBe(true);

    // Non-transient errors
    expect(isTransientError(new TflHttpError({ status: 400, statusText: 'Bad Request' }))).toBe(
      false,
    );
    expect(isTransientError(new TflHttpError({ status: 404, statusText: 'Not Found' }))).toBe(
      false,
    );
    expect(isTransientError(new TypeError('Cannot read properties of undefined'))).toBe(false);
    expect(isTransientError(new BrokenCircuitError())).toBe(false);
  });

  it('Should_retry_3_times_with_exponential_backoff_on_transient_failure_and_succeed', async () => {
    let callCount = 0;
    const policy = createTflResiliencePolicy({
      maxRetries: 3,
      initialDelayMs: 1,
      maxDelayMs: 10,
    });

    const result = await policy.execute(async () => {
      callCount++;
      if (callCount < 3) {
        throw new TflHttpError({ status: 503, statusText: 'Service Unavailable' });
      }
      return 'success';
    });

    expect(result).toBe('success');
    expect(callCount).toBe(3);
  });

  it('Should_exhaust_retries_and_throw_when_transient_error_persists', async () => {
    let callCount = 0;
    const policy = createTflResiliencePolicy({
      maxRetries: 3,
      initialDelayMs: 1,
      maxDelayMs: 10,
    });

    await expect(
      policy.execute(async () => {
        callCount++;
        throw new TflHttpError({ status: 503, statusText: 'Service Unavailable' });
      }),
    ).rejects.toThrow(TflHttpError);

    // 1 initial try + 3 retries = 4 attempts
    expect(callCount).toBe(4);
  });

  it('Should_not_retry_non_transient_client_errors_such_as_400_Bad_Request', async () => {
    let callCount = 0;
    const policy = createTflResiliencePolicy({
      maxRetries: 3,
      initialDelayMs: 1,
      maxDelayMs: 10,
    });

    await expect(
      policy.execute(async () => {
        callCount++;
        throw new TflHttpError({ status: 400, statusText: 'Bad Request' });
      }),
    ).rejects.toThrow(TflHttpError);

    expect(callCount).toBe(1);
  });

  it('Should_open_circuit_breaker_after_consecutive_failures_and_fast_fail', async () => {
    let callCount = 0;
    const policy = createTflResiliencePolicy({
      maxRetries: 0,
      circuitBreakerConsecutiveFailures: 3,
      circuitBreakerHalfOpenMs: 30000,
    });

    for (let i = 0; i < 3; i++) {
      await expect(
        policy.execute(async () => {
          callCount++;
          throw new TflHttpError({ status: 503, statusText: 'Service Unavailable' });
        }),
      ).rejects.toThrow(TflHttpError);
    }
    expect(callCount).toBe(3);

    // 4th call should trip breaker immediately without executing inner action
    await expect(
      policy.execute(async () => {
        callCount++;
        return 'never';
      }),
    ).rejects.toThrow(BrokenCircuitError);

    expect(callCount).toBe(3);
  });

  it('Should_abort_execution_via_timeout_policy_signal_when_stalled', async () => {
    const policy = createTflResiliencePolicy({
      maxRetries: 0,
      timeoutMs: 25,
    });

    await expect(
      policy.execute(async ({ signal }) => {
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new TaskCancelledError('Timed out'));
          });
        });
      }),
    ).rejects.toThrow(TaskCancelledError);
  });
});
