import { handleWhen, retry, ExponentialBackoff, type IPolicy } from 'cockatiel';

/**
 * Creates an exponential backoff retry policy for Resend API rate limits
 * (2 req/s free tier) and transient 5xx server errors.
 */
export function createResendRetryPolicy(maxAttempts = 3): IPolicy {
  return retry(
    handleWhen((err: unknown) => {
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        return (
          msg.includes('429') ||
          msg.includes('rate limit') ||
          msg.includes('500') ||
          msg.includes('503')
        );
      }
      return false;
    }),
    { maxAttempts, backoff: new ExponentialBackoff() }
  );
}
