import { PrismaClient } from '@prisma/client';
import { config } from './config.js';

// Node.js module reloads (e.g. via tsx watch in development) re-evaluate modules on change.
// Without an ambient IoC container managing lifetime, creating new PrismaClient instances
// on each reload spawns runaway connection pools, causing connection exhaustion in PostgreSQL
// and SQLITE_BUSY lock errors in SQLite. Caching the singleton on globalThis preserves the
// active connection pool across development re-evaluations while avoiding global leakage in production.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || config.databaseUrl,
      },
    },
    log: config.nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (config.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma;
}
