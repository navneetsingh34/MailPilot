/**
 * Rebuilds the search index from Postgres (the source of truth).
 *
 *   npm run search:reindex            # re-sync every email
 *   npm run search:reindex -- --fresh # drop and recreate the index first
 */
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { EMAIL_INDEX, ensureSearchIndex, searchClient } from '../lib/search';
import { searchIndexer } from '../services/searchIndexer';

const BATCH = 1000;

async function main() {
  if (!searchClient) throw new Error('ELASTICSEARCH_URL is not set');
  if (process.argv.includes('--fresh')) {
    await searchClient.indices.delete({ index: EMAIL_INDEX }).catch(() => undefined);
    logger.info({ index: EMAIL_INDEX }, 'deleted search index');
  }
  await ensureSearchIndex();

  let cursor: string | undefined;
  let total = 0;
  for (;;) {
    const batch = await prisma.email.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    if (batch.length === 0) break;
    searchIndexer.markDirty(batch.map((e) => e.id));
    await searchIndexer.flush();
    total += batch.length;
    cursor = batch[batch.length - 1].id;
  }
  logger.info({ total }, 'reindex complete');
}

main()
  .catch((err) => {
    logger.error({ err }, 'reindex failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
