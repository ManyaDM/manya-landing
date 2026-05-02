'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const services = [
  { name: 'Marketing de Performance', href: '/marketing-de-performance' },
  { name: 'Branding', href: '/branding' },
  { name: 'Desarrollo Web', href: '/desarrollo-web' },
  { name: 'Posicionamiento Web', href: '/posicionamiento-web' },
  { name: 'Automatizaciones', href: '/automatizaciones' },
  { name: 'Trazabilidad Comercial', href: '/trazabilidad-comercial' },
]

export default function Navbar() {
  const [dropOpen, setDropOpen] = useState(false)
  const dropRef = useRef(null)
  const pathname = usePathname()

  useEffect(() => {
    const nav = document.querySelector('nav')
    const handler = () => {
      if (nav) nav.style.boxShadow = window.scrollY > 40 ? '0 4px 30px rgba(24,35,69,.1)' : 'none'
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { setDropOpen(false) }, [pathname])

  return (
    <nav>
      <Link href="/" className="nav-logo">
        <img
          src="https://manya.pe/wp-content/uploads/2025/03/manyalogoblue.svg"
          alt="Manya"
          loading="lazy"
          height="32"
        />
      </Link>

      <ul className="nav-links">
        <li ref={dropRef} className="nav-services-item">
          <button
            className="nav-services-btn"
            onClick={() => setDropOpen((v) => !v)}
            aria-expanded={dropOpen}
          >
            Servicios
            <svg
              className={`ms-chevron${dropOpen ? ' open' : ''}`}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {dropOpen && (
            <div className="nav-dropdown">
              {services.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className={`nav-dropdown-link${pathname === s.href ? ' active' : ''}`}
                  onClick={() => setDropOpen(false)}
                >
                  {s.name}
                </Link>
              ))}
            </div>
          )}
        </li>
      </ul>

      <div className="nav-actions">
        <Link href="/marketing-de-performance#contacto" className="btn-nav-primary">
          Reunámonos →
        </Link>
      </div>
    </nav>
  )
}
