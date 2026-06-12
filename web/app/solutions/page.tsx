import Link from 'next/link'
import { ArrowRight, Shield, Users, Search, BarChart3, Folder, FileText, Building2, Zap, UserCheck, ScanFace, ShieldAlert, Newspaper, Network } from 'lucide-react'
import { industries } from '@/lib/industries'
import { capabilities as libCaps } from '@/lib/capabilities'

export const metadata = {
  title: 'AML Compliance Solutions | Verigo',
  description: 'Explore VeriGo\'s complete suite of AML/CTF compliance solutions: customer onboarding, KYC, KYB, sanctions screening, PEP screening, adverse media, transaction monitoring, case management, and AUSTRAC reporting.',
}

const capIcons: Record<string, React.ElementType> = {
  'customer-onboarding': UserCheck,
  'kyc': ScanFace,
  'kyb': Building2,
  'sanctions-screening': ShieldAlert,
  'pep-screening': Shield,
  'adverse-media': Newspaper,
  'transaction-monitoring': BarChart3,
  'case-management': Folder,
  'regulatory-reporting': FileText,
  'reporting-groups': Network,
  'workflow-automation': Zap,
}

const capabilities = libCaps.map(c => ({
  ...c,
  icon: capIcons[c.id] ?? Shield,
}))

export default function SolutionsPage() {
  const current = industries.filter(i => i.regime === 'current')
  const expanded = industries.filter(i => i.regime === 'expanded')

  return (
    <div className="bg-white text-slate-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <span className="pub-label mb-6 block w-fit mx-auto">Platform</span>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 leading-tight tracking-tight mb-6">
            The Compliance<br />Operating System
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-8">
            Eight integrated capabilities designed to eliminate the complexity of AML/CTF compliance for Australian reporting entities.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/start-trial" className="pub-btn-lg">Start Free Trial <ArrowRight className="w-5 h-5" /></Link>
            <Link href="/live-demo" className="pub-btn-secondary-lg">Book Demo</Link>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="pub-section">
        <div className="pub-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-slate-900 mb-3">Platform Capabilities</h2>
            <p className="text-slate-500 max-w-xl mx-auto">Every capability works independently or as part of the full compliance stack.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {capabilities.map(({ id, slug, icon: Icon, title, tagline, benefits }) => (
              <Link key={id} href={`/solutions/${id}`} className="pub-card-hover group flex flex-col gap-4">
                <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 mb-1">{title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-3">{tagline}</p>
                  {benefits.slice(0, 2).map(b => (
                    <p key={b} className="text-xs text-slate-400 flex items-start gap-1.5 mb-1">
                      <span className="text-green-500 mt-0.5">✓</span> {b}
                    </p>
                  ))}
                </div>
                <span className="text-blue-600 text-sm font-semibold group-hover:underline">Learn more →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="pub-section bg-slate-50">
        <div className="pub-container">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl font-black text-slate-900">Current Reporting Entities</h2>
              <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-700/10">Active obligations now</span>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {current.map(ind => (
                <Link key={ind.id} href={`/solutions/${ind.id}`} className="pub-card-hover group flex flex-col">
                  <div className={`w-14 h-14 bg-gradient-to-br ${ind.color} rounded-2xl flex items-center justify-center text-2xl mb-5`}>{ind.icon}</div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{ind.label}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-5 flex-1">{ind.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{ind.packName}</span>
                    <span className="text-blue-600 text-sm flex items-center gap-1 group-hover:gap-2 transition-all font-semibold">View pack <ArrowRight className="w-4 h-4" /></span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl font-black text-slate-900">Tranche 2 — Expanded Regime</h2>
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-700/10">Effective 2026</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 flex gap-4">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-amber-900 mb-1">Prepare now — the deadline is approaching</p>
                <p className="text-amber-800 text-sm leading-relaxed">The AML/CTF Amendment Act 2024 will bring real estate professionals, lawyers, accountants, conveyancers and precious metal dealers under AUSTRAC&apos;s regulatory umbrella from 2026.</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {expanded.map(ind => (
                <Link key={ind.id} href={`/solutions/${ind.id}`} className="pub-card-hover group flex flex-col">
                  <div className={`w-14 h-14 bg-gradient-to-br ${ind.color} rounded-2xl flex items-center justify-center text-2xl mb-5`}>{ind.icon}</div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{ind.label}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-5 flex-1">{ind.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-600 font-semibold">{ind.packName}</span>
                    <span className="text-blue-600 text-sm flex items-center gap-1 group-hover:gap-2 transition-all font-semibold">View pack <ArrowRight className="w-4 h-4" /></span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pub-section bg-slate-900">
        <div className="pub-container text-center">
          <h2 className="text-4xl font-black text-white mb-4">Ready to get started?</h2>
          <p className="text-slate-400 text-lg mb-8">7-day free trial. No credit card. Full access to all features.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/live-demo" className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-8 py-4 text-base font-semibold text-white ring-1 ring-slate-700 hover:bg-slate-700 transition-colors">
              Book Demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
