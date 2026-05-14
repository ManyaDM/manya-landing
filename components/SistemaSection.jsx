'use client'
import { useRef, useEffect } from 'react'
import { tinaField } from 'tinacms/dist/react'

const SCROLL_PER_CARD = 360
const EXTRA_SCROLL = SCROLL_PER_CARD * 5

const ICONS = {
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
    </svg>
  ),
  broadcast: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
    </svg>
  ),
  monitor: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
    </svg>
  ),
}

export default function SistemaSection({ cards }) {
  const sectionRef = useRef(null)
  const trackRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    const track = trackRef.current
    const wrap = wrapRef.current
    if (!section || !track || !wrap) return
    if (window.innerWidth <= 900) return

    let targetX = 0, currentX = 0, rafId = null
    const lerp = (a, b, t) => a + (b - a) * t

    const onScroll = () => {
      if (window.innerWidth <= 900) return
      const scrolledIn = Math.max(0, window.scrollY - section.offsetTop)
      const progress = Math.min(1, scrolledIn / EXTRA_SCROLL)
      targetX = -progress * (track.scrollWidth - wrap.clientWidth)
    }

    const tick = () => {
      currentX = lerp(currentX, targetX, 0.1)
      track.style.transform = `translateX(${currentX.toFixed(2)}px)`
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <section
      className="sistema-section"
      id="sistema"
      ref={sectionRef}
      style={{ height: `calc(100vh + ${EXTRA_SCROLL}px)` }}
    >
      <div className="sistema-sticky">
        <div className="sistema-top reveal">
          <div className="section-num">Nuestra razón</div>
          <h2 className="section-title">El sistema que nos<br />hace diferentes</h2>
          <p className="section-sub">
            Desarrollamos sistemas integrales de crecimiento digital que transforman cómo una empresa se presenta, se comunica, vende y escala.
          </p>
        </div>
        <div className="sistema-track-wrap" ref={wrapRef}>
          <div className="sistema-track" ref={trackRef}>
            {cards.map((card) => (
              <div key={card.label} className="sistema-card">
                <div className="sistema-card-icon">{ICONS[card.iconKey] ?? ICONS.star}</div>
                <div
                  className="sistema-card-label"
                  data-tina-field={tinaField(card, 'label')}
                >{card.label}</div>
                <h3
                  className="sistema-card-name"
                  data-tina-field={tinaField(card, 'name')}
                >{card.name}</h3>
                <p
                  className="sistema-card-desc"
                  data-tina-field={tinaField(card, 'desc')}
                >{card.desc}</p>
              </div>
            ))}
          </div>
          <div className="sistema-fade-left" />
          <div className="sistema-fade-right" />
        </div>
        <div className="hero-actions btn-sistemas">
          <a href="#contacto" className="btn-hero-primary">Quiero crecer con Manya →</a>
        </div>
      </div>
    </section>
  )
}
