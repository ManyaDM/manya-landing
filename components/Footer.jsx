import Link from 'next/link'

export default function Footer() {
  return (
    <footer>
      <Link href="/" className="nav-logo">
        <img
          src="https://manya.pe/wp-content/uploads/2025/03/manyalogoblue.svg"
          alt="Manya"
          loading="lazy"
          height="28"
        />
      </Link>
      <p>© 2026 Manya Agency · Performance Marketing</p>
    </footer>
  )
}
