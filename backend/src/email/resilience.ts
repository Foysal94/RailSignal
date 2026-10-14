import {
  decorrelatedJitterGenerator,
  ExponentialBackoff,
  handleWhen,
  type IPolicy,
  retry,
} from 'cockatiel';

export function isResendTransientError(err: unknown): boolean {
  if (err instanceof Error) {
    // Deterministic coding errors must fail immediately
    if (err instanceof TypeError || err instanceof SyntaxError || err instanceof RangeError) {
      return false;
    }

    const msg = err.message.toLowerCase();
    // Vendor quirk: Resend SDK returns generic Error objects without HTTP status codes,
    // and Node fetch throws generic TypeError on socket stalls. We inspect strings to isolate
    // transient capacity/socket errors from deterministic 400/401 errors.
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
export function createResendRetryPolicy(maxAttempts = 3): IPolicy {
  return retry(handleWhen(isResendTransientError), {
    maxAttempts,
    backoff: new ExponentialBackoff({
      generator: decorrelatedJitterGenerator,
      initialDelay: 250,
      maxDelay: 2000,
    }),
  });
}
