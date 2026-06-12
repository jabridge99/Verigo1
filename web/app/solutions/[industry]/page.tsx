import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle, ArrowRight, Shield, AlertTriangle, Users, Search,
  BarChart3, Folder, FileText, Building2, Zap, Eye, ClipboardList,
  TrendingUp, BookOpen, ScanFace, ShieldAlert, UserX, Newspaper, Activity, Network,
} from 'lucide-react'
import { industries, getIndustry } from '@/lib/industries'
import { capabilities as libCapabilities } from '@/lib/capabilities'

// ── Capability definitions ────────────────────────────────────────────────────

const capabilityIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'compliance-operations': Shield,
  'customer-onboarding': Users,
  'kyc-kyb': Search,
  'kyc-identity-verification': ScanFace,
  'kyb-business-verification': Building2,
  'sanctions-screening': ShieldAlert,
  'pep-screening': UserX,
  'adverse-media': Newspaper,
  'transaction-monitoring': Activity,
  'case-management': Folder,
  'regulatory-reporting': FileText,
  'reporting-groups': Network,
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
    tagline: "Know exactly who you're doing business with",
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
    tagline: "Automate the compliance work that shouldn't need a human",
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

export async function generateMetadata({ params }: { params: { industry: string } }) {
  const slug = params.industry
  const ind = getIndustry(slug)
  if (ind) {
    return {
      title: `AML Compliance Software for ${ind.label} | Verigo`,
      description: `${ind.label} AML/CTF compliance made easy. ${ind.description} AUSTRAC-ready, Australian data hosting.`,
    }
  }
  const libCap = libCapabilities.find(c => c.slug === slug)
  if (libCap) {
    return {
      title: `${libCap.title} | Verigo AML Platform`,
      description: libCap.tagline,
    }
  }
  const cap = capabilitiesData.find(c => c.slug === slug)
  if (cap) {
    return {
      title: `${cap.title} | Verigo AML Platform`,
      description: cap.tagline,
    }
  }
  return {}
}

export async function generateStaticParams() {
  const industrySlugs = industries.map(i => ({ industry: i.id }))
  const inlineCapSlugs = capabilitiesData.map(c => ({ industry: c.slug }))
  const libCapSlugs = libCapabilities.map(c => ({ industry: c.slug }))
  const allCaps = [...inlineCapSlugs, ...libCapSlugs]
  const dedupedCaps = allCaps.filter((v, i, a) => a.findIndex(x => x.industry === v.industry) === i)
  return [...industrySlugs, ...dedupedCaps]
}

export default function IndustryOrCapabilityPage({ params }: { params: { industry: string } }) {
  const slug = params.industry

  // Check inline capabilities first, then fall back to lib
  const inlineCap = capabilitiesData.find(c => c.slug === slug)
  if (inlineCap) {
    return <CapabilityPage capability={inlineCap} />
  }
  const libCap = libCapabilities.find(c => c.slug === slug)
  if (libCap) {
    const mapped: Capability = {
      slug: libCap.slug,
      title: libCap.title,
      tagline: libCap.tagline,
      color: 'from-blue-500 to-blue-600',
      problem: libCap.problem,
      solution: libCap.solution,
      benefits: libCap.benefits,
      outcome: libCap.outcome,
      useCases: libCap.useCases.map(u => u.description),
    }
    return <CapabilityPage capability={mapped} />
  }

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

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-8 mb-12 text-center">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-2">Outcome</p>
            <p className="text-2xl font-bold text-slate-900">{cap.outcome}</p>
          </div>

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
  const regimeBadge = ind.regime === 'current'
    ? { label: 'Active obligations now', cls: 'bg-green-50 text-green-700 ring-green-700/10' }
    : { label: 'Tranche 2 — obligations from 2026', cls: 'bg-amber-50 text-amber-700 ring-amber-700/10' }

  return (
    <div className="bg-white text-slate-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/solutions" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-8">
            ← All industries
          </Link>
          <div className="flex items-start gap-6">
            <div className={`w-16 h-16 bg-gradient-to-br ${ind.color} rounded-2xl flex items-center justify-center text-3xl flex-shrink-0`}>{ind.icon}</div>
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${regimeBadge.cls}`}>
                  {regimeBadge.label}
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-3">{ind.label}</h1>
              <p className="text-xl text-slate-500 max-w-2xl">{ind.description}</p>
              <p className="text-xs text-slate-400 mt-2">{ind.austracRef}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="pub-section pt-8">
        <div className="pub-container space-y-16">

          {/* 1. Overview */}
          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-4 flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-blue-600" /> Overview
            </h2>
            <p className="text-slate-600 leading-relaxed max-w-3xl">{ind.overview}</p>
          </div>

          {/* 2. Compliance Challenges */}
          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500" /> Compliance Challenges
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {ind.risks.map((r, i) => (
                <div key={i} className="flex items-start gap-3 pub-card py-4">
                  <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-2" />
                  <p className="text-slate-600 text-sm">{r}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Australian AML Obligations */}
          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
              <Shield className="w-6 h-6 text-blue-600" /> Australian AML/CTF Obligations
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {ind.obligations.map((o, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-700 text-sm">{o}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 4. CDD Requirements */}
          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-600" /> Customer Due Diligence (CDD) Requirements
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {ind.cddRequirements.map((c, i) => (
                <div key={i} className="pub-card flex items-start gap-3 py-4">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-bold text-xs">{i + 1}</span>
                  </div>
                  <p className="text-slate-600 text-sm">{c}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Monitoring Requirements */}
          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
              <Eye className="w-6 h-6 text-blue-600" /> Transaction Monitoring Requirements
            </h2>
            <div className="space-y-3">
              {ind.monitoringRequirements.map((m, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-xl px-5 py-4">
                  <TrendingUp className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-700 text-sm">{m}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 6. Reporting Requirements */}
          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-600" /> AUSTRAC Reporting Requirements
            </h2>
            <div className="pub-card bg-slate-50 ring-slate-200">
              <div className="flex flex-wrap gap-2 mb-4">
                {ind.reportingRequirements.types.map(t => (
                  <span key={t} className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">{t}</span>
                ))}
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">{ind.reportingRequirements.details}</p>
            </div>
          </div>

          {/* 7. How Verigo Helps */}
          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
              <ClipboardList className="w-6 h-6 text-blue-600" /> How VeriGo Helps {ind.shortLabel}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {ind.howVerigoHelps.map((h, i) => (
                <div key={i} className="flex items-start gap-3 pub-card py-4">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-700 text-sm">{h}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 8. Compliance Pack CTA */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="pub-card bg-blue-50 ring-blue-200">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 bg-gradient-to-br ${ind.color} rounded-xl flex items-center justify-center text-2xl`}>{ind.icon}</div>
                <div>
                  <h3 className="font-bold text-slate-900">{ind.packName}</h3>
                  <p className="text-xs text-slate-500">Recommended Compliance Pack</p>
                </div>
              </div>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                Pre-loaded compliance configuration for {ind.label} — KYC rules, risk thresholds, AUSTRAC report templates, and monitoring rules configured for your sector out of the box.
              </p>
              <div className="space-y-2">
                <Link href="/start-trial" className="pub-btn-primary w-full justify-center">
                  Start Free Trial <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/live-demo" className="pub-btn-secondary w-full justify-center">Book a Demo</Link>
              </div>
            </div>

            <div className="pub-card bg-slate-900 text-white">
              <h3 className="text-xl font-bold text-white mb-3">Start compliant in minutes</h3>
              <p className="text-slate-400 text-sm mb-5 leading-relaxed">
                The {ind.packName} is configured on day one of your trial. Your team gets a fully working AML/CTF programme from the moment you sign up — no consultants, no configuration sprints.
              </p>
              <ul className="space-y-2 mb-6">
                {[
                  'Pre-built KYC and CDD workflows',
                  'Industry-specific monitoring rules',
                  'AUSTRAC report templates ready to use',
                  '7-day free trial, no credit card',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

        </div>
      </section>
    </div>
  )
}
