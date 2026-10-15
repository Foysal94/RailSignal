import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(currentDir, '../../');
const testDbPath = resolve(backendRoot, 'prisma/test.db');

export async function setup(): Promise<void> {
  process.env.DATABASE_URL = 'file:./test.db';
  process.env.NODE_ENV = 'test';

  // Apply migrations to ephemeral test.db to mirror production schema without touching development railsignal.db
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: backendRoot,
    env: {
      ...process.env,
      DATABASE_URL: 'file:./test.db',
      NODE_ENV: 'test',
    },
    stdio: 'ignore',
  });
}

export async function teardown(): Promise<void> {
  // Clean up ephemeral SQLite files on test suite completion
  if (existsSync(testDbPath)) {
    rmSync(testDbPath, { force: true });
  }
  if (existsSync(`${testDbPath}-journal`)) {
    rmSync(`${testDbPath}-journal`, { force: true });
  }
}
