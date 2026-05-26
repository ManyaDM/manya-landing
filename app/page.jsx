import { getServices } from '@/lib/content'
import HomeClient from './home-client'

export const metadata = {
  title: 'Manya · Sistemas de Crecimiento Digital',
  description:
    'Agencia especializada en marketing de performance, branding, desarrollo web, SEO, automatizaciones y trazabilidad comercial para empresas que quieren crecer.',
}

export default function HomePage() {
  const services = getServices()
  return <HomeClient services={services} />
}
