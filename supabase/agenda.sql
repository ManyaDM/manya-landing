-- Agenda (Google Calendar booking for go.manya.pe/mapa-de-fugas).
-- Idempotent: safe to run more than once in the Supabase SQL editor.
-- Tables are isolated with RLS ENABLED and NO policies: anon/authenticated roles get nothing;
-- only the server (service role key) reads and writes them.

create extension if not exists pgcrypto;

create table if not exists public.agenda_staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  refresh_token_enc text,               -- AES-256-GCM, key in AGENDA_ENCRYPTION_KEY (never stored here)
  connected_at timestamptz,
  active boolean not null default true,
  timezone text not null default 'America/Lima',
  weekly_hours jsonb not null default '{
    "0": [],
    "1": [{"start": "09:00", "end": "18:00"}],
    "2": [{"start": "09:00", "end": "18:00"}],
    "3": [{"start": "09:00", "end": "18:00"}],
    "4": [{"start": "09:00", "end": "18:00"}],
    "5": [{"start": "09:00", "end": "18:00"}],
    "6": []
  }'::jsonb,
  meeting_minutes int not null default 20 check (meeting_minutes between 5 and 240),
  slot_step_minutes int not null default 30 check (slot_step_minutes between 5 and 240),
  min_notice_hours int not null default 12 check (min_notice_hours between 0 and 720),
  days_ahead int not null default 14 check (days_ahead between 1 and 60),
  buffer_minutes int not null default 0 check (buffer_minutes between 0 and 240),
  created_at timestamptz not null default now()
);

create table if not exists public.agenda_bookings (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.agenda_staff(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  google_event_id text,
  meet_link text,
  lead jsonb not null default '{}'::jsonb,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- One live booking per person per start time (guards double-booking races).
-- Partial so a cancelled booking does not block the slot forever.
create unique index if not exists agenda_bookings_staff_start_uniq
  on public.agenda_bookings (staff_id, starts_at)
  where status <> 'cancelled';

create index if not exists agenda_bookings_staff_range_idx
  on public.agenda_bookings (staff_id, starts_at, ends_at);

create index if not exists agenda_bookings_created_idx
  on public.agenda_bookings (staff_id, created_at desc);

alter table public.agenda_staff enable row level security;
alter table public.agenda_bookings enable row level security;

-- Belt and braces: no API access for client roles even if a policy is added by mistake later.
revoke all on table public.agenda_staff from anon, authenticated;
revoke all on table public.agenda_bookings from anon, authenticated;
