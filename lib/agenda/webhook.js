import 'server-only'
import { env } from './config'

/**
 * Forwards an event to the Make scenario. Never throws: a Make outage must not break bookings.
 * The webhook URL is a secret and is never logged or sent to the browser.
 * @returns true when Make accepted the payload
 */
export async function sendToMake(payload) {
  const url = env.makeWebhookUrl
  if (!url) {
    console.warn('[agenda] MAKE_AGENDA_WEBHOOK_URL not set; skipped', payload.type)
    return false
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (!res.ok) console.error('[agenda] Make webhook responded', res.status, payload.type)
    return res.ok
  } catch (e) {
    console.error('[agenda] Make webhook failed', payload.type, e.name)
    return false
  }
}
