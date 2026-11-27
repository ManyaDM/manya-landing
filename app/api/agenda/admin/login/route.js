import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { OAUTH_COOKIE, adminUrl } from '@/lib/agenda/admin'
import { ADMIN_DOMAIN, makeState } from '@/lib/agenda/auth'
import { adminConfigured, env } from '@/lib/agenda/config'
import { buildLoginUrl } from '@/lib/agenda/google'
import { clientIp, createRateLimiter } from '@/lib/agenda/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const limiter = createRateLimiter({ windowMs: 15 * 60_000, max: 20 })

/**
 * GET /api/agenda/admin/login → "Sign in with Google" (openid email, no calendar scopes).
 * Uses the same OAuth client and redirect URI as calendar connections; the signed state carries
 * purpose 'login' so the callback can never confuse it with a calendar connection.
 */
export async function GET(request) {
  if (!adminConfigured()) return NextResponse.redirect(adminUrl(request))
  if (!limiter.check(clientIp(request)).ok) return NextResponse.redirect(adminUrl(request, { login: 'rate_limited' }))
  const nonce = randomBytes(16).toString('base64url')
  const state = makeState('login', { n: nonce }, env.sessionSecret)
  const res = NextResponse.redirect(buildLoginUrl({ state, domain: ADMIN_DOMAIN }))
  res.headers.set('Cache-Control', 'no-store')
  res.cookies.set(OAUTH_COOKIE, nonce, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/agenda/oauth', maxAge: 600,
  })
  return res
}
