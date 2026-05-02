'use client'
import { useState, useEffect } from 'react'

const trustItems = [
  'Análisis gratuito de tus cuentas actuales sin compromiso',
  'Respuesta en menos de 24 horas hábiles',
  'Recomendaciones accionables independientemente de si contratas',
  'Reunión con especialista senior, no con un vendedor',
  'NDA disponible para empresas con información sensible',
]

const OBJECTIVES = [
  'Quiero escalar mis ventas de ecommerce',
  'Quiero mejorar la calidad de mis leads',
  'Quiero profundizar en la trazabilidad de mis resultados',
  'Quiero expandir mi estrategia de medios digitales',
  'Otro',
]

function countWords(text) {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

function buildWAUrl(fields) {
  const objetivo = fields.objetivo === 'Otro' ? fields.otroText : fields.objetivo
  const msg =
    `Hola, soy ${fields.nombre}, de la empresa ${fields.empresa}. ${objetivo}. ` +
    `Mi presupuesto para campañas está en un intervalo de ${fields.presupuesto}`
  return `https://api.whatsapp.com/send/?phone=51912391850&text=${encodeURIComponent(msg)}`
}

export default function ContactSection() {
  const [fields, setFields] = useState({
    nombre: '',
    whatsapp: '',
    email: '',
    empresa: '',
    presupuesto: '',
    objetivo: '',
    otroText: '',
    terms: false,
  })
  const [errors, setErrors] = useState({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [utms, setUtms] = useState({
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_term: '',
    utm_content: '',
  })

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

  const validate = () => {
    const e = {}
    if (!fields.nombre.trim()) e.nombre = 'El nombre es requerido'
    if (fields.whatsapp.length !== 9) e.whatsapp = 'Ingresa un número de 9 dígitos'
    if (!fields.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
      e.email = 'Ingresa un email válido'
    if (!fields.empresa.trim()) e.empresa = 'La empresa es requerida'
    if (!fields.presupuesto) e.presupuesto = 'Selecciona un presupuesto'
    if (!fields.objetivo) e.objetivo = 'Selecciona un objetivo'
    if (fields.objetivo === 'Otro') {
      if (!fields.otroText.trim()) e.otroText = 'Describe tu objetivo'
      else if (countWords(fields.otroText) > 50) e.otroText = 'Máximo 50 palabras'
    }
    if (!fields.terms) e.terms = 'Debes aceptar los términos y condiciones'
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return

    setSending(true)

    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event: 'whatsapp_form_submit' })

    const finalObjetivo = fields.objetivo === 'Otro' ? fields.otroText : fields.objetivo
    const payload = {
      nombre: fields.nombre,
      whatsapp: `+51${fields.whatsapp}`,
      email: fields.email,
      empresa: fields.empresa,
      presupuesto: fields.presupuesto,
      objetivo: finalObjetivo,
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

    window.open(buildWAUrl(fields), '_blank')
    setSent(true)
    setSending(false)
  }

  const wordCount = countWords(fields.otroText)

  return (
    <section className="results-section">
      <div className="contact-wrap">
        <div className="contact-info reveal">
          <div className="section-num">Diagnóstico</div>
          <h2>Revisemos juntos tus objetivos</h2>
          <p>
            En 30 minutos identificamos las principales oportunidades en tus campañas actuales y
            proyectamos el impacto potencial con la metodología Manya. Sin compromiso, con datos concretos.
          </p>
          <div className="trust-list">
            {trustItems.map((item) => (
              <div key={item} className="trust-item">
                <div className="trust-bullet" />
                {item}
              </div>
            ))}
          </div>
          <div className="contact-tag">Agenda una reunión para un diagnóstico profesional → </div>
        </div>

        <form id="contacto" className="lead-form reveal">
          <input type="hidden" id="utm_source" name="utm_source" value={utms.utm_source} readOnly />
          <input type="hidden" id="utm_medium" name="utm_medium" value={utms.utm_medium} readOnly />
          <input type="hidden" id="utm_campaign" name="utm_campaign" value={utms.utm_campaign} readOnly />
          <input type="hidden" id="utm_term" name="utm_term" value={utms.utm_term} readOnly />
          <input type="hidden" id="utm_content" name="utm_content" value={utms.utm_content} readOnly />

          <div className="contact-info reveal">
            <h2 className="title-mobile">Revisemos juntos tus objetivos</h2>
            <p>El crecimiento real toma tiempo. Empieza hoy.<br />Llena tus datos y solicita una reunión por whatsapp.</p>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Nombre completo</label>
              <input
                type="text"
                placeholder="María García"
                value={fields.nombre}
                onChange={e => setField('nombre', e.target.value)}
                className={errors.nombre ? 'field-error' : ''}
              />
              {errors.nombre && <span className="error-msg">{errors.nombre}</span>}
            </div>
            <div className="form-group">
              <label>WhatsApp</label>
              <div className={`wa-input-wrap${errors.whatsapp ? ' field-error' : ''}`}>
                <span className="wa-prefix">+51</span>
                <input
                  type="tel"
                  placeholder="987 654 321"
                  value={fields.whatsapp}
                  onChange={e => setField('whatsapp', e.target.value.replace(/\D/g, '').slice(0, 9))}
                />
              </div>
              {errors.whatsapp && <span className="error-msg">{errors.whatsapp}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email empresarial</label>
              <input
                type="email"
                placeholder="maria@empresa.com"
                value={fields.email}
                onChange={e => setField('email', e.target.value)}
                className={errors.email ? 'field-error' : ''}
              />
              {errors.email && <span className="error-msg">{errors.email}</span>}
            </div>
            <div className="form-group">
              <label>Empresa</label>
              <input
                type="text"
                placeholder="Nombre de tu empresa"
                value={fields.empresa}
                onChange={e => setField('empresa', e.target.value)}
                className={errors.empresa ? 'field-error' : ''}
              />
              {errors.empresa && <span className="error-msg">{errors.empresa}</span>}
            </div>
          </div>

          <div className="form-group">
            <label>Presupuesto mensual para campañas</label>
            <select
              value={fields.presupuesto}
              onChange={e => setField('presupuesto', e.target.value)}
              className={errors.presupuesto ? 'field-error' : ''}
            >
              <option value="">Selecciona un rango</option>
              <option>Menos de S/ 3,000</option>
              <option>S/ 3,000 – S/ 10,000</option>
              <option>S/ 10,000 – S/ 30,000</option>
              <option>S/ 30,000 – S/ 100,000</option>
              <option>Más de S/ 100,000</option>
            </select>
            {errors.presupuesto && <span className="error-msg">{errors.presupuesto}</span>}
          </div>

          <div className="form-group">
            <label>¿Cuál es tu principal objetivo?</label>
            <select
              value={fields.objetivo}
              onChange={e => setField('objetivo', e.target.value)}
              className={errors.objetivo ? 'field-error' : ''}
            >
              <option value="">Selecciona tu objetivo</option>
              {OBJECTIVES.map(opt => (
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

          <div className="form-group terms-group">
            <label className="terms-label">
              <input
                type="checkbox"
                checked={fields.terms}
                onChange={e => setField('terms', e.target.checked)}
              />
              <span className="terms-checkbox-ui" />
              Acepto los{' '}
              <a href="https://manya.pe/terminos-y-condiciones/" target="_blank" rel="noopener noreferrer">
                términos y condiciones
              </a>
            </label>
            {errors.terms && <span className="error-msg">{errors.terms}</span>}
          </div>

          <div className="form-footer">
            <button
              type="button"
              className={`btn-submit${sent ? ' sent' : ''}`}
              disabled={sent || sending}
              onClick={handleSubmit}
            >
              {!sent && !sending && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
              )}
              {sent
                ? '✓ Enviado — Abriendo WhatsApp...'
                : sending
                ? 'Enviando...'
                : 'Solicitar una reunión'}
            </button>
          </div>
          <p className="form-note">
            Al enviar este formulario aceptas nuestra política de privacidad. Tu información es confidencial y nunca será compartida con terceros.
          </p>
        </form>
      </div>
    </section>
  )
}
