import { guardAdmin, insertStaff, presentStaff } from '@/lib/agenda/admin'
import { db, isMissingSchema } from '@/lib/agenda/db'
import { json, readJson } from '@/lib/agenda/http'
import { allowlistOutcome, validateInvite } from '@/lib/agenda/onboard'
import { bootstrapAdmins, currentAdmin, invalidateAdminList } from '@/lib/agenda/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST { name, email } → { staff, access } — "Invitar a otra persona".
 * Creates the staff row (not connected, inactive) and adds the @manya.pe email to agenda_admins
 * (added_by = current admin) so the person can sign in; signing in connects their calendar.
 * access: 'added' | 'already' | 'fixed' | 'migration_required' | 'error' (the staff row exists either way).
 */
export async function POST(request) {
  const denied = await guardAdmin(request, { mutating: true })
  if (denied) return denied
  const v = validateInvite(await readJson(request, 2048))
  if (!v.ok) return json({ error: v.errors.includes('email') ? 'invalid_admin_email' : 'invalid', fields: v.errors }, 400)
  const { name, email } = v.value

  const { data: dup, error: dupErr } = await db().from('agenda_staff').select('id').eq('email', email).maybeSingle()
  if (dupErr) { console.error('[agenda] invite lookup failed', dupErr.code); return json({ error: 'db_error' }, 502) }
  if (dup) return json({ error: 'email_exists' }, 409)

  const { data, error } = await insertStaff({ name, email, active: false })
  if (error) {
    if (error.code === '23505') return json({ error: 'email_exists' }, 409)
    console.error('[agenda] invite insert failed', error.code)
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
  return json({ staff: presentStaff(data), access }, 201)
}
