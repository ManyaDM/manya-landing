import MapaDeFugas from './MapaDeFugas'

export const metadata = {
  title: 'Mapa de Fugas | Manya: no te faltan leads, te sobran fugas',
  description:
    'Diagnóstico comercial de Manya. En 7 días hábiles te mostramos dónde se pierden tus oportunidades entre el anuncio y el cierre, y qué corregir primero. USD 600 + IGV, 100% acreditable.',
  openGraph: {
    title: 'Mapa de Fugas | Manya',
    description:
      'No te faltan leads. Te sobran fugas. En 7 días hábiles sabes dónde se pierden tus ventas y qué corregir primero.',
    type: 'website',
  },
}

export const viewport = {
  themeColor: '#182345',
  colorScheme: 'light',
}

export default function MapaDeFugasPage() {
  return <MapaDeFugas />
}
