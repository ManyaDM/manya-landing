import { bookingConfigured } from '@/lib/agenda/config'
import { json } from '@/lib/agenda/http'
import { clientIp, createRateLimiter } from '@/lib/agenda/ratelimit'
import { AgendaError, publicAvailability } from '@/lib/agenda/service'
import { DISPLAY_TZ } from '@/lib/agenda/slots'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const limiter = createRateLimiter({ windowMs: 60_000, max: 20 })

/**
 * GET /api/agenda/slots → { timezone, meeting_minutes, days: [{ date, slots: [{ start, end, time, minutes }] }] }.
 * meeting_minutes is the global default; a slot whose assignee has another length carries its own `minutes`. No staff data.
 */
export async function GET(request) {
  if (!bookingConfigured()) return json({ error: 'not_configured' }, 503)
  const rl = limiter.check(clientIp(request))
  if (!rl.ok) return json({ error: 'rate_limited' }, 429, { 'Retry-After': String(rl.retryAfter) })
  try {
    const { days, meetingMinutes } = await publicAvailability()
    return json({ timezone: DISPLAY_TZ, meeting_minutes: meetingMinutes, days })
  } catch (e) {
    const status = e instanceof AgendaError ? e.status : 500
    if (!(e instanceof AgendaError)) console.error('[agenda] slots failed', e.message)
    return json({ error: e instanceof AgendaError ? e.code : 'server_error' }, status)
  }
}
