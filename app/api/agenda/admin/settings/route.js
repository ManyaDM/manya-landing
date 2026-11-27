import { guardAdmin, validatePolicy } from '@/lib/agenda/admin'
import { DEFAULT_POLICY, normalizePolicy } from '@/lib/agenda/assign'
import { db, isMissingSchema } from '@/lib/agenda/db'
import { json, readJson } from '@/lib/agenda/http'
import { ASSIGNMENT_KEY } from '@/lib/agenda/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** → { assignment: { policy }, migration_required } */
export async function GET(request) {
  const denied = guardAdmin(request)
  if (denied) return denied
  const { data, error } = await db().from('agenda_settings').select('value').eq('key', ASSIGNMENT_KEY).maybeSingle()
  if (error) {
    if (isMissingSchema(error)) return json({ assignment: { policy: DEFAULT_POLICY }, migration_required: true })
    console.error('[agenda] settings read failed', error.code)
    return json({ error: 'db_error' }, 502)
  }
  return json({ assignment: { policy: normalizePolicy(data?.value) }, migration_required: false })
}

/** PUT { policy: 'priority' | 'round_robin' } */
export async function PUT(request) {
  const denied = guardAdmin(request, { mutating: true })
  if (denied) return denied
  const v = validatePolicy(await readJson(request, 1024))
  if (!v.ok) return json({ error: 'invalid', fields: v.errors }, 400)
  const { error } = await db().from('agenda_settings')
    .upsert({ key: ASSIGNMENT_KEY, value: v.value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) {
    if (isMissingSchema(error)) return json({ error: 'migration_required' }, 503)
    console.error('[agenda] settings write failed', error.code)
    return json({ error: 'db_error' }, 502)
  }
  return json({ assignment: v.value })
}
