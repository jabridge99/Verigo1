import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight, CheckCircle, XCircle, AlertTriangle, BookOpen, Users, Search,
  FileText, BarChart3, ClipboardList, Shield, Zap, ArrowLeft, Clock,
} from 'lucide-react'
import { industries } from '@/lib/industries'
import { onboardingPacks } from '@/lib/onboardingPacks'

export function generateStaticParams() {
  return industries.map(i => ({ industry: i.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ industry: string }> }) {
  const { industry } = await params
  const pack = onboardingPacks.find(p => p.industryId === industry)
  const ind = industries.find(i => i.id === industry)
  if (!pack || !ind) return {}
  return {
    title: `${ind.label} Onboarding Pack | Verigo`,
    description: `Complete AML/CTF onboarding guide for ${ind.label}s. Covers AML obligations, CDD, EDD, monitoring, reporting, risk assessment, AML program structure, and Verigo configuration checklist.`,
  }
}

const sectionIcons = [BookOpen, FileText, Users, Shield, BarChart3, FileText, ClipboardList, Zap, CheckCircle, ArrowRight]

const sections = [
  { id: 'overview', label: 'Industry Overview' },
  { id: 'obligations', label: 'AML Obligations' },
  { id: 'cdd', label: 'Required CDD' },
  { id: 'edd', label: 'Required EDD' },
  { id: 'monitoring', label: 'Monitoring Controls' },
  { id: 'reporting', label: 'Reporting Obligations' },
  { id: 'risk-assessment', label: 'Risk Assessment' },
  { id: 'aml-program', label: 'AML Program Structure' },
  { id: 'verigo-checklist', label: 'Verigo Checklist' },
  { id: 'go-live', label: 'Go-Live Assessment' },
]

export default async function OnboardingPackPage({ params }: { params: Promise<{ industry: string }> }) {
  const { industry } = await params
  const pack = onboardingPacks.find(p => p.industryId === industry)
  const ind = industries.find(i => i.id === industry)

  if (!pack || !ind) notFound()

  return (
    <div className="bg-white text-slate-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Link href="/onboarding-packs" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
              <ArrowLeft className="w-4 h-4" /> All Onboarding Packs
            </Link>
          </div>
          <div className="flex items-start gap-6">
            <div className={`w-16 h-16 bg-gradient-to-br ${ind.color} rounded-2xl flex items-center justify-center text-3xl flex-shrink-0`}>{ind.icon}</div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="pub-label">Onboarding Pack</span>
                {pack.regime === 'expanded' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-700/10">
                    <Clock className="w-3.5 h-3.5" /> Tranche 2 — Effective 1 July 2026
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-700/10">
                    Active obligations now
                  </span>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-3">
                {ind.label}<br />Onboarding Pack
              </h1>
              <p className="text-slate-600 text-lg max-w-3xl">{ind.description}</p>
            </div>
          </div>
          {/* Report type chips */}
          <div className="flex flex-wrap gap-3 mt-8">
            {ind.reportingRequirements.types.map(t => (
              <span key={t} className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1 text-sm font-bold text-white">{t}</span>
            ))}
            <span className="inline-flex items-center rounded-lg bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">10 sections</span>
            <span className="inline-flex items-center rounded-lg bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">{ind.austracRef}</span>
          </div>
        </div>
      </section>

      {/* Body: sidebar + content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex gap-12 items-start">
          {/* Sticky sidebar */}
          <aside className="hidden lg:block w-56 flex-shrink-0 sticky top-24">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Contents</p>
            <nav className="space-y-1">
              {sections.map((s, idx) => (
                <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2.5 text-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg px-3 py-2 transition-colors group">
                  <span className="w-5 h-5 rounded-md bg-slate-100 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center text-xs font-bold text-slate-500 transition-colors flex-shrink-0">{idx + 1}</span>
                  {s.label}
                </a>
              ))}
            </nav>
            <div className="mt-8 p-4 bg-blue-50 rounded-xl">
              <p className="text-xs font-semibold text-blue-900 mb-2">Ready to configure?</p>
              <Link href="/start-trial" className="block text-center text-xs font-semibold text-white bg-blue-600 rounded-lg py-2 hover:bg-blue-700 transition-colors">
                Start Free Trial
              </Link>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0 space-y-16">

            {/* Section 1: Overview */}
            <section id="overview">
              <SectionHeader n={1} title="Industry Overview" />
              <p className="text-slate-700 leading-relaxed mb-6 text-lg">{pack.overview.intro}</p>
              {pack.overview.paragraphs.map((p, i) => (
                <p key={i} className="text-slate-600 leading-relaxed mb-4">{p}</p>
              ))}
              <div className="grid sm:grid-cols-2 gap-3 mt-8">
                {pack.overview.keyFacts.map(f => (
                  <div key={f.label} className="flex items-start gap-3 bg-slate-50 rounded-xl p-4">
                    <span className="text-xs font-semibold text-slate-500 w-32 flex-shrink-0 pt-0.5">{f.label}</span>
                    <span className="text-sm font-semibold text-slate-900">{f.value}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 2: AML Obligations */}
            <section id="obligations">
              <SectionHeader n={2} title="AML Obligations" />
              <p className="text-slate-600 leading-relaxed mb-8">{pack.amlObligations.intro}</p>
              <div className="space-y-4">
                {pack.amlObligations.obligations.map((o, i) => (
                  <div key={i} className="pub-card">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0">{i + 1}</div>
                      <div>
                        <h3 className="font-bold text-slate-900 mb-2">{o.title}</h3>
                        <p className="text-slate-600 text-sm leading-relaxed">{o.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 3: CDD */}
            <section id="cdd">
              <SectionHeader n={3} title="Required Customer Due Diligence" />
              <p className="text-slate-600 leading-relaxed mb-8">{pack.cdd.intro}</p>
              <div className="space-y-6">
                {pack.cdd.requirements.map((req, i) => (
                  <div key={i} className="pub-card">
                    <h3 className="font-bold text-slate-900 mb-4">{req.category}</h3>
                    <ul className="space-y-2">
                      {req.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-3 text-sm text-slate-700">
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 4: EDD */}
            <section id="edd">
              <SectionHeader n={4} title="Required Enhanced Due Diligence" />
              <p className="text-slate-600 leading-relaxed mb-6">{pack.edd.intro}</p>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8">
                <h3 className="font-bold text-amber-900 mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> EDD Triggers</h3>
                <ul className="space-y-2">
                  {pack.edd.triggers.map((t, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-6">
                {pack.edd.requirements.map((req, i) => (
                  <div key={i} className="pub-card">
                    <h3 className="font-bold text-slate-900 mb-4">{req.category}</h3>
                    <ul className="space-y-2">
                      {req.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-3 text-sm text-slate-700">
                          <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 5: Monitoring */}
            <section id="monitoring">
              <SectionHeader n={5} title="Required Monitoring Controls" />
              <p className="text-slate-600 leading-relaxed mb-8">{pack.monitoring.intro}</p>
              <div className="space-y-4">
                {pack.monitoring.controls.map((c, i) => (
                  <div key={i} className="pub-card flex gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-slate-900">{c.name}</h3>
                        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-700/10">{c.ruleType}</span>
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed">{c.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 6: Reporting */}
            <section id="reporting">
              <SectionHeader n={6} title="Required Reporting Obligations" />
              <p className="text-slate-600 leading-relaxed mb-8">{pack.reporting.intro}</p>
              <div className="space-y-6">
                {pack.reporting.reports.map((r, i) => (
                  <div key={i} className="pub-card">
                    <div className="flex items-start gap-4 mb-4">
                      <span className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-base font-black text-white">{r.type}</span>
                      <div>
                        <p className="font-bold text-slate-900">{r.fullName}</p>
                        <div className="flex flex-wrap gap-4 mt-1">
                          <span className="text-xs text-slate-500">⏱ Deadline: <strong className="text-slate-700">{r.deadline}</strong></span>
                          <span className="text-xs text-slate-500">$ Threshold: <strong className="text-slate-700">{r.threshold}</strong></span>
                        </div>
                      </div>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">{r.description}</p>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Key Fields Required</p>
                      <ul className="space-y-1">
                        {r.keyFields.map((f, j) => (
                          <li key={j} className="flex items-center gap-2 text-sm text-slate-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" /> {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 7: Risk Assessment */}
            <section id="risk-assessment">
              <SectionHeader n={7} title="Recommended Risk Assessment" />
              <p className="text-slate-600 leading-relaxed mb-6">{pack.riskAssessment.intro}</p>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="text-left p-3 rounded-tl-xl font-semibold">Risk Factor</th>
                      <th className="text-left p-3 font-semibold">Low Risk</th>
                      <th className="text-left p-3 font-semibold">Medium Risk</th>
                      <th className="text-left p-3 rounded-tr-xl font-semibold">High Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pack.riskAssessment.ratingMatrix.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="p-3 font-medium text-slate-900 border-b border-slate-100">{row.factor}</td>
                        <td className="p-3 text-slate-600 border-b border-slate-100">
                          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />{row.lowRisk}</span>
                        </td>
                        <td className="p-3 text-slate-600 border-b border-slate-100">
                          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />{row.mediumRisk}</span>
                        </td>
                        <td className="p-3 text-slate-600 border-b border-slate-100">
                          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />{row.highRisk}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-blue-50 rounded-xl p-5">
                <p className="text-sm font-semibold text-blue-900 mb-2">Methodology Note</p>
                <p className="text-sm text-blue-800 leading-relaxed">{pack.riskAssessment.methodology}</p>
              </div>
            </section>

            {/* Section 8: AML Program */}
            <section id="aml-program">
              <SectionHeader n={8} title="Recommended AML Program Structure" />
              <p className="text-slate-600 leading-relaxed mb-8">{pack.amlProgram.intro}</p>
              <div className="space-y-5">
                {pack.amlProgram.components.map((c, i) => (
                  <div key={i} className="pub-card">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white text-xs font-black flex-shrink-0">{i + 1}</div>
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900 mb-2">{c.name}</h3>
                        <p className="text-slate-600 text-sm leading-relaxed mb-4">{c.description}</p>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Key Elements</p>
                          <ul className="space-y-1">
                            {c.keyElements.map((el, j) => (
                              <li key={j} className="flex items-center gap-2 text-sm text-slate-600">
                                <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" /> {el}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 9: Verigo Checklist */}
            <section id="verigo-checklist">
              <SectionHeader n={9} title="Verigo Configuration Checklist" />
              <p className="text-slate-600 leading-relaxed mb-8">{pack.verigoChecklist.intro}</p>
              <div className="space-y-8">
                {pack.verigoChecklist.phases.map((phase, pi) => (
                  <div key={pi}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-black">{pi + 1}</div>
                      <div>
                        <h3 className="font-bold text-slate-900">{phase.phase}</h3>
                        <span className="text-xs text-slate-500">{phase.timeframe}</span>
                      </div>
                    </div>
                    <div className="space-y-3 ml-11">
                      {phase.items.map((item, ii) => (
                        <div key={ii} className={`rounded-xl p-4 border ${item.critical ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'}`}>
                          <div className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 border-2 ${item.critical ? 'border-blue-500 bg-blue-50' : 'border-slate-300'}`} />
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-slate-900 text-sm">{item.task}</p>
                                {item.critical && <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600 ring-1 ring-red-200">Critical</span>}
                              </div>
                              <p className="text-slate-500 text-sm">{item.detail}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 10: Go-Live */}
            <section id="go-live">
              <SectionHeader n={10} title="Go-Live Readiness Assessment" />
              <p className="text-slate-600 leading-relaxed mb-8">{pack.goLive.intro}</p>
              <div className="space-y-6">
                {pack.goLive.criteria.map((cat, ci) => (
                  <div key={ci} className="pub-card">
                    <h3 className="font-bold text-slate-900 mb-4">{cat.category}</h3>
                    <div className="space-y-3">
                      {cat.checks.map((check, chi) => (
                        <div key={chi} className="flex items-start gap-4 p-3 bg-slate-50 rounded-xl">
                          <div className="w-6 h-6 rounded-lg bg-white border-2 border-green-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{check.item}</p>
                            <p className="text-slate-500 text-sm mt-0.5">{check.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* CTA */}
            <section className="bg-slate-900 rounded-3xl p-10 text-center">
              <h2 className="text-3xl font-black text-white mb-3">Configure Verigo for {ind.shortLabel}</h2>
              <p className="text-slate-400 mb-8">7-day free trial. Your {ind.packName} is activated on day one.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
                  Start Free Trial <ArrowRight className="w-5 h-5" />
                </Link>
                <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-8 py-4 text-base font-semibold text-white ring-1 ring-slate-700 hover:bg-slate-700 transition-colors">
                  Start Free Trial
                </Link>
              </div>
            </section>

          </main>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
        {String(n).padStart(2, '0')}
      </div>
      <h2 className="text-2xl font-black text-slate-900">{title}</h2>
    </div>
  )
}
