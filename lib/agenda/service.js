import 'server-only'
import { randomUUID } from 'node:crypto'
import { db, isMissingSchema, selectStaff } from './db'
import { accessTokenFor, busyForStaff, createEvent } from './google'
import { attributeSlots, freeAt, generateStaffSlots, groupByDay, mergeStaffSlots, scheduleOf, toRanges } from './slots'
import { DEFAULTS_KEY, effectiveStaff, normalizeDefaults } from './settings'
import { DEFAULT_POLICY, assignmentOrder, latestByStaff, normalizePolicy } from './assign'
import { describeLead } from './validation'

const DAY = 86400000
const CACHE_MS = 30000

export class AgendaError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status }
}

// ---- settings (agenda_settings: key → jsonb)

export const ASSIGNMENT_KEY = 'assignment'

/**
 * Reads one settings row → { value, missing, schemaMissing, failed }. missing = the table (002) or the row
 * does not exist. Other errors are logged, flagged as `failed` and also reported as missing, so the public
 * flow falls back to its defaults instead of failing.
 */
export async function readSetting(key) {
  const { data, error } = await db().from('agenda_settings').select('value').eq('key', key).maybeSingle()
  if (error) {
    const schemaMissing = isMissingSchema(error)
    if (!schemaMissing) console.error('[agenda] settings query failed', key, error.code)
    return { value: null, missing: true, schemaMissing, failed: !schemaMissing }
  }
  return { value: data ? data.value : null, missing: !data, schemaMissing: false, failed: false }
}

/** Current assignment policy. Missing table/row (migration not run yet) → default policy. */
export async function assignmentPolicy() {
  const { value, missing } = await readSetting(ASSIGNMENT_KEY)
  return missing ? DEFAULT_POLICY : normalizePolicy(value)
}

/**
 * Global scheduling defaults. Before supabase/agenda_003.sql inserts the 'defaults' row, the hardcoded
 * DEFAULT_SCHEDULE is used (and every staff value, still non-null then, acts as a personal override).
 */
export async function scheduleDefaults() {
  const { value, missing } = await readSetting(DEFAULTS_KEY)
  return { defaults: normalizeDefaults(value), missing }
}

/** Active, connected staff with their effective schedule (personal override ?? global default). */
async function bookableStaff() {
  const [{ data, error }, { defaults }] = await Promise.all([
    selectStaff((cols) => db().from('agenda_staff').select(cols)
      .eq('active', true).not('refresh_token_enc', 'is', null), ',refresh_token_enc'),
    scheduleDefaults(),
  ])
  if (error) { console.error('[agenda] staff query failed', error.code); throw new AgendaError('db_error', 502) }
  return { staff: (data || []).map((s) => effectiveStaff(s, defaults)), defaults }
}

/** Non-cancelled bookings overlapping [from, to) as Map staffId → [[startMs, endMs]]. */
async function bookedRanges(staffIds, fromIso, toIso) {
  const out = new Map(staffIds.map((id) => [id, []]))
  if (!staffIds.length) return out
  const { data, error } = await db().from('agenda_bookings').select('staff_id,starts_at,ends_at')
    .in('staff_id', staffIds).neq('status', 'cancelled').lt('starts_at', toIso).gt('ends_at', fromIso)
  if (error) { console.error('[agenda] bookings query failed', error.code); throw new AgendaError('db_error', 502) }
  for (const r of data || []) out.get(r.staff_id)?.push(...toRanges([{ start: r.starts_at, end: r.ends_at }]))
  return out
}

/** Latest non-cancelled booking per staff member (for round robin). */
async function lastBookings(staffIds) {
  if (!staffIds.length) return new Map()
  const { data, error } = await db().from('agenda_bookings').select('staff_id,created_at')
    .in('staff_id', staffIds).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(500)
  if (error) { console.error('[agenda] round robin query failed', error.code); return new Map() }
  return latestByStaff(data)
}

// ---- availability (short shared cache so bursts of visitors don't hammer Google)
let cached = null

export function invalidateAvailability() { cached = null }

/**
 * Public availability. Each slot carries the meeting length of the person who would be assigned at
 * that time under the current policy. → { days, meetingMinutes } (meetingMinutes = global default).
 */
export async function publicAvailability() {
  if (cached && cached.at + CACHE_MS > Date.now()) return cached.value
  const now = Date.now()
  const { staff, defaults } = await bookableStaff()
  if (!staff.length) return { days: [], meetingMinutes: defaults.meeting_minutes }
  const horizon = Math.max(...staff.map((s) => scheduleOf(s).daysAhead + 1)) * DAY
  const timeMin = new Date(now).toISOString(), timeMax = new Date(now + horizon).toISOString()
  const [busy, booked, policy] = await Promise.all([
    busyForStaff(staff, timeMin, timeMax),
    bookedRanges(staff.map((s) => s.id), timeMin, timeMax),
    assignmentPolicy(),
  ])
  const readable = staff.filter((s) => busy.has(s.id))
  if (!readable.length) throw new AgendaError('calendar_unavailable', 503)
  const merged = mergeStaffSlots(readable.map((s) => ({
    staffId: s.id,
    slots: generateStaffSlots(s, [...busy.get(s.id), ...booked.get(s.id)], now),
  })))
  const last = policy === 'round_robin' ? await lastBookings(readable.map((s) => s.id)) : null
  const value = { days: groupByDay(attributeSlots(merged, new Map(readable.map((s) => [s.id, s])), policy, last)), meetingMinutes: defaults.meeting_minutes }
  cached = { at: Date.now(), value }
  return value
}

// ---- booking

function eventBody({ staff, startMs, endMs, lead, fit }) {
  const lines = [
    'Evaluación gratuita del Mapa de Fugas, agendada desde go.manya.pe/mapa-de-fugas.',
    '',
    ...describeLead(lead),
    '',
    'Calificación: ' + fit.level,
  ]
  return {
    summary: ('Evaluación Mapa de Fugas · ' + lead.empresa).slice(0, 200),
    description: lines.join('\n').slice(0, 7000),
    start: { dateTime: new Date(startMs).toISOString(), timeZone: scheduleOf(staff).timezone },
    end: { dateTime: new Date(endMs).toISOString(), timeZone: scheduleOf(staff).timezone },
    attendees: [{ email: lead.correo, displayName: lead.nombre }],
    conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    reminders: { useDefault: true },
    guestsCanInviteOthers: false,
  }
}

/**
 * Books `startMs` with a free staff member, ordered by the assignment policy (priority cascade or round robin),
 * the same person-first order the public slot list uses. Re-checks availability at that exact slot, relies on
 * the unique (staff_id, starts_at) index for races and falls through to the next free person. The meeting
 * length is always the assigned person's own (it may differ from the one shown if the assignee changed).
 * @returns { bookingId, staff, startMs, endMs, minutes, eventId, meetLink }
 */
export async function bookSlot({ startMs, lead, fit, utms, pageUrl }) {
  const now = Date.now()
  const { staff } = await bookableStaff()
  const candidates = staff.filter((s) => generateStaffSlots(s, [], now).some((sl) => sl.start === startMs))
  if (!candidates.length) throw new AgendaError('slot_unavailable', 409)

  const span = (s) => {
    const sc = scheduleOf(s)
    return { minutes: sc.meetingMinutes, end: startMs + sc.meetingMinutes * 60000, buf: sc.bufferMinutes * 60000 }
  }
  const from = Math.min(...candidates.map((s) => startMs - span(s).buf))
  const to = Math.max(...candidates.map((s) => span(s).end + span(s).buf))
  const [busy, booked] = await Promise.all([
    busyForStaff(candidates, new Date(from).toISOString(), new Date(to).toISOString()),
    bookedRanges(candidates.map((s) => s.id), new Date(from).toISOString(), new Date(to).toISOString()),
  ])
  const free = freeAt(candidates, busy, booked, startMs)
  // Nobody is free any more: drop the cached availability so the client's refresh no longer offers it.
  if (!free.length) { invalidateAvailability(); throw new AgendaError('slot_taken', 409) }

  const policy = await assignmentPolicy()
  const order = assignmentOrder(policy, free, policy === 'round_robin' ? await lastBookings(free.map((s) => s.id)) : null)
  let calendarFailed = false
  for (const s of order) {
    const { end: endMs, minutes } = span(s)
    const { data: row, error } = await db().from('agenda_bookings').insert({
      staff_id: s.id,
      starts_at: new Date(startMs).toISOString(),
      ends_at: new Date(endMs).toISOString(),
      lead: { ...lead, fit, utms, page_url: pageUrl },
      status: 'pending',
    }).select('id').single()
    if (error) {
      if (error.code === '23505') continue // someone took this person's slot a moment ago
      console.error('[agenda] booking insert failed', error.code)
      throw new AgendaError('db_error', 502)
    }
    try {
      const token = await accessTokenFor(s)
      const ev = await createEvent(token, eventBody({ staff: s, startMs, endMs, lead, fit }))
      const { error: upErr } = await db().from('agenda_bookings')
        .update({ google_event_id: ev.id, meet_link: ev.meetLink, status: 'confirmed' }).eq('id', row.id)
      if (upErr) console.error('[agenda] booking update failed', row.id, upErr.code)
      invalidateAvailability()
      return { bookingId: row.id, staff: s, startMs, endMs, minutes, eventId: ev.id, meetLink: ev.meetLink }
    } catch (e) {
      calendarFailed = true
      console.error('[agenda] event creation failed for staff', s.id, e.code || e.message)
      const { error: delErr } = await db().from('agenda_bookings').delete().eq('id', row.id)
      if (delErr) console.error('[agenda] could not delete orphan booking', row.id, delErr.code)
    }
  }
  invalidateAvailability()
  throw calendarFailed ? new AgendaError('calendar_error', 502) : new AgendaError('slot_taken', 409)
}
