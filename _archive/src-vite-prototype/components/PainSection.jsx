import { useRef, useEffect } from 'react'

// Píxeles de scroll vertical para avanzar entre un card y el siguiente
const SCROLL_PER_CARD = 360
const NUM_CARDS = 6
const EXTRA_SCROLL = SCROLL_PER_CARD * (NUM_CARDS - 1) // 1800px

const painCards = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    title: '⚠️ Presupuesto sin dirección',
    desc: 'Campañas activas en múltiples plataformas, pero sin saber qué canal genera rentabilidad real. El dinero se gasta, no se invierte.',
    
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    title: '⚠️ Plataformas sin resultados',
    desc: 'Google, Meta, TikTok y LinkedIn reportan gastos de forma inconsistente. Sin visión unificada, es imposible optimizar el mix correctamente.',
    
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
      </svg>
    ),
    title: '⚠️ ROAS impredecible',
    desc: 'Funciona un mes, falla el siguiente. Sin metodología de testing continuo y creativos data-driven, los resultados no escalan.',
    
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: '⚠️ IA sin estrategia',
    desc: 'PMax y Advantage+ automatizan targeting, pero sin señales de primera parte y creativos optimizados, la IA no puede convertir.',
    
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" />
      </svg>
    ),
    title: '⚠️ Reportes sin contexto',
    desc: 'Métricas de vanidad que no conectan con el negocio real. Un reporte sin insights accionables es solo ruido con colores.',
    
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: '⚠️ Equipo sin especialización',
    desc: 'Cada plataforma requiere expertise técnico distinto. Un generalista no puede competir contra especialistas full-time en cada canal.',
    
  },
]

export default function PainSection() {
  const sectionRef = useRef(null)
  const trackRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    const track = trackRef.current
    const wrap = wrapRef.current
    if (!section || !track || !wrap) return

    // En mobile el carousel está desactivado (CSS lo apila verticalmente)
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
      className="pain-section"
      id="problema"
      ref={sectionRef}
      style={{ height: `calc(100vh + ${EXTRA_SCROLL}px)` }}
    >
      <div className="pain-sticky">

        {/* Cabecera de sección */}
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

        {/* Carrusel horizontal */}
        <div className="pain-track-wrap" ref={wrapRef}>
          <div className="pain-track" ref={trackRef}>
            {painCards.map((card) => (
              <div key={card.title} className="pain-card">
                <div className="pain-icon">{card.icon}</div>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
                <span className="pain-tag">{card.tag}</span>
              </div>
            ))}
          </div>

          {/* Fade en bordes */}
          <div className="pain-fade-left" />
          <div className="pain-fade-right" />
        </div>

      </div>
    </section>
  )
}
