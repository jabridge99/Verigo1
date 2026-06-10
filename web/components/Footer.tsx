import Link from 'next/link'
import { Shield } from 'lucide-react'

const footerLinks = {
  Solutions: [
    { label: 'Digital Currency Exchange', href: '/solutions/digital-currency-exchange' },
    { label: 'Remittance Provider', href: '/solutions/remittance-provider' },
    { label: 'Foreign Exchange', href: '/solutions/foreign-exchange' },
    { label: 'Payment Service Provider', href: '/solutions/payment-service-provider' },
    { label: 'Real Estate', href: '/solutions/real-estate' },
    { label: 'Lawyers & Accountants', href: '/solutions/lawyer' },
  ],
  Platform: [
    { label: 'Customer Onboarding', href: '/#onboarding' },
    { label: 'KYC / KYB Verification', href: '/#kyc' },
    { label: 'Transaction Monitoring', href: '/#monitoring' },
    { label: 'AUSTRAC Reporting', href: '/#reporting' },
    { label: 'Case Management', href: '/#cases' },
    { label: 'API & Integrations', href: '/api-integrations' },
  ],
  Company: [
    { label: 'Pricing', href: '/pricing' },
    { label: 'Live Demo', href: '/live-demo' },
    { label: 'Start Free Trial', href: '/start-trial' },
    { label: 'Login', href: '/login' },
  ],
  Compliance: [
    { label: 'AUSTRAC', href: 'https://www.austrac.gov.au', target: '_blank' },
    { label: 'FATF Recommendations', href: 'https://www.fatf-gafi.org', target: '_blank' },
    { label: 'AML/CTF Act 2006', href: '#' },
    { label: 'Tranche 2 Reforms', href: '#' },
  ],
}

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-navy-900 pt-16 pb-8 px-4">
      <div className="container-xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 font-bold text-lg mb-4">
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-white">Trust<span className="text-brand-400"> Verify</span><span className="text-gold-400"> Go</span></span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed">
              Australian-first Compliance Operating System for regulated businesses.
            </p>
            <div className="mt-4 flex gap-2 flex-wrap">
              <span className="badge bg-brand-900/50 text-brand-400 border border-brand-700/30">AUSTRAC Aligned</span>
              <span className="badge bg-green-900/30 text-green-400 border border-green-700/30">FATF Ready</span>
            </div>
          </div>

          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <h4 className="text-white font-semibold text-sm mb-4">{section}</h4>
              <ul className="space-y-2">
                {links.map(l => (
                  <li key={l.label}>
                    <Link href={l.href} target={(l as any).target}
                      className="text-white/50 hover:text-white/80 text-sm transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/40 text-sm">
            © {new Date().getFullYear()} Trust Verify Go. All rights reserved. ABN: XX XXX XXX XXX
          </p>
          <div className="flex gap-6">
            {['Privacy Policy', 'Terms of Service', 'Security'].map(l => (
              <Link key={l} href="#" className="text-white/40 hover:text-white/60 text-sm transition-colors">{l}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
