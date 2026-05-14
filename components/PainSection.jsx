'use client'
import { useRef, useEffect } from 'react'
import { tinaField } from 'tinacms/dist/react'

const SCROLL_PER_CARD = 360
const EXTRA_SCROLL = SCROLL_PER_CARD * 5

const ICONS = {
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  monitor: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  document: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
    </svg>
  ),
  team: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
}

export default function PainSection({ cards }) {
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
      className="pain-section"
      id="problema"
      ref={sectionRef}
      style={{ height: `calc(100vh + ${EXTRA_SCROLL}px)` }}
    >
      <div className="pain-sticky">
        <div className="pain-sticky-header reveal">
          <div>
            <div className="section-num">El problema</div>
            <h2 className="section-title">¿Por qué tu inversión<br />en ads no genera resultados?</h2>
            <div className="section-sub">
              El crecimiento digital no debería ser un proceso complejo, lento o frustrante.
              Si lo es, algo en el sistema está roto.
            </div>
          </div>
        </div>
        <div className="pain-track-wrap" ref={wrapRef}>
          <div className="pain-track" ref={trackRef}>
            {cards.map((card) => (
              <div key={card.title} className="pain-card">
                <div className="pain-icon">{ICONS[card.iconKey] ?? ICONS.alert}</div>
                <h3 data-tina-field={tinaField(card, 'title')}>{card.title}</h3>
                <p data-tina-field={tinaField(card, 'desc')}>{card.desc}</p>
              </div>
            ))}
          </div>
          <div className="pain-fade-left" />
          <div className="pain-fade-right" />
        </div>
      </div>
    </section>
  )
}
