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
export const STAFF_PUBLIC_COLUMNS =
  'id,name,email,connected_at,active,timezone,weekly_hours,meeting_minutes,slot_step_minutes,min_notice_hours,days_ahead,buffer_minutes,created_at'
