import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Migrations go over the direct (non-pooled) connection; the app uses the pooled one.
// Optional so `prisma generate` also works where no database is configured (e.g. CI).
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  ...(url && { datasource: { url } }),
});
