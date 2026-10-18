import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Router, type CookieOptions, type Response } from 'express';
import { env, isProd } from '../config/env';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from '../lib/jwt';
import { logger } from '../lib/logger';
import { currentUserId, requireAuth } from '../middleware/auth';
import { tokenBucket } from '../middleware/rateLimit';
import { loginSchema, signupSchema } from '../schemas/auth';
import {
  buildGoogleAuthUrl,
  getUserProfile,
  loginWithGoogleCode,
  loginWithPassword,
  signupWithPassword,
} from '../services/authService';

export const authRouter = Router();

const STATE_COOKIE = 'rb_oauth_state';

const cookieBase: CookieOptions = { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/' };

const safeEqual = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

const startSession = (res: Response, user: { id: string; email: string }) =>
  res.cookie(SESSION_COOKIE, signSession({ sub: user.id, email: user.email }), {
    ...cookieBase,
    maxAge: SESSION_TTL_SECONDS * 1000,
  });

// One per-IP bucket shared by login, signup and Google OAuth, on top of the per-account
// failed-login lockout in authService
const authLimit = tokenBucket({ name: 'auth', perMinute: 30 });

const redirectToLogin = (res: Response, error: string) =>
  res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);

authRouter.get('/google', authLimit, (_req, res) => {
  // CSRF protection for the OAuth round-trip
  const state = randomBytes(24).toString('hex');
  res.cookie(STATE_COOKIE, state, { ...cookieBase, maxAge: 10 * 60 * 1000 });
  res.redirect(buildGoogleAuthUrl(state));
});

authRouter.get('/google/callback', authLimit, async (req, res) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  const expectedState = req.cookies?.[STATE_COOKIE] as string | undefined;
  res.clearCookie(STATE_COOKIE, cookieBase);

  if (error) return redirectToLogin(res, error === 'access_denied' ? 'Login was cancelled' : error);
  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    return redirectToLogin(res, 'Login session expired, please try again');
  }

  try {
    const user = await loginWithGoogleCode(code);
    startSession(res, user);
    logger.info({ userId: user.id }, 'user logged in with google');
    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (err) {
    logger.error({ err }, 'google login failed');
    redirectToLogin(res, 'Google login failed');
  }
});

authRouter.post('/signup', authLimit, async (req, res) => {
  const user = await signupWithPassword(signupSchema.parse(req.body));
  startSession(res, user);
  logger.info({ userId: user.id }, 'user signed up');
  res.status(201).json(await getUserProfile(user.id));
});

authRouter.post('/login', authLimit, async (req, res) => {
  const user = await loginWithPassword(loginSchema.parse(req.body), req.ip ?? 'unknown');
  startSession(res, user);
  logger.info({ userId: user.id }, 'user logged in with password');
  res.json(await getUserProfile(user.id));
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json(await getUserProfile(currentUserId(req)));
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, cookieBase);
  res.status(204).end();
});
