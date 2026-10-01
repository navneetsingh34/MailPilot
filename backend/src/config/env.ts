import 'dotenv/config';
import { z } from 'zod';

const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  ELASTICSEARCH_URL: optional,
  ELASTICSEARCH_API_KEY: optional,
  ELASTICSEARCH_INDEX: z.string().min(1).default('reachinbox-emails'),

  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  GOOGLE_CALLBACK_URL: optional,

  SLACK_CLIENT_ID: optional,
  SLACK_CLIENT_SECRET: optional,
  SLACK_REDIRECT_URI: optional,

  WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(5),
  MIN_DELAY_BETWEEN_SENDS_MS: z.coerce.number().int().min(0).default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().int().min(1).default(200),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
