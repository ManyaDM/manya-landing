import { UUID_RE, guardAdmin, presentStaff, validateStaffPatch } from '@/lib/agenda/admin'
import { db, STAFF_PUBLIC_COLUMNS } from '@/lib/agenda/db'
import { json, readJson } from '@/lib/agenda/http'
import { invalidateAvailability } from '@/lib/agenda/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request, { params }) {
  const denied = guardAdmin(request, { mutating: true })
  if (denied) return denied
  if (!UUID_RE.test(params.id)) return json({ error: 'not_found' }, 404)
  const v = validateStaffPatch(await readJson(request, 8192))
  if (!v.ok) return json({ error: 'invalid', fields: v.errors }, 400)
  const { data, error } = await db().from('agenda_staff').update(v.value).eq('id', params.id).select(STAFF_PUBLIC_COLUMNS).maybeSingle()
  if (error) {
    // 23502 not_null_violation: clearing an override (null) before supabase/agenda_003.sql made the columns nullable.
    if (error.code === '23502') return json({ error: 'migration_required_003' }, 503)
    console.error('[agenda] admin update failed', error.code)
    return json({ error: 'db_error' }, 502)
  }
  if (!data) return json({ error: 'not_found' }, 404)
  invalidateAvailability()
  return json({ staff: presentStaff(data) })
}
