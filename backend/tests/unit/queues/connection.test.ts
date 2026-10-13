import { describe, expect, it } from 'vitest';
import {
  createRedisConnection,
  DEFAULT_DRAIN_DELAY_MS,
  DEFAULT_DRAIN_DELAY_SECONDS,
  UPSTASH_WORKER_DEFAULTS,
} from '../../../src/queues/connection.js';

describe('Redis Connection & Quota Safeguards', () => {
  it('Should_expose_default_worker_drain_delay_safeguard_of_60_seconds_and_60000_ms', () => {
    expect(DEFAULT_DRAIN_DELAY_SECONDS).toBe(60);
    expect(DEFAULT_DRAIN_DELAY_MS).toBe(60_000);
    expect(UPSTASH_WORKER_DEFAULTS.drainDelay).toBe(60);
    expect(UPSTASH_WORKER_DEFAULTS.stalledInterval).toBe(60_000);
  });

  it('Should_create_redis_connection_with_required_bullmq_and_upstash_defaults', () => {
    const connection = createRedisConnection('redis://127.0.0.1:6379');
    try {
      expect(connection.options.maxRetriesPerRequest).toBeNull();
      expect(connection.options.enableReadyCheck).toBe(false);
      expect(connection.options.lazyConnect).toBe(true);
    } finally {
      connection.disconnect();
    }
  });

  it('Should_enable_tls_when_connection_string_uses_rediss_protocol', () => {
    const connection = createRedisConnection('rediss://default:secret@rail-signal.upstash.io:6379');
    try {
      expect(connection.options.tls).toBeDefined();
      expect(connection.options.maxRetriesPerRequest).toBeNull();
      expect(connection.options.enableReadyCheck).toBe(false);
    } finally {
      connection.disconnect();
    }
  });

  it('Should_allow_overriding_connection_options_while_retaining_bullmq_invariants', () => {
    const connection = createRedisConnection('redis://127.0.0.1:6379', {
      family: 4,
    });
    try {
      expect(connection.options.family).toBe(4);
      expect(connection.options.maxRetriesPerRequest).toBeNull();
      expect(connection.options.enableReadyCheck).toBe(false);
    } finally {
      connection.disconnect();
    }
  });
});
