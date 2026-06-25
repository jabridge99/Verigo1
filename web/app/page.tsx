import React from 'react'
import Link from 'next/link'
import {
  Shield, CheckCircle, AlertTriangle, FileText, Users, Lock,
  ArrowRight, Building2, Activity, Database,
  UserCheck, ShieldAlert, Zap, BookOpen, ScanFace, FolderOpen,
  Package, Network, ClipboardList,
  Coins, Globe, ArrowLeftRight, CreditCard, Home, FileCheck, Scale, Calculator, Gem, Landmark,
} from 'lucide-react'
import { industries } from '@/lib/industries'
import { fetchPlanPrices, formatAud, type PlanPrice } from '@/lib/pricing'

export const metadata = {
  title: 'Verigo — Compliance Made Practical. Built for Australian Business.',
  description: 'VeriGo is an AUSTRAC-ready compliance platform that automates customer onboarding, KYC/KYB, sanctions screening, transaction monitoring, and regulatory reporting for Australian regulated businesses.',
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — HERO
// ─────────────────────────────────────────────────────────────────────────────
function Hero() {
  const flow = [
    { label: 'Industry', icon: Building2 },
    { label: 'Customer', icon: UserCheck },
    { label: 'Verification', icon: ScanFace },
    { label: 'Monitoring', icon: Activity },
    { label: 'Reporting', icon: FileText },
  ]

  return (
    <section className="relative bg-gradient-to-b from-slate-950 via-blue-950 to-slate-900 overflow-hidden pt-32 pb-24 px-4 sm:px-6 lg:px-8">
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.02%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-40" />

      <div className="relative max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 ring-1 ring-blue-500/20 mb-8">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          AUSTRAC-Ready · Australian Hosted · Tranche 2 Ready
        </div>

        <h1 className="text-5xl md:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6">
          Compliance Made Practical
        </h1>

        <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          Built for Australian businesses navigating AML obligations, customer onboarding, transaction monitoring and regulatory reporting.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-900 hover:bg-slate-100 transition-colors shadow-lg">
            Start Free Trial <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-8 py-4 text-base font-semibold text-white ring-1 ring-white/15 hover:bg-white/10 transition-colors">
            Start Free Trial
          </Link>
        </div>

        {/* Workflow illustration */}
        <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
          {flow.map(({ label, icon: Icon }, i) => (
            <div key={label} className="flex items-center gap-1 sm:gap-2">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/10 ring-1 ring-white/20 flex items-center justify-center backdrop-blur-sm">
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-300" />
                </div>
                <span className="text-xs text-slate-400 font-medium">{label}</span>
              </div>
              {i < flow.length - 1 && (
                <ArrowRight className="w-4 h-4 text-slate-600 mb-5 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — WHY COMPLIANCE MATTERS
// ─────────────────────────────────────────────────────────────────────────────
function WhyComplianceMatters() {
  const cards = [
    {
      icon: Shield,
      color: 'bg-blue-50 text-blue-600',
      title: 'Fraud Prevention',
      desc: 'Know who your customers are before you do business with them. Strong AML controls stop fraudsters and protect your revenue.',
    },
    {
      icon: Users,
      color: 'bg-green-50 text-green-600',
      title: 'Customer Trust',
      desc: 'Customers trust businesses that take identity seriously. A compliant onboarding process is a signal of quality and safety.',
    },
    {
      icon: AlertTriangle,
      color: 'bg-amber-50 text-amber-600',
      title: 'Business Protection',
      desc: 'Non-compliance carries fines up to $22M. Proactive compliance protects your licence, your reputation, and your business.',
    },
    {
      icon: CheckCircle,
      color: 'bg-purple-50 text-purple-600',
      title: 'Regulatory Readiness',
      desc: "AUSTRAC inspections happen. Businesses with mature AML programs respond with confidence — those without scramble to catch up.",
    },
  ]

  return (
    <section className="pub-section bg-white">
      <div className="pub-container">
        <div className="text-center mb-12">
          <span className="pub-label mb-4 block w-fit mx-auto">Why It Matters</span>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-3">
            Why compliance matters to your business
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            Compliance isn&apos;t just a legal requirement — it&apos;s a business asset.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {cards.map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="pub-card flex flex-col gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — AML REFORM TIMELINE
// ─────────────────────────────────────────────────────────────────────────────
function AMLReformTimeline() {
  const timeline = [
    {
      period: 'Today',
      status: 'active',
      title: 'Current obligations',
      who: 'Banks, crypto exchanges, remittance providers, foreign exchange dealers, payment services',
      what: 'Must have a written AML/CTF Program, conduct customer due diligence, file SMR, IFTI and TTR reports with AUSTRAC.',
    },
    {
      period: '2026',
      status: 'upcoming',
      title: 'Tranche 2 reforms begin',
      who: 'Law firms, accounting firms, conveyancers, real estate professionals, precious metal dealers',
      what: 'Newly regulated from 1 July 2026. Must enrol with AUSTRAC, build an AML/CTF Program, and begin customer due diligence.',
    },
    {
      period: 'Future',
      status: 'future',
      title: 'Further expansion',
      who: 'Additional professional services sectors under review',
      what: "Australia's AML/CTF regime will continue to expand in line with FATF standards. Get ahead of obligations now.",
    },
  ]

  return (
    <section className="pub-section bg-slate-900" id="aml-reform">
      <div className="pub-container">
        <div className="text-center mb-14">
          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 ring-1 ring-blue-500/20 mb-4 block w-fit mx-auto">
            🇦🇺 Australian AML Reform
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
            {"Australia's AML Reforms Are Expanding"}
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            The biggest change to Australian compliance law in 18 years. Is your business ready?
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-5 mb-10">
          {timeline.map(item => (
            <div
              key={item.period}
              className={`rounded-2xl p-7 flex flex-col gap-4 ${
                item.status === 'upcoming'
                  ? 'bg-blue-600 ring-1 ring-blue-500'
                  : item.status === 'active'
                  ? 'bg-slate-800 ring-1 ring-green-500/30'
                  : 'bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  item.status === 'upcoming' ? 'bg-white/20 text-white' :
                  item.status === 'active' ? 'bg-green-500/20 text-green-400' :
                  'bg-slate-700 text-slate-400'
                }`}>{item.period}</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">{item.title}</h3>
                <p className={`text-xs font-semibold mb-3 ${item.status === 'upcoming' ? 'text-blue-200' : 'text-slate-500'}`}>
                  Who: {item.who}
                </p>
                <p className={`text-sm leading-relaxed ${item.status === 'upcoming' ? 'text-blue-100' : 'text-slate-400'}`}>
                  {item.what}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link href="/learn/austrac-reform-guide" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/20 transition-colors">
            Read the AML Reform Guide <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — WHO WE HELP
// ─────────────────────────────────────────────────────────────────────────────
function WhoWeHelp() {
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

  const allIndustries = industries.filter(i =>
    [
      'vasp', 'remittance', 'bullion_dealers',
      'real_estate', 'conveyancers', 'legal_professionals', 'accountants',
      'precious_metals', 'pubs_clubs', 'reporting_group',
    ].includes(i.id)
  )

  return (
    <section className="pub-section bg-white" id="industries">
      <div className="pub-container">
        <div className="text-center mb-12">
          <span className="pub-label mb-4 block w-fit mx-auto">Who We Help</span>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-3">
            Built for your industry
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            Select your industry — VeriGo loads the right compliance pack, risk matrix, and AUSTRAC report templates automatically.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {allIndustries.map(ind => (
            <Link
              key={ind.id}
              href={`/solutions/${ind.slug}`}
              className="pub-card-hover group flex flex-col gap-4"
            >
              <div className={`w-12 h-12 bg-gradient-to-br ${ind.color} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                {(() => { const Icon = industryIconMap[ind.id] ?? Shield; return <Icon className="w-6 h-6 text-white" /> })()}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 mb-1 text-sm">{ind.label}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{ind.packName}</p>
              </div>
              <span className="text-blue-600 text-xs font-semibold flex items-center gap-1 group-hover:gap-2 transition-all mt-auto">
                Learn More <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — HOW VERIGO WORKS
// ─────────────────────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { n: 1, title: 'Choose Industry', desc: 'Pick your regulated sector. Your compliance pack loads instantly.' },
    { n: 2, title: 'Onboard Customers', desc: 'Guided digital onboarding with built-in compliance checks.' },
    { n: 3, title: 'Verify Risk', desc: 'Screen customers against sanctions, PEP, and adverse media lists.' },
    { n: 4, title: 'Monitor Activity', desc: 'Automated transaction surveillance flags suspicious patterns 24/7.' },
    { n: 5, title: 'Generate Reports', desc: 'SMR, IFTI, and TTR reports pre-populated and AUSTRAC-ready.' },
    { n: 6, title: 'Stay Compliant', desc: 'Audit trails, registers, and annual review workflows built in.' },
  ]

  return (
    <section className="pub-section bg-gradient-to-br from-blue-600 to-blue-700">
      <div className="pub-container">
        <div className="text-center mb-12">
          <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white mb-4 block w-fit mx-auto">
            How It Works
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
            Six steps to full compliance
          </h2>
          <p className="text-blue-100 max-w-xl mx-auto">
            From first customer to first AUSTRAC report — in minutes, not months.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {steps.map(step => (
            <div key={step.n} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 ring-1 ring-white/15 flex gap-4">
              <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-blue-600 font-black text-sm flex-shrink-0">
                {step.n}
              </div>
              <div>
                <h3 className="font-bold text-white mb-1 text-sm">{step.title}</h3>
                <p className="text-blue-100 text-xs leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — PLATFORM OVERVIEW (4 grouped categories)
// ─────────────────────────────────────────────────────────────────────────────
function PlatformOverview() {
  const groups = [
    {
      label: 'Foundation',
      color: 'bg-blue-600',
      icon: BookOpen,
      title: 'AML Program, CDD & EDD',
      desc: 'Build your ML/TF Risk Assessment and unified AML/CTF Program — risk-based, 2026-aligned, and always current.',
      features: ['AML Program', 'Customer Due Diligence', 'Enhanced Due Diligence'],
      slug: 'aml-program',
    },
    {
      label: 'Verification',
      color: 'bg-indigo-600',
      icon: ScanFace,
      title: 'KYC, KYB & Screening',
      desc: 'Verify the identity of every customer — individual or business. Automated sanctions, PEP, and adverse media screening runs in real time.',
      features: ['KYC / Identity', 'KYB / Business', 'Sanctions & PEP Screening'],
      slug: 'kyc-identity-verification',
    },
    {
      label: 'Operations',
      color: 'bg-violet-600',
      icon: Activity,
      title: 'Monitoring, Cases & Automation',
      desc: 'Detect suspicious activity automatically. Every alert becomes an investigation case with a full audit trail and no-code automation to reduce manual work.',
      features: ['Transaction Monitoring', 'Case Management', 'Workflow Automation'],
      slug: 'transaction-monitoring',
    },
    {
      label: 'Reporting',
      color: 'bg-emerald-600',
      icon: FileText,
      title: 'IFTI, SMR & TTR',
      desc: 'Pre-populated AUSTRAC regulatory reports generated directly from your transaction data. Built-in validation before submission.',
      features: ['IFTI Reports', 'Suspicious Matter Reports', 'Threshold Transaction Reports'],
      slug: 'regulatory-reporting',
    },
  ]

  return (
    <section className="pub-section bg-slate-50">
      <div className="pub-container">
        <div className="text-center mb-12">
          <span className="pub-label mb-4 block w-fit mx-auto">Platform</span>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-3">
            Everything in one platform
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            Four capability groups. Fully integrated. No switching between tools.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {groups.map(({ label, color, icon: Icon, title, desc, features, slug }) => (
            <Link
              key={slug}
              href={`/solutions/${slug}`}
              className="pub-card-hover group flex flex-col gap-5"
            >
              <div className="flex items-start gap-4">
                <div className={`w-11 h-11 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
                  <h3 className="font-bold text-slate-900 mt-0.5">{title}</h3>
                </div>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              <div className="flex flex-wrap gap-2 mt-auto">
                {features.map(f => (
                  <span key={f} className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {f}
                  </span>
                ))}
              </div>
              <span className="text-blue-600 text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                Explore <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link href="/solutions" className="pub-btn-secondary">View all capabilities</Link>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — WHY VERIGO
// ─────────────────────────────────────────────────────────────────────────────
function WhyVerigo() {
  const points = [
    { icon: Shield, color: 'bg-blue-50 text-blue-600', title: 'Australian AML Law', desc: 'Built for the AML/CTF Act 2006 and the 2024 Tranche 2 reforms — not adapted from a global product.' },
    { icon: Package, color: 'bg-indigo-50 text-indigo-600', title: 'Industry Compliance Packs', desc: 'Each regulated industry gets a pre-configured pack: risk matrix, templates, and reporting workflows ready on day one.' },
    { icon: Network, color: 'bg-purple-50 text-purple-600', title: 'Reporting Groups', desc: 'Multi-entity Reporting Group structures with consolidated AML Programs and shared CDD capabilities.' },
    { icon: ClipboardList, color: 'bg-amber-50 text-amber-600', title: 'AUSTRAC Workflows', desc: 'SMR, IFTI, and TTR reports built directly from your platform data. Submit with confidence.' },
    { icon: Zap, color: 'bg-green-50 text-green-600', title: 'Fast to Deploy', desc: 'Go live in a day — not months. Pre-built workflows mean no lengthy implementation projects.' },
    { icon: Users, color: 'bg-slate-100 text-slate-600', title: 'Australian Business Focus', desc: 'Designed for Australian SMEs, law firms, and financial services — not enterprise banks in New York.' },
  ]

  return (
    <section className="pub-section bg-white">
      <div className="pub-container">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <span className="pub-label mb-6 block w-fit">Why VeriGo</span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-4">
              Built for Australia.<br />
              <span className="text-blue-600">Not adapted for it.</span>
            </h2>
            <p className="text-slate-500 leading-relaxed mb-6">
              Most compliance platforms are built for global banks and adapted for the Australian market as an afterthought. VeriGo is built from day one for the AML/CTF Act, AUSTRAC obligations, and the businesses that must comply with them.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/start-trial" className="pub-btn-primary">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/start-trial" className="pub-btn-secondary">Start Free Trial</Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {points.map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="pub-card flex flex-col gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">{title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — TRUST & SECURITY
// ─────────────────────────────────────────────────────────────────────────────
function TrustSecurity() {
  const features = [
    { icon: Lock, title: 'MFA', desc: 'Multi-factor authentication enforced for every user account.' },
    { icon: Shield, title: 'AES-256 Encryption', desc: 'All data encrypted at rest and in transit. Always.' },
    { icon: Activity, title: 'Audit Trails', desc: 'Immutable, timestamped records of every action on the platform.' },
    { icon: Users, title: 'Role-Based Access', desc: 'Granular permissions from viewer to MLRO. Least-privilege by default.' },
    { icon: Database, title: 'Secure Document Storage', desc: 'Customer documents stored encrypted in Australian data centres.' },
    { icon: ShieldAlert, title: 'Customer-Owned Storage', desc: 'Bring your own storage option — data stays in your infrastructure.' },
  ]

  return (
    <section className="pub-section bg-slate-900">
      <div className="pub-container">
        <div className="text-center mb-12">
          <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white mb-4 block w-fit mx-auto">
            Security & Trust
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">
            Enterprise security. Built in by default.
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Compliance data is sensitive. VeriGo is architected with security at the core — not added later.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-4 rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
              <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-blue-300" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1 text-sm">{title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl bg-white/5 ring-1 ring-white/10 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-white font-bold">Australian Data Residency</p>
            <p className="text-slate-400 text-sm">All data hosted in AWS Sydney. No cross-border transfer. Guaranteed by contract.</p>
          </div>
          <Link href="/trust-centre" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/20 transition-colors flex-shrink-0">
            Trust Centre <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 — PRICING PREVIEW
// ─────────────────────────────────────────────────────────────────────────────
function PricingPreview({ prices }: { prices: Record<string, PlanPrice> }) {
  const plans = [
    {
      name: 'Essential',
      price: formatAud(prices.starter.monthly_aud),
      period: prices.starter.monthly_aud != null ? '/month' : '',
      badge: null,
      desc: 'For small reporting entities building their first AML/CTF programme.',
      features: ['Unlimited customers', 'KYC & KYB verification', 'AML/CTF Program template', 'IFTI, SMR & TTR reporting', 'Basic transaction monitoring', 'Essential integrations'],
      cta: 'Start Free Trial',
      href: '/start-trial',
      highlight: false,
    },
    {
      name: 'Professional',
      price: formatAud(prices.professional.monthly_aud),
      period: prices.professional.monthly_aud != null ? '/month' : '',
      badge: 'Most Popular',
      desc: 'For growing compliance teams with full AUSTRAC reporting obligations.',
      features: ['Everything in Essential', 'Sanctions, PEP & adverse media', 'Advanced transaction monitoring', 'EDD workflows', 'Case management', 'Workflow automation', 'AML data connectors'],
      cta: 'Start Free Trial',
      href: '/start-trial',
      highlight: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      badge: null,
      desc: 'For reporting groups, financial institutions, and SaaS resellers.',
      features: ['Everything in Professional', 'All compliance packs', 'Reporting groups (multi-entity)', 'White label branding', 'Dedicated compliance support', 'SLA guarantee'],
      cta: 'Contact Sales',
      href: '/contact',
      highlight: false,
    },
  ]

  return (
    <section className="pub-section bg-slate-50">
      <div className="pub-container">
        <div className="text-center mb-12">
          <span className="pub-label mb-4 block w-fit mx-auto">Pricing</span>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-3">
            Simple, transparent pricing
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            7-day free trial. No credit card required. Cancel any time.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {plans.map(plan => (
            <div
              key={plan.name}
              className={`rounded-2xl p-7 flex flex-col gap-5 ${
                plan.highlight
                  ? 'bg-blue-600 ring-2 ring-blue-500'
                  : 'bg-white ring-1 ring-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className={`text-xs font-bold uppercase tracking-wider ${plan.highlight ? 'text-blue-200' : 'text-slate-400'}`}>
                    {plan.name}
                  </p>
                  {plan.badge && (
                    <span className="text-xs font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full">{plan.badge}</span>
                  )}
                </div>
                <p className={`text-2xl font-black ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>
                  {plan.price}<span className={`text-base font-medium ${plan.highlight ? 'text-blue-200' : 'text-slate-400'}`}>{plan.period}</span>
                </p>
                <p className={`text-sm mt-1 ${plan.highlight ? 'text-blue-100' : 'text-slate-500'}`}>
                  {plan.desc}
                </p>
              </div>
              <ul className="space-y-2 flex-1">
                {plan.features.map(f => (
                  <li key={f} className={`flex items-start gap-2 text-sm ${plan.highlight ? 'text-blue-100' : 'text-slate-600'}`}>
                    <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-white' : 'text-green-500'}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? 'bg-white text-blue-600 hover:bg-blue-50'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {plan.cta} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link href="/pricing" className="pub-btn-secondary">View full pricing details</Link>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10 — FINAL CTA
// ─────────────────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="pub-section bg-slate-900">
      <div className="pub-container text-center">
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
          Ready to Simplify Compliance?
        </h2>
        <p className="text-slate-400 text-lg max-w-lg mx-auto mb-10">
          7-day free trial. No credit card. Full platform access from day one.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
          <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-900 hover:bg-slate-100 transition-colors shadow-lg">
            Start Free Trial <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-8 py-4 text-base font-semibold text-white ring-1 ring-white/15 hover:bg-white/10 transition-colors">
            Start Free Trial
          </Link>
        </div>
        <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
          {['AUSTRAC aligned', 'Australian data hosting', 'AES-256 encryption', 'No lock-in contracts'].map(t => (
            <span key={t} className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" /> {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default async function HomePage() {
  const prices = await fetchPlanPrices()
  return (
    <div className="bg-white text-slate-900">
      <Hero />
      <WhyComplianceMatters />
      <AMLReformTimeline />
      <WhoWeHelp />
      <HowItWorks />
      <PlatformOverview />
      <WhyVerigo />
      <TrustSecurity />
      <PricingPreview prices={prices} />
      <FinalCTA />
    </div>
  )
}
