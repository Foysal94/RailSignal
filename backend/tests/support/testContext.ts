import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { type AppOptions, buildApp } from '../../src/app.js';
import { type AppConfig, config as defaultConfig } from '../../src/config.js';
import { prisma as defaultPrisma } from '../../src/db.js';
import type { DemoAlertJobData, IngestJobData, IngestJobResult } from '../../src/queues/queues.js';
import { InMemoryQueueDouble } from './inMemoryQueueDouble.js';

export interface TestContextOptions {
  prisma?: PrismaClient | undefined;
  demoAlertQueue?: InMemoryQueueDouble<DemoAlertJobData, void> | undefined;
  ingestQueue?: InMemoryQueueDouble<IngestJobData, IngestJobResult> | undefined;
  config?: Partial<AppConfig> | undefined;
  configure?: ((app: FastifyInstance) => void | Promise<void>) | undefined;
}

export interface TestContext {
  app: FastifyInstance;
  prisma: PrismaClient;
  demoAlertQueue: InMemoryQueueDouble<DemoAlertJobData, void>;
  ingestQueue: InMemoryQueueDouble<IngestJobData, IngestJobResult>;
  config: AppConfig;
  resetDatabase: () => Promise<void>;
  close: () => Promise<void>;
}

// In-memory test context factory for Fastify integration testing.
// Boots Fastify with in-memory queue doubles and ephemeral SQLite persistence,
// exposing app directly for app.inject() calls without middleman wrappers.
export async function createTestContext(options: TestContextOptions = {}): Promise<TestContext> {
  const prisma = options.prisma ?? defaultPrisma;
  const demoAlertQueue =
    options.demoAlertQueue ?? new InMemoryQueueDouble<DemoAlertJobData, void>();
  const ingestQueue =
    options.ingestQueue ?? new InMemoryQueueDouble<IngestJobData, IngestJobResult>();
  const appConfig = options.config
    ? ({ ...defaultConfig, ...options.config } as AppConfig)
    : defaultConfig;

  const appOptions: AppOptions = {
    prisma,
    demoAlertQueue,
    ingestQueue,
    config: appConfig,
  };

  const app = buildApp(appOptions);

  if (options.configure) {
    await options.configure(app);
  }

  await app.ready();

  const resetDatabase = async (): Promise<void> => {
    await prisma.$transaction([
      prisma.subscriptionLine.deleteMany(),
      prisma.subscription.deleteMany(),
      prisma.disruptionNotice.deleteMany(),
      prisma.weekendDisruption.deleteMany(),
    ]);
    demoAlertQueue.clear();
    ingestQueue.clear();
  };

  const close = async (): Promise<void> => {
    await app.close();
    await prisma.$disconnect();
  };

  return {
    app,
    prisma,
    demoAlertQueue,
    ingestQueue,
    config: appConfig,
    resetDatabase,
    close,
  };
}
