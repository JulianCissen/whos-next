import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

interface GlobalWithContainer {
  __pgContainer?: StartedPostgreSqlContainer;
}

export async function setup(): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  process.env['DATABASE_URL'] = container.getConnectionUri();
  process.env['DB_HOST'] = container.getHost();
  process.env['DB_PORT'] = String(container.getPort());
  process.env['DB_NAME'] = container.getDatabase();
  process.env['DB_USER'] = container.getUsername();
  process.env['DB_PASSWORD'] = container.getPassword();
  (globalThis as GlobalWithContainer).__pgContainer = container;
}

export async function teardown(): Promise<void> {
  const container = (globalThis as GlobalWithContainer).__pgContainer;
  await container?.stop();
}
