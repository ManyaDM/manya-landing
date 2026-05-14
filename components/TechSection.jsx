import TechGrid from './TechGrid'

export default function TechSection({ cards }) {
  return (
    <section className="tech-section" id="tecnologia">
      <div className="tech-intro reveal">
        <div className="section-num">IA &amp; Tecnología</div>
        <h2 className="section-title">La innovación no es inspiración.<br />Es estructura que ejecuta.</h2>
        <p className="section-sub">
          Integramos el mejor stack de herramientas para atribución, automatización y reporting.
          Tú pagas por resultados, nosotros absorbemos el costo del stack.
        </p>
      </div>
      <TechGrid cards={cards} />
    </section>
  )
}
