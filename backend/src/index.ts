import { buildApp } from './app.js';
import { config } from './config.js';

const app = buildApp({
  logger: {
    level: config.nodeEnv === 'test' ? 'silent' : 'info',
  },
});

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  app.log.info(`Received ${signal}, closing server gracefully...`);

  // Force termination fallback if cleanup hangs
  const forceKillTimeout = setTimeout(() => {
    app.log.error('Graceful shutdown timed out after 10s, forcing exit');
    process.exit(1);
  }, 10_000);
  forceKillTimeout.unref();

  try {
    await app.close();
    app.log.info('Server closed successfully');
    process.exit(0);
  } catch (error) {
    app.log.error(error, 'Error during graceful shutdown');
    process.exit(1);
  }
}

async function start(): Promise<void> {
  try {
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

const signals: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const signal of signals) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

process.on('unhandledRejection', (reason) => {
  app.log.error(reason, 'Unhandled Promise Rejection');
});

process.on('uncaughtException', (error) => {
  app.log.fatal(error, 'Uncaught Exception');
  void shutdown('uncaughtException');
});

void start();
