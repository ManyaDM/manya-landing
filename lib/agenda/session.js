import 'server-only'
import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { env, adminConfigured } from './config'
import { safeEqual, signToken, verifyToken } from './sign'

export const SESSION_COOKIE = 'agenda_admin'
const SESSION_TTL = 12 * 60 * 60 // 12 h

const digest = (v) => createHash('sha256').update(String(v)).digest('hex')

/** Constant-time password check (hashing first equalizes lengths). */
export function passwordMatches(input) {
  if (!adminConfigured() || typeof input !== 'string' || input.length > 256) return false
  return safeEqual(digest(input), digest(env.adminPassword))
}

export function sessionCookieOptions(maxAge = SESSION_TTL) {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge }
}

export function newSessionToken() {
  return signToken({ role: 'admin' }, env.sessionSecret, SESSION_TTL)
}

/** True when the request carries a valid admin session cookie. */
export function isAdmin() {
  if (!adminConfigured()) return false
  const token = cookies().get(SESSION_COOKIE)?.value
  const payload = verifyToken(token, env.sessionSecret)
  return Boolean(payload && payload.role === 'admin')
}
