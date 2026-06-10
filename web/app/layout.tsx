import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Trust Verify Go | Australian AML/CTF Compliance Platform',
  description: 'The Australian-first Compliance Operating System for regulated businesses. AUSTRAC-aligned KYC, AML transaction monitoring, IFTI/TTR/SMR reporting, sanctions screening and case management.',
  keywords: 'AML, KYC, AUSTRAC, compliance, Australia, digital currency exchange, remittance, Tranche 2, anti-money laundering',
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
      </body>
    </html>
  )
}
