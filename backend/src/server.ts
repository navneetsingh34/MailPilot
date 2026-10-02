import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { ensureSearchIndex } from './lib/search';
import { emailQueue } from './queue/emailQueue';
import { searchIndexer } from './services/searchIndexer';
import { startWorkerRuntime } from './workerRuntime';

void ensureSearchIndex();

const server = createApp().listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});

// Single-service hosting: run the worker inside this process too.
const stopWorker = env.RUN_WORKER_IN_API ? startWorkerRuntime() : null;

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down API');
  server.close();
  await stopWorker?.().catch(() => undefined);
  await searchIndexer.flush().catch(() => undefined);
  await emailQueue.close().catch(() => undefined);
  await prisma.$disconnect();
  await redis.quit().catch(() => undefined);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
