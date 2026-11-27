// "Eliminar persona" rules (pure, no I/O) so they can be unit tested; only imported by server code.

/** A person cannot delete their own staff row. → null | 'cannot_delete_self' */
export function deleteBlocker(targetEmail, me) {
  return String(targetEmail || '').toLowerCase() === String(me || '').toLowerCase() ? 'cannot_delete_self' : null
}

/**
 * How to remove a staff row. Bookings reference it (on delete restrict) and keep the history, so a person
 * with any booking is archived (archived_at = now) instead of deleted.
 * @param bookingCount     number of agenda_bookings rows for this person (any status, past or future)
 * @param archiveSupported false when supabase/agenda_005.sql (archived_at) has not been run yet
 * @returns 'deleted' | 'archived' | 'migration_required'
 */
export function removalMode({ bookingCount, archiveSupported }) {
  if (!(Number(bookingCount) > 0)) return 'deleted'
  return archiveSupported ? 'archived' : 'migration_required'
}

/**
 * Panel access after removing a person.
 * 'fixed' = the email is in AGENDA_ADMIN_EMAILS (cannot be removed from here), 'removed' = an agenda_admins
 * row was deleted, 'none' = the person had no listed access.
 */
export function adminAccessOutcome({ email, bootstrap, removedRows }) {
  if (bootstrap?.has(String(email || '').toLowerCase())) return 'fixed'
  return Number(removedRows) > 0 ? 'removed' : 'none'
}

/** Columns cleared on removal: no calendar, no bookings. */
export const DISCONNECTED = Object.freeze({ refresh_token_enc: null, connected_at: null, active: false })

/**
 * What the invite flow does when the email already has a staff row.
 * An archived person is restored (archived_at = null) with their old settings; anyone else is a duplicate.
 * @returns 'insert' | 'restore' | 'exists'
 */
export function inviteAction(existing) {
  if (!existing) return 'insert'
  return existing.archived_at ? 'restore' : 'exists'
}
