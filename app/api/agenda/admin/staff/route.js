import { guardAdmin, presentStaff, validateNewStaff } from '@/lib/agenda/admin'
import { db, selectStaff } from '@/lib/agenda/db'
import { json, readJson } from '@/lib/agenda/http'
import { DEFAULT_WEEKLY_HOURS } from '@/lib/agenda/slots'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const list = (cols) => db().from('agenda_staff').select(cols)

/** → { staff: [...] ordered by priority, migration_required } */
export async function GET(request) {
  const denied = guardAdmin(request)
  if (denied) return denied
  const { data, error, legacy } = await selectStaff((cols) => {
    const q = list(cols)
    return cols.includes('priority') ? q.order('priority', { ascending: true }).order('created_at', { ascending: true }) : q.order('created_at', { ascending: true })
  })
  if (error) { console.error('[agenda] admin list failed', error.code); return json({ error: 'db_error' }, 502) }
  return json({ staff: (data || []).map(presentStaff), migration_required: legacy })
}

export async function POST(request) {
  const denied = guardAdmin(request, { mutating: true })
  if (denied) return denied
  const v = validateNewStaff(await readJson(request, 4096))
  if (!v.ok) return json({ error: 'invalid', fields: v.errors }, 400)
  // New people: Mon–Fri with the 13:30–14:30 lunch break, a month ahead, last in the priority order.
  const row = { ...v.value, days_ahead: 30, weekly_hours: DEFAULT_WEEKLY_HOURS }
  const { data: last, error: maxErr } = await db().from('agenda_staff').select('priority').order('priority', { ascending: false }).limit(1).maybeSingle()
  if (!maxErr) row.priority = (Number(last?.priority) || 0) + 10
  const { data, error } = await selectStaff((cols) => db().from('agenda_staff').insert(row).select(cols).single())
  if (error) {
    if (error.code === '23505') return json({ error: 'email_exists' }, 409)
    console.error('[agenda] admin insert failed', error.code)
    return json({ error: 'db_error' }, 502)
  }
  return json({ staff: presentStaff(data) }, 201)
}
