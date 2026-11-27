// Round robin assignment (pure): whoever was booked least recently goes first.

/**
 * @param candidates [{id, name?}]
 * @param lastBookedAt Map|object staffId → ISO string or ms of their latest booking (missing = never booked)
 * @returns candidates ordered by priority (never booked first, then oldest last booking; ties by name, then id)
 */
export function roundRobinOrder(candidates, lastBookedAt) {
  const get = (id) => {
    const v = lastBookedAt instanceof Map ? lastBookedAt.get(id) : lastBookedAt?.[id]
    if (v === undefined || v === null) return -Infinity
    const ms = typeof v === 'number' ? v : Date.parse(v)
    return Number.isFinite(ms) ? ms : -Infinity
  }
  return [...candidates].sort((a, b) => {
    const d = get(a.id) - get(b.id)
    if (d !== 0 && Number.isFinite(d)) return d
    if (get(a.id) !== get(b.id)) return get(a.id) === -Infinity ? -1 : 1
    return String(a.name || '').localeCompare(String(b.name || '')) || String(a.id).localeCompare(String(b.id))
  })
}

/** Latest booking per staff from rows [{staff_id, created_at}]. */
export function latestByStaff(rows) {
  const out = new Map()
  for (const r of rows || []) {
    const ms = Date.parse(r.created_at)
    if (!Number.isFinite(ms)) continue
    if (!out.has(r.staff_id) || out.get(r.staff_id) < ms) out.set(r.staff_id, ms)
  }
  return out
}

// ---- assignment policies

export const POLICIES = ['priority', 'round_robin']
export const DEFAULT_POLICY = 'priority'

/** Coerces a stored setting into a known policy (unknown or missing → priority). */
export function normalizePolicy(value) {
  const p = value && typeof value === 'object' ? value.policy : value
  return POLICIES.includes(p) ? p : DEFAULT_POLICY
}

const prio = (s) => {
  const n = Number(s.priority)
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}

/** Lowest `priority` value first; ties by creation date, then id (stable across requests). */
export function priorityOrder(candidates) {
  return [...candidates].sort((a, b) =>
    prio(a) - prio(b)
    || String(a.created_at || '').localeCompare(String(b.created_at || ''))
    || String(a.id).localeCompare(String(b.id)))
}

/**
 * Order in which free staff members are tried for a booking.
 * priority    → cascade: the highest-priority free person gets it.
 * round_robin → whoever was booked least recently gets it.
 */
export function assignmentOrder(policy, candidates, lastBookedAt) {
  return normalizePolicy(policy) === 'round_robin'
    ? roundRobinOrder(candidates, lastBookedAt)
    : priorityOrder(candidates)
}
