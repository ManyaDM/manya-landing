import { guardAdmin, insertStaff, presentStaff } from '@/lib/agenda/admin'
import { db, selectStaff } from '@/lib/agenda/db'
import { json, readJson } from '@/lib/agenda/http'
import { displayName } from '@/lib/agenda/onboard'
import { currentSession } from '@/lib/agenda/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

  const { data: found, error } = await selectStaff((cols) => db().from('agenda_staff').select(cols).eq('email', me.email).maybeSingle())
  if (error) { console.error('[agenda] me lookup failed', error.code); return json({ error: 'db_error' }, 502) }
  if (found) return json({ staff: presentStaff(found), created: false })

  const name = displayName(typeof body.name === 'string' && body.name.trim() ? body.name : me.name, me.email)
  const { data, error: insErr } = await insertStaff({ name, email: me.email, active: false })
  if (insErr) {
    if (insErr.code === '23505') {
      const again = await selectStaff((cols) => db().from('agenda_staff').select(cols).eq('email', me.email).maybeSingle())
      if (again.data) return json({ staff: presentStaff(again.data), created: false })
    }
    console.error('[agenda] me insert failed', insErr.code)
    return json({ error: 'db_error' }, 502)
  }
  return json({ staff: presentStaff(data), created: true }, 201)
}
