import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Router, type CookieOptions, type Response } from 'express';
import { env, isProd } from '../config/env';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from '../lib/jwt';
import { logger } from '../lib/logger';
import { currentUserId, requireAuth } from '../middleware/auth';
import { buildGoogleAuthUrl, getUserProfile, loginWithGoogleCode } from '../services/authService';

export const authRouter = Router();

const STATE_COOKIE = 'rb_oauth_state';

const cookieBase: CookieOptions = { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/' };

const safeEqual = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

const redirectToLogin = (res: Response, error: string) =>
  res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);

authRouter.get('/google', (_req, res) => {
  // CSRF protection for the OAuth round-trip
  const state = randomBytes(24).toString('hex');
  res.cookie(STATE_COOKIE, state, { ...cookieBase, maxAge: 10 * 60 * 1000 });
  res.redirect(buildGoogleAuthUrl(state));
});

authRouter.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  const expectedState = req.cookies?.[STATE_COOKIE] as string | undefined;
  res.clearCookie(STATE_COOKIE, cookieBase);

  if (error) return redirectToLogin(res, error === 'access_denied' ? 'Login was cancelled' : error);
  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    return redirectToLogin(res, 'Login session expired, please try again');
  }

  try {
    const user = await loginWithGoogleCode(code);
    res.cookie(SESSION_COOKIE, signSession({ sub: user.id, email: user.email }), {
      ...cookieBase,
      maxAge: SESSION_TTL_SECONDS * 1000,
    });
    logger.info({ userId: user.id }, 'user logged in');
    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (err) {
    logger.error({ err }, 'google login failed');
    redirectToLogin(res, 'Google login failed');
  }
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json(await getUserProfile(currentUserId(req)));
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, cookieBase);
  res.status(204).end();
});
