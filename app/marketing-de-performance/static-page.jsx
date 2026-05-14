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
import {
  getHero,
  getPainCards,
  getSistemaCards,
  getTechCards,
  getResultCards,
  getTestimonials,
  getProcesoSteps,
  getContact,
} from '@/lib/content'

export default function StaticMarketingPage() {
  return (
    <>
      <Hero data={getHero()} />
      <LogosBar />
      <PainSection cards={getPainCards()} />
      <SistemaSection cards={getSistemaCards()} />
      <ResultsSection cards={getResultCards()} />
      <TestimonialsSection testimonials={getTestimonials()} />
      <CtaBand />
      <ContactSection data={getContact()} />
      <ProcesoSection steps={getProcesoSteps()} />
      <TechSection cards={getTechCards()} />
    </>
  )
}
