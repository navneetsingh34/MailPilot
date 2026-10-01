import { Redis } from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * BullMQ needs `maxRetriesPerRequest: null` so blocking commands used by
 * workers are never aborted. Each caller gets its own connection because
 * BullMQ workers hold blocking connections.
 */
export function createRedisConnection(name: string): Redis {
  const conn = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectionName: name,
  });
  conn.on('error', (err) => logger.error({ err, name }, 'redis connection error'));
  return conn;
}

/** Shared connection for non-blocking commands (rate-limit counters, flags). */
export const redis = createRedisConnection('shared');
