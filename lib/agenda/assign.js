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
