import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { env } from './config'

// Service-role client. The agenda_* tables have RLS enabled with no policies,
// so only this server-side client can read or write them.
let client = null

export function db() {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  }
  return client
}

// Columns safe to send to the admin UI (no refresh token).
// LEGACY = before supabase/agenda_002.sql (priority) has been run.
export const STAFF_LEGACY_COLUMNS =
  'id,name,email,connected_at,active,timezone,weekly_hours,meeting_minutes,slot_step_minutes,min_notice_hours,days_ahead,buffer_minutes,created_at'
export const STAFF_PUBLIC_COLUMNS = STAFF_LEGACY_COLUMNS + ',priority'

/** True when a query failed because a migration (column/table) has not been applied yet. */
export function isMissingSchema(error) {
  if (!error) return false
  if (['42703', '42P01', 'PGRST204', 'PGRST205'].includes(error.code)) return true
  return /does not exist|could not find/i.test(String(error.message || ''))
}

/**
 * Runs `build(columns)` with the full staff column list and, when the 002 migration is missing,
 * once more with the legacy list. Resolves to { data, error, legacy }.
 */
export async function selectStaff(build, extra = '') {
  const res = await build(STAFF_PUBLIC_COLUMNS + extra)
  if (!res.error || !isMissingSchema(res.error)) return { ...res, legacy: false }
  const old = await build(STAFF_LEGACY_COLUMNS + extra)
  return { ...old, legacy: true }
}
