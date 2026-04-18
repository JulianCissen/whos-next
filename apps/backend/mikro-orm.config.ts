import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';

export default defineConfig({
  host: process.env['DB_HOST'] ?? 'localhost',
  port: Number.parseInt(process.env['DB_PORT'] ?? '5432', 10),
  dbName: process.env['DB_NAME'] ?? 'whosnext',
  user: process.env['DB_USER'] ?? 'postgres',
  password: process.env['DB_PASSWORD'] ?? 'postgres',
  entities: ['dist/**/*.entity.js'],
  entitiesTs: ['src/**/*.entity.ts'],
  discovery: {
    // No entity files exist yet during scaffolding — suppress the "no entities" error
    warnWhenNoEntities: false,
  },
  extensions: [Migrator],
  migrations: {
    path: 'dist/database/migrations',
    pathTs: 'src/database/migrations',
    glob: '!(*.d).{js,ts}',
  },
  debug: process.env['NODE_ENV'] === 'development',
});
