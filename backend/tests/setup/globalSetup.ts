import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(currentDir, '../../');
const testDbPath = resolve(backendRoot, 'prisma/test.db');

function purgeEphemeralDbFiles(): void {
  const artifacts = [testDbPath, `${testDbPath}-journal`, `${testDbPath}-wal`, `${testDbPath}-shm`];

  for (const artifact of artifacts) {
    if (existsSync(artifact)) {
      rmSync(artifact, { force: true });
    }
  }
}

export async function setup(): Promise<void> {
  process.env.DATABASE_URL = 'file:./test.db';
  process.env.NODE_ENV = 'test';

  purgeEphemeralDbFiles();

  try {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: backendRoot,
      env: {
        ...process.env,
        DATABASE_URL: 'file:./test.db',
        NODE_ENV: 'test',
      },
      stdio: 'pipe',
    });
  } catch (error) {
    process.stderr.write(`Failed to migrate ephemeral test database: ${String(error)}\n`);
    throw error;
  }
}

export async function teardown(): Promise<void> {
  purgeEphemeralDbFiles();
}
