// Slot generation (pure, no I/O). Time zones are resolved with Intl, never with a hardcoded offset,
// so a staff member in another zone (or one with DST) gets correct wall-clock windows.
import { assignmentOrder } from './assign.js'
import { DEFAULT_SCHEDULE } from './settings.js'

export const DISPLAY_TZ = 'America/Lima'
// Lunch break 13:30–14:30 for everyone (two franjas per weekday).
export const LUNCH = { start: '13:30', end: '14:30' }
const WORKDAY = () => [{ start: '09:00', end: LUNCH.start }, { start: LUNCH.end, end: '18:00' }]
export const DEFAULT_WEEKLY_HOURS = { 0: [], 1: WORKDAY(), 2: WORKDAY(), 3: WORKDAY(), 4: WORKDAY(), 5: WORKDAY(), 6: [] }

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const formatters = new Map()

function formatter(tz) {
  let f = formatters.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    formatters.set(tz, f)
  }
  return f
}

export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false
  try { formatter(tz); return true } catch { return false }
}

/** Wall-clock parts of an instant in a time zone (month is 1-12). */
export function zonedParts(ms, tz) {
  const out = {}
  for (const p of formatter(tz).formatToParts(new Date(ms))) if (p.type !== 'literal') out[p.type] = Number(p.value)
  if (out.hour === 24) out.hour = 0
  return out
}

/** Offset (ms) of a time zone at a given instant: local wall clock minus UTC. */
export function tzOffsetMs(ms, tz) {
  const p = zonedParts(ms, tz)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000
}

/** UTC instant for a wall-clock time in a zone. `minutes` may exceed 59 (minutes after midnight). */
export function zonedToUtc(year, month, day, minutes, tz) {
  const guess = Date.UTC(year, month - 1, day, 0, minutes)
  const off = tzOffsetMs(guess, tz)
  let ts = guess - off
  const off2 = tzOffsetMs(ts, tz)
  if (off2 !== off) ts = guess - off2 // crossed a DST transition
  return ts
}

export function parseHHMM(s) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(s || ''))
  if (m) return Number(m[1]) * 60 + Number(m[2])
  return s === '24:00' ? 1440 : null
}

/** Validates and normalizes weekly_hours. Returns the cleaned object or null when invalid. */
export function normalizeWeeklyHours(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const out = {}
  for (let dow = 0; dow <= 6; dow++) {
    const list = input[dow] ?? input[String(dow)] ?? []
    if (!Array.isArray(list) || list.length > 6) return null
    const cleaned = []
    for (const w of list) {
      const a = parseHHMM(w && w.start), b = parseHHMM(w && w.end)
      if (a === null || b === null || b <= a) return null
      cleaned.push({ start: w.start, end: w.end })
    }
    cleaned.sort((x, y) => parseHHMM(x.start) - parseHHMM(y.start))
    for (let i = 1; i < cleaned.length; i++) if (parseHHMM(cleaned[i].start) < parseHHMM(cleaned[i - 1].end)) return null
    out[dow] = cleaned
  }
  return out
}

/**
 * Splits every franja that fully contains the lunch break into start–13:30 and 14:30–end
 * (mirror of the UPDATE in supabase/agenda_002.sql). Idempotent; other franjas are kept as they are.
 */
export function splitLunch(weeklyHours, lunch = LUNCH) {
  const ls = parseHHMM(lunch.start), le = parseHHMM(lunch.end)
  const out = {}
  for (const [dow, list] of Object.entries(weeklyHours || {})) {
    out[dow] = (Array.isArray(list) ? list : []).flatMap((w) => {
      const a = parseHHMM(w.start), b = parseHHMM(w.end)
      if (a === null || b === null || a > ls || b < le) return [w]
      return [...(a < ls ? [{ start: w.start, end: lunch.start }] : []), ...(b > le ? [{ start: lunch.end, end: w.end }] : [])]
    })
  }
  return out
}

/**
 * Staff members free for [startMs, startMs + their meeting length), including their buffer.
 * @param candidates staff rows (each with its own schedule)
 * @param busy       Map staffId → busy ranges from Google (staff whose calendar could not be read are excluded)
 * @param booked     Map staffId → ranges of existing non-cancelled bookings
 */
export function freeAt(candidates, busy, booked, startMs) {
  return candidates.filter((s) => {
    if (!busy.has(s.id)) return false
    const sc = scheduleOf(s)
    const end = startMs + sc.meetingMinutes * MINUTE, buf = sc.bufferMinutes * MINUTE
    return ![...busy.get(s.id), ...(booked.get(s.id) || [])].some(([bs, be]) => startMs - buf < be && end + buf > bs)
  })
}

/** Google freeBusy ranges ([{start,end}] ISO) → [[startMs, endMs]]. */
export function toRanges(busy) {
  return (busy || [])
    .map((b) => [Date.parse(b.start), Date.parse(b.end)])
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s)
}

function overlaps(ranges, start, end) {
  for (const [s, e] of ranges) if (start < e && end > s) return true
  return false
}

const int = (v, min, max, fallback) => {
  if (v === null || v === undefined || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}

/** Schedule settings with safe bounds applied. Expects an effective row (see effectiveStaff in settings.js). */
export function scheduleOf(staff) {
  return {
    timezone: isValidTimeZone(staff.timezone) ? staff.timezone : DISPLAY_TZ,
    weeklyHours: normalizeWeeklyHours(staff.weekly_hours) || DEFAULT_WEEKLY_HOURS,
    meetingMinutes: int(staff.meeting_minutes, 5, 240, DEFAULT_SCHEDULE.meeting_minutes),
    stepMinutes: int(staff.slot_step_minutes, 5, 240, DEFAULT_SCHEDULE.slot_step_minutes),
    noticeHours: int(staff.min_notice_hours, 0, 24 * 30, DEFAULT_SCHEDULE.min_notice_hours),
    daysAhead: int(staff.days_ahead, 1, 60, DEFAULT_SCHEDULE.days_ahead),
    bufferMinutes: int(staff.buffer_minutes, 0, 240, DEFAULT_SCHEDULE.buffer_minutes),
  }
}

/**
 * Candidate slots for one staff member.
 * @param staff  row with timezone, weekly_hours, meeting_minutes, slot_step_minutes, min_notice_hours, days_ahead, buffer_minutes
 * @param busy   [[startMs, endMs]] ranges to avoid (calendar busy + existing bookings)
 * @param now    current instant (ms)
 * @returns [{start, end}] in ms, sorted
 */
export function generateStaffSlots(staff, busy, now) {
  const s = scheduleOf(staff)
  const dur = s.meetingMinutes * MINUTE
  const buf = s.bufferMinutes * MINUTE
  const minStart = now + s.noticeHours * HOUR
  const today = zonedParts(now, s.timezone)
  const seen = new Set()
  const slots = []
  for (let i = 0; i < s.daysAhead; i++) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + i))
    const y = day.getUTCFullYear(), m = day.getUTCMonth() + 1, d = day.getUTCDate()
    for (const w of s.weeklyHours[day.getUTCDay()] || []) {
      const ws = parseHHMM(w.start), we = parseHHMM(w.end)
      for (let t = ws; t + s.meetingMinutes <= we; t += s.stepMinutes) {
        const start = zonedToUtc(y, m, d, t, s.timezone)
        const end = start + dur
        if (start < minStart || seen.has(start)) continue
        if (overlaps(busy, start - buf, end + buf)) continue
        seen.add(start)
        slots.push({ start, end })
      }
    }
  }
  return slots.sort((a, b) => a.start - b.start)
}

/**
 * Merges per-staff slots by start time. Input [{staffId, slots}] → [{start, end, staffIds}] sorted.
 * `end` is the first contributor's; attributeSlots() sets it from the person who would be assigned.
 */
export function mergeStaffSlots(perStaff) {
  const byStart = new Map()
  for (const { staffId, slots } of perStaff) {
    for (const sl of slots) {
      const cur = byStart.get(sl.start)
      if (cur) { if (!cur.staffIds.includes(staffId)) cur.staffIds.push(staffId) }
      else byStart.set(sl.start, { start: sl.start, end: sl.end, staffIds: [staffId] })
    }
  }
  return [...byStart.values()].sort((a, b) => a.start - b.start)
}

/**
 * Gives every merged slot the meeting length of the person the assignment policy would pick among
 * the ones free at that time (cascade → highest priority; round robin → least recently booked).
 * @param merged     [{start, end, staffIds}] from mergeStaffSlots
 * @param staffById  Map staffId → effective staff row
 * @returns [{start, end, minutes, staffIds, assignee}] (assignee is a staff id and never reaches the browser)
 */
export function attributeSlots(merged, staffById, policy, lastBookedAt) {
  return merged.map((sl) => {
    const free = sl.staffIds.map((id) => staffById.get(id)).filter(Boolean)
    const who = free.length ? assignmentOrder(policy, free, lastBookedAt)[0] : null
    const minutes = who ? scheduleOf(who).meetingMinutes : Math.round((sl.end - sl.start) / MINUTE)
    return { ...sl, end: sl.start + minutes * MINUTE, minutes, assignee: who ? who.id : null }
  })
}

const pad = (n) => String(n).padStart(2, '0')

/** Public shape: days in the display zone, without any staff information. */
export function groupByDay(merged, tz = DISPLAY_TZ) {
  const days = new Map()
  for (const sl of merged) {
    const p = zonedParts(sl.start, tz)
    const date = p.year + '-' + pad(p.month) + '-' + pad(p.day)
    if (!days.has(date)) days.set(date, [])
    days.get(date).push({
      start: new Date(sl.start).toISOString(),
      end: new Date(sl.end).toISOString(),
      time: pad(p.hour) + ':' + pad(p.minute),
      minutes: Math.round((sl.end - sl.start) / MINUTE),
    })
  }
  return [...days.entries()].map(([date, slots]) => ({ date, slots }))
}
