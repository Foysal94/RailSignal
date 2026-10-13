import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { AppConfig } from './config.js';
import { errorHandler, notFoundHandler } from './errorHandler.js';
import type { DemoAlertJobData, IngestJobData, IngestJobResult } from './queues/queues.js';
import { demoRoutes } from './routes/demo.js';
import { healthRoutes } from './routes/health.js';
import { jobsRoutes } from './routes/jobs.js';
import { linesRoutes } from './routes/lines.js';
import { subscriptionsRoutes } from './routes/subscriptions.js';

export interface AppOptions extends FastifyServerOptions {
  prisma?: PrismaClient | undefined;
  demoAlertQueue?: Pick<Queue<DemoAlertJobData, void, string>, 'add'> | undefined;
  ingestQueue?: Pick<Queue<IngestJobData, IngestJobResult, string>, 'add'> | undefined;
  config?: AppConfig | undefined;
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify(options);

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  app.register(healthRoutes);
  app.register(linesRoutes, { prisma: options.prisma });
  app.register(subscriptionsRoutes, { prisma: options.prisma });
  app.register(demoRoutes, { demoAlertQueue: options.demoAlertQueue });
  app.register(jobsRoutes, { ingestQueue: options.ingestQueue, config: options.config });

  return app;
}
