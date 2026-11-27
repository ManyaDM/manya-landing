// HMAC-SHA256 signed tokens (admin session cookie, OAuth state).
// Pure Node module so it can be unit tested; only imported by server code.
import { createHmac, timingSafeEqual } from 'node:crypto'

function mac(data, secret) {
  return createHmac('sha256', String(secret)).update(data).digest('base64url')
}

/** Constant-time string comparison (length leak only). */
export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''))
  const y = Buffer.from(String(b ?? ''))
  if (x.length !== y.length) return false
  return timingSafeEqual(x, y)
}

/** Signs a JSON payload with an expiry. Returns "<base64url(json)>.<mac>". */
export function signToken(payload, secret, ttlSeconds, now = Date.now()) {
  if (!secret) throw new Error('signing_secret_missing')
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(now / 1000) + ttlSeconds })).toString('base64url')
  return body + '.' + mac(body, secret)
}

/** Returns the payload when the signature is valid and not expired; otherwise null. */
export function verifyToken(token, secret, now = Date.now()) {
  if (!secret || typeof token !== 'string' || token.length > 4096) return null
  const dot = token.indexOf('.')
  if (dot <= 0 || dot !== token.lastIndexOf('.')) return null
  const body = token.slice(0, dot)
  if (!safeEqual(token.slice(dot + 1), mac(body, secret))) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload || typeof payload.exp !== 'number' || payload.exp * 1000 < now) return null
    return payload
  } catch {
    return null
  }
}
