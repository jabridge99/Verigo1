import Link from 'next/link'
import { ArrowRight, Shield, Users, Search, BarChart3, Folder, FileText, Building2, Zap } from 'lucide-react'
import { industries } from '@/lib/industries'

export const metadata = {
  title: 'Solutions | Verigo',
  description: 'Platform capabilities and industry compliance packs for every Australian regulated business.',
}

const capabilities = [
  {
    slug: 'compliance-operations',
    icon: Shield,
    title: 'Compliance Operations',
    desc: 'Your central compliance command centre. Manage obligations, workflows, and team tasks in one place.',
    problem: 'Managing compliance across multiple obligations is complex, manual, and error-prone.',
    solution: 'Verigo consolidates all compliance workflows into a single operating system with real-time visibility.',
  },
  {
    slug: 'customer-onboarding',
    icon: Users,
    title: 'Customer Onboarding',
    desc: 'Digital onboarding with built-in KYC. Collect information once, verify automatically.',
    problem: 'Manual onboarding is slow, inconsistent, and creates compliance gaps.',
    solution: 'Guided digital flows with embedded checks ensure every customer is onboarded correctly from the start.',
  },
  {
    slug: 'kyc-kyb',
    icon: Search,
    title: 'KYC & KYB',
    desc: 'Identity and business verification. Sanctions, PEP, and adverse media screening.',
    problem: 'Verifying identities manually across multiple databases is time-consuming and unreliable.',
    solution: 'One-click verification against global sanctions lists, PEP databases, and identity document checks.',
  },
  {
    slug: 'transaction-monitoring',
    icon: BarChart3,
    title: 'Transaction Monitoring',
    desc: 'Automated AML transaction surveillance. Rule-based and risk-scored monitoring 24/7.',
    problem: 'Suspicious activity hides in transaction volume that humans cannot manually review.',
    solution: 'Automated rule engine screens every transaction against configurable AML rules and generates alerts.',
  },
  {
    slug: 'case-management',
    icon: Folder,
    title: 'Case Management',
    desc: 'Alert-to-resolution case workflows. Full audit trail and escalation paths.',
    problem: 'Alerts without structured workflows lead to missed investigations and no audit trail.',
    solution: 'Automated case creation from alerts with assignment, four-eyes approval, and complete documentation.',
  },
  {
    slug: 'regulatory-reporting',
    icon: FileText,
    title: 'Regulatory Reporting',
    desc: 'AUSTRAC-ready report generation. TTR, IFTI, and SMR with pre-filled templates.',
    problem: 'Building AUSTRAC-compliant reports manually is slow, error-prone, and stressful.',
    solution: 'Pre-filled report templates with built-in validation ensure accurate, on-time AUSTRAC submissions.',
  },
  {
    slug: 'reporting-groups',
    icon: Building2,
    title: 'Reporting Groups',
    desc: 'Multi-entity group compliance. Consolidated oversight across related businesses.',
    problem: 'Large groups struggle to maintain consistent compliance standards across multiple entities.',
    solution: 'Group-level dashboard with consolidated reporting, shared customer records, and centralised oversight.',
  },
  {
    slug: 'workflow-automation',
    icon: Zap,
    title: 'Workflow Automation',
    desc: 'No-code compliance automation. Build triggers, rules, and escalations without development.',
    problem: 'Compliance teams are bottlenecked by manual processes that should be automated.',
    solution: 'No-code workflow builder lets compliance teams automate repetitive tasks and approvals instantly.',
  },
]

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
            {capabilities.map(({ slug, icon: Icon, title, desc }) => (
              <Link key={slug} href={`/solutions/${slug}`} className="pub-card-hover group flex flex-col gap-4">
                <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
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
