import { type Static, Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

export const DevelopmentConfigSchema = Type.Object({
  nodeEnv: Type.Union([Type.Literal('development'), Type.Literal('test')]),
  port: Type.Integer({ minimum: 1, maximum: 65535 }),
  host: Type.String({ minLength: 1 }),
  databaseUrl: Type.String({
    pattern: '^((postgres(ql)?|file)://|file:).+',
  }),
  redisUrl: Type.Optional(Type.String({ pattern: '^rediss?://.+' })),
  resendApiKey: Type.Optional(Type.String({ minLength: 1 })),
  emailFrom: Type.Optional(Type.String()),
  jobSecret: Type.Optional(Type.String({ minLength: 1 })),
});

export const ProductionConfigSchema = Type.Object({
  nodeEnv: Type.Literal('production'),
  port: Type.Integer({ minimum: 1, maximum: 65535 }),
  host: Type.String({ minLength: 1 }),
  // Production requires PostgreSQL per ADR 0002; embedded SQLite is rejected.
  databaseUrl: Type.String({
    pattern: '^postgres(ql)?://.+',
  }),
  // Upstash Serverless Redis over TLS required per ADR 0003.
  redisUrl: Type.String({
    pattern: '^rediss://.+',
  }),
  resendApiKey: Type.String({ minLength: 1 }),
  emailFrom: Type.Optional(Type.String()),
  jobSecret: Type.String({ minLength: 1 }),
});

export const ConfigSchema = Type.Union([DevelopmentConfigSchema, ProductionConfigSchema]);

export type AppConfig = Static<typeof ConfigSchema>;

const ENV_VAR_MAPPINGS: Record<string, string> = {
  '/databaseUrl': 'DATABASE_URL',
  '/redisUrl': 'REDIS_URL',
  '/resendApiKey': 'RESEND_API_KEY',
  '/jobSecret': 'JOB_SECRET',
  '/port': 'PORT',
  '/host': 'HOST',
  '/nodeEnv': 'NODE_ENV',
  '/emailFrom': 'EMAIL_FROM',
};

function deepFreeze<T extends object>(obj: T): Readonly<T> {
  return Object.freeze(obj);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const rawNodeEnv = env.NODE_ENV || 'development';

  const rawPort = env.PORT;
  let port = 3000;
  if (rawPort !== undefined) {
    const trimmed = rawPort.trim();
    const parsed = trimmed === '' ? Number.NaN : Number(trimmed);
    port = Number.isInteger(parsed) ? parsed : Number.NaN;
  }

  const host = env.HOST || '0.0.0.0';

  const databaseUrl =
    env.DATABASE_URL && env.DATABASE_URL.trim() !== ''
      ? env.DATABASE_URL
      : rawNodeEnv === 'production'
        ? undefined
        : 'file:./railsignal.db';

  const candidate = {
    nodeEnv: rawNodeEnv,
    port,
    host,
    ...(databaseUrl ? { databaseUrl } : {}),
    ...(env.REDIS_URL && env.REDIS_URL.trim() !== '' ? { redisUrl: env.REDIS_URL } : {}),
    ...(env.RESEND_API_KEY && env.RESEND_API_KEY.trim() !== ''
      ? { resendApiKey: env.RESEND_API_KEY }
      : {}),
    ...(env.EMAIL_FROM && env.EMAIL_FROM.trim() !== '' ? { emailFrom: env.EMAIL_FROM } : {}),
    ...(env.JOB_SECRET && env.JOB_SECRET.trim() !== '' ? { jobSecret: env.JOB_SECRET } : {}),
  };

  const targetSchema =
    rawNodeEnv === 'production' ? ProductionConfigSchema : DevelopmentConfigSchema;
  const errors = [...Value.Errors(targetSchema, candidate)];

  if (errors.length > 0) {
    const seenPaths = new Set<string>();
    const errorDetails = errors
      .filter((e) => {
        if (seenPaths.has(e.path)) return false;
        seenPaths.add(e.path);
        return true;
      })
      .map((e) => {
        const envName = ENV_VAR_MAPPINGS[e.path] || e.path.slice(1);
        return `${e.path} (${envName}): ${e.message}`;
      })
      .join(', ');

    throw new Error(`Invalid application configuration: ${errorDetails}`);
  }

  return deepFreeze(candidate as unknown as AppConfig);
}

export const config = loadConfig();
