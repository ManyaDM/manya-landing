'use client'
import { useState, useEffect } from 'react'

const VISIBLE = 3
const DESKTOP_INTERVAL = 3000
const MOBILE_INTERVAL = 4000

const testimonials = [
  {
    text: '"Recomendaría el servicio de Manya por dos cosas: el primer lugar <strong>su metodología para obtener resultados súper potentes</strong> y en segundo lugar la receptividad y creatividad del equipo, hicimos bastante sinergia y explotaron todo su potencial con nosotros."',
    logo: 'https://manya.pe/wp-content/uploads/2025/03/culqi_logo.png',
    name: 'Amparo Nalvarte',
    role: 'Founder',
    metric: 'Culqi',
  },
  {
    text: '"Lo que mas me gusta de Manya es cómo <strong>piensa fuera de la caja</strong> y su capacidad de amoldarse rápidamente a lo que se necesite… le ponen todo el corazón en cada uno de los trabajos que realizan, eso se ve reflejado totalmente en los entregables y resultados finales."',
    logo: 'https://manya.pe/wp-content/uploads/2025/03/niubizvm_logo.png',
    name: 'Michaela Domenack',
    role: 'Jefe de Marketing',
    metric: 'Niubiz',
  },
  {
    text: '"Desde la primera reunión <strong>entendieron bien nuestra necesidad</strong> y nuestras expectativas de trabajo. La recopilación de información y posterior sistematización estuvo súper. Además, todo el input que les brindamos fue rápidamente asimilado y aplicado. El servicio superó nuestras expectativas."',
    logo: 'https://manya.pe/wp-content/uploads/2025/03/educacioncontinua_logo.png',
    name: 'Karina Salavador',
    role: 'Jefa de Desarrollo Comercial',
    metric: 'EC PUCP',
  },
  {
    text: '"Gran <strong>servicio y profesionalismo.</strong> Siempre atentos y dispuestos a ayudarnos cuando lo necesitamos. Valoramos mucho la relación que hemos construido y <strong>estamos muy contentos con los resultados obtenidos</strong> como una de las referentes en el rubro."',
    logo: 'https://manya.pe/wp-content/uploads/2025/05/logo_chapacambio.png',
    name: 'Brendam Castillo',
    role: 'Coordinador de Marketing e Inteligencia Comercial',
    metric: 'ChapaCambio',
  },
]

const N = testimonials.length
const doubled = [...testimonials, ...testimonials]

const Stars = () => (
  <div className="testi-stars">
    {[...Array(5)].map((_, i) => <div key={i} className="star" />)}
  </div>
)

const IconPrev = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)
const IconNext = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)
const IconPause = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
)
const IconPlay = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,3 19,12 5,21" />
  </svg>
)

function TestitCard({ t }) {
  return (
    <div className="testi-card">
      <Stars />
      <p className="testi-text" dangerouslySetInnerHTML={{ __html: t.text }} />
      <div className="testi-author">
        <div className="testi-avatar"><img src={t.logo} alt={t.name} /></div>
        <div>
          <div className="testi-name">{t.name}</div>
          <div className="testi-role">{t.role}</div>
        </div>
      </div>
      <div className="testi-metric">{t.metric}</div>
    </div>
  )
}

function MobileCarousel() {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => setIdx((p) => (p + 1) % N), MOBILE_INTERVAL)
    return () => clearInterval(timer)
  }, [paused])

  const prev = () => setIdx((p) => (p - 1 + N) % N)
  const next = () => setIdx((p) => (p + 1) % N)

  return (
    <div className="testi-mobile-wrap">
      <div
        className="testi-mobile-track"
        style={{ transform: `translateX(-${idx * 100}%)` }}
      >
        {testimonials.map((t, i) => (
          <div key={i} className="testi-mobile-slide">
            <TestitCard t={t} />
          </div>
        ))}
      </div>

      <div className="testi-mobile-controls">
        <button className="testi-ctrl-btn" onClick={prev} aria-label="Anterior">
          <IconPrev />
        </button>
        <div className="testi-dots">
          {testimonials.map((_, i) => (
            <button
              key={i}
              className={`testi-dot${i === idx ? ' active' : ''}`}
              onClick={() => setIdx(i)}
              aria-label={`Testimonio ${i + 1}`}
            />
          ))}
        </div>
        <button
          className="testi-ctrl-btn testi-ctrl-pause"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? 'Reanudar' : 'Pausar'}
        >
          {paused ? <IconPlay /> : <IconPause />}
        </button>
        <button className="testi-ctrl-btn" onClick={next} aria-label="Siguiente">
          <IconNext />
        </button>
      </div>
    </div>
  )
}

function DesktopCarousel() {
  const [idx, setIdx] = useState(0)
  const [animate, setAnimate] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => setIdx((p) => p + 1), DESKTOP_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (idx === N) {
      const t = setTimeout(() => { setAnimate(false); setIdx(0) }, 500)
      return () => clearTimeout(t)
    } else {
      setAnimate(true)
    }
  }, [idx])

  const trackWidthPct = (doubled.length / VISIBLE) * 100
  const slideWidthPct = 100 / doubled.length
  const translatePct = -(idx / doubled.length) * 100

  return (
    <div className="testi-carousel-wrap">
      <div
        className="testi-carousel-track"
        style={{
          width: `${trackWidthPct}%`,
          transform: `translateX(${translatePct}%)`,
          transition: animate ? 'transform 0.5s ease' : 'none',
        }}
      >
        {doubled.map((t, i) => (
          <div key={i} className="testi-slide" style={{ width: `${slideWidthPct}%` }}>
            <TestitCard t={t} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TestimonialsSection() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    setIsMobile(mq.matches)
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <section className="testi-section" id="testimonios">
      <div className="reveal">
        <div className="section-num">Testimonios</div>
        <h2 className="section-title">Lo que dicen<br />nuestros clientes</h2>
      </div>
      {isMobile ? <MobileCarousel /> : <DesktopCarousel />}
    </section>
  )
}
