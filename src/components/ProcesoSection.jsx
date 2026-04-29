const steps = [
  {
    num: '01',
    title: 'Diagnóstico inicial',
    desc: 'Analizamos tus cuentas actuales, identificamos pérdidas de inversión y establecemos benchmarks reales de tu industria.',
    tag: 'Auditoría gratis',
    active: false,
  },
  {
    num: '02',
    title: 'Kickoff & Investigación',
    desc: 'Entendemos tu oferta, audiencia, competidores y objetivos. Definimos el mix de plataformas para bases sólidas.',
    tag: 'Semana 1',
    active: true,
  },
  {
    num: '03',
    title: 'Configuración inicial',
    desc: 'Setup completo de tracking, pixels y conversiones. Configuramos las herramientas para trazabilidad de datos sin ruido.',
    tag: 'Semanas 2–3',
    active: false,
  },
  {
    num: '04',
    title: 'Estrategia de medios',
    desc: 'Definimos objetivos SMART, planeamos el contenido, la estrategia del embudo y el plan de inversión para maximizar resultados.',
    tag: 'En curso',
    active: false,
  },
]

export default function ProcesoSection() {
  return (
    <section className="proceso-section" id="proceso">
      <div className="proceso-header reveal">
        <div className="section-num">Metodología</div>
        <h2 className="section-title">Cómo trabajamos juntos</h2>
        <p className="section-sub">
          Convertir no es suerte. Es estrategia con dirección. Guiamos cada paso, medimos cada impacto, construimos relaciones que cierran.
        </p>
      </div>
      <div className="proceso-steps reveal">
        {steps.map((step) => (
          <div key={step.num} className={`proceso-step${step.active ? ' active' : ''}`}>
            <div className="step-circle">{step.num}</div>
            <div className="step-title">{step.title}</div>
            <p className="step-desc">{step.desc}</p>
            <span className="step-tag">{step.tag}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
