import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { Prisma } from '../generated/prisma/client';
import { HttpError } from '../lib/httpError';
import { hashPassword, verifyPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import type { LoginInput, SignupInput } from '../schemas/auth';

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

/** Exchanges the OAuth code, verifies the ID token and finds, links or creates the user. */
export async function loginWithGoogleCode(code: string) {
  const client = googleClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) throw new HttpError(401, 'Google did not return an ID token');

  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.GOOGLE_CLIENT_ID });
  const profile = ticket.getPayload();
  if (!profile?.sub || !profile.email) throw new HttpError(401, 'Google profile is missing an email');
  if (!profile.email_verified) throw new HttpError(403, 'Google email is not verified');

  const email = profile.email.toLowerCase();
  const data = { name: profile.name ?? email.split('@')[0], avatarUrl: profile.picture ?? null };

  const byGoogleId = await prisma.user.findUnique({ where: { googleId: profile.sub } });
  if (byGoogleId) return prisma.user.update({ where: { id: byGoogleId.id }, data: { ...data, email } });

  // An email/password account with the same address: Google has just proved the user owns that
  // inbox, which signup never did. Drop the password so whoever registered the address before
  // its owner can't keep a way in; the owner logs in with Google from now on.
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    return prisma.user.update({
      where: { id: byEmail.id },
      data: { googleId: profile.sub, passwordHash: null, avatarUrl: byEmail.avatarUrl ?? data.avatarUrl },
    });
  }

  return prisma.user.create({ data: { googleId: profile.sub, email, ...data } });
}

const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_SECONDS = 15 * 60;

/** Caps failed password attempts per email and per IP so passwords can't be brute-forced. */
async function assertNotThrottled(keys: string[]) {
  const counts = await redis.mget(keys);
  if (counts.some((c) => Number(c) >= LOGIN_MAX_ATTEMPTS)) {
    throw new HttpError(429, 'Too many failed attempts, try again in 15 minutes');
  }
}

async function recordFailure(keys: string[]) {
  const tx = redis.multi();
  for (const key of keys) tx.incr(key).expire(key, LOGIN_WINDOW_SECONDS, 'NX');
  await tx.exec();
}

export async function signupWithPassword({ name, email, password }: SignupInput) {
  const existing = await prisma.user.findUnique({ where: { email }, select: { googleId: true } });
  if (existing) {
    throw new HttpError(
      409,
      existing.googleId ? 'This email uses Google login, continue with Google' : 'An account with this email already exists',
    );
  }
  const passwordHash = await hashPassword(password);
  try {
    return await prisma.user.create({ data: { name, email, passwordHash } });
  } catch (err) {
    // Lost a race with a concurrent signup for the same email
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'An account with this email already exists');
    }
    throw err;
  }
}

export async function loginWithPassword({ email, password }: LoginInput, ip: string) {
  const keys = [`login:fail:email:${email}`, `login:fail:ip:${ip}`];
  await assertNotThrottled(keys);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.passwordHash) {
    throw new HttpError(401, 'This account uses Google login, continue with Google');
  }
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    await recordFailure(keys);
    throw new HttpError(401, 'Invalid email or password');
  }
  await redis.del(keys[0]);
  return user;
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
