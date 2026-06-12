import type { Metadata, Viewport } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import MobileNav from '@/components/MobileNav'
import PWAProvider from '@/components/PWAProvider'

export const metadata: Metadata = {
  title: 'Verigo | Australian AML/CTF Compliance Platform',
  description: 'The Australian-first Compliance Operating System for regulated businesses. AUSTRAC-aligned KYC, AML transaction monitoring, IFTI/TTR/SMR reporting, sanctions screening and case management.',
  keywords: 'AML, KYC, AUSTRAC, compliance, Australia, digital currency exchange, remittance, Tranche 2, anti-money laundering',
  manifest: '/manifest.json',
  applicationName: 'Verigo',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TVG Compliance',
  },
  icons: {
    icon: '/favicon.png',
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#060d1a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Navbar />
        <main className="pt-16">{children}</main>
        <Footer />
        <MobileNav />
        <PWAProvider />
      </body>
    </html>
  )
}
