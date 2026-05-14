export default function ProcesoSection({ steps }) {
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
