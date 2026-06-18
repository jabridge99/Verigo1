import React from 'react'
import Link from 'next/link'
import {
  ArrowRight, Shield,
  Coins, Globe, ArrowLeftRight, CreditCard, Home, FileCheck,
  Scale, Calculator, Gem, Network, Landmark,
  TrendingUp, Briefcase, ShieldCheck, Building2, Dice5, Factory, Handshake,
} from 'lucide-react'
import { industries } from '@/lib/industries'

export const metadata = {
  title: 'Industries | Verigo',
  description: 'AML/CTF compliance packs for every Australian regulated industry — current reporting entities, Tranche 2 businesses, and all other AUSTRAC-regulated sectors.',
}

const industryIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'vasp': Coins,
  'remittance': Globe,
  'bullion_dealers': Gem,
  'real_estate': Home,
  'conveyancers': FileCheck,
  'legal_professionals': Scale,
  'accountants': Calculator,
  'precious_metals': Gem,
  'pubs_clubs': Building2,
  'reporting_group': Network,
}

const otherSectors: { icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { icon: Landmark, label: 'Banks & Authorised Deposit-taking Institutions (ADIs)' },
  { icon: TrendingUp, label: 'Stockbrokers & Securities Dealers' },
  { icon: Briefcase, label: 'Financial Advisers & Financial Planners' },
  { icon: ShieldCheck, label: 'Life Insurance Providers' },
  { icon: Building2, label: 'Superannuation Trustees & Fund Managers' },
  { icon: Dice5, label: 'Casino & Wagering Operators' },
  { icon: CreditCard, label: 'Stored Value Card & Prepaid Product Providers' },
  { icon: Factory, label: 'Factoring & Invoice Finance Companies' },
  { icon: Handshake, label: 'Trust & Company Service Providers (TCSPs)' },
]

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
            Verigo loads the correct compliance pack for your industry automatically — pre-configured risk rules, KYC requirements, and AUSTRAC reporting obligations built in from day one.
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
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-2xl font-black text-slate-900">Current Reporting Entities</h2>
            <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-700/10">Active obligations now</span>
          </div>
          <p className="text-slate-600 mb-8 max-w-2xl">
            These industries have been reporting entities under the AML/CTF Act 2006 since it came into force. They must maintain a full AML/CTF programme, conduct ongoing CDD, and report to AUSTRAC.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {current.map(ind => {
              const Icon = industryIconMap[ind.id] ?? Shield
              return (
                <Link key={ind.id} href={`/solutions/${ind.slug}`} className="pub-card-hover group flex flex-col">
                  <div className={`w-14 h-14 bg-gradient-to-br ${ind.color} rounded-2xl flex items-center justify-center mb-5`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{ind.label}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-5 flex-1">{ind.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{ind.packName}</span>
                    <span className="text-blue-600 text-sm flex items-center gap-1 group-hover:gap-2 transition-all font-semibold">View pack <ArrowRight className="w-4 h-4" /></span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Tranche 2 */}
      <section className="pub-section bg-slate-50">
        <div className="pub-container">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-2xl font-black text-slate-900">Tranche 2 — Expanded Regime</h2>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-700/10">Effective 1 July 2026</span>
          </div>
          <p className="text-slate-600 mb-6 max-w-2xl">
            The AML/CTF Amendment Act 2024 extends obligations to Designated Non-Financial Businesses and Professions (DNFBPs). These industries must be ready by 1 July 2026.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 flex gap-4">
            <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 mb-1">Prepare now — the deadline is 1 July 2026</p>
              <p className="text-amber-800 text-sm leading-relaxed">Penalties of up to $22.2 million for body corporates. Start building your AML/CTF programme now — enrolment with AUSTRAC opens before the deadline.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {expanded.map(ind => {
              const Icon = industryIconMap[ind.id] ?? Shield
              return (
                <Link key={ind.id} href={`/solutions/${ind.slug}`} className="pub-card-hover group flex flex-col">
                  <div className={`w-14 h-14 bg-gradient-to-br ${ind.color} rounded-2xl flex items-center justify-center mb-5`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{ind.label}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-5 flex-1">{ind.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-600 font-semibold">{ind.packName}</span>
                    <span className="text-blue-600 text-sm flex items-center gap-1 group-hover:gap-2 transition-all font-semibold">View pack <ArrowRight className="w-4 h-4" /></span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Other AUSTRAC-regulated sectors */}
      <section className="pub-section bg-white">
        <div className="pub-container">
          <h2 className="text-2xl font-black text-slate-900 mb-2">Other AUSTRAC-regulated sectors</h2>
          <p className="text-slate-500 text-sm mb-8 max-w-2xl">
            AUSTRAC regulates a broad range of financial services businesses in Australia. The following sectors are all subject to AML/CTF obligations under the AML/CTF Act 2006.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {otherSectors.map(s => (
              <div key={s.label} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3.5 ring-1 ring-slate-100">
                <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <s.icon className="w-4 h-4 text-slate-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="bg-slate-900 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="flex-1">
              <p className="font-semibold text-white mb-1">Operating in one of these sectors?</p>
              <p className="text-slate-400 text-sm">We can tailor a compliance solution to your specific obligations. Contact us to discuss your requirements.</p>
            </div>
            <Link href="/live-demo" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors flex-shrink-0">
              Talk to us <ArrowRight className="w-4 h-4" />
            </Link>
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
