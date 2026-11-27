import 'server-only'
import { adminConfigured, bookingConfigured, env } from './config'
import { json, sameOrigin } from './http'
import { POLICIES } from './assign'
import { isAdmin } from './session'
import { isValidTimeZone, normalizeWeeklyHours } from './slots'
import { isEmail } from './validation'

export const OAUTH_COOKIE = 'agenda_oauth'
export const UUID_RE =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Returns an error response when the request may not use the admin API, otherwise null. */
export function guardAdmin(request, { mutating = false, needsDb = true } = {}) {
  if (!adminConfigured()) return json({ error: 'not_configured' }, 503)
  if (mutating && !sameOrigin(request)) return json({ error: 'forbidden' }, 403)
  if (!isAdmin()) return json({ error: 'unauthorized' }, 401)
  if (needsDb && !bookingConfigured()) return json({ error: 'not_configured' }, 503)
  return null
}

/** Absolute URL of the admin page on the canonical host (Railway's internal host is not public). */
export function adminUrl(request, params = {}) {
  const base = env.googleRedirectUri ? new URL(env.googleRedirectUri).origin : new URL(request.url).origin
  const u = new URL('/agenda-admin', base)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  return u
}

const NUMERIC = {
  meeting_minutes: [5, 240],
  slot_step_minutes: [5, 240],
  min_notice_hours: [0, 720],
  days_ahead: [1, 60],
  buffer_minutes: [0, 240],
}

export function validateNewStaff(body) {
  const name = typeof body?.name === 'string' ? body.name.replace(/\s+/g, ' ').trim().slice(0, 80) : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const errors = []
  if (name.length < 2) errors.push('name')
  if (!isEmail(email)) errors.push('email')
  return errors.length ? { ok: false, errors } : { ok: true, value: { name, email } }
}

/** Whitelisted, validated update for a staff row. */
export function validateStaffPatch(body) {
  const value = {}
  const errors = []
  if (!body || typeof body !== 'object') return { ok: false, errors: ['body'] }
  if ('name' in body) {
    const n = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim().slice(0, 80) : ''
    n.length >= 2 ? (value.name = n) : errors.push('name')
  }
  if ('active' in body) typeof body.active === 'boolean' ? (value.active = body.active) : errors.push('active')
  if ('timezone' in body) isValidTimeZone(body.timezone) ? (value.timezone = body.timezone) : errors.push('timezone')
  if ('weekly_hours' in body) {
    const wh = normalizeWeeklyHours(body.weekly_hours)
    wh ? (value.weekly_hours = wh) : errors.push('weekly_hours')
  }
  for (const [k, [min, max]] of Object.entries(NUMERIC)) {
    if (!(k in body)) continue
    const n = Number(body[k])
    Number.isInteger(n) && n >= min && n <= max ? (value[k] = n) : errors.push(k)
  }
  if (!errors.length && !Object.keys(value).length) errors.push('empty')
  return errors.length ? { ok: false, errors } : { ok: true, value }
}

/** Staff row as the admin UI sees it (never the token). */
export function presentStaff(row) {
  const { refresh_token_enc: _t, ...rest } = row
  return { ...rest, connected: Boolean(row.connected_at) }
}

export function validatePolicy(body) {
  return body && POLICIES.includes(body.policy) ? { ok: true, value: { policy: body.policy } } : { ok: false, errors: ['policy'] }
}

/** Full priority order: a list of distinct staff UUIDs (first = highest priority). */
export function validateOrder(body) {
  const ids = Array.isArray(body?.ids) ? body.ids : null
  if (!ids || !ids.length || ids.length > 200 || !ids.every((id) => typeof id === 'string' && UUID_RE.test(id)) || new Set(ids).size !== ids.length) {
    return { ok: false, errors: ['ids'] }
  }
  return { ok: true, value: ids.map((id) => id.toLowerCase()) }
}
