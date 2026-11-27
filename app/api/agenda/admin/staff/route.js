import { guardAdmin, presentStaff, validateNewStaff } from '@/lib/agenda/admin'
import { db, STAFF_PUBLIC_COLUMNS } from '@/lib/agenda/db'
import { json, readJson } from '@/lib/agenda/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  const denied = guardAdmin(request)
  if (denied) return denied
  const { data, error } = await db().from('agenda_staff').select(STAFF_PUBLIC_COLUMNS).order('created_at', { ascending: true })
  if (error) { console.error('[agenda] admin list failed', error.code); return json({ error: 'db_error' }, 502) }
  return json({ staff: (data || []).map(presentStaff) })
}

export async function POST(request) {
  const denied = guardAdmin(request, { mutating: true })
  if (denied) return denied
  const v = validateNewStaff(await readJson(request, 4096))
  if (!v.ok) return json({ error: 'invalid', fields: v.errors }, 400)
  const { data, error } = await db().from('agenda_staff').insert(v.value).select(STAFF_PUBLIC_COLUMNS).single()
  if (error) {
    if (error.code === '23505') return json({ error: 'email_exists' }, 409)
    console.error('[agenda] admin insert failed', error.code)
    return json({ error: 'db_error' }, 502)
  }
  return json({ staff: presentStaff(data) }, 201)
}
