import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { ensureSearchIndex } from './lib/search';
import { emailQueue } from './queue/emailQueue';
import { searchIndexer } from './services/searchIndexer';
import { startWorkerRuntime } from './workerRuntime';

// Separate process from the API so it can be scaled / restarted independently.
const stopWorker = startWorkerRuntime();
void ensureSearchIndex();

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down worker (waiting for in-flight sends)');
  await stopWorker();
  await searchIndexer.flush().catch(() => undefined);
  await emailQueue.close();
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
