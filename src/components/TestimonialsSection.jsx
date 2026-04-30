import { useState, useEffect } from 'react'

const VISIBLE = 3
const INTERVAL = 3000

const testimonials = [
  {
    text: '"Recomendaría el servicio de Manya por dos cosas: el primer lugar su metodología para obtener resultados súper potentes y en segundo lugar la receptividad y creatividad del equipo, hicimos bastante sinergia y explotaron todo su potencial con nosotros."',
    logo: 'https://manya.pe/wp-content/uploads/2025/03/culqi_logo.png',
    name: 'Amparo Nalvarte',
    role: 'Founder',
    metric: 'Culqi',
  },
  {
    text: '"Lo que mas me gusta de Manya es cómo piensa fuera de la caja y su capacidad de amoldarse rápidamente a lo que se necesite… le ponen todo el corazón en cada uno de los trabajos que realizan, eso se ve reflejado totalmente en los entregables y resultados finales."',
    logo: 'https://manya.pe/wp-content/uploads/2025/03/niubizvm_logo.png',
    name: 'Michaela Domenack',
    role: 'Jefe de Marketing',
    metric: 'Niubiz',
  },
  {
    text: '"Desde la primera reunión entendieron bien nuestra necesidad y nuestras expectativas de trabajo. La recopilación de información y posterior sistematización estuvo súper. Además, todo el input que les brindamos fue rápidamente asimilado y aplicado. El servicio superó nuestras expectativas."',
    logo: 'https://manya.pe/wp-content/uploads/2025/03/educacioncontinua_logo.png',
    name: 'Karina Salavador',
    role: 'Jefa de Desarrollo Comercial',
    metric: 'EC PUCP',
  },
  {
    text: '"Gran <strong>servicio y profesionalismo.</strong> Siempre atentos y dispuestos a ayudarnos cuando lo necesitamos. Valoramos mucho la relación que hemos construido y <strong>estamos muy contentos con los resultados obtenidos</strong> como una de las referentes en el rubro."',
    logo: 'https://manya.pe/wp-content/uploads/2025/05/logo_chapacambio.png',
    name: 'Brendam Castillo',
    role: 'Coordinador de Marketing e Inteligencia Comercial',
    metric: 'ChapaCambio',
  },
]

const Stars = () => (
  <div className="testi-stars">
    {[...Array(5)].map((_, i) => <div key={i} className="star" />)}
  </div>
)

export default function TestimonialsSection() {
  const [idx, setIdx] = useState(0)
  const [animate, setAnimate] = useState(true)

  const N = testimonials.length
  const doubled = [...testimonials, ...testimonials]

  useEffect(() => {
    const timer = setInterval(() => {
      setIdx(prev => prev + 1)
    }, INTERVAL)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (idx === N) {
      const t = setTimeout(() => {
        setAnimate(false)
        setIdx(0)
      }, 500)
      return () => clearTimeout(t)
    } else {
      setAnimate(true)
    }
  }, [idx, N])

  const trackWidthPct = (doubled.length / VISIBLE) * 100
  const slideWidthPct = 100 / doubled.length
  const translatePct = -(idx / doubled.length) * 100

  return (
    <section className="testi-section" id="testimonios">
      <div className="reveal">
        <div className="section-num">Testimonios</div>
        <h2 className="section-title">Lo que dicen<br />nuestros clientes</h2>
      </div>

      <div className="testi-carousel-wrap">
        <div
          className="testi-carousel-track"
          style={{
            width: `${trackWidthPct}%`,
            transform: `translateX(${translatePct}%)`,
            transition: animate ? 'transform 0.5s ease' : 'none',
          }}
        >
          {doubled.map((t, i) => (
            <div
              key={i}
              className="testi-slide"
              style={{ width: `${slideWidthPct}%` }}
            >
              <div className="testi-card">
                <Stars />
                <p
                  className="testi-text"
                  dangerouslySetInnerHTML={{ __html: t.text }}
                />
                <div className="testi-author">
                  <div className="testi-avatar">
                    <img src={t.logo} alt={t.name} />
                  </div>
                  <div>
                    <div className="testi-name">{t.name}</div>
                    <div className="testi-role">{t.role}</div>
                  </div>
                </div>
                <div className="testi-metric">{t.metric}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
