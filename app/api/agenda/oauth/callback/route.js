import { NextResponse } from 'next/server'
import { OAUTH_COOKIE, adminUrl } from '@/lib/agenda/admin'
import { adminConfigured, env, oauthConfigured } from '@/lib/agenda/config'
import { encrypt } from '@/lib/agenda/crypto'
import { db } from '@/lib/agenda/db'
import { SCOPES, exchangeCode, forgetAccessToken, revokeToken } from '@/lib/agenda/google'
import { isAdmin } from '@/lib/agenda/session'
import { safeEqual, verifyToken } from '@/lib/agenda/sign'
import { invalidateAvailability } from '@/lib/agenda/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function done(request, status) {
  const res = NextResponse.redirect(adminUrl(request, { oauth: status }))
  res.headers.set('Cache-Control', 'no-store')
  res.cookies.set(OAUTH_COOKIE, '', { httpOnly: true, path: '/api/agenda/oauth', maxAge: 0 })
  return res
}

/** GET /api/agenda/oauth/callback?code&state — stores the staff member's encrypted refresh token. */
export async function GET(request) {
  if (!adminConfigured() || !isAdmin()) return done(request, 'login')
  if (!oauthConfigured()) return done(request, 'not_configured')
  const q = new URL(request.url).searchParams
  if (q.get('error')) return done(request, 'denied')

  const state = verifyToken(q.get('state'), env.sessionSecret)
  const nonce = request.cookies.get(OAUTH_COOKIE)?.value
  if (!state || !nonce || !safeEqual(state.n, nonce)) return done(request, 'state')
  const code = q.get('code')
  if (!code || code.length > 2048) return done(request, 'error')

  const { data: staff, error } = await db().from('agenda_staff').select('id,email').eq('id', state.sid).maybeSingle()
  if (error || !staff) return done(request, 'error')

  let tokens
  try { tokens = await exchangeCode(code) } catch (e) {
    console.error('[agenda] code exchange failed', e.code || e.message)
    return done(request, 'error')
  }
  const revoke = () => revokeToken(tokens.refreshToken || tokens.accessToken).catch(() => {})
  // The Google account that consented must be the staff member's own account.
  if (!tokens.emailVerified || tokens.email !== staff.email.toLowerCase()) { await revoke(); return done(request, 'email_mismatch') }
  // Google lets people untick individual scopes; both calendar scopes are required.
  const granted = tokens.scope.split(' ')
  if (!SCOPES.filter((s) => s.startsWith('https://')).every((s) => granted.includes(s))) { await revoke(); return done(request, 'scopes') }
  if (!tokens.refreshToken) return done(request, 'no_refresh_token')

  const { error: upErr } = await db().from('agenda_staff')
    .update({ refresh_token_enc: encrypt(tokens.refreshToken, env.encryptionKey), connected_at: new Date().toISOString() })
    .eq('id', staff.id)
  if (upErr) { console.error('[agenda] token store failed', upErr.code); return done(request, 'error') }
  forgetAccessToken(staff.id)
  invalidateAvailability()
  return done(request, 'ok')
}
