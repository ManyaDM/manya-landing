import client from '@/tina/__generated__/client'
import HomeClient from './home-client'

export const metadata = {
  title: 'Manya · Sistemas de Crecimiento Digital',
  description:
    'Agencia especializada en marketing de performance, branding, desarrollo web, SEO, automatizaciones y trazabilidad comercial para empresas que quieren crecer.',
}

export default async function HomePage() {
  const services = await client.queries.serviceConnection({ sort: 'order' })
  return <HomeClient services={services} />
}
