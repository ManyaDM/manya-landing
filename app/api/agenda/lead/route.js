import { json, readJson } from '@/lib/agenda/http'
import { clientIp, createRateLimiter } from '@/lib/agenda/ratelimit'
import { cleanPageUrl, cleanUtms, qualify, validateLead } from '@/lib/agenda/validation'
import { sendToMake } from '@/lib/agenda/webhook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const limiter = createRateLimiter({ windowMs: 10 * 60_000, max: 10 })

/**
 * POST /api/agenda/lead — every completed form (fit or not) is forwarded to Make as
 * type 'mapa_de_fugas_lead'. Bookings arrive later as 'mapa_de_fugas_booking' with the same lead_id.
 * body: { lead: {...form fields, lead_id}, utms, page_url, honeypot } → { ok }
 */
export async function POST(request) {
  const rl = limiter.check(clientIp(request))
  if (!rl.ok) return json({ error: 'rate_limited' }, 429, { 'Retry-After': String(rl.retryAfter) })
  const body = await readJson(request)
  if (!body) return json({ error: 'invalid_body' }, 400)
  if (body.honeypot) return json({ ok: true })

  const v = validateLead(body.lead)
  if (!v.ok) return json({ error: 'invalid_lead', fields: v.errors }, 400)
  const fit = qualify(v.lead)
  await sendToMake({
    type: 'mapa_de_fugas_lead',
    lead: v.lead,
    fit,
    utms: cleanUtms(body.utms),
    page_url: cleanPageUrl(body.page_url) || cleanPageUrl(request.headers.get('referer')),
    created_at: new Date().toISOString(),
  })
  return json({ ok: true })
}
