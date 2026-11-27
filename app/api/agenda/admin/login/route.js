import { adminConfigured } from '@/lib/agenda/config'
import { json, readJson, sameOrigin } from '@/lib/agenda/http'
import { clientIp, createRateLimiter } from '@/lib/agenda/ratelimit'
import { SESSION_COOKIE, newSessionToken, passwordMatches, sessionCookieOptions } from '@/lib/agenda/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const limiter = createRateLimiter({ windowMs: 15 * 60_000, max: 8 })

export async function POST(request) {
  if (!adminConfigured()) return json({ error: 'not_configured' }, 503)
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403)
  const rl = limiter.check(clientIp(request))
  if (!rl.ok) return json({ error: 'rate_limited' }, 429, { 'Retry-After': String(rl.retryAfter) })
  const body = await readJson(request, 2048)
  if (!body || !passwordMatches(body.password)) return json({ error: 'invalid_password' }, 401)
  const res = json({ ok: true })
  res.cookies.set(SESSION_COOKIE, newSessionToken(), sessionCookieOptions())
  return res
}
