import { buildApp } from './app.js';
import { config } from './config.js';

const app = buildApp({
  logger: {
    level: config.nodeEnv === 'test' ? 'silent' : 'info',
  },
});

async function start(): Promise<void> {
  try {
    const address = await app.listen({
      port: config.port,
      host: config.host,
    });
    app.log.info(`RailSignal Fastify server listening on ${address}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

const signals: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const signal of signals) {
  process.on(signal, () => {
    void (async () => {
      app.log.info(`Received ${signal}, closing server gracefully...`);
      await app.close();
      process.exit(0);
    })();
  });
}

void start();
