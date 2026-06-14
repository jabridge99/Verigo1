import React from 'react'
import Link from 'next/link'
import { ArrowRight, Shield, BarChart3, Folder, FileText, Building2, Zap, UserCheck, ScanFace, ShieldAlert, Newspaper, Network, BookOpen, UserX } from 'lucide-react'
import { capabilities as libCaps } from '@/lib/capabilities'


export const metadata = {
  title: 'AML Compliance Solutions | Verigo',
  description: 'Explore VeriGo\'s complete suite of AML/CTF compliance solutions: AML Program, customer onboarding, KYC, KYB, sanctions screening, PEP screening, adverse media, transaction monitoring, case management, and AUSTRAC reporting.',
}

const amlProgramFeature = {
  id: 'aml-program',
  slug: 'aml-program',
  title: 'AML Program',
  tagline: 'Your legally required AML/CTF Program — built into the platform, not sitting in a drawer',
  benefits: [
    'ML/TF Risk Assessment — the foundation of your program',
    'Unified AML/CTF Program aligned to 2026 reforms',
    'CDD/EDD policies and MLRO workflows',
    'Compliance registers maintained automatically',
    'Staff training module with completion tracking',
    'Annual review workflow with automated reminders',
  ],
  icon: BookOpen,
  highlight: true,
}

const capIcons: Record<string, React.ElementType> = {
  'customer-onboarding': UserCheck,
  'kyc-identity-verification': ScanFace,
  'kyb-business-verification': Building2,
  'sanctions-screening': ShieldAlert,
  'pep-screening': UserX,
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
  highlight: false,
}))

export default function SolutionsPage() {
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
            Twelve integrated capabilities — from your AML Program foundation through to automated AUSTRAC reporting. Built exclusively for Australian regulated businesses.
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

          {/* AML Program featured card */}
          <Link href="/solutions/aml-program" className="block pub-card-hover mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white group">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-white">{amlProgramFeature.title}</h3>
                  <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">Core Feature — Included in every plan</span>
                </div>
                <p className="text-blue-100 text-sm mb-4">{amlProgramFeature.tagline}</p>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  {amlProgramFeature.benefits.slice(0, 4).map(b => (
                    <span key={b} className="text-xs text-blue-200 flex items-center gap-1.5">
                      <span className="text-green-300">✓</span> {b}
                    </span>
                  ))}
                </div>
              </div>
              <span className="text-white font-semibold text-sm flex items-center gap-1 group-hover:gap-2 transition-all flex-shrink-0">
                Explore <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </Link>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {capabilities.map(({ id, slug, icon: Icon, title, tagline, benefits }) => (
              <Link key={id} href={`/solutions/${slug}`} className="pub-card-hover group flex flex-col gap-4">
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

          {/* AUSTRAC Reporting sub-capabilities */}
          <div className="bg-slate-50 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <FileText className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900">AUSTRAC Reporting — all report types included</h3>
              <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-700/10">Every plan</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { code: 'IFTI', name: 'International Funds Transfer Instruction', desc: 'IFTI IN and IFTI OUT reports for international transfers of $10,000 AUD or more. Bulk import for high-volume corridors. Pre-populated from transaction data.', deadline: 'Due: within 10 business days' },
                { code: 'SMR', name: 'Suspicious Matter Report', desc: 'Suspicious matter reports generated directly from investigated cases. Built-in AUSTRAC field validation. MLRO sign-off workflow before submission.', deadline: 'Due: within 3 business days' },
                { code: 'TTR', name: 'Threshold Transaction Report', desc: 'Threshold cash transaction reports for transactions of $10,000 AUD or more. Auto-generated from transaction data. Batch submission supported.', deadline: 'Due: within 10 business days' },
              ].map(r => (
                <div key={r.code} className="bg-white rounded-xl p-5 ring-1 ring-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1 text-sm font-black text-white">{r.code}</span>
                    <span className="text-xs text-slate-400 font-medium">{r.deadline}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">{r.name}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Industries CTA */}
      <section className="pub-section bg-slate-50">
        <div className="pub-container text-center">
          <h2 className="text-2xl font-black text-slate-900 mb-3">Looking for your industry?</h2>
          <p className="text-slate-500 mb-6 max-w-xl mx-auto">Every compliance pack is pre-configured for your sector — current reporting entities, Tranche 2 businesses, and more.</p>
          <Link href="/industries" className="pub-btn-secondary inline-flex">
            View all industries <ArrowRight className="w-4 h-4" />
          </Link>
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
