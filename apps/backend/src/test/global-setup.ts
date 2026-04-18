// Integration test global setup — Testcontainers pattern (RA §7.3)
//
// TODO: When the first integration tests are added:
//   1. Install: pnpm --filter @whos-next/backend add -D @testcontainers/postgresql
//   2. Replace the stubs below with the real Testcontainers implementation:
//
//   import { PostgreSqlContainer } from '@testcontainers/postgresql';
//
//   export async function setup(): Promise<void> {
//     const container = await new PostgreSqlContainer('postgres:16-alpine').start();
//     process.env['DATABASE_URL'] = container.getConnectionUri();
//     (globalThis as { __pgContainer?: unknown }).__pgContainer = container;
//   }
//
//   export async function teardown(): Promise<void> {
//     const container = (globalThis as { __pgContainer?: { stop(): Promise<void> } }).__pgContainer;
//     await container?.stop();
//   }

export async function setup(): Promise<void> {
  // No-op until Testcontainers is introduced.
}

export async function teardown(): Promise<void> {
  // No-op until Testcontainers is introduced.
}
