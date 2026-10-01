import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { HttpError } from '../lib/httpError';
import { prisma } from '../lib/prisma';

const SCOPES = ['openid', 'email', 'profile'];

function googleClient() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_CALLBACK_URL) {
    throw new HttpError(503, 'Google login is not configured');
  }
  return new OAuth2Client({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_CALLBACK_URL,
  });
}

export function buildGoogleAuthUrl(state: string): string {
  return googleClient().generateAuthUrl({
    scope: SCOPES,
    state,
    prompt: 'select_account',
    access_type: 'online',
  });
}

/** Exchanges the OAuth code, verifies the ID token and upserts the user. */
export async function loginWithGoogleCode(code: string) {
  const client = googleClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) throw new HttpError(401, 'Google did not return an ID token');

  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.GOOGLE_CLIENT_ID });
  const profile = ticket.getPayload();
  if (!profile?.sub || !profile.email) throw new HttpError(401, 'Google profile is missing an email');
  if (!profile.email_verified) throw new HttpError(403, 'Google email is not verified');

  const data = {
    email: profile.email.toLowerCase(),
    name: profile.name ?? profile.email.split('@')[0],
    avatarUrl: profile.picture ?? null,
  };
  return prisma.user.upsert({
    where: { googleId: profile.sub },
    update: data,
    create: { googleId: profile.sub, ...data },
  });
}

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, avatarUrl: true, slack: { select: { teamName: true, channel: true } } },
  });
  if (!user) throw new HttpError(401, 'Not authenticated');
  const { slack, ...profile } = user;
  return { ...profile, slack: slack ? { connected: true, ...slack } : { connected: false } };
}
