import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { requireAuth } from './middleware/auth';
import { errorHandler, notFound } from './middleware/error';
import { authRouter } from './routes/auth';
import { campaignsRouter } from './routes/campaigns';
import { emailsRouter } from './routes/emails';
import { healthRouter } from './routes/health';
import { createQueueDashboardRouter, QUEUE_DASHBOARD_PATH } from './routes/queueDashboard';
import { sendersRouter } from './routes/senders';
import { slackRouter } from './routes/slack';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(cookieParser());
  // Bull Board serves its own UI (inline scripts), so it is mounted before helmet's CSP.
  app.use(QUEUE_DASHBOARD_PATH, requireAuth, createQueueDashboardRouter());

  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  // Large enough for up to 3 base64-encoded 2 MB attachments
  app.use(express.json({ limit: '10mb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/senders', requireAuth, sendersRouter);
  app.use('/api/campaigns', requireAuth, campaignsRouter);
  app.use('/api/emails', requireAuth, emailsRouter);
  app.use('/api/slack', slackRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
