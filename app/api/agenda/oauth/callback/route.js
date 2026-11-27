import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { OAUTH_COOKIE, adminUrl } from '@/lib/agenda/admin'
import { ADMIN_DOMAIN, checkLoginIdentity, makeState, readState, statePurpose } from '@/lib/agenda/auth'
import { adminConfigured, bookingConfigured, env, oauthConfigured } from '@/lib/agenda/config'
import { encrypt } from '@/lib/agenda/crypto'
import { db, isMissingSchema, liveOnly, withArchive } from '@/lib/agenda/db'
import { SCOPES, buildLoginUrl, exchangeCode, fetchUserInfo, forgetAccessToken, revokeToken } from '@/lib/agenda/google'
import { hasCalendarScopes, planLoginStaff } from '@/lib/agenda/onboard'
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

  let claims, tokens
  try {
    tokens = await exchangeCode(code)
    // The short-lived access token is used once and discarded. It is NOT revoked: Google revokes the whole
    // grant for this client, which would also disconnect the admin's own calendar if they are staff.
    claims = await fetchUserInfo(tokens.accessToken)
  } catch (e) {
    console.error('[agenda] admin login exchange failed', e.code || e.message)
    return loginDone(request, 'error')
  }
  const id = checkLoginIdentity(claims)
  if (!id.ok || !(await isAllowedEmail(id.email))) return loginDone(request, 'denied')

  // Sign-in also connects the calendar. A failure here never blocks the login: the panel then shows
  // the "Conecta tu Google Calendar" banner and the explicit connect flow.
  const plan = await syncStaffOnLogin(id.email, claims.name, tokens)
  const session = newSessionToken(id.email, claims.name)

  // Calendar granted but Google sent no refresh token (prompt=select_account on an existing grant) and none
  // is stored: ask once more with prompt=consent, which always returns one.
  if (plan?.needsConsent && !state.c) {
    const nonce = randomBytes(16).toString('base64url')
    const res = NextResponse.redirect(buildLoginUrl({
      state: makeState('login', { n: nonce, c: 1 }, env.sessionSecret), domain: ADMIN_DOMAIN, prompt: 'consent', loginHint: id.email,
    }))
    res.headers.set('Cache-Control', 'no-store')
    res.cookies.set(OAUTH_COOKIE, nonce, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/agenda/oauth', maxAge: 600,
    })
    res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions())
    return res
  }

  const res = loginDone(request, '')
  res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions())
  return res
}

/** Upserts the signed-in person's staff row (see planLoginStaff). → the plan, or null when it failed. */
async function syncStaffOnLogin(email, name, tokens) {
  if (!bookingConfigured()) return null
  try {
    // An archived person keeps their archived row: planLoginStaff writes nothing and never creates a new one.
    const { data: existing, error } = await withArchive((a) => db().from('agenda_staff')
      .select('id,refresh_token_enc' + (a ? ',archived_at' : '')).eq('email', email).maybeSingle())
    if (error) throw error
    let maxPriority = 0
    if (!existing) {
      const { data: last, error: maxErr } = await db().from('agenda_staff').select('priority').order('priority', { ascending: false }).limit(1).maybeSingle()
      if (!maxErr) maxPriority = last?.priority
    }
    const canStore = oauthConfigured() && tokens.refreshToken && hasCalendarScopes(tokens.scope)
    const tokenEnc = canStore ? encrypt(tokens.refreshToken, env.encryptionKey) : ''
    const plan = planLoginStaff({ existing, email, name, scope: oauthConfigured() ? tokens.scope : '', tokenEnc, maxPriority })
    if (plan.action === 'update') {
      const { error: upErr } = await db().from('agenda_staff').update(plan.row).eq('id', existing.id)
      if (upErr) throw upErr
      forgetAccessToken(existing.id)
      invalidateAvailability()
    } else if (plan.action === 'insert') {
      let { error: insErr } = await db().from('agenda_staff').insert(plan.row)
      if (insErr && isMissingSchema(insErr)) {
        const { priority: _p, ...legacy } = plan.row // supabase/agenda_002.sql not run yet
        ;({ error: insErr } = await db().from('agenda_staff').insert(legacy))
      }
      if (insErr && insErr.code !== '23505') throw insErr // 23505: created concurrently, keep that row
    }
    return plan
  } catch (e) {
    console.error('[agenda] login staff sync failed', e.code || e.message)
    return null
  }
}

async function connect(request, q) {
  if (!(await isAdmin())) return done(request, 'login')
  if (!oauthConfigured()) return done(request, 'not_configured')
  if (q.get('error')) return done(request, 'denied')

  const state = readState(q.get('state'), env.sessionSecret, 'connect')
  if (!checkNonce(request, state)) return done(request, 'state')
  const code = q.get('code')
  if (!code || code.length > 2048) return done(request, 'error')

  const { data: staff, error } = await withArchive((a) => liveOnly(db().from('agenda_staff').select('id,email').eq('id', state.sid), a).maybeSingle())
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
