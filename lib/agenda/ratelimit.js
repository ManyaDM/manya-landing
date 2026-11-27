// In-memory sliding-window rate limiter (per process; Railway runs a single long-lived Node server).

export function createRateLimiter({ windowMs, max, maxKeys = 10000 }) {
  const hits = new Map()
  return {
    /** Records a hit for `key`. Returns { ok, retryAfter } (retryAfter in seconds). */
    check(key, now = Date.now()) {
      const since = now - windowMs
      const list = (hits.get(key) || []).filter((t) => t > since)
      if (list.length >= max) {
        hits.set(key, list)
        return { ok: false, retryAfter: Math.max(1, Math.ceil((list[0] + windowMs - now) / 1000)) }
      }
      list.push(now)
      hits.delete(key) // re-insert so Map order tracks recency
      hits.set(key, list)
      if (hits.size > maxKeys) hits.delete(hits.keys().next().value)
      return { ok: true, retryAfter: 0 }
    },
  }
}

/** Client IP behind Railway's proxy (first X-Forwarded-For hop). */
export function clientIp(request) {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim().slice(0, 64)
  return (request.headers.get('x-real-ip') || 'unknown').slice(0, 64)
}
