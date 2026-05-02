const logos = [
  { src: 'https://manya.pe/wp-content/uploads/2025/03/Litec.png', alt: 'Litec' },
  { src: 'https://manya.pe/wp-content/uploads/2025/03/mapfre-logo-gray.png', alt: 'MAPFRE' },
  { src: 'https://manya.pe/wp-content/uploads/2025/05/ecpucp.png', alt: 'PUCP' },
  { src: 'https://manya.pe/wp-content/uploads/2025/03/arellano.png', alt: 'Arellano' },
  { src: 'https://manya.pe/wp-content/uploads/2025/03/GreenDreams.png', alt: 'Green Dreams' },
  { src: 'https://manya.pe/wp-content/uploads/2025/03/cirsa.png', alt: 'CIRSA' },
  { src: 'https://manya.pe/wp-content/uploads/2025/03/oriflame.png', alt: 'Oriflame' },
  { src: 'https://manya.pe/wp-content/uploads/2025/03/Coopacsm.png', alt: 'Coopacsm' },
  { src: 'https://manya.pe/wp-content/uploads/2025/03/cebacesarvallejo.png', alt: 'CEBA César Vallejo' },
  { src: 'https://manya.pe/wp-content/uploads/2025/03/Arteco.png', alt: 'Arteco' },
  { src: 'https://manya.pe/wp-content/uploads/2025/03/Coolbox.png', alt: 'Coolbox' },
  { src: 'https://manya.pe/wp-content/uploads/2025/03/Quimtia.png', alt: 'Quimtia' },
  { src: 'https://manya.pe/wp-content/uploads/2025/03/Chapacambio.png', alt: 'Chapacambio' },
  { src: 'https://manya.pe/wp-content/uploads/2025/03/Cumbra.png', alt: 'Cumbra' },
  { src: 'https://manya.pe/wp-content/uploads/2025/03/Academia-Pitagoras.png', alt: 'Academia Pitágoras' },
]

const track = [...logos, ...logos]

export default function LogosBar() {
  return (
    <div className="logos-bar">
      <div className="logos-label">Marcas que confían en Manya</div>
      <div className="logos-carousel">
        <div className="logos-track">
          {track.map((logo, i) => (
            <div key={i} className="logos-slide">
              <img
                src={logo.src}
                alt={logo.alt}
                className="logo-slide-img"
                loading="lazy"
                draggable="false"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
