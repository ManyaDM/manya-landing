-- Agenda round 5: "Eliminar persona" in /agenda-admin.
-- Run AFTER supabase/agenda.sql. Idempotent: safe to run more than once in the Supabase SQL editor.
--
-- A removed person with no bookings is deleted. One with bookings (agenda_bookings.staff_id is
-- "on delete restrict") is archived instead: archived_at is set, the row stays for the booking history and
-- is hidden from the panel, the public slots and the assignment. Re-inviting the email clears archived_at.

alter table public.agenda_staff add column if not exists archived_at timestamptz;

-- Most lookups only want people who are not archived.
create index if not exists agenda_staff_live_email_idx
  on public.agenda_staff (email)
  where archived_at is null;
