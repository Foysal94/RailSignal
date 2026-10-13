import { Redis, type RedisOptions } from 'ioredis';
import { config } from '../config.js';

/**
 * Empty-queue long-polling idle delay safeguard (ADR 0003).
 * Upstash serverless free tier is capped at 10,000 commands/day.
 * BullMQ Worker drainDelay defaults to 5 seconds, which exhausts the daily quota.
 * We enforce an idle polling backoff of 60 seconds (60,000 ms) to cap daily idle commands under ~1,440.
 */
export const DEFAULT_DRAIN_DELAY_SECONDS = 60;
export const DEFAULT_DRAIN_DELAY_MS = 60_000;

/**
 * Standard worker settings tuned for Upstash Serverless Redis.
 */
export const UPSTASH_WORKER_DEFAULTS = {
  drainDelay: DEFAULT_DRAIN_DELAY_SECONDS,
  stalledInterval: 60_000,
  lockDuration: 60_000,
  maxStalledCount: 2,
} as const;

/**
 * Creates an ioredis client instance configured for BullMQ and Upstash Serverless Redis.
 * BullMQ requires maxRetriesPerRequest to be null for blocking operations (BRPOPLPUSH/BZPOPMIN).
 * For TLS connections (rediss://), ioredis natively handles the TLS handshake.
 */
export function createRedisConnection(redisUrl?: string, customOptions?: RedisOptions): Redis {
  const url = redisUrl ?? config.redisUrl ?? process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

  const defaultOptions: RedisOptions = {
    // BullMQ invariant: worker and queue blocking commands throw if maxRetriesPerRequest is not null
    maxRetriesPerRequest: null,
    // Upstash serverless does not support or benefit from ready check polling
    enableReadyCheck: false,
    // Avoid eagerly opening socket connections upon instantiation
    lazyConnect: true,
  };

  const clientOptions: RedisOptions = {
    ...defaultOptions,
    ...(customOptions ?? {}),
    // Invariants that must never be overridden
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  // ioredis constructor overloads clash with exactOptionalPropertyTypes: true due to optional replyMapping
  const client = new Redis(url, clientOptions as never);

  // Attach error handler to prevent unhandled EventEmitter crashes when Redis is temporarily offline
  client.on('error', (error) => {
    // BullMQ and ioredis handle reconnects, but unhandled error events crash Node if unlistened
    if (config.nodeEnv !== 'test') {
      console.error('[Redis Client Error]', error);
    }
  });

  return client;
}
