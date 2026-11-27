-- Agenda round 3: global scheduling defaults with per-person overrides.
-- Run AFTER supabase/agenda_002.sql. Idempotent: safe to run more than once in the Supabase SQL editor.
--
-- meeting_minutes, slot_step_minutes, min_notice_hours, days_ahead and buffer_minutes become nullable
-- overrides on agenda_staff: null = use the global value in agenda_settings('defaults'); a value = that
-- person's own setting, which wins. Same logic as effectiveStaff() in lib/agenda/settings.js.

-- Global defaults. A second run keeps whatever was saved from the admin panel.
insert into public.agenda_settings (key, value)
values ('defaults', '{"meeting_minutes": 20, "slot_step_minutes": 30, "min_notice_hours": 12, "days_ahead": 30, "buffer_minutes": 0}'::jsonb)
on conflict (key) do nothing;

-- Overrides are nullable and have no default (new people inherit everything). The existing
-- "between" check constraints stay: a null value passes them.
alter table public.agenda_staff
  alter column meeting_minutes drop not null,
  alter column meeting_minutes drop default,
  alter column slot_step_minutes drop not null,
  alter column slot_step_minutes drop default,
  alter column min_notice_hours drop not null,
  alter column min_notice_hours drop default,
  alter column days_ahead drop not null,
  alter column days_ahead drop default,
  alter column buffer_minutes drop not null,
  alter column buffer_minutes drop default;

-- One-time reset: existing people start inheriting the global values. Guarded by a marker so a later
-- run never wipes overrides set afterwards from the admin panel.
do $$
begin
  if not coalesce((select (value->>'003_overrides_reset')::boolean
                     from public.agenda_settings where key = 'migrations'), false) then
    update public.agenda_staff
       set meeting_minutes = null,
           slot_step_minutes = null,
           min_notice_hours = null,
           days_ahead = null,
           buffer_minutes = null;
    insert into public.agenda_settings (key, value)
    values ('migrations', '{"003_overrides_reset": true}'::jsonb)
    on conflict (key) do update
      set value = public.agenda_settings.value || excluded.value,
          updated_at = now();
  end if;
end $$;
