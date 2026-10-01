import { Client } from '@opensearch-project/opensearch';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * OpenSearch (Elasticsearch-compatible API) client. Search is optional: without
 * ELASTICSEARCH_URL the app still runs and search falls back to Postgres.
 */
export const searchClient = env.ELASTICSEARCH_URL
  ? new Client({
      node: env.ELASTICSEARCH_URL,
      headers: env.ELASTICSEARCH_API_KEY ? { Authorization: `ApiKey ${env.ELASTICSEARCH_API_KEY}` } : undefined,
      requestTimeout: 10_000,
    })
  : null;

export const EMAIL_INDEX = env.ELASTICSEARCH_INDEX;

const emailMappings = {
  dynamic: 'strict',
  properties: {
    userId: { type: 'keyword' },
    campaignId: { type: 'keyword' },
    status: { type: 'keyword' },
    senderEmail: { type: 'keyword' },
    // search_as_you_type = prefix matching while the user types ("lea" finds "lead0@…")
    recipient: { type: 'search_as_you_type' },
    subject: { type: 'search_as_you_type' },
    body: { type: 'text' },
    scheduledAt: { type: 'date' },
    sentAt: { type: 'date' },
    failedAt: { type: 'date' },
    starred: { type: 'boolean' },
  },
} as const;

/** Creates the index on first boot. Failures are logged, never fatal. */
export async function ensureSearchIndex(): Promise<void> {
  if (!searchClient) {
    logger.warn('ELASTICSEARCH_URL not set; search will use Postgres fallback');
    return;
  }
  try {
    const { body: exists } = await searchClient.indices.exists({ index: EMAIL_INDEX });
    if (exists) return;
    await searchClient.indices.create({
      index: EMAIL_INDEX,
      body: { settings: { number_of_shards: 1, number_of_replicas: 0 }, mappings: emailMappings },
    });
    logger.info({ index: EMAIL_INDEX }, 'created search index');
  } catch (err) {
    // Another process may have created it at the same moment.
    if ((err as { meta?: { body?: { error?: { type?: string } } } }).meta?.body?.error?.type === 'resource_already_exists_exception') return;
    logger.error({ err }, 'could not ensure search index');
  }
}
