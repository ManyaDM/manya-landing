import Hero from '@/components/Hero'
import LogosBar from '@/components/LogosBar'
import PainSection from '@/components/PainSection'
import SistemaSection from '@/components/SistemaSection'
import TechSection from '@/components/TechSection'
import ResultsSection from '@/components/ResultsSection'
import TestimonialsSection from '@/components/TestimonialsSection'
import CtaBand from '@/components/CtaBand'
import ContactSection from '@/components/ContactSection'
import ProcesoSection from '@/components/ProcesoSection'

export const metadata = {
  title: 'Marketing de Performance · Manya',
  description:
    'Campañas digitales optimizadas en Google Ads, Meta Ads, TikTok Ads y LinkedIn Ads. Metodología data-driven que convierte inversión en resultados medibles.',
}

export default function MarketingDePerformancePage() {
  return (
    <>
      <Hero />
      <LogosBar />
      <PainSection />
      <SistemaSection />
      <ResultsSection />
      <TestimonialsSection />
      <CtaBand />
      <ContactSection />
      <ProcesoSection />
    </>
  )
}
