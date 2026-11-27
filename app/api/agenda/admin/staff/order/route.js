import { guardAdmin, validateOrder } from '@/lib/agenda/admin'
import { db, isMissingSchema, liveOnly, withArchive } from '@/lib/agenda/db'
import { json, readJson } from '@/lib/agenda/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** PUT { ids: [staffId...] } → rewrites priority as 10, 20, 30… in that order. */
export async function PUT(request) {
  const denied = await guardAdmin(request, { mutating: true })
  if (denied) return denied
  const v = validateOrder(await readJson(request, 16 * 1024))
  if (!v.ok) return json({ error: 'invalid', fields: v.errors }, 400)
  const { data: rows, error } = await withArchive((a) => liveOnly(db().from('agenda_staff').select('id'), a))
  if (error) { console.error('[agenda] order lookup failed', error.code); return json({ error: 'db_error' }, 502) }
  const known = new Set((rows || []).map((r) => r.id))
  if (v.value.length !== known.size || !v.value.every((id) => known.has(id))) return json({ error: 'invalid', fields: ['ids'] }, 400)
  for (const [i, id] of v.value.entries()) {
    const { error: upErr } = await db().from('agenda_staff').update({ priority: (i + 1) * 10 }).eq('id', id)
    if (upErr) {
      if (isMissingSchema(upErr)) return json({ error: 'migration_required' }, 503)
      console.error('[agenda] order update failed', upErr.code)
      return json({ error: 'db_error' }, 502)
    }
  }
  return json({ ok: true })
}
