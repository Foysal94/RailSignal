import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { parseCliArgs } from './jobs/cliArgs.js';
import { runSyncDisruptionsCli } from './jobs/syncDisruptionsRunner.js';
import { closeAllWorkers, startAllWorkers } from './workers/index.js';

let isShuttingDown = false;

async function shutdown(app: ReturnType<typeof buildApp>, signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  app.log.info(`Received ${signal}, closing server and workers gracefully...`);

  // Force termination fallback if cleanup hangs
  const forceKillTimeout = setTimeout(() => {
    app.log.error('Graceful shutdown timed out after 10s, forcing exit');
    process.exit(1);
  }, 10_000);
  forceKillTimeout.unref();

  try {
    await Promise.allSettled([app.close(), closeAllWorkers()]);
    app.log.info('Server and workers closed successfully');
  } catch (error) {
    app.log.error(error, 'Error during graceful shutdown');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  }
}

export async function startServer(): Promise<void> {
  const app = buildApp({
    logger: {
      level: config.nodeEnv === 'test' ? 'silent' : 'info',
    },
  });

  const signals: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, () => {
      void shutdown(app, signal);
    });
  }

  process.on('unhandledRejection', (reason) => {
    app.log.error(reason, 'Unhandled Promise Rejection');
  });

  process.on('uncaughtException', (error) => {
    app.log.fatal(error, 'Uncaught Exception');
    void shutdown(app, 'uncaughtException');
  });

  try {
    startAllWorkers();
    const address = await app.listen({
      port: config.port,
      host: config.host,
    });
    app.log.info(`RailSignal Fastify server listening on ${address}`);
  } catch (error) {
    app.log.error(error, 'Failed to start server');
    process.exit(1);
  }
}

export interface MainOptions {
  argv?: string[] | undefined;
  runSyncJob?: typeof runSyncDisruptionsCli | undefined;
  startHttpServer?: (() => Promise<void>) | undefined;
  exit?: ((code: number) => void) | undefined;
  logger?: Pick<typeof console, 'error'> | undefined;
}

/**
 * Root composition entrypoint. Inspects CLI arguments:
 * - If `--job sync-disruptions` is provided, executes the scheduled runner and exits.
 * - Otherwise, boots background BullMQ workers and starts the Fastify HTTP listener.
 */
export async function main(options: MainOptions = {}): Promise<void> {
  const argv = options.argv ?? process.argv.slice(2);
  const { job } = parseCliArgs(argv);

  if (job) {
    if (job === 'sync-disruptions') {
      const runner = options.runSyncJob ?? runSyncDisruptionsCli;
      await runner();
      return;
    }

    const logger = options.logger ?? console;
    const exit = options.exit ?? ((code: number) => process.exit(code));
    logger.error(`Unknown job: "${job}". Supported jobs: sync-disruptions`);
    exit(1);
    return;
  }

  const startHttp = options.startHttpServer ?? startServer;
  await startHttp();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main();
}
