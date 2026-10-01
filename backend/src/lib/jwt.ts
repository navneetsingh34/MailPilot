import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface SessionPayload {
  sub: string;
  email: string;
}

export const SESSION_COOKIE = 'rb_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string' || !decoded.sub) return null;
    return { sub: decoded.sub, email: String(decoded.email) };
  } catch {
    return null;
  }
}
