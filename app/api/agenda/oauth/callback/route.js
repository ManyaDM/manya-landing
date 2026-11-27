import { NextResponse } from 'next/server'
import { OAUTH_COOKIE, adminUrl } from '@/lib/agenda/admin'
import { checkLoginIdentity, readState, statePurpose } from '@/lib/agenda/auth'
import { adminConfigured, env, oauthConfigured } from '@/lib/agenda/config'
import { encrypt } from '@/lib/agenda/crypto'
import { db } from '@/lib/agenda/db'
import { SCOPES, exchangeCode, fetchUserInfo, forgetAccessToken, revokeToken } from '@/lib/agenda/google'
import { SESSION_COOKIE, isAdmin, isAllowedEmail, newSessionToken, sessionCookieOptions } from '@/lib/agenda/session'
import { safeEqual } from '@/lib/agenda/sign'
import { invalidateAvailability } from '@/lib/agenda/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function redirect(request, params) {
  const res = NextResponse.redirect(adminUrl(request, params))
  res.headers.set('Cache-Control', 'no-store')
  res.cookies.set(OAUTH_COOKIE, '', { httpOnly: true, path: '/api/agenda/oauth', maxAge: 0 })
  return res
}
const done = (request, status) => redirect(request, { oauth: status })
const loginDone = (request, status) => redirect(request, status ? { login: status } : {})

/**
 * GET /api/agenda/oauth/callback?code&state — one redirect URI for two flows, told apart by the signed
 * state's purpose: 'login' (admin sign-in) or 'connect' (store a staff member's calendar refresh token).
 */
export async function GET(request) {
  if (!adminConfigured()) return loginDone(request, 'error')
  const q = new URL(request.url).searchParams
  const purpose = statePurpose(q.get('state'), env.sessionSecret)
  if (purpose === 'login') return login(request, q)
  if (purpose === 'connect') return connect(request, q)
  return q.get('error') ? loginDone(request, 'cancelled') : loginDone(request, 'state')
}

function checkNonce(request, state) {
  const nonce = request.cookies.get(OAUTH_COOKIE)?.value
  return Boolean(state && nonce && safeEqual(state.n, nonce))
}

async function login(request, q) {
  if (q.get('error')) return loginDone(request, 'cancelled')
  const state = readState(q.get('state'), env.sessionSecret, 'login')
  if (!checkNonce(request, state)) return loginDone(request, 'state')
  const code = q.get('code')
  if (!code || code.length > 2048) return loginDone(request, 'error')

  let claims
  try {
    const tokens = await exchangeCode(code)
    // The short-lived access token is used once and discarded. It is NOT revoked: Google revokes the whole
    // grant for this client, which would also disconnect the admin's own calendar if they are staff.
    claims = await fetchUserInfo(tokens.accessToken)
  } catch (e) {
    console.error('[agenda] admin login exchange failed', e.code || e.message)
    return loginDone(request, 'error')
  }
  const id = checkLoginIdentity(claims)
  if (!id.ok || !(await isAllowedEmail(id.email))) return loginDone(request, 'denied')

  const res = loginDone(request, '')
  res.cookies.set(SESSION_COOKIE, newSessionToken(id.email), sessionCookieOptions())
  return res
}

async function connect(request, q) {
  if (!(await isAdmin())) return done(request, 'login')
  if (!oauthConfigured()) return done(request, 'not_configured')
  if (q.get('error')) return done(request, 'denied')

  const state = readState(q.get('state'), env.sessionSecret, 'connect')
  if (!checkNonce(request, state)) return done(request, 'state')
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
