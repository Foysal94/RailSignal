import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

export const ConfigSchema = Type.Object({
  nodeEnv: Type.Union([
    Type.Literal('development'),
    Type.Literal('production'),
    Type.Literal('test'),
  ]),
  port: Type.Integer({ minimum: 1, maximum: 65535 }),
  host: Type.String(),
  databaseUrl: Type.String({ minLength: 1 }),
  redisUrl: Type.Optional(Type.String()),
  resendApiKey: Type.Optional(Type.String()),
  emailFrom: Type.Optional(Type.String()),
  jobSecret: Type.Optional(Type.String()),
});

export type AppConfig = Static<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const rawNodeEnv = env['NODE_ENV'] || 'development';
  const nodeEnv = rawNodeEnv === 'production' || rawNodeEnv === 'test' ? rawNodeEnv : 'development';

  const rawPort = env['PORT'];
  const port = rawPort ? Number.parseInt(rawPort, 10) : 3000;
  const host = env['HOST'] || '0.0.0.0';

  const databaseUrl = env['DATABASE_URL'] || (nodeEnv === 'production' ? '' : 'file:./railsignal.db');
  if (nodeEnv === 'production' && !databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required in production');
  }

  const candidate: AppConfig = {
    nodeEnv,
    port: Number.isNaN(port) ? 3000 : port,
    host,
    databaseUrl,
    ...(env['REDIS_URL'] ? { redisUrl: env['REDIS_URL'] } : {}),
    ...(env['RESEND_API_KEY'] ? { resendApiKey: env['RESEND_API_KEY'] } : {}),
    ...(env['EMAIL_FROM'] ? { emailFrom: env['EMAIL_FROM'] } : {}),
    ...(env['JOB_SECRET'] ? { jobSecret: env['JOB_SECRET'] } : {}),
  };

  const errors = [...Value.Errors(ConfigSchema, candidate)];
  if (errors.length > 0) {
    const errorDetails = errors.map((e) => `${e.path}: ${e.message}`).join(', ');
    throw new Error(`Invalid application configuration: ${errorDetails}`);
  }

  return Object.freeze(candidate);
}

export const config = loadConfig();
