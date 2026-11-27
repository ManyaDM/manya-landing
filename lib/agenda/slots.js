// Slot generation (pure, no I/O). Time zones are resolved with Intl, never with a hardcoded offset,
// so a staff member in another zone (or one with DST) gets correct wall-clock windows.

export const DISPLAY_TZ = 'America/Lima'
export const DEFAULT_WEEKLY_HOURS = {
  0: [],
  1: [{ start: '09:00', end: '18:00' }],
  2: [{ start: '09:00', end: '18:00' }],
  3: [{ start: '09:00', end: '18:00' }],
  4: [{ start: '09:00', end: '18:00' }],
  5: [{ start: '09:00', end: '18:00' }],
  6: [],
}

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
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}

/** Schedule settings with safe bounds applied. */
export function scheduleOf(staff) {
  return {
    timezone: isValidTimeZone(staff.timezone) ? staff.timezone : DISPLAY_TZ,
    weeklyHours: normalizeWeeklyHours(staff.weekly_hours) || DEFAULT_WEEKLY_HOURS,
    meetingMinutes: int(staff.meeting_minutes, 5, 240, 20),
    stepMinutes: int(staff.slot_step_minutes, 5, 240, 30),
    noticeHours: int(staff.min_notice_hours, 0, 24 * 30, 12),
    daysAhead: int(staff.days_ahead, 1, 60, 14),
    bufferMinutes: int(staff.buffer_minutes, 0, 240, 0),
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

/** Merges per-staff slots by start time. Input [{staffId, slots}] → [{start, end, staffIds}] sorted. */
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

const pad = (n) => String(n).padStart(2, '0')

/** Public shape: days in the display zone, without any staff information. */
export function groupByDay(merged, tz = DISPLAY_TZ) {
  const days = new Map()
  for (const sl of merged) {
    const p = zonedParts(sl.start, tz)
    const date = p.year + '-' + pad(p.month) + '-' + pad(p.day)
    if (!days.has(date)) days.set(date, [])
    days.get(date).push({ start: new Date(sl.start).toISOString(), end: new Date(sl.end).toISOString(), time: pad(p.hour) + ':' + pad(p.minute) })
  }
  return [...days.entries()].map(([date, slots]) => ({ date, slots }))
}
