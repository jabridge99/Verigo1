import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { industries } from '@/lib/industries'

export const metadata = {
  title: 'Industries | Verigo',
  description: 'AML/CTF compliance packs for every Australian regulated industry.',
}

export default function IndustriesPage() {
  const current = industries.filter(i => i.regime === 'current')
  const expanded = industries.filter(i => i.regime === 'expanded')

  return (
    <div className="bg-white text-slate-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <span className="pub-label mb-6 block w-fit mx-auto">Industries</span>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 leading-tight tracking-tight mb-6">
            Every regulated<br />business covered.
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-8">
            Verigo loads the correct compliance pack for your industry automatically — pre-configured risk rules, KYC requirements, and AUSTRAC reporting obligations.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/start-trial" className="pub-btn-lg">Start Free Trial <ArrowRight className="w-5 h-5" /></Link>
            <Link href="/live-demo" className="pub-btn-secondary-lg">Book Demo</Link>
          </div>
        </div>
      </section>

      {/* Current Reporting Entities */}
      <section className="pub-section">
        <div className="pub-container">
          <div className="flex items-center gap-3 mb-8">
            <h2 className="text-2xl font-black text-slate-900">Current Reporting Entities</h2>
            <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-700/10">Active obligations now</span>
          </div>
          <p className="text-slate-600 mb-8 max-w-2xl">
            These industries have been reporting entities under the AML/CTF Act 2006 since it came into force. They must maintain full AML/CTF programmes, conduct ongoing CDD, and report to AUSTRAC.
          </p>
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
      </section>

      {/* Tranche 2 */}
      <section className="pub-section bg-slate-50">
        <div className="pub-container">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-2xl font-black text-slate-900">Tranche 2 — Expanded Regime</h2>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-700/10">Effective 2026</span>
          </div>
          <p className="text-slate-600 mb-6 max-w-2xl">
            The AML/CTF Amendment Act 2024 extends obligations to Designated Non-Financial Businesses and Professions. These industries must be ready by 2026.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 flex gap-4">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-amber-900 mb-1">Prepare now — the deadline is 2026</p>
              <p className="text-amber-800 text-sm leading-relaxed">Penalties of up to $22.2 million for body corporates. Criminal prosecution for individuals. Start building your programme now — not in 2025.</p>
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
      </section>

      {/* CTA */}
      <section className="pub-section bg-slate-900">
        <div className="pub-container text-center">
          <h2 className="text-4xl font-black text-white mb-4">Find your industry. Start compliant.</h2>
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
