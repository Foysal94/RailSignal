import { Redis, type RedisOptions } from 'ioredis';
import { config } from '../config.js';

/**
 * Empty-queue idle backoff safeguard (ADR 0003).
 * Upstash serverless free tier is capped at 10,000 commands/day.
 * BullMQ Worker defaults to 5s polling (~17,280 cmds/day, exceeding the quota).
 * Setting drainDelay to 60s caps daily idle commands under ~1,440.
 */
export const DEFAULT_DRAIN_DELAY_SECONDS = 60;

export const UPSTASH_WORKER_DEFAULTS = {
  drainDelay: DEFAULT_DRAIN_DELAY_SECONDS,
  stalledInterval: 60_000,
  lockDuration: 60_000,
  maxStalledCount: 2,
} as const;

export function createRedisConnection(redisUrl?: string, customOptions?: RedisOptions): Redis {
  const url = redisUrl ?? config.redisUrl ?? 'redis://127.0.0.1:6379';

  const defaultOptions: RedisOptions = {
    // BullMQ invariant: worker blocking commands throw if maxRetriesPerRequest is not null
    maxRetriesPerRequest: null,
    // Upstash serverless does not support ready-check polling
    enableReadyCheck: false,
    lazyConnect: true,
  };

  const clientOptions: RedisOptions = {
    ...defaultOptions,
    ...(customOptions ?? {}),
    // Preserve invariants even if custom options are passed
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  // ioredis constructor overloads clash with exactOptionalPropertyTypes: true due to optional replyMapping
  const client = new Redis(url, clientOptions as never);

  // Prevent unhandled EventEmitter crashes during temporary Redis network disconnects
  client.on('error', (error) => {
    if (config.nodeEnv !== 'test') {
      console.error('[Redis Client Error]', error);
    }
  });

  return client;
}
