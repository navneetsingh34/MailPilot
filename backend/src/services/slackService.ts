import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { HttpError } from '../lib/httpError';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';

const SLACK_TIMEOUT_MS = 5000;
const STATE_PURPOSE = 'slack-install';

function slackConfig() {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET || !env.SLACK_REDIRECT_URI) {
    throw new HttpError(503, 'Slack integration is not configured');
  }
  return { clientId: env.SLACK_CLIENT_ID, clientSecret: env.SLACK_CLIENT_SECRET, redirectUri: env.SLACK_REDIRECT_URI };
}

/**
 * The user's identity rides in a signed, 10-minute `state` value (also the OAuth CSRF
 * token), so the callback works even if it lands on a different host than the login
 * cookie was set for (e.g. an HTTPS tunnel).
 */
export function buildSlackInstallUrl(userId: string): string {
  const { clientId, redirectUri } = slackConfig();
  const state = jwt.sign({ sub: userId, purpose: STATE_PURPOSE }, env.JWT_SECRET, { expiresIn: '10m' });
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.search = new URLSearchParams({ client_id: clientId, scope: 'incoming-webhook', redirect_uri: redirectUri, state }).toString();
  return url.toString();
}

function userIdFromState(state: string): string {
  try {
    const payload = jwt.verify(state, env.JWT_SECRET);
    if (typeof payload !== 'string' && payload.purpose === STATE_PURPOSE && payload.sub) return payload.sub;
  } catch {
    // fall through
  }
  throw new HttpError(400, 'Slack connection expired, please try again');
}

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  team?: { id: string; name: string };
  incoming_webhook?: { url: string; channel: string; channel_id: string };
}

/** Exchanges the OAuth code and stores (or replaces) the user's Slack connection. */
export async function completeSlackInstall(code: string, state: string) {
  const userId = userIdFromState(state);
  const { clientId, clientSecret, redirectUri } = slackConfig();

  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }),
    signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
  });
  const data = (await res.json()) as SlackOAuthResponse;
  if (!data.ok || !data.incoming_webhook || !data.team) {
    throw new HttpError(502, `Slack OAuth failed: ${data.error ?? 'missing webhook'}`);
  }

  const fields = {
    teamId: data.team.id,
    teamName: data.team.name,
    channel: data.incoming_webhook.channel,
    webhookUrl: data.incoming_webhook.url,
    accessToken: data.access_token ?? null,
  };
  const integration = await prisma.slackIntegration.upsert({
    where: { userId },
    update: fields,
    create: { userId, ...fields },
  });

  await postToSlack(userId, integration.webhookUrl, {
    text: `✅ MailPilot is connected. Rate-limit alerts will be posted to ${integration.channel}.`,
  });
  return integration;
}

export async function disconnectSlack(userId: string): Promise<void> {
  const integration = await prisma.slackIntegration.findUnique({ where: { userId } });
  if (!integration) return;
  await prisma.slackIntegration.delete({ where: { userId } });
  if (integration.accessToken) {
    // Best effort: also uninstall on Slack's side so the webhook stops working.
    await fetch('https://slack.com/api/auth.revoke', {
      method: 'POST',
      headers: { Authorization: `Bearer ${integration.accessToken}` },
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    }).catch((err) => logger.warn({ err }, 'slack token revoke failed'));
  }
}

type SlackMessage = { text: string; blocks?: unknown[] };

/**
 * Posts to a user's webhook. If Slack says the webhook is gone (app removed or channel
 * deleted on Slack's side), the stale connection is dropped so the UI shows "disconnected".
 */
async function postToSlack(userId: string, webhookUrl: string, message: SlackMessage): Promise<boolean> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
  });
  if (res.ok) return true;

  const body = await res.text().catch(() => '');
  logger.warn({ status: res.status, body }, 'slack webhook rejected message');
  if ([403, 404, 410].includes(res.status)) {
    await prisma.slackIntegration.deleteMany({ where: { userId, webhookUrl } });
  }
  return false;
}

/** Sends to the user's Slack if connected. Returns false (never throws) when not connected. */
export async function notifyUserOnSlack(userId: string, message: SlackMessage): Promise<boolean> {
  const integration = await prisma.slackIntegration.findUnique({ where: { userId }, select: { webhookUrl: true } });
  if (!integration) return false;
  return postToSlack(userId, integration.webhookUrl, message);
}
