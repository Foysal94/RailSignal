import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, InjectOptions, Response } from 'fastify';
import { type AppOptions, buildApp } from '../../src/app.js';
import { type AppConfig, config as defaultConfig } from '../../src/config.js';
import { prisma as defaultPrisma } from '../../src/db.js';
import type { DemoAlertJobData, IngestJobData, IngestJobResult } from '../../src/queues/queues.js';
import { InMemoryQueueDouble } from '../support/inMemoryQueueDouble.js';

export interface WebApplicationFactoryOptions {
  prisma?: PrismaClient | undefined;
  demoAlertQueue?: InMemoryQueueDouble<DemoAlertJobData, void> | undefined;
  ingestQueue?: InMemoryQueueDouble<IngestJobData, IngestJobResult> | undefined;
  config?: Partial<AppConfig> | undefined;
  configure?: ((app: FastifyInstance) => void | Promise<void>) | undefined;
}

// In-memory application test harness mirroring .NET's WebApplicationFactory<Program>.
// Coordinates Fastify in-memory transport (app.inject), Prisma persistence against test.db,
// and in-memory BullMQ queue doubles to eliminate external network/cloud dependencies.
export class WebApplicationFactory {
  public readonly app: FastifyInstance;
  public readonly prisma: PrismaClient;
  public readonly demoAlertQueue: InMemoryQueueDouble<DemoAlertJobData, void>;
  public readonly ingestQueue: InMemoryQueueDouble<IngestJobData, IngestJobResult>;
  public readonly config: AppConfig;

  private constructor(
    app: FastifyInstance,
    prisma: PrismaClient,
    demoAlertQueue: InMemoryQueueDouble<DemoAlertJobData, void>,
    ingestQueue: InMemoryQueueDouble<IngestJobData, IngestJobResult>,
    config: AppConfig,
  ) {
    this.app = app;
    this.prisma = prisma;
    this.demoAlertQueue = demoAlertQueue;
    this.ingestQueue = ingestQueue;
    this.config = config;
  }

  public static async create(
    options: WebApplicationFactoryOptions = {},
  ): Promise<WebApplicationFactory> {
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

    return new WebApplicationFactory(app, prisma, demoAlertQueue, ingestQueue, appConfig);
  }

  // Mirrors .NET HttpClient calls via Fastify's in-memory transport layer
  public async inject(options: InjectOptions): Promise<Response> {
    return this.app.inject(options);
  }

  // Atomic database purge between test suites to ensure strict test isolation
  public async resetDatabase(): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.subscriptionLine.deleteMany(),
      this.prisma.subscription.deleteMany(),
      this.prisma.weekendDisruption.deleteMany(),
    ]);
  }

  public async close(): Promise<void> {
    await this.app.close();
  }
}
