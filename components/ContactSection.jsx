'use client'
import { useState, useEffect, useRef } from 'react'

const BUDGET_OPTIONS = [
  'Menos de S/ 2,000',
  'S/ 2,000 – S/ 5,000',
  'S/ 5,000 – S/ 10,000',
  'S/ 10,000 – S/ 30,000',
  'Más de S/ 30,000',
  'Todavía no invierto en pauta',
]

// Budgets below the agency minimum go to a nurture funnel instead of WhatsApp.
const NURTURE_BUDGETS = ['Todavía no invierto en pauta', 'Menos de S/ 2,000']

const ECOMMERCE_OBJECTIVE = 'Quiero escalar mis ventas de ecommerce'

const STEPS = [
  { n: 1, title: 'Tus datos' },
  { n: 2, title: 'Tu proyecto' },
]

// Values that are not a real company name (compared after normalize()).
const JUNK_COMPANY = new Set([
  'no', 'na', 'n/a', 'n.a', 'ni', 'x', 'xx', 'xxx', 'yo', 'nada', 'ninguna', 'ninguno',
  'no tengo', 'no tengo empresa', 'aun no tengo', 'todavia no', 'aun no', 'sin empresa',
  'no aplica', 'independiente', 'particular', 'persona natural', 'personal', 'propia',
  'mi empresa', 'empresa', 'test', 'prueba', 'asdf', 'qwerty', 'none', 'nn',
])

const JUNK_NAME = new Set(['test', 'prueba', 'asdf', 'qwerty', 'xxx', 'nn', 'na'])

const FREE_EMAIL_DOMAINS = [
  'gmail.com', 'hotmail.com', 'outlook.com', 'outlook.es', 'yahoo.com', 'yahoo.es',
  'live.com', 'icloud.com', 'hotmail.es', 'msn.com',
]

function normalize(text) {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

function isJunkCompany(value) {
  const v = normalize(value)
  if (v.replace(/[^a-z0-9]/g, '').length < 2) return true
  if (!/[a-z]/.test(v)) return true
  if (JUNK_COMPANY.has(v)) return true
  return /\bno tengo\b|\bsin empresa\b|\bninguna?\b/.test(v)
}

function isFreeEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase().trim()
  return Boolean(domain) && FREE_EMAIL_DOMAINS.includes(domain)
}

// Peruvian mobile numbers: 9 digits starting with 9. Strips a pasted +51 prefix.
function sanitizeWhatsapp(raw) {
  let digits = raw.replace(/\D/g, '')
  if (digits.length > 9 && digits.startsWith('51')) digits = digits.slice(2)
  return digits.slice(0, 9)
}

function countWords(text) {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

function normalizeSitioWeb(value) {
  const clean = value.replace(/\s/g, '')
  if (!clean) return ''
  if (!/^https?:\/\//i.test(clean)) return `https://${clean}`
  return clean
}

function buildWAUrl(fields) {
  const objetivo = fields.objetivo === 'Otro' ? fields.otroText : fields.objetivo
  const msg =
    `Hola, soy ${fields.nombre}, de la empresa ${fields.empresa}. ${objetivo}. ` +
    `Mi inversión mensual en pauta está en el rango de ${fields.presupuesto}`
  return `https://api.whatsapp.com/send/?phone=51997510692&text=${encodeURIComponent(msg)}`
}

export default function ContactSection({ data }) {
  const { sectionTitle, sectionDesc, tagline, trustItems, objectives } = data

  const [step, setStep] = useState(1)
  const [fields, setFields] = useState({
    nombre: '',
    whatsapp: '',
    email: '',
    empresa: '',
    presupuesto: '',
    objetivo: '',
    otroText: '',
    sitioWeb: '',
    terms: false,
    bitacora: false,
  })
  const [errors, setErrors] = useState({})
  const [emailHint, setEmailHint] = useState(false)
  const [budgetInfo, setBudgetInfo] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [nurtureModal, setNurtureModal] = useState(false)
  const [utms, setUtms] = useState({
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_term: '',
    utm_content: '',
  })
  const formRef = useRef(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const gclid = params.get('gclid')
    const fbclid = params.get('fbclid')
    const ttclid = params.get('ttclid')

    let source = params.get('utm_source') || ''
    let medium = params.get('utm_medium') || ''

    if (!source) {
      if (gclid) { source = 'google'; medium = medium || 'cpc' }
      else if (fbclid) { source = 'meta'; medium = medium || 'paid_social' }
      else if (ttclid) { source = 'tiktok'; medium = medium || 'paid_social' }
    }

    setUtms({
      utm_source: source,
      utm_medium: medium,
      utm_campaign: params.get('utm_campaign') || '',
      utm_term: params.get('utm_term') || '',
      utm_content: params.get('utm_content') || '',
    })
  }, [])

  const setField = (key, val) => {
    setFields(f => ({ ...f, [key]: val }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const validateStep1 = () => {
    const e = {}
    const nombre = normalize(fields.nombre)
    if (!nombre) e.nombre = 'El nombre es requerido'
    else if (nombre.split(' ').length < 2 || JUNK_NAME.has(nombre) || !/[a-z]{2}/.test(nombre))
      e.nombre = 'Ingresa tu nombre y apellido'
    if (!/^9\d{8}$/.test(fields.whatsapp)) e.whatsapp = 'Ingresa un celular de 9 dígitos que empiece con 9'
    if (!fields.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
      e.email = 'Ingresa un email válido'
    if (!fields.empresa.trim()) e.empresa = 'La empresa es requerida'
    else if (isJunkCompany(fields.empresa)) e.empresa = 'Ingresa el nombre de tu empresa o negocio'
    return e
  }

  const validateStep2 = () => {
    const e = {}
    if (!fields.presupuesto) e.presupuesto = 'Selecciona un rango'
    if (!fields.objetivo) e.objetivo = 'Selecciona un objetivo'
    if (fields.objetivo === 'Otro') {
      if (!fields.otroText.trim()) e.otroText = 'Describe tu objetivo'
      else if (countWords(fields.otroText) > 50) e.otroText = 'Máximo 50 palabras'
    }
    if (fields.objetivo === ECOMMERCE_OBJECTIVE && fields.sitioWeb) {
      const host = fields.sitioWeb.replace(/^https?:\/\//i, '')
      if (!host.includes('.')) e.sitioWeb = 'Ingresa una URL válida (ej: tutienda.com)'
    }
    if (!fields.terms) e.terms = 'Debes aceptar los términos y condiciones'
    return e
  }

  const scrollFormIntoView = () => {
    const el = formRef.current
    if (!el) return
    const top = el.getBoundingClientRect().top
    if (top < 0 || top > window.innerHeight * 0.4) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const goToStep2 = () => {
    const e = validateStep1()
    setErrors(e)
    if (Object.keys(e).length > 0) return

    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event: 'form_step1_complete' })

    setStep(2)
    scrollFormIntoView()
  }

  const goToStep1 = () => {
    setStep(1)
    scrollFormIntoView()
  }

  const handleSubmit = async () => {
    const e = validateStep2()
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const isNurture = NURTURE_BUDGETS.includes(fields.presupuesto)
    setSending(true)

    // Separate events so low-budget leads don't count as Ads conversions.
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event: isNurture ? 'lead_nurture_submit' : 'whatsapp_form_submit' })

    const finalObjetivo = fields.objetivo === 'Otro' ? fields.otroText : fields.objetivo
    const payload = {
      nombre: fields.nombre,
      whatsapp: `+51${fields.whatsapp}`,
      email: fields.email,
      empresa: fields.empresa,
      presupuesto: fields.presupuesto,
      segmento: isNurture ? 'nurture' : 'calificado',
      emailCorporativo: !isFreeEmail(fields.email),
      objetivo: finalObjetivo,
      sitioWeb: fields.objetivo === ECOMMERCE_OBJECTIVE ? fields.sitioWeb : undefined,
      bitacora: fields.bitacora,
      timestamp: new Date().toISOString(),
      ...utms,
    }

    try {
      await fetch('https://hook.us1.make.com/247dthhjbd85knn34yjzj65j2up5o8rz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (_) {}

    setSending(false)

    if (isNurture) {
      setNurtureModal(true)
      setSent(true)
      return
    }

    window.open(buildWAUrl(fields), '_blank')
    setSent(true)
  }

  const onFormSubmit = (ev) => {
    ev.preventDefault()
    if (sent || sending) return
    if (step === 1) goToStep2()
    else handleSubmit()
  }

  const wordCount = countWords(fields.otroText)
  const firstName = fields.nombre.trim().split(/\s+/)[0] || ''

  return (
    <section className="results-section">
      <div className="contact-wrap">
        <div className="contact-info reveal">
          <div className="section-num">Diagnóstico</div>
          <h2>{sectionTitle}</h2>
          <p>{sectionDesc}</p>
          <div className="trust-list">
            {trustItems.map((item) => (
              <div key={item} className="trust-item">
                <div className="trust-bullet" />
                {item}
              </div>
            ))}
          </div>
          <div className="contact-tag">{tagline}</div>
        </div>

        <form id="contacto" ref={formRef} className="lead-form reveal" onSubmit={onFormSubmit} noValidate>
          <input type="hidden" id="utm_source" name="utm_source" value={utms.utm_source} readOnly />
          <input type="hidden" id="utm_medium" name="utm_medium" value={utms.utm_medium} readOnly />
          <input type="hidden" id="utm_campaign" name="utm_campaign" value={utms.utm_campaign} readOnly />
          <input type="hidden" id="utm_term" name="utm_term" value={utms.utm_term} readOnly />
          <input type="hidden" id="utm_content" name="utm_content" value={utms.utm_content} readOnly />

          <div className="contact-info reveal">
            <h2 className="title-mobile">{sectionTitle}</h2>
            <p>El crecimiento real toma tiempo. Empieza hoy.<br />Llena tus datos y solicita una reunión por whatsapp.</p>
          </div>

          <div className="form-progress" aria-label={`Paso ${step} de ${STEPS.length}`}>
            <div className="form-progress-label">
              <span className="form-progress-count">Paso {step} de {STEPS.length}</span>
              <span className="form-progress-title">{STEPS[step - 1].title}</span>
            </div>
            <div className="form-progress-track">
              {STEPS.map(s => (
                <span key={s.n} className={`form-progress-seg${s.n <= step ? ' active' : ''}`} />
              ))}
            </div>
          </div>

          {step === 1 && (
            <div className="form-step" key="step-1">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="cf-nombre">Nombre completo</label>
                  <input
                    id="cf-nombre"
                    type="text"
                    autoComplete="name"
                    placeholder="María García"
                    value={fields.nombre}
                    onChange={e => setField('nombre', e.target.value)}
                    className={errors.nombre ? 'field-error' : ''}
                  />
                  {errors.nombre && <span className="error-msg">{errors.nombre}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="cf-whatsapp">WhatsApp</label>
                  <div className={`wa-input-wrap${errors.whatsapp ? ' field-error' : ''}`}>
                    <span className="wa-prefix">+51</span>
                    <input
                      id="cf-whatsapp"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder="987 654 321"
                      value={fields.whatsapp}
                      onChange={e => {
                        const v = sanitizeWhatsapp(e.target.value)
                        if (v && v[0] !== '9') {
                          setErrors(er => ({ ...er, whatsapp: 'El número debe empezar con 9' }))
                          return
                        }
                        setField('whatsapp', v)
                      }}
                    />
                  </div>
                  {errors.whatsapp && <span className="error-msg">{errors.whatsapp}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="cf-email">Email empresarial</label>
                  <input
                    id="cf-email"
                    type="email"
                    autoComplete="email"
                    placeholder="maria@empresa.com"
                    value={fields.email}
                    onChange={e => { setField('email', e.target.value); setEmailHint(false) }}
                    onBlur={e => setEmailHint(isFreeEmail(e.target.value))}
                    className={errors.email ? 'field-error' : ''}
                  />
                  {errors.email
                    ? <span className="error-msg">{errors.email}</span>
                    : emailHint && <span className="helper-text">Si tienes un email de tu empresa, úsalo: nos ayuda a preparar tu diagnóstico.</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="cf-empresa">Empresa</label>
                  <input
                    id="cf-empresa"
                    type="text"
                    autoComplete="organization"
                    placeholder="Nombre de tu empresa"
                    value={fields.empresa}
                    onChange={e => setField('empresa', e.target.value)}
                    className={errors.empresa ? 'field-error' : ''}
                  />
                  {errors.empresa && <span className="error-msg">{errors.empresa}</span>}
                </div>
              </div>

              <div className="form-footer">
                <button type="submit" className="btn-next">
                  Continuar
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="form-step" key="step-2">
              <div className="form-group">
                <div className="label-row">
                  <label htmlFor="cf-presupuesto">¿Cuál es tu inversión mensual en publicidad (pauta)?</label>
                  <div
                    className="info-tip"
                    onMouseEnter={() => setBudgetInfo(true)}
                    onMouseLeave={() => setBudgetInfo(false)}
                  >
                    <button
                      type="button"
                      className="info-tip-btn"
                      aria-label="Más información sobre la inversión en pauta"
                      aria-expanded={budgetInfo}
                      aria-controls="cf-presupuesto-info"
                      onClick={() => setBudgetInfo(true)}
                      onBlur={() => setBudgetInfo(false)}
                      onKeyDown={e => { if (e.key === 'Escape') setBudgetInfo(false) }}
                    >
                      i
                    </button>
                    {budgetInfo && (
                      <div id="cf-presupuesto-info" role="tooltip" className="info-tip-bubble">
                        Es el dinero que destinas cada mes a anuncios en plataformas como Google, Meta o TikTok.
                        <strong> No es lo que pagarías a Manya</strong> por gestionar tus campañas: el fee de la agencia va aparte.
                      </div>
                    )}
                  </div>
                </div>
                <select
                  id="cf-presupuesto"
                  value={fields.presupuesto}
                  onChange={e => setField('presupuesto', e.target.value)}
                  className={errors.presupuesto ? 'field-error' : ''}
                  aria-describedby="cf-presupuesto-help"
                >
                  <option value="">Selecciona un rango</option>
                  {BUDGET_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {errors.presupuesto
                  ? <span className="error-msg">{errors.presupuesto}</span>
                  : <span id="cf-presupuesto-help" className="helper-text">Solo lo que inviertes en anuncios (Google, Meta, TikTok).</span>}
              </div>

              <div className="form-group">
                <label htmlFor="cf-objetivo">¿Cuál es tu principal objetivo?</label>
                <select
                  id="cf-objetivo"
                  value={fields.objetivo}
                  onChange={e => setField('objetivo', e.target.value)}
                  className={errors.objetivo ? 'field-error' : ''}
                >
                  <option value="">Selecciona tu objetivo</option>
                  {objectives.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {errors.objetivo && <span className="error-msg">{errors.objetivo}</span>}
                {fields.objetivo === 'Otro' && (
                  <div className="otro-wrap">
                    <textarea
                      className={`otro-textarea${errors.otroText ? ' field-error' : ''}`}
                      placeholder="Describe tu objetivo... (máximo 50 palabras)"
                      value={fields.otroText}
                      onChange={e => setField('otroText', e.target.value)}
                      rows={3}
                    />
                    <div className={`word-count${wordCount > 50 ? ' over' : ''}`}>{wordCount}/50 palabras</div>
                    {errors.otroText && <span className="error-msg">{errors.otroText}</span>}
                  </div>
                )}
              </div>

              {fields.objetivo === ECOMMERCE_OBJECTIVE && (
                <div className="form-group">
                  <label htmlFor="cf-sitio">Sitio web de tu tienda</label>
                  <input
                    id="cf-sitio"
                    type="url"
                    placeholder="https://tutienda.com"
                    value={fields.sitioWeb}
                    onChange={e => setField('sitioWeb', e.target.value.replace(/\s/g, ''))}
                    onBlur={e => setField('sitioWeb', normalizeSitioWeb(e.target.value))}
                    className={errors.sitioWeb ? 'field-error' : ''}
                  />
                  {errors.sitioWeb && <span className="error-msg">{errors.sitioWeb}</span>}
                </div>
              )}

              <div className="form-group terms-group">
                <label className="terms-label">
                  <input
                    type="checkbox"
                    checked={fields.terms}
                    onChange={e => setField('terms', e.target.checked)}
                  />
                  <span className="terms-checkbox-ui" />
                  <span className="terms-text">
                    Acepto los{' '}
                    <a href="https://manya.pe/terminos-y-condiciones/" target="_blank" rel="noopener noreferrer">
                      términos y condiciones
                    </a>
                  </span>
                </label>
                {errors.terms && <span className="error-msg">{errors.terms}</span>}
              </div>

              <div className="form-group bitacora-group">
                <label className="terms-label">
                  <input
                    type="checkbox"
                    checked={fields.bitacora}
                    onChange={e => setField('bitacora', e.target.checked)}
                  />
                  <span className="terms-checkbox-ui" />
                  <span className="terms-text">
                    Acepto recibir, por correo electrónico, la newsletter "Bitácora Manya" con contenido editorial sobre marketing digital y tendencias, bajo esta{' '}
                    <a href="https://manya.pe/politica-de-consentimiento-bitacora-manya/" target="_blank" rel="noopener noreferrer" className="terminos-link">
                      política de consentimiento
                    </a>.
                  </span>
                </label>
              </div>

              <div className="form-footer">
                <button
                  type="submit"
                  className={`btn-submit${sent ? ' sent' : ''}`}
                  disabled={sent || sending}
                >
                  {!sent && !sending && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                  )}
                  {sent
                    ? '✓ Enviado'
                    : sending
                    ? 'Enviando...'
                    : 'Solicitar una reunión'}
                </button>
                {!sent && (
                  <button type="button" className="btn-back" onClick={goToStep1} disabled={sending}>
                    ← Volver
                  </button>
                )}
              </div>
              <p className="form-note">
                Al enviar este formulario aceptas nuestra política de privacidad. Tu información es confidencial y nunca será compartida con terceros.
              </p>
            </div>
          )}
        </form>
      </div>

      {nurtureModal && (
        <div className="budget-overlay" onClick={() => setNurtureModal(false)}>
          <div className="budget-modal" role="dialog" aria-modal="true" aria-labelledby="nurture-title" onClick={e => e.stopPropagation()}>
            <h3 id="nurture-title" className="budget-modal-title">
              ¡Gracias por tu interés en Manya{firstName ? `, ${firstName}` : ''}!
            </h3>
            <p className="budget-modal-body">
              Nos alegra que pienses en nosotros para hacer crecer tu negocio. Nuestros planes de performance están pensados para inversiones en pauta desde <strong>S/ 2,000 mensuales</strong>: con ese volumen las campañas generan datos suficientes para optimizar y dar resultados.
            </p>
            <p className="budget-modal-body">
              Cuando estés listo para escalar, aquí estaremos.
            </p>
            <button className="budget-modal-btn" onClick={() => setNurtureModal(false)}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
