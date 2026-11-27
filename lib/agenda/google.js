import 'server-only'
import { env } from './config'
import { decrypt } from './crypto'
import { toRanges } from './slots'

// Plain fetch against Google's REST endpoints (no googleapis dependency).
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const CAL = 'https://www.googleapis.com/calendar/v3'
export const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.events.freebusy',
]
const TIMEOUT = 10000

export class GoogleError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status }
}

async function call(url, init = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), cache: 'no-store' })
  let data = null
  try { data = await res.json() } catch { /* empty body */ }
  if (!res.ok) {
    // Only Google's error code is surfaced; tokens and bodies are never logged.
    const code = (data && (data.error?.status || data.error?.message || data.error)) || 'http_' + res.status
    throw new GoogleError(String(code).slice(0, 120), res.status)
  }
  return data
}

export function buildAuthUrl({ state, loginHint }) {
  const u = new URL(AUTH_URL)
  u.searchParams.set('client_id', env.googleClientId)
  u.searchParams.set('redirect_uri', env.googleRedirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', SCOPES.join(' '))
  u.searchParams.set('access_type', 'offline')
  u.searchParams.set('prompt', 'consent')
  u.searchParams.set('include_granted_scopes', 'true')
  u.searchParams.set('state', state)
  if (loginHint) u.searchParams.set('login_hint', loginHint)
  return u.toString()
}

/** Exchanges an authorization code. Returns { refreshToken, accessToken, expiresIn, email, emailVerified, scope }. */
export async function exchangeCode(code) {
  const data = await call(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: env.googleRedirectUri,
      grant_type: 'authorization_code',
    }),
  })
  // The id_token comes straight from Google's token endpoint over TLS, so decoding its claims is sufficient here.
  let claims = {}
  try { claims = JSON.parse(Buffer.from(String(data.id_token).split('.')[1], 'base64url').toString('utf8')) } catch { /* no id_token */ }
  return {
    refreshToken: data.refresh_token || '',
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    scope: data.scope || '',
    email: String(claims.email || '').toLowerCase(),
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
  }
}

export async function revokeToken(token) {
  await call(REVOKE_URL + '?token=' + encodeURIComponent(token), {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
}

// ---- access tokens (in-memory cache per staff member)
const tokenCache = new Map() // staffId → { token, exp, src }

export function forgetAccessToken(staffId) { tokenCache.delete(staffId) }

export async function accessTokenFor(staff) {
  const hit = tokenCache.get(staff.id)
  // `src` ties the cache entry to the stored refresh token, so a reconnect invalidates it.
  if (hit && hit.src === staff.refresh_token_enc && hit.exp - 60000 > Date.now()) return hit.token
  if (!staff.refresh_token_enc) throw new GoogleError('not_connected', 0)
  const refreshToken = decrypt(staff.refresh_token_enc, env.encryptionKey)
  const data = await call(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  tokenCache.set(staff.id, { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000, src: staff.refresh_token_enc })
  return data.access_token
}

async function freeBusyQuery(token, ids, timeMin, timeMax) {
  const data = await call(CAL + '/freeBusy', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin, timeMax, items: ids.map((id) => ({ id })) }),
  })
  return data.calendars || {}
}

/**
 * Busy ranges for many staff members.
 * First tries ONE freeBusy request (with any connected member's token) for every calendar; inside a
 * Workspace domain free/busy is normally visible to colleagues. Calendars that come back with errors
 * (sharing disabled) are re-queried individually with their owner's token.
 * @returns Map staffId → [[startMs, endMs]] (staff whose calendar could not be read are absent)
 */
export async function busyForStaff(staffList, timeMin, timeMax) {
  const result = new Map()
  const pending = new Map(staffList.map((s) => [s.id, s]))
  if (!pending.size) return result

  let token = null
  for (const s of staffList) {
    try { token = await accessTokenFor(s); break } catch (e) {
      console.error('[agenda] access token failed for staff', s.id, e.code || e.message)
      pending.delete(s.id)
    }
  }
  if (token && pending.size) {
    const list = [...pending.values()]
    for (let i = 0; i < list.length; i += 50) {
      const chunk = list.slice(i, i + 50)
      try {
        const cals = await freeBusyQuery(token, chunk.map((s) => s.email), timeMin, timeMax)
        for (const s of chunk) {
          const cal = cals[s.email] || cals[s.email.toLowerCase()]
          if (cal && !(cal.errors && cal.errors.length)) { result.set(s.id, toRanges(cal.busy)); pending.delete(s.id) }
        }
      } catch (e) {
        console.error('[agenda] batch freeBusy failed', e.code || e.message)
      }
    }
  }
  await Promise.all([...pending.values()].map(async (s) => {
    try {
      const own = await accessTokenFor(s)
      const cals = await freeBusyQuery(own, ['primary'], timeMin, timeMax)
      const cal = cals.primary
      if (cal && !(cal.errors && cal.errors.length)) result.set(s.id, toRanges(cal.busy))
    } catch (e) {
      console.error('[agenda] freeBusy failed for staff', s.id, e.code || e.message)
    }
  }))
  return result
}

/** Creates an event with a Google Meet link and emails the invitation to attendees. */
export async function createEvent(token, event) {
  const ev = await call(CAL + '/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  })
  const meet = ev.hangoutLink || ev.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri || ''
  return { id: ev.id, htmlLink: ev.htmlLink || '', meetLink: meet }
}
