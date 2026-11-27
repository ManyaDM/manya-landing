import { bookingConfigured } from '@/lib/agenda/config'
import { json, readJson } from '@/lib/agenda/http'
import { clientIp, createRateLimiter } from '@/lib/agenda/ratelimit'
import { AgendaError, bookSlot } from '@/lib/agenda/service'
import { scheduleOf } from '@/lib/agenda/slots'
import { cleanAttribution, cleanPageUrl, cleanUtms, qualify, validateLead } from '@/lib/agenda/validation'
import { sendToMake } from '@/lib/agenda/webhook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const limiter = createRateLimiter({ windowMs: 10 * 60_000, max: 5 })

/**
 * POST /api/agenda/book
 * body: { start: ISO, lead: {...form fields}, utms: {...}, page_url, honeypot }
 * → { ok, start, end, minutes, meet_link } (minutes = the assigned person's meeting length)
 */
export async function POST(request) {
  if (!bookingConfigured()) return json({ error: 'not_configured' }, 503)
  const rl = limiter.check(clientIp(request))
  if (!rl.ok) return json({ error: 'rate_limited' }, 429, { 'Retry-After': String(rl.retryAfter) })

  const body = await readJson(request)
  if (!body) return json({ error: 'invalid_body' }, 400)
  // Bots that fill the hidden field get a plausible success and nothing is booked.
  if (body.honeypot) return json({ ok: true, start: body.start || null, end: null, minutes: null, meet_link: '' })

  const startMs = typeof body.start === 'string' ? Date.parse(body.start) : NaN
  if (!Number.isFinite(startMs) || startMs % 60000 !== 0) return json({ error: 'invalid_start' }, 400)
  const v = validateLead(body.lead)
  if (!v.ok) return json({ error: 'invalid_lead', fields: v.errors }, 400)
  const fit = qualify(v.lead)
  if (fit.level === 'no_apto') return json({ error: 'not_eligible' }, 403)
  const utms = cleanUtms(body.utms)
  const attribution = cleanAttribution(body.attribution)
  const pageUrl = cleanPageUrl(body.page_url) || cleanPageUrl(request.headers.get('referer'))

  let result
  try {
    result = await bookSlot({ startMs, lead: v.lead, fit, utms, attribution, pageUrl })
  } catch (e) {
    if (e instanceof AgendaError) return json({ error: e.code }, e.status)
    console.error('[agenda] booking failed', e.message)
    return json({ error: 'server_error' }, 500)
  }

  const start = new Date(result.startMs).toISOString()
  const end = new Date(result.endMs).toISOString()
  // Make is notified after the booking is safe in the calendar; its failure never fails the booking.
  await sendToMake({
    type: 'mapa_de_fugas_booking',
    lead: v.lead,
    fit,
    booking: {
      id: result.bookingId,
      start,
      end,
      minutes: result.minutes,
      timezone: scheduleOf(result.staff).timezone,
      staff_name: result.staff.name,
      staff_email: result.staff.email,
      meet_link: result.meetLink,
      event_id: result.eventId,
    },
    utms,
    attribution,
    page_url: pageUrl,
    created_at: new Date().toISOString(),
  })

  return json({ ok: true, start, end, minutes: result.minutes, meet_link: result.meetLink })
}
