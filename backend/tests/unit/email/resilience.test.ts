import { describe, expect, it, vi } from 'vitest';
import { createResendRetryPolicy } from '../../../src/email/resilience.js';

describe('Resend resilience policy', () => {
  it('Should_retry_transient_rate_limit_and_succeed_on_subsequent_attempt', async () => {
    const policy = createResendRetryPolicy(3);
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Rate limit exceeded: 429'))
      .mockResolvedValueOnce('success');

    const result = await policy.execute(mockFn);

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('Should_rethrow_fatal_non_transient_errors_immediately_without_retrying', async () => {
    const policy = createResendRetryPolicy(3);
    const mockFn = vi.fn().mockRejectedValue(new Error('Unauthorized: 401'));

    await expect(policy.execute(mockFn)).rejects.toThrow('Unauthorized: 401');
    expect(mockFn).toHaveBeenCalledOnce();
  });
});
