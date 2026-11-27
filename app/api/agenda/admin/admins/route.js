import { guardAdmin } from '@/lib/agenda/admin'
import { removeBlocker, validateAdminEmail } from '@/lib/agenda/auth'
import { db, isMissingSchema } from '@/lib/agenda/db'
import { json, readJson } from '@/lib/agenda/http'
import { bootstrapAdmins, currentAdmin, invalidateAdminList } from '@/lib/agenda/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** → { me, fixed: [email], admins: [{ email, added_by, created_at }], migration_required } */
export async function GET(request) {
  const denied = await guardAdmin(request)
  if (denied) return denied
  const me = await currentAdmin()
  const fixed = [...bootstrapAdmins()].sort()
  const { data, error } = await db().from('agenda_admins').select('email,added_by,created_at').order('created_at', { ascending: true })
  if (error) {
    if (isMissingSchema(error)) return json({ me, fixed, admins: [], migration_required: true })
    console.error('[agenda] admins list failed', error.code)
    return json({ error: 'db_error' }, 502)
  }
  const fixedSet = new Set(fixed)
  return json({ me, fixed, admins: (data || []).filter((a) => !fixedSet.has(a.email)), migration_required: false })
}

/** POST { email } → adds an @manya.pe account to the allowlist. */
export async function POST(request) {
  const denied = await guardAdmin(request, { mutating: true })
  if (denied) return denied
  const v = validateAdminEmail(await readJson(request, 1024))
  if (!v.ok) return json({ error: 'invalid_admin_email' }, 400)
  if (bootstrapAdmins().has(v.value)) return json({ error: 'admin_exists' }, 409)
  const me = await currentAdmin()
  const { data, error } = await db().from('agenda_admins').insert({ email: v.value, added_by: me }).select('email,added_by,created_at').single()
  if (error) {
    if (error.code === '23505') return json({ error: 'admin_exists' }, 409)
    if (isMissingSchema(error)) return json({ error: 'migration_required_004' }, 503)
    console.error('[agenda] admin add failed', error.code)
    return json({ error: 'db_error' }, 502)
  }
  invalidateAdminList()
  return json({ admin: data }, 201)
}

/** DELETE { email } → removes an account. Never yourself, never an AGENDA_ADMIN_EMAILS (fixed) account. */
export async function DELETE(request) {
  const denied = await guardAdmin(request, { mutating: true })
  if (denied) return denied
  const v = validateAdminEmail(await readJson(request, 1024))
  if (!v.ok) return json({ error: 'invalid_admin_email' }, 400)
  const blocker = removeBlocker(v.value, await currentAdmin(), bootstrapAdmins())
  if (blocker) return json({ error: blocker }, 400)
  const { data, error } = await db().from('agenda_admins').delete().eq('email', v.value).select('email')
  if (error) {
    if (isMissingSchema(error)) return json({ error: 'migration_required_004' }, 503)
    console.error('[agenda] admin remove failed', error.code)
    return json({ error: 'db_error' }, 502)
  }
  if (!data?.length) return json({ error: 'not_found' }, 404)
  invalidateAdminList()
  return json({ ok: true })
}
