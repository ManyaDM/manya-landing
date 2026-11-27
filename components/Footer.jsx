'use client'

import { usePathname } from 'next/navigation'

export default function Footer() {
  const pathname = usePathname()
  // The internal agenda admin is a standalone tool without the site footer.
  if (pathname?.startsWith('/agenda-admin')) return null
  return (
    <footer>
      <a href="#" className="nav-logo" aria-label="Volver al inicio">
        <img
          src="https://manya.pe/wp-content/uploads/2025/03/manyalogoblue.svg"
          alt="Manya"
          loading="lazy"
          height="28"
        />
      </a>
      <p>© 2026 Manya Agency · Performance Marketing</p>
    </footer>
  )
}
