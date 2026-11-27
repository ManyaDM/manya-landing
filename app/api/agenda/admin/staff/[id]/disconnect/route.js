import { UUID_RE, guardAdmin, presentStaff } from '@/lib/agenda/admin'
import { env } from '@/lib/agenda/config'
import { decrypt } from '@/lib/agenda/crypto'
import { db, STAFF_PUBLIC_COLUMNS } from '@/lib/agenda/db'
import { forgetAccessToken, revokeToken } from '@/lib/agenda/google'
import { json } from '@/lib/agenda/http'
import { invalidateAvailability } from '@/lib/agenda/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request, { params }) {
  const denied = guardAdmin(request, { mutating: true })
  if (denied) return denied
  if (!UUID_RE.test(params.id)) return json({ error: 'not_found' }, 404)
  const { data: row, error } = await db().from('agenda_staff').select('id,refresh_token_enc').eq('id', params.id).maybeSingle()
  if (error) { console.error('[agenda] disconnect lookup failed', error.code); return json({ error: 'db_error' }, 502) }
  if (!row) return json({ error: 'not_found' }, 404)
  if (row.refresh_token_enc) {
    try { await revokeToken(decrypt(row.refresh_token_enc, env.encryptionKey)) } catch (e) {
      // Already revoked or key rotated: clearing it locally is still the right outcome.
      console.warn('[agenda] revoke failed for staff', row.id, e.code || e.message)
    }
  }
  const { data, error: upErr } = await db().from('agenda_staff')
    .update({ refresh_token_enc: null, connected_at: null }).eq('id', row.id).select(STAFF_PUBLIC_COLUMNS).single()
  if (upErr) { console.error('[agenda] disconnect update failed', upErr.code); return json({ error: 'db_error' }, 502) }
  forgetAccessToken(row.id)
  invalidateAvailability()
  return json({ staff: presentStaff(data) })
}
