import { guardAdmin, insertStaff, presentStaff } from '@/lib/agenda/admin'
import { db, isMissingSchema, selectStaff, withArchive } from '@/lib/agenda/db'
import { json, readJson } from '@/lib/agenda/http'
import { allowlistOutcome, validateInvite } from '@/lib/agenda/onboard'
import { inviteAction } from '@/lib/agenda/remove'
import { bootstrapAdmins, currentAdmin, invalidateAdminList } from '@/lib/agenda/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST { name, email } → { staff, access, restored } — "Invitar a otra persona".
 * Creates the staff row (not connected, inactive) and adds the @manya.pe email to agenda_admins
 * (added_by = current admin) so the person can sign in; signing in connects their calendar.
 * A person removed earlier ("Eliminar persona", archived) is restored with their old settings instead.
 * access: 'added' | 'already' | 'fixed' | 'migration_required' | 'error' (the staff row exists either way).
 */
export async function POST(request) {
  const denied = await guardAdmin(request, { mutating: true })
  if (denied) return denied
  const v = validateInvite(await readJson(request, 2048))
  if (!v.ok) return json({ error: v.errors.includes('email') ? 'invalid_admin_email' : 'invalid', fields: v.errors }, 400)
  const { name, email } = v.value

  const { data: dup, error: dupErr } = await withArchive((a) => db().from('agenda_staff')
    .select('id' + (a ? ',archived_at' : '')).eq('email', email).maybeSingle())
  if (dupErr) { console.error('[agenda] invite lookup failed', dupErr.code); return json({ error: 'db_error' }, 502) }
  const action = inviteAction(dup)
  if (action === 'exists') return json({ error: 'email_exists' }, 409)

  const { data, error } = action === 'restore'
    ? await selectStaff((cols) => db().from('agenda_staff').update({ archived_at: null }).eq('id', dup.id).select(cols).single())
    : await insertStaff({ name, email, active: false })
  if (error) {
    if (error.code === '23505') return json({ error: 'email_exists' }, 409)
    console.error('[agenda] invite ' + action + ' failed', error.code)
    return json({ error: 'db_error' }, 502)
  }

  const bootstrap = bootstrapAdmins()
  let insErr = null
  if (!bootstrap.has(email)) {
    ;({ error: insErr } = await db().from('agenda_admins').insert({ email, added_by: await currentAdmin() }))
  }
  const access = allowlistOutcome({ email, bootstrap, error: insErr, missingSchema: isMissingSchema(insErr) })
  if (access === 'added') invalidateAdminList()
  if (access === 'error') console.error('[agenda] invite allowlist insert failed', insErr.code)
  return json({ staff: presentStaff(data), access, restored: action === 'restore' }, action === 'restore' ? 200 : 201)
}
