import 'server-only'
import { NextResponse } from 'next/server'

const NO_STORE = { 'Cache-Control': 'no-store' }

export function json(body, status = 200, headers = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } })
}

/** Reads a JSON body with a hard size limit. Returns the parsed object or null. */
export async function readJson(request, maxBytes = 16 * 1024) {
  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > maxBytes) return null
  if (!(request.headers.get('content-type') || '').includes('application/json')) return null
  const reader = request.body?.getReader()
  if (!reader) return null
  const chunks = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) { try { await reader.cancel() } catch { /* ignore */ } return null }
    chunks.push(value)
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Rejects cross-site state-changing requests (admin endpoints): Origin must match Host when present. */
export function sameOrigin(request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try { return new URL(origin).host === request.headers.get('host') } catch { return false }
}
