import type { Request, RequestHandler } from 'express';
import { HttpError } from '../lib/httpError';
import { SESSION_COOKIE, verifySession } from '../lib/jwt';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const session = verifySession(req.cookies?.[SESSION_COOKIE] ?? '');
  if (!session) throw new HttpError(401, 'Not authenticated');
  req.user = { id: session.sub, email: session.email };
  next();
};

/** For handlers mounted behind requireAuth. */
export function currentUserId(req: Request): string {
  if (!req.user) throw new HttpError(401, 'Not authenticated');
  return req.user.id;
}
