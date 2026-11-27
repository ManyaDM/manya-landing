// Server-side validation mirroring the Mapa de Fugas form (app/mapa-de-fugas/MapaDeFugas.jsx).
// Pure module; never trust the browser's checks.

export const OPTIONS = {
  cargo: {
    'Dueño/a o socio/a': 'Dueño/a o socio/a',
    'Gerencia general o comercial': 'Gerencia general o comercial',
    'Líder de marketing': 'Líder de marketing',
    'Líder de ecommerce': 'Líder de ecommerce',
    'Otro rol': 'Otro rol',
  },
  rubro: {
    salud: 'Salud o clínica', inmobiliaria: 'Inmobiliaria o construcción', educacion: 'Educación',
    b2b: 'Servicios a empresas (B2B)', retail: 'Ecommerce o retail', otro: 'Otro rubro',
  },
  ticket: { lt100: 'Menos de S/ 100', 100: 'S/ 100 – 499', 500: 'S/ 500 – 1,999', 2000: 'S/ 2,000 – 9,999', 10000: 'S/ 10,000 o más' },
  modelo: {
    b2b: 'Venta asistida: un asesor cotiza o se reúne',
    whatsapp: 'Por WhatsApp: consultas, citas o pedidos',
    ecommerce: 'Ecommerce: compran y pagan en tu web',
  },
  pauta: {
    nada: 'Aún no invertimos en publicidad', bajo: 'Menos de USD 500', 500: 'USD 500 – 999',
    1000: 'USD 1,000 – 1,999', 2000: 'USD 2,000 – 4,999', 5000: 'USD 5,000 o más',
  },
  equipo: { equipo: 'Un equipo comercial', persona: 'Una persona dedicada', mixto: 'Lo atiendo yo, entre otras cosas', nadie: 'Hoy nadie de forma consistente' },
  medicion: { kommo: 'En Kommo', crm: 'En otro CRM', excel: 'En Excel o en el mismo WhatsApp', nada: 'No lo registramos' },
  urgencia: { ya: 'Este mes, es prioridad', pronto: 'El próximo mes', validar: 'Depende de validarlo internamente', explorando: 'Solo estoy explorando' },
}

export const FIELD_LABELS = {
  nombre: 'Nombre', empresa: 'Empresa', correo: 'Correo', telefono: 'WhatsApp', cargo: 'Rol',
  rubro: 'Rubro', ticket: 'Valor de una venta', modelo: 'Cómo vende', web: 'Web', instagram: 'Instagram',
  facebook: 'Facebook', tiktok: 'TikTok', linkedin: 'LinkedIn', pauta: 'Inversión en pauta',
  equipo: 'Quién atiende', medicion: 'Dónde registra leads', urgencia: 'Plazo',
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
const URL_CHARS = /^[A-Za-z0-9\-._~:/?#@!$&'()*+,;=%]*$/
const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const str = (v) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s{2,}/g, ' ').trim()

export function normalizePhone(v) {
  let d = String(v || '').replace(/\D/g, '')
  if (d.length > 9 && d.startsWith('51')) d = d.slice(2)
  return /^9\d{8}$/.test(d) ? '+51' + d : null
}

export function isEmail(v) {
  return typeof v === 'string' && v.length <= 120 && EMAIL_RE.test(v)
}

/**
 * Validates the lead payload. Returns { ok: true, lead } or { ok: false, errors: [field...] }.
 * Unknown keys are dropped.
 */
export function validateLead(input) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const errors = []
  const lead = {}

  const nombre = str(src.nombre).slice(0, 60)
  if (!/^[\p{L}\p{M}\s'’-]+$/u.test(nombre) || (nombre.match(/\p{L}/gu) || []).length < 2) errors.push('nombre')
  lead.nombre = nombre

  const empresa = str(src.empresa).replace(/[<>]/g, '').slice(0, 80)
  if (empresa.length < 2 || !/[\p{L}\p{N}]/u.test(empresa)) errors.push('empresa')
  lead.empresa = empresa

  const correo = str(src.correo).toLowerCase()
  if (!isEmail(correo)) errors.push('correo')
  lead.correo = correo

  const tel = normalizePhone(src.telefono)
  if (!tel) errors.push('telefono')
  lead.telefono = tel || ''

  for (const k of ['cargo', 'rubro', 'ticket', 'modelo', 'pauta', 'equipo', 'medicion', 'urgencia']) {
    const v = str(src[k])
    if (!Object.prototype.hasOwnProperty.call(OPTIONS[k], v)) errors.push(k)
    lead[k] = v
  }

  for (const k of ['web', 'facebook', 'linkedin']) {
    const v = str(src[k]).slice(0, 200)
    if (v && !URL_CHARS.test(v)) errors.push(k)
    lead[k] = v
  }
  for (const k of ['instagram', 'tiktok']) {
    const v = str(src[k]).slice(0, 31)
    if (v && !/^@?[\w.]{1,30}$/.test(v)) errors.push(k)
    lead[k] = v
  }
  if (lead.web && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(lead.web)) errors.push('web')
  if (!lead.web && !lead.instagram) errors.push('canales')

  const leadId = str(src.lead_id)
  lead.lead_id = UUID_RE.test(leadId) ? leadId.toLowerCase() : ''

  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true, lead }
}

/** Same rule as the form's live fit checklist. */
export function qualify(lead) {
  if (['nada', 'bajo'].includes(lead.pauta)) return { level: 'no_apto', reason: 'pauta' }
  if (lead.equipo === 'nadie') return { level: 'no_apto', reason: 'equipo' }
  if (['validar', 'explorando'].includes(lead.urgencia)) return { level: 'pendiente_validacion', reason: '' }
  return { level: 'precalificado', reason: '' }
}

export function cleanUtms(input) {
  const src = input && typeof input === 'object' ? input : {}
  const out = {}
  for (const k of UTM_KEYS) out[k] = str(src[k]).slice(0, 200)
  return out
}

export function cleanPageUrl(v) {
  const s = str(v).slice(0, 500)
  try {
    const u = new URL(s)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : ''
  } catch {
    return ''
  }
}

/** Human-readable answers (value → option label) for the calendar event and Make. */
export function describeLead(lead) {
  const lines = []
  for (const [k, label] of Object.entries(FIELD_LABELS)) {
    const v = lead[k]
    if (!v) continue
    lines.push(label + ': ' + (OPTIONS[k] ? OPTIONS[k][v] || v : v))
  }
  return lines
}
