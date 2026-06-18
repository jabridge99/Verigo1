import Link from 'next/link'
import { Shield } from 'lucide-react'

const footerLinks = {
  Solutions: [
    { label: 'All Solutions', href: '/solutions' },
    { label: 'Customer Onboarding', href: '/solutions/customer-onboarding' },
    { label: 'KYC & Identity Verification', href: '/solutions/kyc-identity-verification' },
    { label: 'Transaction Monitoring', href: '/solutions/transaction-monitoring' },
    { label: 'Regulatory Reporting', href: '/solutions/regulatory-reporting' },
    { label: 'Case Management', href: '/solutions/case-management' },
    { label: 'Workflow Automation', href: '/solutions/workflow-automation' },
  ],
  Industries: [
    { label: 'Compliance Packs', href: '/packs' },
    { label: 'VASPs / Digital Currency Exchanges (DCEs)', href: '/packs/digital-currency-exchange' },
    { label: 'Remittance Providers', href: '/packs/remittance-provider' },
    { label: 'Real Estate Professionals', href: '/packs/real-estate' },
    { label: 'Law Firms', href: '/packs/law-firm' },
    { label: 'Accounting Firms', href: '/packs/accounting-firm' },
    { label: 'View all packs', href: '/packs' },
  ],
  Company: [
    { label: 'Our Company', href: '/company' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'API & Integrations', href: '/api-integrations' },
    { label: 'Trust Centre', href: '/trust-centre' },
    { label: 'Contact Us', href: '/contact' },
    { label: 'Book Demo', href: '/live-demo' },
    { label: 'Sign In', href: '/login' },
  ],
  Resources: [
    { label: 'Learning Centre', href: '/learn' },
    { label: 'AML/CTF Fundamentals', href: '/learn/aml-fundamentals' },
    { label: 'KYC Guide', href: '/learn/kyc-guide' },
    { label: 'SMR Guide', href: '/learn/smr-guide' },
    { label: 'AUSTRAC Reform Guide', href: '/learn/austrac-reform-guide' },
    { label: 'AUSTRAC', href: 'https://www.austrac.gov.au', target: '_blank' as const },
  ],
}

export default function Footer() {
  return (
    <footer className="bg-slate-950 pt-16 pb-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg text-white">Veri<span className="text-blue-400">go</span></span>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs mb-5">
              Australia&apos;s Compliance Operating System for regulated businesses navigating AUSTRAC obligations and AML reforms.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-blue-950 px-2.5 py-1 text-xs font-medium text-blue-400 ring-1 ring-blue-800">AUSTRAC Aligned</span>
              <span className="inline-flex items-center rounded-full bg-emerald-950 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-800">FATF Ready</span>
              <span className="inline-flex items-center rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 ring-1 ring-slate-700">🇦🇺 Australian Data</span>
            </div>
          </div>

          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <h4 className="text-white font-semibold text-sm mb-4">{section}</h4>
              <ul className="space-y-2.5">
                {links.map(l => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      target={'target' in l ? l.target : undefined}
                      className="text-slate-400 hover:text-slate-200 text-sm transition-colors"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} PSP Education Pty Ltd (ABN 21 628 429 925), trading as Verigo. All rights reserved.
          </p>
          <div className="flex gap-6">
            {[
              { label: 'Privacy Policy', href: '/privacy' },
              { label: 'Terms of Service', href: '#' },
              { label: 'Security', href: '/trust-centre' },
            ].map(l => (
              <Link key={l.label} href={l.href} className="text-slate-500 hover:text-slate-400 text-sm transition-colors">{l.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
