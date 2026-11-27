-- Agenda round 4: admin allowlist for "Iniciar sesión con Google" on /agenda-admin.
-- Run AFTER supabase/agenda.sql. Idempotent: safe to run more than once in the Supabase SQL editor.
-- Only @manya.pe Google accounts listed here (or in the AGENDA_ADMIN_EMAILS env variable, which is
-- always allowed and bootstraps the first admin) can sign in.

create table if not exists public.agenda_admins (
  email text primary key check (email = lower(email) and email like '%@manya.pe'),
  added_by text,
  created_at timestamptz not null default now()
);

-- Same isolation as the other agenda tables: RLS on, no policies, no client-role access.
alter table public.agenda_admins enable row level security;
revoke all on table public.agenda_admins from anon, authenticated;
