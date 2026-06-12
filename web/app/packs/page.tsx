import Link from 'next/link'
import { ArrowRight, Package } from 'lucide-react'
import { industries } from '@/lib/industries'

export const metadata = {
  title: 'Industry Compliance Packs | Verigo',
  description: 'Pre-configured AML/CTF compliance packs for every Australian regulated industry. KYC workflows, monitoring rules, AUSTRAC report templates, and AML program templates — ready to go.',
}

export default function PacksIndexPage() {
  const current = industries.filter(i => i.regime === 'current')
  const expanded = industries.filter(i => i.regime === 'expanded')

  return (
    <div className="bg-white text-slate-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <span className="pub-label mb-6 block w-fit mx-auto">
            <Package className="w-3.5 h-3.5 mr-1.5 inline" /> Compliance Packs
          </span>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 leading-tight tracking-tight mb-6">
            Your industry.<br />
            <span className="text-blue-600">Your compliance pack.</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-8">
            Pre-configured AML/CTF compliance packs for every Australian regulated industry. Select your sector and start compliant on day one — no configuration required.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm text-slate-500">
            {['KYC & KYB workflows', 'Transaction monitoring rules', 'AUSTRAC report templates', 'AML Program templates'].map(f => (
              <span key={f} className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-4 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="pub-section pt-8">
        <div className="pub-container space-y-16">

          {/* Current regime */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <h2 className="text-2xl font-black text-slate-900">Tranche 1 — Active Obligations</h2>
              <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-700/10">Obligations active now</span>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {current.map(ind => (
                <Link key={ind.id} href={`/packs/${ind.id}`} className="pub-card-hover group">
                  <div className="flex items-center gap-4 mb-5">
                    <div className={`w-14 h-14 bg-gradient-to-br ${ind.color} rounded-2xl flex items-center justify-center text-2xl flex-shrink-0`}>{ind.icon}</div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{ind.packName}</h3>
                      <p className="text-sm text-slate-400">{ind.shortLabel}</p>
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed mb-5">{ind.description}</p>
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {ind.reportingRequirements.types.map(t => (
                      <span key={t} className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{t}</span>
                    ))}
                  </div>
                  <span className="text-blue-600 text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                    View pack details <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Tranche 2 */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-2xl font-black text-slate-900">Tranche 2 — Expanded Regime</h2>
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-700/10">Effective 2026</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 flex gap-4">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-amber-900 mb-1">Prepare now — the deadline is approaching</p>
                <p className="text-amber-800 text-sm leading-relaxed">The AML/CTF Amendment Act 2024 brings real estate professionals, lawyers, accountants, conveyancers, and precious metal dealers under AUSTRAC from 2026. VeriGo&apos;s Tranche 2 packs include everything you need to enrol and comply from day one.</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {expanded.map(ind => (
                <Link key={ind.id} href={`/packs/${ind.id}`} className="pub-card-hover group">
                  <div className="flex items-center gap-4 mb-5">
                    <div className={`w-14 h-14 bg-gradient-to-br ${ind.color} rounded-2xl flex items-center justify-center text-2xl flex-shrink-0`}>{ind.icon}</div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{ind.packName}</h3>
                      <p className="text-sm text-slate-400">{ind.shortLabel}</p>
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed mb-5">{ind.description}</p>
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {ind.reportingRequirements.types.map(t => (
                      <span key={t} className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-600/20">{t}</span>
                    ))}
                  </div>
                  <span className="text-blue-600 text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                    View pack details <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="bg-slate-900 rounded-2xl p-10 md:p-14 text-center">
            <h2 className="text-3xl font-black text-white mb-3">Not sure which pack is right for you?</h2>
            <p className="text-slate-400 mb-8 max-w-xl mx-auto">
              Book a 30-minute demo and we&apos;ll recommend the right compliance pack for your business, walk through exactly what&apos;s included, and answer your AUSTRAC questions.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
                Start Free Trial <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/live-demo" className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-8 py-4 text-base font-semibold text-white ring-1 ring-slate-700 hover:bg-slate-700 transition-colors">
                Book Demo
              </Link>
            </div>
          </div>

        </div>
      </section>
    </div>
  )
}
