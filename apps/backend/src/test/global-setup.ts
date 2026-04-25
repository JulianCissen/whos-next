import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

interface GlobalWithContainer {
  __pgContainer?: StartedPostgreSqlContainer;
  __sqliteDbPath?: string;
}

function resolveIntegrationDbDriver(): 'postgres' | 'sqlite' {
  const configured = (process.env['INTEGRATION_DB_DRIVER'] ?? 'postgres').toLowerCase();
  if (configured === 'postgres' || configured === 'sqlite') {
    return configured;
  }
  throw new Error(
    `Unsupported INTEGRATION_DB_DRIVER "${configured}". Expected "postgres" or "sqlite".`,
  );
}

export async function setup(): Promise<void> {
  const dbDriver = resolveIntegrationDbDriver();
  if (dbDriver === 'sqlite') {
    const sqliteDbPath =
      process.env['INTEGRATION_SQLITE_PATH'] ??
      join(tmpdir(), `whos-next-integration-${process.pid}.sqlite`);

    process.env['DB_DRIVER'] = 'sqlite';
    process.env['DB_SQLITE_PATH'] = sqliteDbPath;
    delete process.env['DATABASE_URL'];
    (globalThis as GlobalWithContainer).__sqliteDbPath = sqliteDbPath;
    return;
  }

  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  process.env['DB_DRIVER'] = 'postgres';
  process.env['DATABASE_URL'] = container.getConnectionUri();
  process.env['DB_HOST'] = container.getHost();
  process.env['DB_PORT'] = String(container.getPort());
  process.env['DB_NAME'] = container.getDatabase();
  process.env['DB_USER'] = container.getUsername();
  process.env['DB_PASSWORD'] = container.getPassword();
  (globalThis as GlobalWithContainer).__pgContainer = container;
}

export async function teardown(): Promise<void> {
  const globalData = globalThis as GlobalWithContainer;
  const container = globalData.__pgContainer;
  await container?.stop();

  const sqliteDbPath = globalData.__sqliteDbPath;
  if (sqliteDbPath) {
    await rm(sqliteDbPath, { force: true });
  }
}
