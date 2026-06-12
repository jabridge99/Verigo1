import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, ArrowRight, Shield, AlertTriangle, Users, Search, BarChart3, Folder, FileText, Building2, Zap } from 'lucide-react'
import { industries, getIndustry } from '@/lib/industries'

// ── Capability definitions ────────────────────────────────────────────────────

const capabilityIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'compliance-operations': Shield,
  'customer-onboarding': Users,
  'kyc-kyb': Search,
  'transaction-monitoring': BarChart3,
  'case-management': Folder,
  'regulatory-reporting': FileText,
  'reporting-groups': Building2,
  'workflow-automation': Zap,
}

type Capability = {
  slug: string
  title: string
  tagline: string
  color: string
  problem: string
  solution: string
  benefits: string[]
  outcome: string
  useCases: string[]
}

const capabilitiesData: Capability[] = [
  {
    slug: 'compliance-operations',
    title: 'Compliance Operations',
    tagline: 'Your central command for compliance',
    color: 'from-blue-500 to-blue-600',
    problem: 'Managing compliance across multiple obligations is complex, manual, and error-prone. Teams struggle with siloed tools, spreadsheets, and no single source of truth.',
    solution: 'Verigo consolidates all compliance workflows into a single operating system with real-time visibility, automated controls, and a complete audit trail across your entire programme.',
    benefits: [
      'Unified compliance dashboard',
      'Automated obligation tracking',
      'Real-time risk visibility',
      'Audit-ready records',
      'Configurable workflows',
      'Team task management',
    ],
    outcome: 'Reduce compliance overhead by up to 60% and eliminate manual tracking across siloed tools.',
    useCases: [
      'Financial institutions managing complex AML obligations',
      'Tranche 2 businesses establishing their first compliance programme',
      'Reporting groups needing centralised oversight across entities',
    ],
  },
  {
    slug: 'customer-onboarding',
    title: 'Customer Onboarding',
    tagline: 'Digital onboarding with compliance built in',
    color: 'from-green-500 to-emerald-600',
    problem: 'Manual customer onboarding is slow, inconsistent, and creates compliance gaps. Paper-based processes miss required fields and produce poor audit trails.',
    solution: 'Guided digital onboarding flows with embedded KYC checks, document collection, and risk scoring. Every customer journey is consistent, documented, and audit-ready.',
    benefits: [
      'Guided digital onboarding flows',
      'Automated document collection',
      'Embedded KYC checks',
      'Risk scoring at intake',
      'Customer portal access',
      'Onboarding audit trail',
    ],
    outcome: 'Cut onboarding time from days to minutes while meeting every AUSTRAC CDD requirement.',
    useCases: [
      'DCEs onboarding high volumes of retail crypto customers',
      'Remittance providers collecting sender/receiver information',
      'Law firms capturing client due diligence at matter inception',
    ],
  },
  {
    slug: 'kyc-kyb',
    title: 'KYC & KYB',
    tagline: 'Know exactly who you\'re doing business with',
    color: 'from-purple-500 to-violet-600',
    problem: 'Verifying identities manually across multiple databases is time-consuming, inconsistent, and exposes your business to missed sanctions hits and regulatory breaches.',
    solution: 'One-click verification against global sanctions lists, PEP databases, adverse media, and identity document checks. Business ownership structures mapped automatically.',
    benefits: [
      'Sanctions list screening (OFAC, UN, EU, DFAT, UK HMT)',
      'PEP identification and enhanced due diligence',
      'Identity document verification',
      'Beneficial ownership mapping',
      'Adverse media monitoring',
      'Ongoing periodic review',
    ],
    outcome: 'Catch 100% of sanctioned individuals and entities before they become your customer.',
    useCases: [
      'FX providers screening high-risk international customers',
      'Payment service providers verifying merchant identities',
      'Accountants conducting KYB on corporate clients under Tranche 2',
    ],
  },
  {
    slug: 'transaction-monitoring',
    title: 'Transaction Monitoring',
    tagline: 'Automated AML surveillance around the clock',
    color: 'from-cyan-500 to-blue-600',
    problem: 'Suspicious activity hides in the volume of transactions that human analysts cannot manually review. Missed alerts mean missed obligations.',
    solution: 'Automated rule engine screens every transaction against configurable AML rules. Structuring, velocity patterns, high-risk jurisdictions, and unusual behaviour flagged instantly.',
    benefits: [
      'Pre-built AML monitoring rules',
      'Configurable risk thresholds',
      'Real-time alert generation',
      'Structuring detection',
      'Velocity monitoring',
      'High-risk country flags',
    ],
    outcome: 'Monitor 100% of transaction volume with zero manual intervention. Alert on what matters.',
    useCases: [
      'Remittance providers monitoring high-volume international transfers',
      'DCEs detecting structuring and smurfing patterns',
      'PSPs identifying unusual merchant activity',
    ],
  },
  {
    slug: 'case-management',
    title: 'Case Management',
    tagline: 'From alert to resolution without missing a step',
    color: 'from-amber-500 to-orange-500',
    problem: 'Alerts without structured workflows lead to missed investigations, unresolved cases, and no audit trail to show regulators.',
    solution: 'Automated case creation from monitoring alerts. Assign to analysts, track resolution stages, enforce four-eyes approval, and document every decision.',
    benefits: [
      'Automatic case creation from alerts',
      'Analyst assignment and escalation',
      'Four-eyes approval workflows',
      'Full case audit trail',
      'MLRO review queue',
      'SMR preparation from cases',
    ],
    outcome: 'Zero cases fall through the cracks. Every alert investigated, documented, and resolved.',
    useCases: [
      'MLRO teams managing suspicious matter investigations',
      'Compliance teams handling high-volume alert queues',
      'Businesses preparing SMRs from investigated cases',
    ],
  },
  {
    slug: 'regulatory-reporting',
    title: 'Regulatory Reporting',
    tagline: 'AUSTRAC-ready reports without the manual work',
    color: 'from-rose-500 to-pink-600',
    problem: 'Building AUSTRAC-compliant reports manually is slow, error-prone, stressful, and risks late submissions that attract regulatory attention.',
    solution: 'Pre-filled report templates for TTR, IFTI IN, IFTI OUT, and SMR with built-in validation. Submit with confidence knowing every field meets AUSTRAC requirements.',
    benefits: [
      'TTR report templates',
      'IFTI IN & OUT templates',
      'SMR report generation',
      'Built-in AUSTRAC validation',
      'Bulk transaction import',
      'Submission audit trail',
    ],
    outcome: 'Submit accurate AUSTRAC reports on time, every time. No missed deadlines, no manual errors.',
    useCases: [
      'DCEs with daily TTR obligations',
      'Remittance providers managing high-volume IFTI submissions',
      'Compliance officers preparing SMRs under time pressure',
    ],
  },
  {
    slug: 'reporting-groups',
    title: 'Reporting Groups',
    tagline: 'Group-level compliance without the complexity',
    color: 'from-teal-500 to-cyan-600',
    problem: 'Large groups struggle to maintain consistent compliance standards across multiple entities, with duplicated effort and fragmented visibility.',
    solution: 'Group-level dashboard with consolidated reporting, shared customer records, centralised oversight, and individual entity compliance status at a glance.',
    benefits: [
      'Group-level compliance dashboard',
      'Shared customer master records',
      'Consolidated AUSTRAC reporting',
      'Per-entity compliance status',
      'Centralised policy management',
      'Group-wide audit trails',
    ],
    outcome: 'One view of compliance across every entity in your group. Spot gaps before regulators do.',
    useCases: [
      'Financial services groups with multiple AUSTRAC registrations',
      'Multi-brand DCE operations',
      'Law firm networks with shared AML obligations',
    ],
  },
  {
    slug: 'workflow-automation',
    title: 'Workflow Automation',
    tagline: 'Automate the compliance work that shouldn\'t need a human',
    color: 'from-indigo-500 to-blue-700',
    problem: 'Compliance teams are bottlenecked by repetitive manual tasks — assigning reviews, sending reminders, escalating alerts — that pull focus from high-value work.',
    solution: 'No-code workflow builder lets compliance teams automate triggers, approvals, escalations, and notifications without writing a single line of code.',
    benefits: [
      'No-code workflow builder',
      'Event-triggered automations',
      'Automated review reminders',
      'Escalation rule automation',
      'Scheduled report generation',
      'Integration webhooks',
    ],
    outcome: 'Free your compliance team from manual coordination. Focus on judgement, not administration.',
    useCases: [
      'Automating periodic KYC renewal reminders',
      'Triggering enhanced due diligence on risk threshold breach',
      'Scheduling and distributing weekly compliance reports',
    ],
  },
]

export async function generateStaticParams() {
  const industrySlugs = industries.map(i => ({ industry: i.id }))
  const capabilitySlugs = capabilitiesData.map(c => ({ industry: c.slug }))
  return [...industrySlugs, ...capabilitySlugs]
}

export default function IndustryOrCapabilityPage({ params }: { params: { industry: string } }) {
  const slug = params.industry

  // Check if it's a capability
  const capability = capabilitiesData.find(c => c.slug === slug)
  if (capability) {
    return <CapabilityPage capability={capability} />
  }

  // Check if it's an industry
  const ind = getIndustry(slug)
  if (ind) {
    return <IndustryPage ind={ind} />
  }

  notFound()
}

// ── Capability Page ───────────────────────────────────────────────────────────

function CapabilityPage({ capability: cap }: { capability: Capability }) {
  const Icon = capabilityIconMap[cap.slug] ?? Shield
  return (
    <div className="bg-white text-slate-900">
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/solutions" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-8">
            ← All solutions
          </Link>
          <div className="flex items-start gap-6">
            <div className={`w-16 h-16 bg-gradient-to-br ${cap.color} rounded-2xl flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-8 h-8 text-white" />
            </div>
            <div>
              <span className="pub-label mb-3 block w-fit">Platform Capability</span>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-3">{cap.title}</h1>
              <p className="text-xl text-slate-500">{cap.tagline}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="pub-section">
        <div className="pub-container">
          <div className="grid lg:grid-cols-3 gap-6 mb-12">
            <div className="pub-card border-l-4 border-red-200">
              <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" /> The Problem
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed">{cap.problem}</p>
            </div>
            <div className="pub-card border-l-4 border-blue-200">
              <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" /> Our Solution
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed">{cap.solution}</p>
            </div>
            <div className="pub-card border-l-4 border-green-200">
              <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" /> Key Benefits
              </h2>
              <ul className="space-y-2">
                {cap.benefits.map(b => (
                  <li key={b} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Outcome */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-8 mb-12 text-center">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-2">Outcome</p>
            <p className="text-2xl font-bold text-slate-900">{cap.outcome}</p>
          </div>

          {/* Use Cases */}
          <div className="mb-12">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Who uses {cap.title}?</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {cap.useCases.map((uc, i) => (
                <div key={i} className="pub-card flex gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{i + 1}</div>
                  <p className="text-slate-600 text-sm">{uc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="bg-slate-900 rounded-2xl p-10 text-center">
            <h2 className="text-3xl font-black text-white mb-3">Try {cap.title} free for 7 days</h2>
            <p className="text-slate-400 mb-8">No credit card required. Full access to all features.</p>
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

// ── Industry Page ─────────────────────────────────────────────────────────────

function IndustryPage({ ind }: { ind: ReturnType<typeof getIndustry> & {} }) {
  return (
    <div className="bg-white text-slate-900">
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/solutions" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-8">
            ← All industries
          </Link>
          <div className="flex items-start gap-6">
            <div className={`w-16 h-16 bg-gradient-to-br ${ind.color} rounded-2xl flex items-center justify-center text-3xl flex-shrink-0`}>{ind.icon}</div>
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${ind.regime === 'current' ? 'bg-green-50 text-green-700 ring-green-700/10' : 'bg-amber-50 text-amber-700 ring-amber-700/10'}`}>
                  {ind.regime === 'current' ? '✓ Active obligations now' : '⏰ Tranche 2 — 2026'}
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-3">{ind.label}</h1>
              <p className="text-xl text-slate-500">{ind.description}</p>
              <p className="text-sm text-slate-400 mt-2">{ind.austracRef}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="pub-section">
        <div className="pub-container">
          <div className="grid lg:grid-cols-3 gap-6 mb-12">
            <div className="pub-card">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-blue-600" />
                <h2 className="font-bold text-slate-900">Compliance Obligations</h2>
              </div>
              <ul className="space-y-2">
                {ind.obligations.map(o => (
                  <li key={o} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />{o}
                  </li>
                ))}
              </ul>
            </div>

            <div className="pub-card">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-slate-900">Key Risk Areas</h2>
              </div>
              <ul className="space-y-2">
                {ind.keyRisks.map(r => (
                  <li key={r} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-2" />{r}
                  </li>
                ))}
              </ul>
            </div>

            <div className="pub-card bg-blue-50 ring-blue-200">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-blue-600" />
                <h2 className="font-bold text-slate-900">{ind.packName}</h2>
              </div>
              <p className="text-slate-600 text-sm mb-6">
                Pre-loaded compliance configuration for {ind.shortLabel} — KYC rules, monitoring thresholds, AUSTRAC report templates, and risk scoring.
              </p>
              <Link href="/start-trial" className="pub-btn-primary w-full justify-center mb-3">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/live-demo" className="pub-btn-secondary w-full justify-center">Book a Demo</Link>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="bg-slate-900 rounded-2xl p-10 text-center">
            <h2 className="text-3xl font-black text-white mb-3">Start compliant in minutes</h2>
            <p className="text-slate-400 mb-8">The {ind.packName} is ready to go. 7-day free trial, no credit card.</p>
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
