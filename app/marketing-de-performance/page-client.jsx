'use client'
import { useTina } from 'tinacms/dist/react'
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

function sortByOrder(edges) {
  return edges
    .map((e) => e.node)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export default function MarketingPageClient({
  hero,
  painCards,
  sistemaCards,
  techCards,
  results,
  testimonials,
  procesoSteps,
  contact,
}) {
  const { data: heroData } = useTina(hero)
  const { data: painData } = useTina(painCards)
  const { data: sistemaData } = useTina(sistemaCards)
  const { data: techData } = useTina(techCards)
  const { data: resultsData } = useTina(results)
  const { data: testiData } = useTina(testimonials)
  const { data: procesoData } = useTina(procesoSteps)
  const { data: contactData } = useTina(contact)

  return (
    <>
      <Hero data={heroData.hero} tinaRef={heroData.hero} />
      <LogosBar />
      <PainSection cards={sortByOrder(painData.painCardConnection.edges)} />
      <SistemaSection cards={sortByOrder(sistemaData.sistemaCardConnection.edges)} />
      <ResultsSection cards={sortByOrder(resultsData.resultConnection.edges)} />
      <TestimonialsSection testimonials={sortByOrder(testiData.testimonialConnection.edges)} />
      <CtaBand />
      <ContactSection data={contactData.contact} />
      <ProcesoSection steps={sortByOrder(procesoData.procesoStepConnection.edges)} />
      <TechSection cards={sortByOrder(techData.techCardConnection.edges)} />
    </>
  )
}
