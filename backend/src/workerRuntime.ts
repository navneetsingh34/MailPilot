import { env } from './config/env';
import { logger } from './lib/logger';
import { reconcilePendingEmails } from './queue/reconciler';
import { closeTransports } from './services/mailer';
import { startEmailWorker } from './workers/emailWorker';

/**
 * Starts the BullMQ email worker plus the startup reconciler. Used by the standalone
 * worker process, and by the API process when RUN_WORKER_IN_API=true (single-service
 * hosting such as a free Render web service). Returns a function that stops it,
 * waiting for in-flight sends.
 */
export function startWorkerRuntime(): () => Promise<void> {
  const worker = startEmailWorker();
  logger.info(
    { concurrency: env.WORKER_CONCURRENCY, minDelayMs: env.MIN_DELAY_BETWEEN_SENDS_MS },
    'email worker started',
  );
  reconcilePendingEmails().catch((err) => logger.error({ err }, 'startup reconciliation failed'));

  return async () => {
    await worker.close();
    closeTransports();
  };
}
