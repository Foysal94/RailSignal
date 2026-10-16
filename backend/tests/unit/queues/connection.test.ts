import { describe, expect, it } from 'vitest';
import { createRedisConnection } from '../../../src/queues/connection.js';

describe('Redis Connection Protocol & Option Handling', () => {
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
