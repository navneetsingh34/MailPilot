import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { ensureSearchIndex } from './lib/search';
import { emailQueue } from './queue/emailQueue';
import { reconcilePendingEmails } from './queue/reconciler';
import { closeTransports } from './services/mailer';
import { searchIndexer } from './services/searchIndexer';
import { startEmailWorker } from './workers/emailWorker';

// Separate process from the API so it can be scaled / restarted independently.
const worker = startEmailWorker();
logger.info(
  { concurrency: env.WORKER_CONCURRENCY, minDelayMs: env.MIN_DELAY_BETWEEN_SENDS_MS },
  'email worker started',
);

reconcilePendingEmails().catch((err) => logger.error({ err }, 'startup reconciliation failed'));
void ensureSearchIndex();

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down worker (waiting for in-flight sends)');
  await worker.close();
  await searchIndexer.flush().catch(() => undefined);
  await emailQueue.close();
  closeTransports();
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
