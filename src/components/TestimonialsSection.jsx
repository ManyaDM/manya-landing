const testimonials = [
  {
    text: '"Manya transformó completamente nuestra estrategia digital. Antes teníamos campañas activas pero sin dirección. Ahora cada peso invertido tiene un propósito y podemos ver exactamente qué genera resultados."',
    initials: 'SV',
    name: 'Silvy Araujo',
    role: 'CEO · silBe · Colombia',
    metric: '+349% suscriptores · -79% CAC',
  },
  {
    text: '"Lo que más valoro es su enfoque constante en las ventas reales y su compromiso por cumplir los objetivos del negocio. Manya forma parte fundamental del crecimiento de nuestra empresa."',
    initials: 'HR',
    name: 'Hernando Ríos',
    role: 'CEO · Hafa · Colombia',
    metric: '4.2× ROAS sostenido',
  },
  {
    text: '"Excelente trabajo y atención. Realizamos campañas con objetivos muy concretos y sobre todo el seguimiento y las optimizaciones que realizan para mejorar constantemente la calidad y calidad de leads."',
    initials: 'SP',
    name: 'Sebastián Pérez',
    role: 'CEO · Boleto · Colombia',
    metric: '-67% CPL en 60 días',
  },
]

const Stars = () => (
  <div className="testi-stars">
    {[...Array(5)].map((_, i) => <div key={i} className="star" />)}
  </div>
)

export default function TestimonialsSection() {
  return (
    <section className="testi-section" id="testimonios">
      <div className="reveal">
        <div className="section-num">Testimonios</div>
        <h2 className="section-title">Lo que dicen<br />nuestros clientes</h2>
      </div>
      <div className="testi-grid">
        {testimonials.map((t) => (
          <div key={t.name} className="testi-card reveal">
            <Stars />
            <p className="testi-text">{t.text}</p>
            <div className="testi-author">
              <div className="testi-avatar">{t.initials}</div>
              <div>
                <div className="testi-name">{t.name}</div>
                <div className="testi-role">{t.role}</div>
              </div>
            </div>
            <div className="testi-metric">{t.metric}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
