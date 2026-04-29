export default function Navbar() {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <nav>
      <div className="nav-logo">
        <img src="https://manya.pe/wp-content/uploads/2025/03/manyalogoblue.svg" alt="manya" loading="lazy"/>
      </div>
      <ul className="nav-links">
        <li><a href="#sistema">Nuestro sistema</a></li>
        <li><a href="#resultados">Resultados</a></li>
        <li><a href="#testimonios">Testimonios</a></li>
        <li><a href="#contacto">Contacto</a></li>
      </ul>
      <div className="nav-actions">
        <a href="#contacto" className="btn-nav-primary">Reunámonos →</a>
      </div>
    </nav>
  )
}
