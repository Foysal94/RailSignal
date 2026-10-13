import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

describe('Application Configuration Validation (loadConfig)', () => {
  it('Should_load_development_defaults_when_no_env_variables_provided', () => {
    const config = loadConfig({});

    expect(config.nodeEnv).toBe('development');
    expect(config.port).toBe(3000);
    expect(config.host).toBe('0.0.0.0');
    expect(config.databaseUrl).toBe('file:./railsignal.db');
    expect(config.redisUrl).toBeUndefined();
    expect(config.resendApiKey).toBeUndefined();
    expect(config.jobSecret).toBeUndefined();
    expect(config.emailFrom).toBeUndefined();
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('Should_accept_custom_port_and_host_in_development', () => {
    const config = loadConfig({
      PORT: '8080',
      HOST: '127.0.0.1',
    });

    expect(config.port).toBe(8080);
    expect(config.host).toBe('127.0.0.1');
  });

  it('Should_accept_postgres_or_sqlite_database_url_in_development', () => {
    const sqliteConfig = loadConfig({
      DATABASE_URL: 'file:./custom_database.db',
    });
    expect(sqliteConfig.databaseUrl).toBe('file:./custom_database.db');

    const postgresConfig = loadConfig({
      DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/railsignal',
    });
    expect(postgresConfig.databaseUrl).toBe(
      'postgresql://postgres:secret@localhost:5432/railsignal',
    );

    const postgresShortConfig = loadConfig({
      DATABASE_URL: 'postgres://postgres:secret@localhost:5432/railsignal',
    });
    expect(postgresShortConfig.databaseUrl).toBe(
      'postgres://postgres:secret@localhost:5432/railsignal',
    );
  });

  it('Should_accept_valid_redis_url_in_development', () => {
    const redisConfig = loadConfig({
      REDIS_URL: 'redis://localhost:6379',
    });
    expect(redisConfig.redisUrl).toBe('redis://localhost:6379');

    const redissConfig = loadConfig({
      REDIS_URL: 'rediss://default:token@remote.upstash.io:6379',
    });
    expect(redissConfig.redisUrl).toBe('rediss://default:token@remote.upstash.io:6379');
  });

  it('Should_load_valid_production_configuration', () => {
    const validProdEnv = {
      NODE_ENV: 'production',
      PORT: '4000',
      HOST: '0.0.0.0',
      DATABASE_URL: 'postgresql://user:pass@neon.tech:5432/railsignal',
      REDIS_URL: 'rediss://default:token@upstash.io:6379',
      RESEND_API_KEY: 're_123456789',
      JOB_SECRET: 'super-secret-key',
      EMAIL_FROM: 'RailSignal Alerts <alerts@railsignal.london>',
    };

    const config = loadConfig(validProdEnv);

    expect(config.nodeEnv).toBe('production');
    expect(config.port).toBe(4000);
    expect(config.host).toBe('0.0.0.0');
    expect(config.databaseUrl).toBe('postgresql://user:pass@neon.tech:5432/railsignal');
    expect(config.redisUrl).toBe('rediss://default:token@upstash.io:6379');
    expect(config.resendApiKey).toBe('re_123456789');
    expect(config.jobSecret).toBe('super-secret-key');
    expect(config.emailFrom).toBe('RailSignal Alerts <alerts@railsignal.london>');
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('Should_throw_descriptive_error_when_DATABASE_URL_missing_in_production', () => {
    const env = {
      NODE_ENV: 'production',
      REDIS_URL: 'rediss://upstash.io:6379',
      RESEND_API_KEY: 're_123456789',
      JOB_SECRET: 'super-secret-key',
    };

    expect(() => loadConfig(env)).toThrow(/DATABASE_URL/);
    expect(() => loadConfig(env)).toThrow(/required/i);
  });

  it('Should_throw_descriptive_error_when_REDIS_URL_missing_in_production', () => {
    const env = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://neon.tech:5432/railsignal',
      RESEND_API_KEY: 're_123456789',
      JOB_SECRET: 'super-secret-key',
    };

    expect(() => loadConfig(env)).toThrow(/REDIS_URL/);
    expect(() => loadConfig(env)).toThrow(/required/i);
  });

  it('Should_throw_descriptive_error_when_RESEND_API_KEY_missing_in_production', () => {
    const env = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://neon.tech:5432/railsignal',
      REDIS_URL: 'rediss://upstash.io:6379',
      JOB_SECRET: 'super-secret-key',
    };

    expect(() => loadConfig(env)).toThrow(/RESEND_API_KEY/);
    expect(() => loadConfig(env)).toThrow(/required/i);
  });

  it('Should_throw_descriptive_error_when_JOB_SECRET_missing_in_production', () => {
    const env = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://neon.tech:5432/railsignal',
      REDIS_URL: 'rediss://upstash.io:6379',
      RESEND_API_KEY: 're_123456789',
    };

    expect(() => loadConfig(env)).toThrow(/JOB_SECRET/);
    expect(() => loadConfig(env)).toThrow(/required/i);
  });

  it('Should_reject_sqlite_database_url_in_production', () => {
    const env = {
      NODE_ENV: 'production',
      DATABASE_URL: 'file:./railsignal.db',
      REDIS_URL: 'rediss://upstash.io:6379',
      RESEND_API_KEY: 're_123456789',
      JOB_SECRET: 'super-secret-key',
    };

    expect(() => loadConfig(env)).toThrow(/DATABASE_URL/);
  });

  it('Should_reject_unencrypted_redis_url_in_production', () => {
    const env = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://neon.tech:5432/railsignal',
      REDIS_URL: 'redis://localhost:6379',
      RESEND_API_KEY: 're_123456789',
      JOB_SECRET: 'super-secret-key',
    };

    expect(() => loadConfig(env)).toThrow(/REDIS_URL/);
  });

  it('Should_throw_when_port_is_less_than_one', () => {
    expect(() => loadConfig({ PORT: '0' })).toThrow(/PORT/);
    expect(() => loadConfig({ PORT: '-1' })).toThrow(/PORT/);
  });

  it('Should_throw_when_port_is_greater_than_65535', () => {
    expect(() => loadConfig({ PORT: '65536' })).toThrow(/PORT/);
    expect(() => loadConfig({ PORT: '99999' })).toThrow(/PORT/);
  });

  it('Should_throw_when_port_is_not_an_integer', () => {
    expect(() => loadConfig({ PORT: 'not-a-number' })).toThrow(/PORT/);
    expect(() => loadConfig({ PORT: '3000.5' })).toThrow(/PORT/);
    expect(() => loadConfig({ PORT: '' })).toThrow(/PORT/);
  });

  it('Should_throw_when_redis_url_is_malformed_in_development', () => {
    expect(() => loadConfig({ REDIS_URL: 'http://localhost:6379' })).toThrow(/REDIS_URL/);
    expect(() => loadConfig({ REDIS_URL: 'localhost:6379' })).toThrow(/REDIS_URL/);
    expect(() => loadConfig({ REDIS_URL: 'not-a-url' })).toThrow(/REDIS_URL/);
  });

  it('Should_throw_when_database_url_is_malformed_in_development', () => {
    expect(() => loadConfig({ DATABASE_URL: 'mysql://localhost:3306/db' })).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ DATABASE_URL: 'not-a-url' })).toThrow(/DATABASE_URL/);
  });

  it('Should_throw_when_NODE_ENV_is_invalid', () => {
    expect(() => loadConfig({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('Should_return_deeply_frozen_configuration_object', () => {
    const config = loadConfig({});
    expect(Object.isFrozen(config)).toBe(true);
    expect(() => {
      (config as unknown as Record<string, unknown>).port = 9999;
    }).toThrow();
  });
});
