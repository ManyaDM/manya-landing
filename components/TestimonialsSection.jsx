'use client'
import { useState, useEffect } from 'react'
import { tinaField } from 'tinacms/dist/react'

const VISIBLE = 3
const DESKTOP_INTERVAL = 3000
const MOBILE_INTERVAL = 4000

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
      <p
        className="testi-text"
        data-tina-field={tinaField(t, 'text')}
        dangerouslySetInnerHTML={{ __html: t.text }}
      />
      <div className="testi-author">
        <div className="testi-avatar">
          <img src={t.logo} alt={t.name} data-tina-field={tinaField(t, 'logo')} />
        </div>
        <div>
          <div className="testi-name" data-tina-field={tinaField(t, 'name')}>{t.name}</div>
          <div className="testi-role" data-tina-field={tinaField(t, 'role')}>{t.role}</div>
        </div>
      </div>
      <div className="testi-metric" data-tina-field={tinaField(t, 'metric')}>{t.metric}</div>
    </div>
  )
}

function MobileCarousel({ testimonials }) {
  const N = testimonials.length
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => setIdx((p) => (p + 1) % N), MOBILE_INTERVAL)
    return () => clearInterval(timer)
  }, [paused, N])

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
        <button className="testi-ctrl-btn" onClick={prev} aria-label="Anterior"><IconPrev /></button>
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
        <button className="testi-ctrl-btn" onClick={next} aria-label="Siguiente"><IconNext /></button>
      </div>
    </div>
  )
}

function DesktopCarousel({ testimonials }) {
  const N = testimonials.length
  const doubled = [...testimonials, ...testimonials]
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
  }, [idx, N])

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

export default function TestimonialsSection({ testimonials }) {
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
      {isMobile
        ? <MobileCarousel testimonials={testimonials} />
        : <DesktopCarousel testimonials={testimonials} />
      }
    </section>
  )
}
