import { guardAdmin, insertStaff, presentStaff } from '@/lib/agenda/admin'
import { db, selectStaff, withArchive } from '@/lib/agenda/db'
import { json, readJson } from '@/lib/agenda/http'
import { displayName } from '@/lib/agenda/onboard'
import { currentSession } from '@/lib/agenda/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const findMine = (email) => selectStaff((cols) => withArchive((a) => db().from('agenda_staff')
  .select(cols + (a ? ',archived_at' : '')).eq('email', email).maybeSingle()))

/** An archived row ("Eliminar persona") is never reused or recreated: only a new invite restores it. */
function mine(row) {
  if (row.archived_at) return json({ error: 'staff_archived' }, 409)
  const { archived_at: _a, ...rest } = row
  return json({ staff: presentStaff(rest), created: false })
}

/**
 * POST { name? } → { staff, created } for the signed-in account ("Conectar mi calendario").
 * Reuses the row with the session email when it exists; otherwise creates it (inactive, last in the cascade)
 * named after the body, the Google profile name stored in the session, or the email. The client then sends
 * the person to /api/agenda/oauth/start, which still checks that the Google account matches this email.
 */
export async function POST(request) {
  const denied = await guardAdmin(request, { mutating: true })
  if (denied) return denied
  const me = await currentSession()
  if (!me) return json({ error: 'unauthorized' }, 401)
  const body = (await readJson(request, 1024)) || {}

  const { data: found, error } = await findMine(me.email)
  if (error) { console.error('[agenda] me lookup failed', error.code); return json({ error: 'db_error' }, 502) }
  if (found) return mine(found)

  const name = displayName(typeof body.name === 'string' && body.name.trim() ? body.name : me.name, me.email)
  const { data, error: insErr } = await insertStaff({ name, email: me.email, active: false })
  if (insErr) {
    if (insErr.code === '23505') {
      const again = await findMine(me.email)
      if (again.data) return mine(again.data)
    }
    console.error('[agenda] me insert failed', insErr.code)
    return json({ error: 'db_error' }, 502)
  }
  return json({ staff: presentStaff(data), created: true }, 201)
}
