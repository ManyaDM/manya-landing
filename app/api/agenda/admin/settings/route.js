import { guardAdmin, validatePolicy } from '@/lib/agenda/admin'
import { DEFAULT_POLICY, normalizePolicy } from '@/lib/agenda/assign'
import { db, isMissingSchema } from '@/lib/agenda/db'
import { json, readJson } from '@/lib/agenda/http'
import { ASSIGNMENT_KEY, invalidateAvailability, readSetting } from '@/lib/agenda/service'
import { DEFAULTS_KEY, normalizeDefaults, validateDefaults } from '@/lib/agenda/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * → { assignment: { policy }, defaults: { meeting_minutes, ... }, migration_required, defaults_missing }
 * migration_required = agenda_002.sql not run (no settings table). defaults_missing = agenda_003.sql not run
 * (no 'defaults' row): the hardcoded defaults are returned, which is also what the booking flow uses then.
 */
export async function GET(request) {
  const denied = guardAdmin(request)
  if (denied) return denied
  const [assignment, defaults] = await Promise.all([readSetting(ASSIGNMENT_KEY), readSetting(DEFAULTS_KEY)])
  if (assignment.failed || defaults.failed) return json({ error: 'db_error' }, 502)
  return json({
    assignment: { policy: assignment.missing ? DEFAULT_POLICY : normalizePolicy(assignment.value) },
    defaults: normalizeDefaults(defaults.value),
    migration_required: assignment.schemaMissing || defaults.schemaMissing,
    defaults_missing: defaults.missing,
  })
}

/** PUT { policy: 'priority' | 'round_robin' } or { defaults: { meeting_minutes, ... } } (partial allowed). */
export async function PUT(request) {
  const denied = guardAdmin(request, { mutating: true })
  if (denied) return denied
  const body = await readJson(request, 2048)
  if (body && typeof body === 'object' && 'defaults' in body) return putDefaults(body.defaults)

  const v = validatePolicy(body)
  if (!v.ok) return json({ error: 'invalid', fields: v.errors }, 400)
  const { error } = await db().from('agenda_settings')
    .upsert({ key: ASSIGNMENT_KEY, value: v.value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) {
    if (isMissingSchema(error)) return json({ error: 'migration_required' }, 503)
    console.error('[agenda] settings write failed', error.code)
    return json({ error: 'db_error' }, 502)
  }
  invalidateAvailability()
  return json({ assignment: v.value })
}

// The 'defaults' row is only created by supabase/agenda_003.sql (which also makes the staff columns
// nullable), so this is an UPDATE: before that migration it answers migration_required_003.
async function putDefaults(input) {
  const current = await readSetting(DEFAULTS_KEY)
  if (current.failed) return json({ error: 'db_error' }, 502)
  if (current.schemaMissing) return json({ error: 'migration_required' }, 503)
  if (current.missing) return json({ error: 'migration_required_003' }, 503)
  const v = validateDefaults(input, current.value)
  if (!v.ok) return json({ error: 'invalid', fields: v.errors }, 400)
  const { data, error } = await db().from('agenda_settings')
    .update({ value: v.value, updated_at: new Date().toISOString() }).eq('key', DEFAULTS_KEY).select('value').maybeSingle()
  if (error) { console.error('[agenda] defaults write failed', error.code); return json({ error: 'db_error' }, 502) }
  if (!data) return json({ error: 'migration_required_003' }, 503)
  invalidateAvailability()
  return json({ defaults: normalizeDefaults(data.value) })
}
