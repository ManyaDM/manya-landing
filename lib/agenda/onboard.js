// Onboarding rules (pure, no I/O): connecting the calendar at sign-in, "connect my calendar" and invites.
// Pure module so it can be unit tested; only imported by server code.
import { isDomainEmail } from './auth.js'
import { DEFAULT_WEEKLY_HOURS } from './slots.js'

/** Calendar scopes a connection needs (the identity scopes are not enough). */
export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.events.freebusy',
]

/** True when the token response's space-separated `scope` includes every calendar scope (granular consent). */
export function hasCalendarScopes(scope) {
  const granted = String(scope || '').split(/\s+/)
  return CALENDAR_SCOPES.every((s) => granted.includes(s))
}

const clean = (s) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) : '')

/** "ana.maria_lopez@manya.pe" → "Ana Maria Lopez" */
export function nameFromEmail(email) {
  const local = String(email || '').split('@')[0] || ''
  return clean(local.replace(/[._+-]+/g, ' ').replace(/\b\p{L}/gu, (c) => c.toUpperCase()))
}

/** Display name to store: the Google profile name when usable, else derived from the email. */
export function displayName(profileName, email) {
  const n = clean(profileName)
  return n.length >= 2 ? n : nameFromEmail(email)
}

/**
 * What to write to agenda_staff after a successful sign-in.
 * - New person: a row with Google's name, Mon–Fri default hours, last in the cascade and active = false
 *   (no bookings until they switch "Recibe reservas" on); connected only when calendar scopes were granted.
 * - Existing person: only the token and connected_at change, and only when Google sent a new refresh token
 *   with the calendar scopes. active, priority, hours and overrides are never touched.
 * @param existing  { id, refresh_token_enc } | null
 * @param tokenEnc  encrypted refresh token (or '' when Google sent none)
 * @returns {{ action: 'insert'|'update'|'none', row?, needsConsent: boolean, connected: boolean }}
 *   needsConsent = calendar was granted but there is no refresh token anywhere (ask again with prompt=consent).
 */
export function planLoginStaff({ existing, email, name, scope, tokenEnc, maxPriority, now = new Date() }) {
  const granted = hasCalendarScopes(scope)
  const token = granted && tokenEnc ? tokenEnc : ''
  const connectedAt = now.toISOString()
  if (existing) {
    if (token) return { action: 'update', row: { refresh_token_enc: token, connected_at: connectedAt }, needsConsent: false, connected: true }
    return { action: 'none', needsConsent: granted && !existing.refresh_token_enc, connected: Boolean(existing.refresh_token_enc) }
  }
  const row = {
    name: displayName(name, email),
    email: String(email).toLowerCase(),
    weekly_hours: DEFAULT_WEEKLY_HOURS,
    active: false,
    priority: (Number(maxPriority) || 0) + 10,
  }
  if (token) Object.assign(row, { refresh_token_enc: token, connected_at: connectedAt })
  return { action: 'insert', row, needsConsent: granted && !token, connected: Boolean(token) }
}

/** Invite form → { ok, value: { name, email } } | { ok: false, errors } (only @manya.pe accounts). */
export function validateInvite(body) {
  const name = clean(body?.name)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const errors = []
  if (name.length < 2) errors.push('name')
  if (!isDomainEmail(email)) errors.push('email')
  return errors.length ? { ok: false, errors } : { ok: true, value: { name, email } }
}

/**
 * Outcome of adding an invited email to agenda_admins.
 * @returns 'fixed' (already allowed by AGENDA_ADMIN_EMAILS, nothing inserted) | 'added' | 'already'
 *          | 'migration_required' | 'error'
 */
export function allowlistOutcome({ email, bootstrap, error, missingSchema = false }) {
  if (bootstrap?.has(String(email).toLowerCase())) return 'fixed'
  if (!error) return 'added'
  if (error.code === '23505') return 'already'
  return missingSchema ? 'migration_required' : 'error'
}
