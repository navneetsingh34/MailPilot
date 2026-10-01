import { Router, type Response } from 'express';
import { env } from '../config/env';
import { HttpError } from '../lib/httpError';
import { logger } from '../lib/logger';
import { currentUserId, requireAuth } from '../middleware/auth';
import { buildSlackInstallUrl, completeSlackInstall, disconnectSlack, notifyUserOnSlack } from '../services/slackService';

export const slackRouter = Router();

const backToDashboard = (res: Response, params: Record<string, string>) =>
  res.redirect(`${env.FRONTEND_URL}/dashboard?${new URLSearchParams(params)}`);

/** "Connect Slack" button target (a top-level navigation, so the session cookie is sent). */
slackRouter.get('/connect', requireAuth, (req, res) => {
  res.redirect(buildSlackInstallUrl(currentUserId(req)));
});

/** Slack redirects here after the user approves (or cancels) the install. */
slackRouter.get('/callback', async (req, res) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  if (error) return backToDashboard(res, { slack: 'error', message: error === 'access_denied' ? 'Slack connection was cancelled' : error });
  if (!code || !state) return backToDashboard(res, { slack: 'error', message: 'Invalid Slack response' });

  try {
    const integration = await completeSlackInstall(code, state);
    logger.info({ userId: integration.userId, team: integration.teamName }, 'slack connected');
    backToDashboard(res, { slack: 'connected' });
  } catch (err) {
    logger.error({ err }, 'slack install failed');
    backToDashboard(res, { slack: 'error', message: err instanceof HttpError ? err.message : 'Slack connection failed' });
  }
});

slackRouter.delete('/', requireAuth, async (req, res) => {
  await disconnectSlack(currentUserId(req));
  res.status(204).end();
});

slackRouter.post('/test', requireAuth, async (req, res) => {
  const delivered = await notifyUserOnSlack(currentUserId(req), {
    text: '👋 Test message from ReachInbox. Rate-limit alerts will appear in this channel.',
  });
  if (!delivered) throw new HttpError(409, 'Slack is not connected');
  res.json({ delivered });
});
