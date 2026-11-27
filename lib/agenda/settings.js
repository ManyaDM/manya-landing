// Scheduling settings (pure, no I/O): global defaults in agenda_settings('defaults') and nullable
// per-person overrides on agenda_staff. A person's own value wins; null means "use the global one".

/** Overridable fields and their valid ranges (same as the agenda_staff check constraints). */
export const SCHEDULE_FIELDS = {
  meeting_minutes: [5, 240],
  slot_step_minutes: [5, 240],
  min_notice_hours: [0, 720],
  days_ahead: [1, 60],
  buffer_minutes: [0, 240],
}
export const SCHEDULE_KEYS = Object.keys(SCHEDULE_FIELDS)

/** Hardcoded defaults: used until supabase/agenda_003.sql has inserted the 'defaults' row. */
export const DEFAULT_SCHEDULE = Object.freeze({
  meeting_minutes: 20,
  slot_step_minutes: 30,
  min_notice_hours: 12,
  days_ahead: 30,
  buffer_minutes: 0,
})

export const DEFAULTS_KEY = 'defaults'

const inRange = (k, v) => {
  const [min, max] = SCHEDULE_FIELDS[k]
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
}

/** Coerces a stored 'defaults' value: every valid field is kept, anything else falls back to DEFAULT_SCHEDULE. */
export function normalizeDefaults(value) {
  const src = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const out = {}
  for (const k of SCHEDULE_KEYS) {
    const n = typeof src[k] === 'string' && src[k].trim() !== '' ? Number(src[k]) : src[k]
    out[k] = inRange(k, n) ? n : DEFAULT_SCHEDULE[k]
  }
  return out
}

/** True when the staff row has its own value for `key` (null/undefined = inherits the global one). */
export const isOverride = (staff, key) => staff?.[key] !== null && staff?.[key] !== undefined

/**
 * Staff row with every overridable field resolved: personal value ?? global default.
 * Personal values outside the valid range are ignored (the global one is used instead).
 */
export function effectiveStaff(staff, defaults) {
  const d = normalizeDefaults(defaults)
  const out = { ...staff }
  for (const k of SCHEDULE_KEYS) {
    const own = isOverride(staff, k) ? Number(staff[k]) : null
    out[k] = own !== null && inRange(k, own) ? own : d[k]
  }
  return out
}

/** Validates a full or partial update of the global defaults, merged over `current`. */
export function validateDefaults(body, current = DEFAULT_SCHEDULE) {
  const src = body && typeof body === 'object' && !Array.isArray(body) ? body : null
  if (!src) return { ok: false, errors: ['defaults'] }
  const value = normalizeDefaults(current)
  const errors = []
  let touched = false
  for (const k of SCHEDULE_KEYS) {
    if (!(k in src)) continue
    touched = true
    const n = Number(src[k])
    src[k] !== null && src[k] !== '' && inRange(k, n) ? (value[k] = n) : errors.push(k)
  }
  if (!errors.length && !touched) errors.push('empty')
  return errors.length ? { ok: false, errors } : { ok: true, value }
}

/**
 * Validates one overridable field of a staff patch.
 * @returns { ok: true, value: number|null } (null clears the override) or { ok: false }
 */
export function validateOverride(key, raw) {
  if (raw === null) return { ok: true, value: null }
  const n = Number(raw)
  return raw !== '' && inRange(key, n) ? { ok: true, value: n } : { ok: false }
}

// ---- admin staff card: partial updates

/** Staff fields the admin card can change. */
export const STAFF_EDITABLE = ['name', 'active', 'timezone', 'weekly_hours', ...SCHEDULE_KEYS]

const canonHours = (wh) => {
  const src = wh && typeof wh === 'object' ? wh : {}
  const out = {}
  for (let d = 0; d <= 6; d++) {
    const list = src[d] ?? src[String(d)] ?? []
    out[d] = (Array.isArray(list) ? list : []).map((r) => ({ start: r?.start ?? '', end: r?.end ?? '' }))
  }
  return out
}
const canon = (k, v) => {
  if (k === 'weekly_hours') return canonHours(v)
  if (SCHEDULE_FIELDS[k]) {
    if (v === null || v === undefined) return null
    return v === '' || !Number.isFinite(Number(v)) ? String(v) : Number(v)
  }
  return v ?? null
}

/**
 * PATCH body for the admin staff card: only the fields the user edited (`edits`) whose value differs
 * from the last server snapshot. Untouched fields are never sent, so a stale tab cannot overwrite
 * changes made elsewhere (e.g. a migration that rewrote weekly_hours).
 */
export function staffPatch(snapshot, edits) {
  const out = {}
  for (const k of STAFF_EDITABLE) {
    if (!edits || !Object.prototype.hasOwnProperty.call(edits, k)) continue
    const next = canon(k, edits[k])
    if (JSON.stringify(canon(k, snapshot?.[k])) !== JSON.stringify(next)) out[k] = next
  }
  return out
}
