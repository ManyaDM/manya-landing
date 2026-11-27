-- Agenda round 2: priority / assignment policy, lunch break, settings table.
-- Run AFTER supabase/agenda.sql. Idempotent: safe to run more than once in the Supabase SQL editor.

-- Staff: priority order (lower = first in the cascade).
alter table public.agenda_staff add column if not exists priority int not null default 100;

-- New people see a month ahead and get the 13:30–14:30 lunch break. Existing rows keep their days_ahead.
alter table public.agenda_staff alter column days_ahead set default 30;
alter table public.agenda_staff alter column weekly_hours set default '{
  "0": [],
  "1": [{"start": "09:00", "end": "13:30"}, {"start": "14:30", "end": "18:00"}],
  "2": [{"start": "09:00", "end": "13:30"}, {"start": "14:30", "end": "18:00"}],
  "3": [{"start": "09:00", "end": "13:30"}, {"start": "14:30", "end": "18:00"}],
  "4": [{"start": "09:00", "end": "13:30"}, {"start": "14:30", "end": "18:00"}],
  "5": [{"start": "09:00", "end": "13:30"}, {"start": "14:30", "end": "18:00"}],
  "6": []
}'::jsonb;

-- Initial priority for existing people: creation order (10, 20, 30…). Only while nobody has been
-- reordered yet (every row still at the default 100), so a second run changes nothing.
do $$
begin
  if not exists (select 1 from public.agenda_staff where priority <> 100) then
    update public.agenda_staff s
       set priority = o.rn * 10
      from (select id, row_number() over (order by created_at, id) as rn from public.agenda_staff) o
     where s.id = o.id;
  end if;
end $$;

-- Lunch break for existing people: every franja that fully contains 13:30–14:30 is split into
-- start–13:30 and 14:30–end (keeping each person's own start/end). Already-split franjas no longer
-- contain the break, so running this twice changes nothing. Same logic as splitLunch() in lib/agenda/slots.js.
update public.agenda_staff s
   set weekly_hours = x.hours
  from (
    select st.id,
           jsonb_object_agg(d.key, (
             select coalesce(jsonb_agg(piece order by piece->>'start'), '[]'::jsonb)
               from jsonb_array_elements(d.value) w,
                    lateral (
                      select w.value as piece
                       where not (w.value->>'start' <= '13:30' and w.value->>'end' >= '14:30')
                      union all
                      select jsonb_build_object('start', w.value->>'start', 'end', '13:30')
                       where w.value->>'start' < '13:30' and w.value->>'end' >= '14:30'
                      union all
                      select jsonb_build_object('start', '14:30', 'end', w.value->>'end')
                       where w.value->>'start' <= '13:30' and w.value->>'end' > '14:30'
                    ) p
           )) as hours
      from public.agenda_staff st, jsonb_each(st.weekly_hours) d
     where jsonb_typeof(d.value) = 'array'
     group by st.id
  ) x
 where s.id = x.id
   and s.weekly_hours is distinct from x.hours;

-- Settings (key → jsonb). Same isolation as the other agenda tables: RLS on, no policies.
create table if not exists public.agenda_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.agenda_settings enable row level security;
revoke all on table public.agenda_settings from anon, authenticated;

insert into public.agenda_settings (key, value)
values ('assignment', '{"policy": "priority"}'::jsonb)
on conflict (key) do nothing;
