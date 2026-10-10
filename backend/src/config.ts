export interface AppConfig {
  readonly nodeEnv: 'development' | 'production' | 'test';
  readonly port: number;
  readonly host: string;
  readonly databaseUrl: string;
  readonly redisUrl?: string;
  readonly resendApiKey?: string;
  readonly jobSecret?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = (env['NODE_ENV'] as AppConfig['nodeEnv']) || 'development';
  const rawPort = env['PORT'];
  const parsedPort = rawPort ? Number.parseInt(rawPort, 10) : 3000;
  const host = env['HOST'] || '0.0.0.0';
  const databaseUrl = env['DATABASE_URL'] || 'file:./railsignal.db';
  const redisUrl = env['REDIS_URL'];
  const resendApiKey = env['RESEND_API_KEY'];
  const jobSecret = env['JOB_SECRET'];

  return Object.freeze({
    nodeEnv,
    port: Number.isNaN(parsedPort) ? 3000 : parsedPort,
    host,
    databaseUrl,
    ...(redisUrl ? { redisUrl } : {}),
    ...(resendApiKey ? { resendApiKey } : {}),
    ...(jobSecret ? { jobSecret } : {}),
  });
}

export const config = loadConfig();
