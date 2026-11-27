import 'server-only'
import { cookies } from 'next/headers'
import { env, adminConfigured, bookingConfigured } from './config'
import { isDomainEmail, parseEmailList } from './auth'
import { db, isMissingSchema } from './db'
import { signToken, verifyToken } from './sign'

export const SESSION_COOKIE = 'agenda_admin'
const SESSION_TTL = 12 * 60 * 60 // 12 h
const LIST_CACHE_MS = 30000

export function sessionCookieOptions(maxAge = SESSION_TTL) {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge }
}

/** `name` (Google profile display name, optional) is only used to prefill "connect my calendar". */
export function newSessionToken(email, name = '') {
  const payload = { role: 'admin', email: String(email).toLowerCase() }
  const n = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, 80) : ''
  if (n) payload.name = n
  return signToken(payload, env.sessionSecret, SESSION_TTL)
}

/** Emails from AGENDA_ADMIN_EMAILS: always allowed, shown as fixed in the panel. */
export const bootstrapAdmins = () => parseEmailList(env.adminEmails)

// ---- allowlist (agenda_admins), cached briefly so every admin request does not hit the DB
let listCache = null

export function invalidateAdminList() { listCache = null }

/** → { emails: Set, missing } — missing = supabase/agenda_004.sql not run yet (env bootstrap only). */
export async function listedAdmins() {
  if (listCache && listCache.at + LIST_CACHE_MS > Date.now()) return listCache.value
  if (!bookingConfigured()) return { emails: new Set(), missing: false }
  const { data, error } = await db().from('agenda_admins').select('email')
  if (error) {
    const missing = isMissingSchema(error)
    if (!missing) console.error('[agenda] admins query failed', error.code)
    return { emails: new Set(), missing } // not cached: the next request retries
  }
  const value = { emails: new Set((data || []).map((r) => String(r.email).toLowerCase())), missing: false }
  listCache = { at: Date.now(), value }
  return value
}

/** True when `email` may use the admin panel right now (domain + bootstrap or allowlist). */
export async function isAllowedEmail(email) {
  const e = String(email || '').toLowerCase()
  if (!isDomainEmail(e)) return false
  if (bootstrapAdmins().has(e)) return true
  return (await listedAdmins()).emails.has(e)
}

/**
 * Email of the signed-in admin, or null. Checks the signed cookie and that the email is still
 * allowed (removing someone in Accesos ends their session within LIST_CACHE_MS).
 */
export async function currentAdmin() {
  return (await currentSession())?.email || null
}

/** { email, name } of the signed-in admin (name may be '' for sessions created before it was stored), or null. */
export async function currentSession() {
  if (!adminConfigured()) return null
  const payload = verifyToken(cookies().get(SESSION_COOKIE)?.value, env.sessionSecret)
  if (!payload || payload.role !== 'admin' || typeof payload.email !== 'string') return null
  if (!(await isAllowedEmail(payload.email))) return null
  return { email: payload.email.toLowerCase(), name: typeof payload.name === 'string' ? payload.name : '' }
}

export async function isAdmin() {
  return Boolean(await currentAdmin())
}
