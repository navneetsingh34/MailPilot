import { Router } from 'express';
import { redis } from '../lib/redis';

export const healthRouter = Router();

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

healthRouter.get('/', async (_req, res) => {
  const redisOk = await withTimeout(redis.ping(), 2000)
    .then((r) => r === 'PONG')
    .catch(() => false);
  res.status(redisOk ? 200 : 503).json({ status: redisOk ? 'ok' : 'degraded', redis: redisOk });
});
