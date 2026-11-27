import { UUID_RE, guardAdmin, presentStaff, validateStaffPatch } from '@/lib/agenda/admin'
import { env } from '@/lib/agenda/config'
import { decrypt } from '@/lib/agenda/crypto'
import { db, isMissingSchema, liveOnly, STAFF_PUBLIC_COLUMNS, withArchive } from '@/lib/agenda/db'
import { forgetAccessToken, revokeToken } from '@/lib/agenda/google'
import { json, readJson } from '@/lib/agenda/http'
import { DISCONNECTED, adminAccessOutcome, deleteBlocker, removalMode } from '@/lib/agenda/remove'
import { invalidateAvailability } from '@/lib/agenda/service'
import { bootstrapAdmins, currentAdmin, invalidateAdminList } from '@/lib/agenda/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request, { params }) {
  const denied = await guardAdmin(request, { mutating: true })
  if (denied) return denied
  if (!UUID_RE.test(params.id)) return json({ error: 'not_found' }, 404)
  const v = validateStaffPatch(await readJson(request, 8192))
  if (!v.ok) return json({ error: 'invalid', fields: v.errors }, 400)
  const { data, error } = await withArchive((a) => liveOnly(db().from('agenda_staff').update(v.value).eq('id', params.id), a)
    .select(STAFF_PUBLIC_COLUMNS).maybeSingle())
  if (error) {
    // 23502 not_null_violation: clearing an override (null) before supabase/agenda_003.sql made the columns nullable.
    if (error.code === '23502') return json({ error: 'migration_required_003' }, 503)
    console.error('[agenda] admin update failed', error.code)
    return json({ error: 'db_error' }, 502)
  }
  if (!data) return json({ error: 'not_found' }, 404)
  invalidateAvailability()
  return json({ staff: presentStaff(data) })
}

/** Removes the email from agenda_admins unless it is an AGENDA_ADMIN_EMAILS account. → 'removed'|'fixed'|'none'|'error' */
async function dropAccess(email) {
  const bootstrap = bootstrapAdmins()
  if (bootstrap.has(email)) return adminAccessOutcome({ email, bootstrap })
  const { data, error } = await db().from('agenda_admins').delete().eq('email', email).select('email')
  if (error) {
    if (isMissingSchema(error)) return 'none' // agenda_004.sql not run: only fixed accounts can sign in
    console.error('[agenda] delete person: access removal failed', error.code)
    return 'error'
  }
  const outcome = adminAccessOutcome({ email, bootstrap, removedRows: data?.length })
  if (outcome === 'removed') invalidateAdminList()
  return outcome
}

/**
 * DELETE → { ok, mode: 'deleted'|'archived', admin_access: 'removed'|'fixed'|'none'|'error' } — "Eliminar persona".
 * Revokes and clears the Google connection, stops bookings, removes panel access and then deletes the row
 * (no bookings at all) or archives it (archived_at = now, kept for the booking history). Never yourself.
 */
export async function DELETE(request, { params }) {
  const denied = await guardAdmin(request, { mutating: true })
  if (denied) return denied
  if (!UUID_RE.test(params.id)) return json({ error: 'not_found' }, 404)

  const { data: row, error, archiveSupported } = await withArchive((a) => db().from('agenda_staff')
    .select('id,email,refresh_token_enc' + (a ? ',archived_at' : '')).eq('id', params.id).maybeSingle())
  if (error) { console.error('[agenda] delete person lookup failed', error.code); return json({ error: 'db_error' }, 502) }
  if (!row || row.archived_at) return json({ error: 'not_found' }, 404)
  const email = String(row.email).toLowerCase()
  const blocker = deleteBlocker(email, await currentAdmin())
  if (blocker) return json({ error: blocker }, 400)

  const { count, error: countErr } = await db().from('agenda_bookings').select('id', { count: 'exact', head: true }).eq('staff_id', row.id)
  if (countErr) { console.error('[agenda] delete person booking count failed', countErr.code); return json({ error: 'db_error' }, 502) }
  let mode = removalMode({ bookingCount: count, archiveSupported })
  if (mode === 'migration_required') return json({ error: 'migration_required_005' }, 503)

  // 1) Calendar: revoke at Google (best effort), clear locally and stop bookings.
  if (row.refresh_token_enc) {
    try { await revokeToken(decrypt(row.refresh_token_enc, env.encryptionKey)) } catch (e) {
      console.warn('[agenda] delete person: revoke failed for staff', row.id, e.code || e.message)
    }
  }
  const { error: upErr } = await db().from('agenda_staff').update(DISCONNECTED).eq('id', row.id)
  if (upErr) { console.error('[agenda] delete person disconnect failed', upErr.code); return json({ error: 'db_error' }, 502) }
  forgetAccessToken(row.id)
  invalidateAvailability()

  // 2) Delete the row, or archive it when bookings reference it (also when one was booked a moment ago).
  if (mode === 'deleted') {
    const { error: delErr } = await db().from('agenda_staff').delete().eq('id', row.id)
    if (delErr?.code === '23503') {
      if (!archiveSupported) return json({ error: 'migration_required_005' }, 503)
      mode = 'archived'
    } else if (delErr) { console.error('[agenda] delete person failed', delErr.code); return json({ error: 'db_error' }, 502) }
  }
  if (mode === 'archived') {
    const { error: arErr } = await db().from('agenda_staff').update({ archived_at: new Date().toISOString() }).eq('id', row.id)
    if (arErr) { console.error('[agenda] archive person failed', arErr.code); return json({ error: 'db_error' }, 502) }
  }

  // 3) Panel access.
  const admin_access = await dropAccess(email)
  return json({ ok: true, mode, admin_access })
}
