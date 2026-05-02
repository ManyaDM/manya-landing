import { Poppins } from 'next/font/google'
import Script from 'next/script'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ScrollAnimations from '@/components/ScrollAnimations'
import WhatsAppFab from '@/components/WhatsAppFab'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
})

export const metadata = {
  title: 'Manya · Sistemas de Crecimiento Digital',
  description:
    'Agencia de marketing digital especializada en sistemas de crecimiento para empresas. Google Ads, Meta Ads, SEO, Branding, Desarrollo Web y Automatizaciones.',
  icons: {
    icon: 'https://manya.pe/wp-content/uploads/2025/03/manyafavicon.svg',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={poppins.className}>
      <body>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-P6FZFMM2"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <Navbar />
        <main>{children}</main>
        <Footer />
        <WhatsAppFab />
        <ScrollAnimations />
        <Script id="gtm" strategy="afterInteractive">{`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-P6FZFMM2');
        `}</Script>
      </body>
    </html>
  )
}
