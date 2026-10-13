import {
  BrokenCircuitError,
  ConsecutiveBreaker,
  circuitBreaker,
  decorrelatedJitterGenerator,
  ExponentialBackoff,
  handleWhen,
  type IPolicy,
  retry,
  TaskCancelledError,
  TimeoutStrategy,
  timeout,
  wrap,
} from 'cockatiel';

export { BrokenCircuitError, TaskCancelledError };

export interface TflHttpErrorOptions {
  status: number;
  statusText: string;
  body?: string | undefined;
}

export class TflHttpError extends Error {
  public readonly status: number;
  public readonly isTransient: boolean;

  constructor(options: TflHttpErrorOptions) {
    const detail = options.body ? `: ${options.body}` : '';
    super(
      `TfL Unified API request failed with status ${options.status} (${options.statusText})${detail}`,
    );
    this.name = 'TflHttpError';
    this.status = options.status;
    // 429 Too Many Requests and 5xx Server Errors represent transient downstream capacity issues
    this.isTransient = options.status === 429 || (options.status >= 500 && options.status <= 599);
  }
}

export function isTransientError(error: unknown): boolean {
  if (error instanceof TflHttpError) {
    return error.isTransient;
  }
  if (error instanceof BrokenCircuitError) {
    return false;
  }
  if (error instanceof TaskCancelledError) {
    return true;
  }
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return true;
    }
    // Network drops, socket timeouts, and connection aborts from Undici/Node fetch
    if (
      error.message.includes('fetch failed') ||
      error.message.includes('network') ||
      error.message.includes('ECONN') ||
      error.message.includes('ETIMEDOUT')
    ) {
      return true;
    }
    // Deterministic programming errors must never be retried
    if (error instanceof TypeError || error instanceof SyntaxError || error instanceof RangeError) {
      return false;
    }
  }
  return false;
}

export interface ResiliencePolicyOptions {
  maxRetries?: number | undefined;
  timeoutMs?: number | undefined;
  circuitBreakerConsecutiveFailures?: number | undefined;
  circuitBreakerHalfOpenMs?: number | undefined;
  initialDelayMs?: number | undefined;
  maxDelayMs?: number | undefined;
}

/**
 * Creates a composite Cockatiel resilience policy for TfL API calls mirroring .NET Polly v8 pipeline.
 * Order of composition: Retry (outer) -> CircuitBreaker (middle) -> Timeout (inner).
 * This ensures the circuit breaker observes every individual network attempt and fast-fails downstream calls when tripped.
 */
export function createTflResiliencePolicy(options?: ResiliencePolicyOptions): IPolicy {
  const maxRetries = options?.maxRetries ?? 3;
  const timeoutMs = options?.timeoutMs ?? 8000;
  const breakerFailures = options?.circuitBreakerConsecutiveFailures ?? 5;
  const halfOpenMs = options?.circuitBreakerHalfOpenMs ?? 30000;
  const initialDelay = options?.initialDelayMs ?? 200;
  const maxDelay = options?.maxDelayMs ?? 2000;

  const retryPolicy = retry(handleWhen(isTransientError), {
    maxAttempts: maxRetries,
    backoff: new ExponentialBackoff({
      generator: decorrelatedJitterGenerator,
      initialDelay,
      maxDelay,
    }),
  });

  const breakerPolicy = circuitBreaker(handleWhen(isTransientError), {
    halfOpenAfter: halfOpenMs,
    breaker: new ConsecutiveBreaker(breakerFailures),
  });

  const timeoutPolicy = timeout(timeoutMs, TimeoutStrategy.Aggressive);

  // Polly v8 pipeline ordering: Retry (outer) wraps Breaker (middle) wraps Timeout (inner)
  return wrap(retryPolicy, breakerPolicy, timeoutPolicy);
}
