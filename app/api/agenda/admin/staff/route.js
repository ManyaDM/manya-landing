import { guardAdmin, insertStaff, presentStaff, validateNewStaff } from '@/lib/agenda/admin'
import { db, liveOnly, selectStaff, withArchive } from '@/lib/agenda/db'
import { json, readJson } from '@/lib/agenda/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const list = (cols, archive) => liveOnly(db().from('agenda_staff').select(cols), archive)

/** Future confirmed bookings per person → Map staffId → count (empty when the query fails). */
async function upcomingCounts() {
  const { data, error } = await db().from('agenda_bookings').select('staff_id')
    .eq('status', 'confirmed').gte('starts_at', new Date().toISOString()).limit(2000)
  const out = new Map()
  if (error) { console.error('[agenda] upcoming count failed', error.code); return out }
  for (const r of data || []) out.set(r.staff_id, (out.get(r.staff_id) || 0) + 1)
  return out
}

/** → { staff: [...] ordered by priority (archived people excluded), migration_required } */
export async function GET(request) {
  const denied = await guardAdmin(request)
  if (denied) return denied
  const [{ data, error, legacy }, upcoming] = await Promise.all([
    selectStaff((cols) => withArchive((a) => {
      const q = list(cols, a)
      return cols.includes('priority') ? q.order('priority', { ascending: true }).order('created_at', { ascending: true }) : q.order('created_at', { ascending: true })
    })),
    upcomingCounts(),
  ])
  if (error) { console.error('[agenda] admin list failed', error.code); return json({ error: 'db_error' }, 502) }
  return json({ staff: (data || []).map((s) => ({ ...presentStaff(s), upcoming_bookings: upcoming.get(s.id) || 0 })), migration_required: legacy })
}

export async function POST(request) {
  const denied = await guardAdmin(request, { mutating: true })
  if (denied) return denied
  const v = validateNewStaff(await readJson(request, 4096))
  if (!v.ok) return json({ error: 'invalid', fields: v.errors }, 400)
  const { data, error } = await insertStaff(v.value)
  if (error) {
    if (error.code === '23505') return json({ error: 'email_exists' }, 409)
    console.error('[agenda] admin insert failed', error.code)
    return json({ error: 'db_error' }, 502)
  }
  return json({ staff: presentStaff(data) }, 201)
}
