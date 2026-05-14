'use client'
import { useRef, useEffect } from 'react'
import { tinaField } from 'tinacms/dist/react'

const EXTRA_SCROLL = 2500

export default function ResultsSection({ cards }) {
  const sectionRef = useRef(null)
  const h2Ref = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    const h2 = h2Ref.current
    if (!section || !h2) return
    if (window.innerWidth <= 900) return

    let targetX = 0, currentX = 0, rafId = null
    const lerp = (a, b, t) => a + (b - a) * t

    const onScroll = () => {
      if (window.innerWidth <= 900) return
      const scrolledIn = Math.max(0, window.scrollY - section.offsetTop)
      const progress = Math.min(1, scrolledIn / EXTRA_SCROLL)
      targetX = -progress * Math.max(0, h2.scrollWidth - window.innerWidth)
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
      <div className="results-body">
        <div className="results-header reveal">
          <div>
            <div className="section-num">Resultados</div>
            <h2 className="results-reveal-h2">
              La innovación no es inspiración.<br />
              <span>Es metodología que demuestra resultados</span>
            </h2>
            <p className="section-sub" style={{ marginTop: '.5rem' }}>
              No reportamos clics. Reportamos revenue. Cada caso de éxito conecta inversión
              publicitaria con crecimiento real del negocio.
            </p>
          </div>
        </div>
        <div className="results-grid">
          {cards.map((card) => (
            <div key={card.label} className="result-card reveal">
              <div className="rc-metric blue">
                <span data-tina-field={tinaField(card, 'metricPrefix')}>{card.metricPrefix}</span>
                <span
                  className="rc-rose-num"
                  data-tina-field={tinaField(card, 'metricNumber')}
                >{card.metricNumber}</span>
                <span
                  style={{ fontSize: '2rem' }}
                  data-tina-field={tinaField(card, 'metricSuffix')}
                >{card.metricSuffix}</span>
              </div>
              <div
                className="rc-label"
                data-tina-field={tinaField(card, 'label')}
              >{card.label}</div>
              <p
                className="rc-desc"
                data-tina-field={tinaField(card, 'desc')}
              >{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
