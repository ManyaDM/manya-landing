'use client'
import Link from 'next/link'
import { useTina } from 'tinacms/dist/react'

const SERVICE_ICONS = {
  performance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  branding: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
    </svg>
  ),
  desarrollo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  seo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <polyline points="8 11 11 14 14 8" />
    </svg>
  ),
  automatizaciones: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  trazabilidad: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
}

export default function HomeClient({ services: servicesProp }) {
  const { data } = useTina(servicesProp)

  const services = data.serviceConnection.edges
    .map((e) => e.node)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  return (
    <>
      <div className="home-hero">
        <div className="home-kicker">
          <span className="hero-dot" />
          go.manya.pe
        </div>
        <h1 className="home-title">
          Sistemas de<br />
          <span>Crecimiento Digital</span>
        </h1>
        <p className="home-sub">
          Elige el servicio que tu empresa necesita para crecer. Estrategia, ejecución y resultados medibles.
        </p>
      </div>

      <div className="services-section">
        <div className="services-grid">
          {services.map((s) => (
            <Link key={s.slug} href={`/${s.slug}`} className="service-card">
              <div className="service-icon">{SERVICE_ICONS[s.iconKey] ?? SERVICE_ICONS.performance}</div>
              <div className="service-tag">{s.tag}</div>
              <div className="service-name">{s.name}</div>
              <p className="service-desc">{s.desc}</p>
              <span className="service-arrow">Conocer más →</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
