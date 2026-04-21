import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';

export default defineConfig({
  host: process.env['DB_HOST'] ?? 'localhost',
  port: Number.parseInt(process.env['DB_PORT'] ?? '5432', 10),
  dbName: process.env['DB_NAME'] ?? 'whosnext',
  user: process.env['DB_USER'] ?? 'postgres',
  password: process.env['DB_PASSWORD'] ?? 'postgres',
  entities: ['dist/**/*.entity.js', 'dist/common/base-entity.js'],
  entitiesTs: ['src/**/*.entity.ts', 'src/common/base-entity.ts'],
  extensions: [Migrator],
  migrations: {
    path: 'dist/database/migrations',
    pathTs: 'src/database/migrations',
    glob: '!(*.d).{js,ts}',
  },
  debug: process.env['NODE_ENV'] === 'development',
  colors: false,
});
