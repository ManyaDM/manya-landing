'use client'
import { useRef, useEffect } from 'react'

const MAX_OFFSET_X = 55
const MAX_OFFSET_Y = 40
const LERP_FACTOR = 0.07

const logos = [
  {
    src: 'https://manya.pe/wp-content/uploads/2025/03/Facebook-Marketing-Partner-badge.webp',
    alt: 'Facebook Marketing Partner',
  },
  {
    src: 'https://manya.pe/wp-content/uploads/2025/03/premier-partner25.svg',
    alt: 'Google Premier Partner 2025',
  },
  {
    src: 'https://manya.pe/wp-content/uploads/2025/03/kommo_badge_light.svg',
    alt: 'Kommo Partner',
  },
]

export default function Hero() {
  const heroRef = useRef(null)
  const svgRef = useRef(null)

  useEffect(() => {
    const section = heroRef.current
    const svg = svgRef.current
    if (!section || !svg) return

    let targetX = 0, currentX = 0
    let targetY = 0, currentY = 0
    let rafId = null

    const lerp = (a, b, t) => a + (b - a) * t

    const tick = () => {
      currentX = lerp(currentX, targetX, LERP_FACTOR)
      currentY = lerp(currentY, targetY, LERP_FACTOR)
      svg.style.transform = `translateX(${currentX.toFixed(3)}px) translateY(calc(-50% + ${currentY.toFixed(3)}px))`
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    const onMouseMove = (e) => {
      const rect = section.getBoundingClientRect()
      const normalizedX = (e.clientX - rect.left) / rect.width
      const normalizedY = (e.clientY - rect.top) / rect.height
      targetX = (0.5 - normalizedX) * MAX_OFFSET_X * 2
      targetY = (0.5 - normalizedY) * MAX_OFFSET_Y * 2
    }

    const onMouseLeave = () => { targetX = 0; targetY = 0 }

    section.addEventListener('mousemove', onMouseMove)
    section.addEventListener('mouseleave', onMouseLeave)

    return () => {
      cancelAnimationFrame(rafId)
      section.removeEventListener('mousemove', onMouseMove)
      section.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return (
    <section className="hero" ref={heroRef}>
      <svg ref={svgRef} className="hero-bg-shape" viewBox="0 0 600 600" fill="none">
        <circle cx="300" cy="300" r="280" stroke="white" strokeWidth="3" />
        <circle cx="300" cy="300" r="220" stroke="white" strokeWidth="3" />
        <circle cx="300" cy="300" r="160" stroke="white" strokeWidth="3" />
        <circle cx="300" cy="300" r="100" stroke="white" strokeWidth="3" />
        <circle cx="300" cy="300" r="50" stroke="white" strokeWidth="3" />
      </svg>

      <div className="hero-left">
        <div className="hero-eyebrow">
          <span className="hero-dot" />Creatividad en la era de la IA
        </div>

        <h1>
          Tu inversión digital<br />
          <span className="accent-blue">convertida en</span><br />
          <span className="accent-rose">resultados</span> reales.
        </h1>

        <div className="hero-sub">
          <div className="hero-subparrafo">
            Combinamos <strong>IA, estrategia y ejecución ágil</strong> en Google Ads, Meta Ads, TikTok Ads y LinkedIn Ads.
          </div>
          <div className="hero-subparrafo">
            El crecimiento real no se intuye. Se estructura. Se valida. <strong>Se logra.</strong>
          </div>
        </div>

        <div className="hero-actions">
          <a href="#contacto" className="btn-hero-primary">Quiero crecer con Manya →</a>
          <button
            className="btn-hero-ghost"
            onClick={() => document.getElementById('resultados')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Ver resultados ↓
          </button>
        </div>
      </div>

      <div className="hero-right">
        <div className="hero-logos">
          {logos.map((logo, i) => (
            <div key={logo.alt} className="hero-logo-item" style={{ animationDelay: `${-i * 4}s` }}>
              <div className="hero-logo-card">
                <img src={logo.src} alt={logo.alt} className="hero-logo-img" loading="eager" />
              </div>
            </div>
          ))}
        </div>
        <div className="hero-stats">
          <div className="hstat">
            <div className="num">800<span className="rose-num">+</span></div>
            <div className="label">Empresas escaladas</div>
          </div>
          <div className="hstat">
            <div className="num">4.5<span className="rose-num">×</span></div>
            <div className="label">ROAS promedio</div>
          </div>
          <div className="hstat">
            <div className="num">6Mill<span className="rose-num">$</span></div>
            <div className="label">De Inversión en pauta</div>
          </div>
          <div className="hstat">
            <div className="num">14<span className="rose-num">+</span></div>
            <div className="label">Años de ejecución</div>
          </div>
        </div>
      </div>
    </section>
  )
}
