import { json, sameOrigin } from '@/lib/agenda/http'
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/agenda/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403)
  const res = json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0))
  return res
}
