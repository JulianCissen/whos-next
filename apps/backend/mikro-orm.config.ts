import { Migrator } from '@mikro-orm/migrations';
import { defineConfig as definePostgresConfig } from '@mikro-orm/postgresql';
import { defineConfig as defineSqliteConfig } from '@mikro-orm/sqlite';

function resolveDbDriver(): 'postgres' | 'sqlite' {
  const configured = (process.env['DB_DRIVER'] ?? 'postgres').toLowerCase();
  if (configured === 'postgres' || configured === 'sqlite') {
    return configured;
  }
  throw new Error(`Unsupported DB_DRIVER "${configured}". Expected "postgres" or "sqlite".`);
}

const dbDriver = resolveDbDriver();
const databaseUrl = process.env['DATABASE_URL'];

function migrationPaths(driver: 'postgres' | 'sqlite') {
  return {
    path: `dist/database/migrations/${driver}`,
    pathTs: `src/database/migrations/${driver}`,
    glob: '!(*.d).{js,ts}',
  };
}

const commonConfig = {
  entities: ['dist/**/*.entity.js', 'dist/common/base-entity.js'],
  entitiesTs: ['src/**/*.entity.ts', 'src/common/base-entity.ts'],
  extensions: [Migrator],
  debug: process.env['NODE_ENV'] === 'development',
  colors: false,
};

const config =
  dbDriver === 'sqlite'
    ? defineSqliteConfig({
        ...commonConfig,
        migrations: migrationPaths('sqlite'),
        dbName: process.env['DB_SQLITE_PATH'] ?? './data/whosnext.sqlite',
      })
    : definePostgresConfig({
        ...commonConfig,
        migrations: migrationPaths('postgres'),
        ...(databaseUrl ? { clientUrl: databaseUrl } : {}),
        host: process.env['DB_HOST'] ?? 'localhost',
        port: Number.parseInt(process.env['DB_PORT'] ?? '5432', 10),
        dbName: process.env['DB_NAME'] ?? 'whosnext',
        user: process.env['DB_USER'] ?? 'postgres',
        password: process.env['DB_PASSWORD'] ?? 'postgres',
      });

export default config;
