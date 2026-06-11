import Link from 'next/link'
import { ArrowRight, CheckCircle } from 'lucide-react'
import { industries } from '@/lib/industries'

export const metadata = {
  title: 'Industry Solutions | Trust Verify Go',
  description: 'Compliance packs for every regulated Australian industry.',
}

export default function SolutionsPage() {
  const current = industries.filter(i => i.regime === 'current')
  const expanded = industries.filter(i => i.regime === 'expanded')

  return (
    <div className="section">
      <div className="container-xl mx-auto">
        <div className="text-center mb-16">
          <span className="badge bg-brand-900/50 text-brand-400 border border-brand-700/30 mb-4">All Industries</span>
          <h1 className="text-5xl font-black mb-6">The right compliance pack<br /><span className="gradient-text">for your industry.</span></h1>
          <p className="text-white/60 text-xl max-w-2xl mx-auto">
            Select your industry and Trust Verify Go automatically loads the correct compliance requirements, risk matrix, KYC rules, and AUSTRAC reporting obligations.
          </p>
        </div>

        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold">Current Reporting Entities</h2>
            <span className="badge bg-green-900/30 text-green-400 border border-green-700/30">Active obligations now</span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {current.map(ind => (
              <Link key={ind.id} href={`/solutions/${ind.id}`} className="card-hover group flex flex-col">
                <div className={`w-14 h-14 bg-gradient-to-br ${ind.color} rounded-2xl flex items-center justify-center text-2xl mb-5`}>{ind.icon}</div>
                <h3 className="text-lg font-bold mb-2">{ind.label}</h3>
                <p className="text-white/55 text-sm leading-relaxed mb-5 flex-1">{ind.description}</p>
                <div className="flex items-center justify-between">
                  <span className="badge bg-navy-700 text-white/50">{ind.packName}</span>
                  <span className="text-brand-400 text-sm flex items-center gap-1 group-hover:gap-2 transition-all">View pack <ArrowRight className="w-4 h-4" /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold">Tranche 2 — Expanded Regime</h2>
            <span className="badge bg-amber-900/30 text-amber-400 border border-amber-700/30">Effective 2026</span>
          </div>
          <div className="card border-amber-700/20 bg-amber-900/5 mb-8 flex gap-4">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-amber-300 mb-1">Prepare now — the deadline is approaching</p>
              <p className="text-white/60 text-sm leading-relaxed">The AML/CTF Amendment Act 2024 will bring real estate professionals, lawyers, accountants, conveyancers and precious metal dealers under AUSTRAC&apos;s regulatory umbrella from 2026.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {expanded.map(ind => (
              <Link key={ind.id} href={`/solutions/${ind.id}`} className="card-hover group flex flex-col">
                <div className={`w-14 h-14 bg-gradient-to-br ${ind.color} rounded-2xl flex items-center justify-center text-2xl mb-5`}>{ind.icon}</div>
                <h3 className="text-lg font-bold mb-2">{ind.label}</h3>
                <p className="text-white/55 text-sm leading-relaxed mb-5 flex-1">{ind.description}</p>
                <div className="flex items-center justify-between">
                  <span className="badge bg-amber-900/30 text-amber-400 border border-amber-700/30">{ind.packName}</span>
                  <span className="text-brand-400 text-sm flex items-center gap-1 group-hover:gap-2 transition-all">View pack <ArrowRight className="w-4 h-4" /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
