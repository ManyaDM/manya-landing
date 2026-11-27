import { guardAdmin } from '@/lib/agenda/admin'
import { db, withArchive } from '@/lib/agenda/db'
import { json } from '@/lib/agenda/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Upcoming (or ongoing) bookings, soonest first, max 100. Read-only; only the lead fields the list shows. */
export async function GET(request) {
  const denied = await guardAdmin(request)
  if (denied) return denied
  // The join includes archived people ("Eliminar persona"), flagged so the list can tag them.
  const { data, error } = await withArchive((a) => db().from('agenda_bookings')
    .select('id,starts_at,ends_at,status,meet_link,lead,staff:agenda_staff(name,email' + (a ? ',archived_at' : '') + ')')
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true }).limit(100))
  if (error) { console.error('[agenda] admin bookings failed', error.code); return json({ error: 'db_error' }, 502) }
  const bookings = (data || []).map((b) => ({
    id: b.id,
    starts_at: b.starts_at,
    ends_at: b.ends_at,
    status: b.status,
    meet_link: typeof b.meet_link === 'string' && b.meet_link.startsWith('https://meet.google.com/') ? b.meet_link : '',
    lead: { nombre: b.lead?.nombre || '', empresa: b.lead?.empresa || '', correo: b.lead?.correo || '', telefono: b.lead?.telefono || '' },
    staff: b.staff ? { name: b.staff.name, email: b.staff.email, archived: Boolean(b.staff.archived_at) } : null,
  }))
  return json({ bookings })
}
