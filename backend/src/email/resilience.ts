import {
  decorrelatedJitterGenerator,
  ExponentialBackoff,
  handleWhen,
  type IPolicy,
  retry,
} from 'cockatiel';

export function isResendTransientError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();

    // Vendor quirk: Node fetch throws TypeError('fetch failed') on socket stalls / network drops.
    // Allow this specific transient error through while failing deterministic coding TypeErrors immediately.
    if (err instanceof TypeError && !msg.includes('fetch failed')) {
      return false;
    }
    if (err instanceof SyntaxError || err instanceof RangeError) {
      return false;
    }

    return (
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('too many requests') ||
      msg.includes('500') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('504') ||
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('econn') ||
      msg.includes('etimedout')
    );
  }
  return false;
}

// Creates an exponential backoff retry policy with decorrelated jitter (ADR 0004)
// to absorb Resend API free-tier rate limits (2 req/s) and transient network stalls.
export function createResendRetryPolicy(maxAttempts = 3, initialDelay = 250): IPolicy {
  return retry(handleWhen(isResendTransientError), {
    maxAttempts,
    backoff: new ExponentialBackoff({
      generator: decorrelatedJitterGenerator,
      initialDelay,
      maxDelay: 2000,
    }),
  });
}
