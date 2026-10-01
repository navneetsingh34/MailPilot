import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Migrations go over the direct (non-pooled) connection; the app uses the pooled one.
  datasource: { url: env('DIRECT_URL') },
});
