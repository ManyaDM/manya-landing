import Link from 'next/link'

export default function ComingSoon({ name }) {
  return (
    <div className="coming-soon-page">
      <div className="coming-soon-inner">
        <div className="coming-soon-badge">Próximamente</div>
        <h1>{name}</h1>
        <p>
          Estamos preparando algo increíble para este servicio.<br />
          Mientras tanto, cuéntanos tu proyecto y te asesoramos.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" className="btn-back">← Volver al inicio</Link>
          <Link href="/marketing-de-performance#contacto" className="btn-nav-primary">
            Solicitar asesoría →
          </Link>
        </div>
      </div>
    </div>
  )
}
