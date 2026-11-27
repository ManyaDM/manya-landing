import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { OAUTH_COOKIE, UUID_RE, adminUrl } from '@/lib/agenda/admin'
import { adminConfigured, env, oauthConfigured } from '@/lib/agenda/config'
import { db } from '@/lib/agenda/db'
import { buildAuthUrl } from '@/lib/agenda/google'
import { isAdmin } from '@/lib/agenda/session'
import { makeState } from '@/lib/agenda/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/agenda/oauth/start?staff=<id> → Google's calendar consent screen (state purpose 'connect'). */
export async function GET(request) {
  if (!adminConfigured() || !(await isAdmin())) return NextResponse.redirect(adminUrl(request))
  if (!oauthConfigured()) return NextResponse.redirect(adminUrl(request, { oauth: 'not_configured' }))
  const staffId = new URL(request.url).searchParams.get('staff') || ''
  if (!UUID_RE.test(staffId)) return NextResponse.redirect(adminUrl(request, { oauth: 'error' }))
  const { data: staff, error } = await db().from('agenda_staff').select('id,email').eq('id', staffId).maybeSingle()
  if (error || !staff) return NextResponse.redirect(adminUrl(request, { oauth: 'error' }))

  // The nonce lives both in the signed state and in an httpOnly cookie; the callback requires both
  // (CSRF / account-swap protection). SameSite=Lax cookies are sent on Google's top-level redirect back.
  const nonce = randomBytes(16).toString('base64url')
  const state = makeState('connect', { sid: staff.id, n: nonce }, env.sessionSecret)
  const res = NextResponse.redirect(buildAuthUrl({ state, loginHint: staff.email }))
  res.headers.set('Cache-Control', 'no-store')
  res.cookies.set(OAUTH_COOKIE, nonce, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/agenda/oauth', maxAge: 600,
  })
  return res
}
