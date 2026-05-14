import client from '@/tina/__generated__/client'
import MarketingPageClient from './page-client'
import StaticMarketingPage from './static-page'

export const metadata = {
  title: 'Marketing de Performance · Manya',
  description:
    'Campañas digitales optimizadas en Google Ads, Meta Ads, TikTok Ads y LinkedIn Ads. Metodología data-driven que convierte inversión en resultados medibles.',
}

async function tryQuery(fn) {
  try { return await fn() } catch { return null }
}

export default async function MarketingDePerformancePage() {
  const [hero, painCards, sistemaCards, techCards, results, testimonials, procesoSteps, contact] =
    await Promise.all([
      tryQuery(() => client.queries.hero({ relativePath: 'hero.json' })),
      tryQuery(() => client.queries.painCardConnection()),
      tryQuery(() => client.queries.sistemaCardConnection()),
      tryQuery(() => client.queries.techCardConnection()),
      tryQuery(() => client.queries.resultConnection()),
      tryQuery(() => client.queries.testimonialConnection()),
      tryQuery(() => client.queries.procesoStepConnection()),
      tryQuery(() => client.queries.contact({ relativePath: 'contact.json' })),
    ])

  // Fallback a JSON directo si el servidor GraphQL no está disponible
  // (ocurre en next build o si tinacms dev no está corriendo)
  if (!hero) return <StaticMarketingPage />

  return (
    <MarketingPageClient
      hero={hero}
      painCards={painCards}
      sistemaCards={sistemaCards}
      techCards={techCards}
      results={results}
      testimonials={testimonials}
      procesoSteps={procesoSteps}
      contact={contact}
    />
  )
}
