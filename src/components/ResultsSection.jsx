import { useRef, useEffect } from 'react'

// Pixels of vertical scroll to complete the full horizontal text reveal
const EXTRA_SCROLL = 2500

const resultCards = [
  {
    metric: <><span className="rc-rose-num">-79%</span></>,
    metricClass: 'blue',
    label: 'Reducción de CPL',
    desc: 'Optimización de Creative + audience con IA redujo el costo por resultado drásticamente, mientras la inversión total incrementó.',
  },
  {
    metric: <>4.5<span style={{ fontSize: '1.5rem' }}>×</span></>,
    metricClass: 'navy',
    label: 'ROAS promedio portafolio',
    desc: '$4.20 generados por cada $1 invertido en ads. Promedio ponderado de clientes activos en todos los sectores.',
  },
  {
    metric: <>+<span className="rc-rose-num">67%</span></>,
    metricClass: 'blue',
    label: 'Tasa de conversión',
    desc: 'Landing pages con video + social proof integrado por Manya convierten hasta 67% más que páginas genéricas.',
  },
  {
    metric: <>-38<span style={{ fontSize: '1.5rem' }}>%</span></>,
    metricClass: 'navy',
    label: 'Reducción de CPL en B2B',
    desc: 'Empresas B2B que usan LinkedIn Lead Gen Forms + Google en estrategia integrada reducen su CPL consistentemente.',
  },
]

export default function ResultsSection() {
  const sectionRef = useRef(null)
  const h2Ref = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    const h2 = h2Ref.current
    if (!section || !h2) return
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
      const maxTranslate = Math.max(0, h2.scrollWidth - window.innerWidth)
      targetX = -progress * maxTranslate
    }

    const tick = () => {
      currentX = lerp(currentX, targetX, 0.06)
      h2.style.transform = `translateX(${currentX.toFixed(2)}px)`
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
    <section className="results-section" id="resultados" ref={sectionRef}>

      {/* Sticky H2 — sticks within the entire results-section,
          including while the cards below scroll into view 
      <div className="results-reveal-sticky">
        <h2 className="results-reveal-h2" ref={h2Ref}>
          La innovación no es inspiración.{' '}
          <span>Es metodología que demuestra resultados</span>
        </h2>
      </div>

      {/* Scroll space: keeps the sticky alive long enough for the
          full horizontal text animation before cards appear 
      <div style={{ height: EXTRA_SCROLL }} aria-hidden="true" />

      {/* Cards — scroll up from below while H2 is still sticky */}
      <div className="results-body">
        <div className="results-header reveal">
          <div>
            <div className="section-num">Resultados</div>
            <h2 className="results-reveal-h2">
          La innovación no es inspiración.<br/>
          <span>Es metodología que demuestra resultados</span>
        </h2>
            <p className="section-sub" style={{ marginTop: '.5rem' }}>
              No reportamos clics. Reportamos revenue. Cada caso de éxito conecta inversión
              publicitaria con crecimiento real del negocio.
            </p>
          </div>
        </div>
        <div className="results-grid">
          {resultCards.map((card) => (
            <div key={card.label} className="result-card reveal">
              <div className={`rc-metric ${card.metricClass}`}>{card.metric}</div>
              <div className="rc-label">{card.label}</div>
              <p className="rc-desc">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </section>
  )
}
