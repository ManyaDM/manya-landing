// Admin access rules (pure, no I/O): Google sign-in restricted to @manya.pe and to an allowlist
// (AGENDA_ADMIN_EMAILS bootstrap + agenda_admins table), and OAuth state purposes.
import { signToken, verifyToken } from './sign.js'
import { isEmail } from './validation.js'

export const ADMIN_DOMAIN = 'manya.pe'
export const STATE_TTL = 600 // s
export const PURPOSES = ['login', 'connect']

/** True for a syntactically valid address on the admin domain (exact domain, no subdomains). */
export function isDomainEmail(email) {
  const e = String(email || '').trim().toLowerCase()
  return isEmail(e) && e.endsWith('@' + ADMIN_DOMAIN) && e.indexOf('@') === e.length - ADMIN_DOMAIN.length - 1
}

/** AGENDA_ADMIN_EMAILS ("a@manya.pe, b@manya.pe") → Set of lowercase @manya.pe emails (others ignored). */
export function parseEmailList(value) {
  return new Set(String(value || '').split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(isDomainEmail))
}

/** Signed OAuth state bound to one purpose ('login' | 'connect'). */
export function makeState(purpose, data, secret, now = Date.now()) {
  if (!PURPOSES.includes(purpose)) throw new Error('bad_purpose')
  return signToken({ ...data, p: purpose }, secret, STATE_TTL, now)
}

/** Payload of a valid, unexpired state for exactly `purpose`; otherwise null (a connect state never logs in). */
export function readState(token, secret, purpose, now = Date.now()) {
  const payload = verifyToken(token, secret, now)
  return payload && payload.p === purpose ? payload : null
}

/** Purpose of a valid state, or null. */
export function statePurpose(token, secret, now = Date.now()) {
  const payload = verifyToken(token, secret, now)
  return payload && PURPOSES.includes(payload.p) ? payload.p : null
}

/**
 * Checks the identity Google returned for a login (OpenID userinfo claims).
 * Requires a verified email on the admin domain and the matching Workspace `hd` claim
 * (the hd=manya.pe auth parameter is only a hint and can be removed by the user).
 * @returns { ok: true, email } | { ok: false, reason }
 */
export function checkLoginIdentity(claims) {
  const email = String(claims?.email || '').trim().toLowerCase()
  const verified = claims?.email_verified === true || claims?.email_verified === 'true'
  if (!email || !verified) return { ok: false, reason: 'unverified' }
  if (!isDomainEmail(email) || claims?.hd !== ADMIN_DOMAIN) return { ok: false, reason: 'domain' }
  return { ok: true, email }
}

/** Allowed = on the admin domain and in the bootstrap set or in the agenda_admins list. */
export function isAllowedAdmin(email, bootstrap, listed) {
  const e = String(email || '').toLowerCase()
  if (!isDomainEmail(e)) return false
  return Boolean(bootstrap?.has(e) || listed?.has(e))
}

/** Validates an email to add to the allowlist. */
export function validateAdminEmail(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  return isDomainEmail(email) ? { ok: true, value: email } : { ok: false, errors: ['email'] }
}

/** Whether `me` may remove `target`: never yourself, never a fixed (environment) email. → null | reason */
export function removeBlocker(target, me, bootstrap) {
  const t = String(target || '').toLowerCase()
  if (t === String(me || '').toLowerCase()) return 'cannot_remove_self'
  if (bootstrap?.has(t)) return 'cannot_remove_fixed'
  return null
}
