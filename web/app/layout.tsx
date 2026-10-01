import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import Navbar from '@/components/Navbar'
import Tranche2Banner from '@/components/Tranche2Banner'
import MobileCtaBar from '@/components/MobileCtaBar'
import Footer from '@/components/Footer'
import MobileNav from '@/components/MobileNav'
import AppChrome from '@/components/AppChrome'
import PWAProvider from '@/components/PWAProvider'
import AnalyticsProvider from '@/components/AnalyticsProvider'
import CookieNotice from '@/components/CookieNotice'
import ThemeProvider from '@/components/ThemeProvider'

export const metadata: Metadata = {
  title: 'Verigo | Australian AML/CTF Compliance Platform',
  description: 'The Australian-first Compliance Operating System for regulated businesses. AUSTRAC-aligned KYC, AML transaction monitoring, IFTI/TTR/SMR reporting, sanctions screening and case management.',
  keywords: 'AML, KYC, AUSTRAC, compliance, Australia, digital currency exchange, remittance, Tranche 2, anti-money laundering',
  manifest: '/manifest.json',
  applicationName: 'Verigo',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Verigo',
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // P50b: the nonce proxy.ts mints per-request and stamps into the CSP
  // header — read back here so the one inline script this app renders
  // itself (next-themes' pre-paint theme-setting script) can carry it.
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} nonce={nonce}>
          <Tranche2Banner />
          <Navbar />
          <AppChrome>{children}</AppChrome>
          <Footer />
          <MobileNav />
          <PWAProvider />
          <AnalyticsProvider />
          <CookieNotice />
          <MobileCtaBar />
        </ThemeProvider>
      </body>
    </html>
  )
}
