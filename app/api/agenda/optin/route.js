import { json, readJson } from '@/lib/agenda/http'
import { clientIp, createRateLimiter } from '@/lib/agenda/ratelimit'
import { cleanAttribution, cleanPageUrl, cleanUtms, isEmail } from '@/lib/agenda/validation'
import { sendToMake } from '@/lib/agenda/webhook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const limiter = createRateLimiter({ windowMs: 10 * 60_000, max: 10 })
const PAUTA = ['nada', 'bajo', '500', '1000', '2000', '5000']
const EQUIPO = ['equipo', 'persona', 'mixto', 'nadie']
const TICKET = ['lt100', '100', '500', '2000', '10000']
const pick = (list, v) => (typeof v === 'string' && list.includes(v) ? v : '')

/**
 * POST /api/agenda/optin — leaves only an email from the "no encaja" screen, so Make can
 * notify this person when something for their stage exists. body: { email, answers, utms, attribution, page_url, honeypot }
 */
export async function POST(request) {
  const rl = limiter.check(clientIp(request))
  if (!rl.ok) return json({ error: 'rate_limited' }, 429, { 'Retry-After': String(rl.retryAfter) })
  const body = await readJson(request)
  if (!body) return json({ error: 'invalid_body' }, 400)
  if (body.honeypot) return json({ ok: true })

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!isEmail(email)) return json({ error: 'invalid_email' }, 400)

  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {}
  await sendToMake({
    type: 'mapa_de_fugas_optin',
    email,
    answers: {
      pauta: pick(PAUTA, answers.pauta),
      equipo: pick(EQUIPO, answers.equipo),
      ticket: pick(TICKET, answers.ticket),
    },
    utms: cleanUtms(body.utms),
    attribution: cleanAttribution(body.attribution),
    page_url: cleanPageUrl(body.page_url) || cleanPageUrl(request.headers.get('referer')),
    created_at: new Date().toISOString(),
  })
  return json({ ok: true })
}
