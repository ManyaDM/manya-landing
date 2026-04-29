import { useEffect } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import LogosBar from './components/LogosBar'
import PainSection from './components/PainSection'
import SistemaSection from './components/SistemaSection'
import TechSection from './components/TechSection'
import ResultsSection from './components/ResultsSection'
import TestimonialsSection from './components/TestimonialsSection'
import CtaBand from './components/CtaBand'
import ContactSection from './components/ContactSection'
import ProcesoSection from './components/ProcesoSection'
import Footer from './components/Footer'

export default function App() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((el) => {
          if (el.isIntersecting) el.target.classList.add('visible')
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    )

    document.querySelectorAll('.reveal').forEach((el, i) => {
      el.style.transitionDelay = (i % 4) * 0.08 + 's'
      io.observe(el)
    })

    const nav = document.querySelector('nav')
    const handleScroll = () => {
      if (nav) nav.style.boxShadow = window.scrollY > 40 ? '0 4px 30px rgba(24,35,69,.1)' : 'none'
    }
    window.addEventListener('scroll', handleScroll)

    return () => {
      io.disconnect()
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <>
      <Navbar />
      <Hero />
      <LogosBar />
      <PainSection />
      <SistemaSection />
      <ResultsSection />
      <TestimonialsSection />
      <CtaBand />
      <ContactSection />
      <ProcesoSection />
      <Footer />
    </>
  )
}
