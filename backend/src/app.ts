import fastifyCors from '@fastify/cors';
import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import type { AppConfig } from './config.js';
import { errorHandler, notFoundHandler } from './errorHandler.js';
import type { DemoAlertJobData, IngestJobData, IngestJobResult } from './queues/queues.js';
import {
  demoRoutes,
  healthRoutes,
  jobsRoutes,
  linesRoutes,
  subscriptionsRoutes,
} from './routes/index.js';

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

  // Azure Static Web Apps hosts production and preview environments on subdomains of azurestaticapps.net
  const allowedOrigins: (string | RegExp)[] = [
    /^https:\/\/([a-z0-9-]+\.)+azurestaticapps\.net$/,
    'http://localhost:5173',
  ];

  const configuredOrigin = options.config?.clientOrigin ?? process.env.CLIENT_ORIGIN;
  if (configuredOrigin) {
    for (const origin of configuredOrigin
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)) {
      allowedOrigins.push(origin);
    }
  }

  app.register(fastifyCors, {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.register(healthRoutes);
  app.register(linesRoutes, { prisma: options.prisma });
  app.register(subscriptionsRoutes, { prisma: options.prisma });
  app.register(demoRoutes, { demoAlertQueue: options.demoAlertQueue });
  app.register(jobsRoutes, { ingestQueue: options.ingestQueue, config: options.config });

  return app;
}
