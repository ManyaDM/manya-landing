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

export function newSessionToken(email) {
  return signToken({ role: 'admin', email: String(email).toLowerCase() }, env.sessionSecret, SESSION_TTL)
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
  if (!adminConfigured()) return null
  const payload = verifyToken(cookies().get(SESSION_COOKIE)?.value, env.sessionSecret)
  if (!payload || payload.role !== 'admin' || typeof payload.email !== 'string') return null
  return (await isAllowedEmail(payload.email)) ? payload.email.toLowerCase() : null
}

export async function isAdmin() {
  return Boolean(await currentAdmin())
}
