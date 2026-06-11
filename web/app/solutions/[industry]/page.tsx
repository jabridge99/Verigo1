import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, ArrowRight, Shield, AlertTriangle } from 'lucide-react'
import { industries, getIndustry } from '@/lib/industries'

export async function generateStaticParams() {
  return industries.map(i => ({ industry: i.id }))
}

export default function IndustryPage({ params }: { params: { industry: string } }) {
  const ind = getIndustry(params.industry)
  if (!ind) notFound()

  return (
    <div className="section">
      <div className="container-xl mx-auto">
        <div className="mb-12">
          <Link href="/solutions" className="text-white/50 hover:text-white text-sm flex items-center gap-1 mb-6">
            ← All industries
          </Link>
          <div className="flex items-start gap-6">
            <div className={`w-16 h-16 bg-gradient-to-br ${ind.color} rounded-2xl flex items-center justify-center text-3xl flex-shrink-0`}>{ind.icon}</div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-black">{ind.label}</h1>
                <span className={`badge ${ind.regime === 'current' ? 'bg-green-900/30 text-green-400 border border-green-700/30' : 'bg-amber-900/30 text-amber-400 border border-amber-700/30'}`}>
                  {ind.regime === 'current' ? 'Active obligations now' : 'Tranche 2 — 2026'}
                </span>
              </div>
              <p className="text-white/60 text-lg">{ind.description}</p>
              <p className="text-white/40 text-sm mt-2">{ind.austracRef}</p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-brand-400" />
              <h2 className="font-bold">Compliance Obligations</h2>
            </div>
            <ul className="space-y-2">
              {ind.obligations.map(o => (
                <li key={o} className="flex items-start gap-2 text-sm text-white/70">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />{o}
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h2 className="font-bold">Key Risk Areas</h2>
            </div>
            <ul className="space-y-2">
              {ind.keyRisks.map(r => (
                <li key={r} className="flex items-start gap-2 text-sm text-white/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-2" />{r}
                </li>
              ))}
            </ul>
          </div>

          <div className="card bg-brand-900/10 border-brand-700/30">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-brand-400" />
              <h2 className="font-bold">{ind.packName}</h2>
            </div>
            <p className="text-white/60 text-sm mb-6">Pre-loaded compliance configuration for {ind.shortLabel} — KYC rules, monitoring thresholds, AUSTRAC report templates and risk scoring.</p>
            <Link href="/start-trial" className="btn-gold w-full justify-center">Start Free Trial <ArrowRight className="w-4 h-4" /></Link>
            <Link href="/live-demo" className="btn-secondary w-full justify-center mt-3">Book a Demo</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
