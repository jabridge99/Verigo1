import Link from 'next/link'
import { ArrowRight, BookOpen, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import { industries } from '@/lib/industries'
import { onboardingPacks } from '@/lib/onboardingPacks'

export const metadata = {
  title: 'AML Onboarding Packs | Verigo',
  description: 'Complete onboarding packs for every AUSTRAC-regulated industry. Covers AML obligations, CDD requirements, monitoring controls, reporting, risk assessment, program structure, and go-live checklist.',
}

export default function OnboardingPacksIndexPage() {
  const current = industries.filter(i => i.regime === 'current')
  const expanded = industries.filter(i => i.regime === 'expanded')

  return (
    <div className="bg-white text-slate-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <span className="pub-label mb-6 block w-fit mx-auto">Onboarding Packs</span>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 leading-tight tracking-tight mb-6">
            Get compliant.<br />From day one.
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-8">
            Detailed, industry-specific onboarding guides for every AUSTRAC-regulated business. Covers your legal obligations, CDD requirements, monitoring controls, reporting procedures, and a step-by-step Verigo configuration checklist.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
            {['10 industries covered', '10 sections per pack', 'Australian AML/CTF legislation', 'Verigo configuration checklist', 'Go-live readiness assessment'].map(f => (
              <span key={f} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" /> {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* What's in each pack */}
      <section className="pub-section bg-slate-50">
        <div className="pub-container">
          <h2 className="text-2xl font-black text-slate-900 mb-6 text-center">What&apos;s in every pack</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { n: '01', title: 'Industry Overview', desc: 'Legislation, regulatory context, enforcement history, and key risk profile' },
              { n: '02', title: 'AML Obligations', desc: 'Full breakdown of every legal obligation applicable to your industry' },
              { n: '03', title: 'Required CDD', desc: 'Customer due diligence requirements by customer type and transaction tier' },
              { n: '04', title: 'Required EDD', desc: 'Enhanced due diligence triggers and documentation requirements' },
              { n: '05', title: 'Monitoring Controls', desc: 'Specific monitoring rules, alert types, and review procedures' },
              { n: '06', title: 'Reporting Obligations', desc: 'Every report type with deadlines, thresholds, and required fields' },
              { n: '07', title: 'Risk Assessment', desc: 'Risk rating matrix and methodology for your industry' },
              { n: '08', title: 'AML Program Structure', desc: 'Recommended program components, policies, and procedures' },
              { n: '09', title: 'Verigo Checklist', desc: 'Phased configuration checklist to get Verigo live for your business' },
              { n: '10', title: 'Go-Live Assessment', desc: 'Pre-launch readiness checklist covering all critical compliance controls' },
            ].map(s => (
              <div key={s.n} className="bg-white rounded-xl p-4 ring-1 ring-slate-200">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-black mb-3">{s.n}</div>
                <p className="font-bold text-slate-900 text-sm mb-1">{s.title}</p>
                <p className="text-slate-500 text-xs leading-relaxed">{s.desc}</p>
              </div>
            ))}
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {current.map(ind => {
              const pack = onboardingPacks.find(p => p.industryId === ind.id)
              return (
                <Link key={ind.id} href={`/onboarding-packs/${ind.id}`} className="pub-card-hover group flex flex-col">
                  <div className={`w-14 h-14 bg-gradient-to-br ${ind.color} rounded-2xl flex items-center justify-center text-2xl mb-5`}>{ind.icon}</div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{ind.label}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-4 flex-1">{ind.description}</p>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {ind.reportingRequirements.types.map(t => (
                      <span key={t} className="inline-flex items-center rounded-lg bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>10-section pack</span>
                    </div>
                    <span className="text-blue-600 text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                      View pack <ArrowRight className="w-4 h-4" />
                    </span>
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
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 flex gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 mb-1">Obligations commence 1 July 2026 — prepare now</p>
              <p className="text-amber-800 text-sm leading-relaxed">Real estate professionals, lawyers, accountants, conveyancers, and precious metal dealers must enrol with AUSTRAC and have an AML/CTF program in place before providing designated services from 1 July 2026. Each pack includes a phased configuration checklist designed to have your Verigo environment ready before the effective date.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {expanded.map(ind => {
              return (
                <Link key={ind.id} href={`/onboarding-packs/${ind.id}`} className="pub-card-hover group flex flex-col">
                  <div className={`w-14 h-14 bg-gradient-to-br ${ind.color} rounded-2xl flex items-center justify-center text-2xl mb-5`}>{ind.icon}</div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{ind.label}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-4 flex-1">{ind.description}</p>
                  <div className="flex flex-wrap gap-2 mb-5">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                      <Clock className="w-3 h-3" /> July 2026
                    </span>
                    {ind.reportingRequirements.types.map(t => (
                      <span key={t} className="inline-flex items-center rounded-lg bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>10-section pack</span>
                    </div>
                    <span className="text-blue-600 text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                      View pack <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pub-section bg-slate-900">
        <div className="pub-container text-center">
          <h2 className="text-4xl font-black text-white mb-4">Start your compliance journey today</h2>
          <p className="text-slate-400 text-lg mb-8">7-day free trial. Your industry compliance pack is configured on day one.</p>
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
