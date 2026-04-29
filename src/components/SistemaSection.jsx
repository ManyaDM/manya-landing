import { useRef, useEffect } from 'react'

const SCROLL_PER_CARD = 360
const NUM_CARDS = 6
const EXTRA_SCROLL = SCROLL_PER_CARD * (NUM_CARDS - 1)

const sistemaCards = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    label: 'Atribución',
    name: 'Triple Whale · Hyros',
    desc: 'Multi-touch attribution cross-device. Eliminamos el "last-click bias" y conectamos cada touchpoint con revenue real en el CRM.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
      </svg>
    ),
    label: 'Data & Reportes',
    name: 'BigQuery · Looker Studio',
    desc: 'Dashboard en tiempo real que conecta 15+ fuentes de datos. KPIs de negocio visibles, no hojas de cálculo.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
      </svg>
    ),
    label: 'IA Publicitaria',
    name: 'Google AI · Meta AI',
    desc: 'Aprovechamos Smart Bidding, PMax y Advantage+ con señales de primera parte correctamente configuradas. La IA necesita contexto para rendir.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    label: 'Landing Pages',
    name: 'Unbounce · Instapage',
    desc: 'Smart Traffic A/B automatizado y Dynamic Text Replacement. Cada ad tiene su landing con mensaje exacto. +400% vs páginas genéricas.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </svg>
    ),
    label: 'CRM Integration',
    name: 'HubSpot · Salesforce',
    desc: 'Cerramos el loop entre campañas y deals. Cada lead tiene tracking completo desde el ad hasta el cierre, con revenue attribution real.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
      </svg>
    ),
    label: 'Creative Intelligence',
    name: 'Motion · Foreplay',
    desc: 'Analizamos creativos de competencia, identificamos patrones ganadores y producimos ads basados en datos de performance, no en intuición.',
  },
]

export default function SistemaSection() {
  const sectionRef = useRef(null)
  const trackRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    const track = trackRef.current
    const wrap = wrapRef.current
    if (!section || !track || !wrap) return

    if (window.innerWidth <= 900) return

    let targetX = 0
    let currentX = 0
    let rafId = null

    const lerp = (a, b, t) => a + (b - a) * t

    const onScroll = () => {
      if (window.innerWidth <= 900) return
      const sectionTop = section.offsetTop
      const scrolledIn = Math.max(0, window.scrollY - sectionTop)
      const progress = Math.min(1, scrolledIn / EXTRA_SCROLL)
      const maxTranslate = track.scrollWidth - wrap.clientWidth
      targetX = -progress * maxTranslate
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
      className="sistema-section" id="sistema"
      ref={sectionRef}
      style={{ height: `calc(100vh + ${EXTRA_SCROLL}px)` }}
    >
      <div className="sistema-sticky">

        <div className="sistema-top reveal">
          <div className="section-num">Nuestra razón</div>
          <h2 className="section-title">
            El sistema que nos<br />hace diferentes
          </h2>
          <p className="section-sub">
            Desarrollamos sistemas integrales de crecimiento digital que transforman cómo una empresa se presenta, se comunica, vende y escala.
          </p>
        </div>

        <div className="sistema-track-wrap" ref={wrapRef}>
          <div className="sistema-track" ref={trackRef}>
            {sistemaCards.map((card) => (
              <div key={card.name} className="sistema-card">
                <div className="sistema-card-icon">{card.icon}</div>
                <div className="sistema-card-label">{card.label}</div>
                <h3 className="sistema-card-name">{card.name}</h3>
                <p className="sistema-card-desc">{card.desc}</p>
              </div>
            ))}
          </div>

          <div className="sistema-fade-left" />
          <div className="sistema-fade-right" />
        </div>
        <div className='hero-actions btn-sistemas'><a href="#contacto" className="btn-hero-primary">Quiero crecer con Manya →</a></div>

      </div>
    </section>
  )
}
