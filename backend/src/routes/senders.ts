import { Router } from 'express';
import { listActiveSenders } from '../services/senderService';

export const sendersRouter = Router();

sendersRouter.get('/', async (_req, res) => {
  res.json(await listActiveSenders());
});
