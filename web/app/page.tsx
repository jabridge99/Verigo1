import Link from 'next/link'
import {
  Shield, CheckCircle, AlertTriangle, FileText, Users, Lock,
  Zap, BarChart3, ArrowRight, Building2, Search, Activity,
  Database, Folder, UserCheck, ShieldAlert, Newspaper, Network,
  UserX, ScanFace, FolderOpen, BookOpen, ClipboardList, RefreshCw, GraduationCap,
} from 'lucide-react'
import { industries } from '@/lib/industries'

export const metadata = {
  title: 'Verigo — Compliance Made Practical. Built for Australian Business.',
  description: 'VeriGo is an AUSTRAC-ready compliance platform that automates customer onboarding, KYC/KYB, sanctions screening, transaction monitoring, and regulatory reporting for Australian regulated businesses.',
}

function Hero() {
  return (
    <section className="bg-gradient-to-b from-slate-900 via-blue-950 to-slate-900 pt-32 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-900/50 px-4 py-2 text-sm font-semibold text-blue-300 ring-1 ring-blue-700/30 mb-8">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          AUSTRAC-Ready Compliance Platform
        </div>

        <h1 className="text-5xl md:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6">
          Compliance Made Practical.<br />
          <span className="text-blue-400">Built for Australian Business.</span>
        </h1>

        <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed">
          VeriGo is an AUSTRAC-ready compliance platform that automates customer onboarding, KYC/KYB, sanctions screening, transaction monitoring, and regulatory reporting — so your team can focus on running your business.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-900 hover:bg-slate-100 transition-colors shadow-sm">
            Start Free Trial <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="/live-demo" className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-8 py-4 text-base font-semibold text-white ring-1 ring-slate-700 hover:bg-slate-700 transition-colors">
            Book a Demo
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-4 text-sm">
          {[
            'AUSTRAC Aligned',
            'Australian Data Hosting',
            'AES-256 Encryption',
            '99.9% Uptime SLA',
            'SOC 2 Roadmap',
          ].map(t => (
            <span key={t} className="flex items-center gap-2 bg-white/5 rounded-full px-4 py-1.5 text-slate-300 ring-1 ring-white/10">
              <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /> {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function SocialProof() {
  const types = [
    'Digital Currency Exchanges',
    'Remittance Providers',
    'Law Firms',
    'Accounting Firms',
    'Real Estate Professionals',
    'Payment Service Providers',
  ]
  return (
    <section className="bg-slate-50 py-10 px-4 border-y border-slate-200">
      <div className="max-w-7xl mx-auto text-center">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">Trusted by compliance teams across Australia</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {types.map(t => (
            <span key={t} className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 shadow-sm">
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function WhyComplianceMatters() {
  return (
    <section className="pub-section bg-white">
      <div className="pub-container">
        <div className="text-center mb-16">
          <span className="pub-label mb-4 block w-fit mx-auto">Why It Matters</span>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight mb-4">
            Non-compliance is not an option.
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Under the Anti-Money Laundering and Counter-Terrorism Financing Act 2006, Australian reporting entities face serious consequences for non-compliance. The AML/CTF Amendment Act 2024 is extending these obligations further than ever before.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {[
            { stat: '$18.5M', label: 'Largest AUSTRAC penalty issued to a single entity' },
            { stat: '3,000+', label: 'Suspicious matter reports lodged daily in Australia' },
            { stat: '68%', label: 'Of financial crime involves inadequate KYC processes' },
            { stat: '2026', label: 'Tranche 2 reforms bringing lawyers, accountants, and real estate under AML/CTF' },
          ].map(s => (
            <div key={s.stat} className="pub-card text-center">
              <div className="text-4xl font-black text-blue-600 mb-2">{s.stat}</div>
              <div className="text-slate-500 text-sm leading-relaxed">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <p className="text-slate-600 leading-relaxed mb-4">
              Australia&apos;s AML/CTF regime is one of the most comprehensive in the world. The AML/CTF Act 2006 imposes obligations on thousands of reporting entities across the financial services, digital currency, and remittance sectors. AUSTRAC actively supervises and enforces these obligations, with a track record of significant penalties for serious non-compliance.
            </p>
            <p className="text-slate-600 leading-relaxed mb-4">
              From 2026, the AML/CTF Amendment Act 2024 brings lawyers, accountants, real estate professionals, conveyancers, and precious metal dealers within the regime for the first time — representing the biggest expansion of Australia&apos;s AML/CTF framework in 18 years.
            </p>
            <p className="text-slate-600 leading-relaxed">
              Failure to comply carries consequences beyond financial penalties — including criminal prosecution for individuals, reputational damage, and in extreme cases the loss of a business licence or AUSTRAC deregistration.
            </p>
          </div>
          <div className="space-y-4">
            {[
              { icon: AlertTriangle, title: 'Regulatory Penalties', desc: 'Civil penalties of up to $22.2 million per breach for body corporates. Individual criminal liability for compliance failures attributable to officers.', color: 'text-red-500 bg-red-50' },
              { icon: Shield, title: 'Reputational Damage', desc: 'AUSTRAC publishes enforcement actions. A public compliance failure can permanently damage customer trust, banking relationships, and business viability.', color: 'text-amber-500 bg-amber-50' },
              { icon: Lock, title: 'Licence Revocation', desc: 'AUSTRAC can cancel the registration of digital currency exchanges, remittance providers, and other regulated entities for serious or persistent non-compliance.', color: 'text-slate-500 bg-slate-50' },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="pub-card flex gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function AMLReformTimeline() {
  return (
    <section className="pub-section bg-slate-900" id="aml-reform">
      <div className="pub-container">
        <div className="text-center mb-16">
          <span className="inline-flex items-center rounded-full bg-blue-900/50 px-3 py-1.5 text-xs font-semibold text-blue-300 ring-1 ring-blue-700/30 mb-4 block w-fit mx-auto">🇦🇺 Australian Regulation</span>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight tracking-tight mb-4">
            The biggest AML reform in 18 years is underway.
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            The AML/CTF Amendment Act 2024 is transforming who must comply with Australia&apos;s AML/CTF laws. Is your business ready?
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-12">
          {[
            { year: '2006', title: 'AML/CTF Act enacted', desc: 'Australia\'s primary AML/CTF legislation came into force, capturing financial services, digital currency providers, and remittance businesses as reporting entities.', status: 'past' },
            { year: '2024', title: 'Tranche 2 legislation introduced', desc: 'The AML/CTF Amendment Act 2024 passed Parliament, extending obligations to real estate professionals, lawyers, accountants, conveyancers, and precious metal dealers.', status: 'current' },
            { year: '2026', title: 'Expanded obligations commence', desc: 'From 2026, all newly captured businesses must have a full AML/CTF program in place, enrolled with AUSTRAC, and conducting customer due diligence.', status: 'upcoming' },
          ].map(item => (
            <div key={item.year} className={`rounded-2xl p-8 ${item.status === 'upcoming' ? 'bg-blue-600' : item.status === 'current' ? 'bg-slate-800 ring-1 ring-blue-500/40' : 'bg-slate-800'}`}>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{item.year}</div>
              <h3 className={`text-xl font-bold mb-3 ${item.status === 'upcoming' ? 'text-white' : 'text-white'}`}>{item.title}</h3>
              <p className={`text-sm leading-relaxed ${item.status === 'upcoming' ? 'text-blue-100' : 'text-slate-400'}`}>{item.desc}</p>
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

function PlatformCapabilities() {
  const caps = [
    { icon: BookOpen, title: 'AML Program', desc: 'Risk assessment, Part A/B templates, policy registers, and board approval workflows', slug: 'aml-program', highlight: true },
    { icon: UserCheck, title: 'Customer Onboarding', desc: 'Guided digital onboarding with built-in compliance checks', slug: 'customer-onboarding' },
    { icon: ScanFace, title: 'KYC / Identity Verification', desc: 'Automated identity document and biometric verification', slug: 'kyc-identity-verification' },
    { icon: Building2, title: 'KYB / Business Verification', desc: 'Business verification and beneficial ownership mapping', slug: 'kyb-business-verification' },
    { icon: ShieldAlert, title: 'Sanctions & PEP Screening', desc: 'Real-time screening against global sanctions and PEP lists', slug: 'sanctions-screening' },
    { icon: Activity, title: 'Transaction Monitoring', desc: 'Automated AML surveillance across all transactions 24/7', slug: 'transaction-monitoring' },
    { icon: FolderOpen, title: 'Case Management', desc: 'Alert-to-resolution investigation workflows with audit trail', slug: 'case-management' },
    { icon: FileText, title: 'Regulatory Reporting', desc: 'AUSTRAC-ready SMR, IFTI, and TTR report generation', slug: 'regulatory-reporting' },
    { icon: Zap, title: 'Workflow Automation', desc: 'No-code compliance automation for repetitive processes', slug: 'workflow-automation' },
  ]

  return (
    <section className="pub-section bg-slate-50">
      <div className="pub-container">
        <div className="text-center mb-16">
          <span className="pub-label mb-4 block w-fit mx-auto">Platform</span>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight mb-4">
            Everything you need to stay compliant.
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto">
            Nine integrated capabilities — from your AML Program foundation through to automated AUSTRAC reporting.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {caps.map(({ icon: Icon, title, desc, slug, highlight }) => (
            <Link
              key={slug}
              href={`/solutions/${slug}`}
              className={`pub-card-hover group flex flex-col gap-4 ${highlight ? 'ring-blue-300 bg-blue-50 lg:col-span-1' : ''}`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${highlight ? 'bg-blue-600' : 'bg-blue-50'}`}>
                <Icon className={`w-5 h-5 ${highlight ? 'text-white' : 'text-blue-600'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  {highlight && <span className="inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">Core</span>}
                </div>
                <p className="text-slate-500 text-sm">{desc}</p>
              </div>
              <span className="text-blue-600 text-sm font-semibold group-hover:underline mt-auto">Learn more →</span>
            </Link>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/solutions" className="pub-btn-secondary">View all capabilities</Link>
        </div>
      </div>
    </section>
  )
}

function AMLProgramSpotlight() {
  const components = [
    { icon: ClipboardList, title: 'Risk Assessment', desc: 'Industry-specific AML/CTF risk assessment matrix. Pre-populated with the risk factors that matter for your sector.' },
    { icon: FileText, title: 'Part A Program', desc: 'Governance framework, senior officer responsibilities, employee due diligence, and ongoing training obligations.' },
    { icon: Shield, title: 'Part B Program', desc: 'Customer identification and verification procedures — the rules your staff follow when onboarding every customer.' },
    { icon: Users, title: 'CDD & EDD Policies', desc: 'Standard and enhanced due diligence policies with trigger rules and MLRO sign-off workflows built in.' },
    { icon: Database, title: 'Compliance Registers', desc: 'Employee DD register, training log, and high-risk customer register — maintained automatically as your team uses the platform.' },
    { icon: RefreshCw, title: 'Annual Review', desc: 'Automated reminder and review workflow. Update your program annually as required by AUSTRAC guidance.' },
    { icon: GraduationCap, title: 'Staff Training Module', desc: 'AML/CTF awareness training for all staff, with completion tracking and a dated training log for AUSTRAC inspections.' },
  ]

  return (
    <section className="pub-section bg-white">
      <div className="pub-container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: copy */}
          <div>
            <span className="pub-label mb-6 block w-fit">AML Program — Core Feature</span>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight mb-6">
              Your AML/CTF Program.<br />
              <span className="text-blue-600">Built in, not bolted on.</span>
            </h2>
            <p className="text-slate-600 leading-relaxed mb-5">
              Every reporting entity is legally required to have a written AML/CTF Program under the AML/CTF Act 2006. Most businesses treat it as a document exercise — once written, filed away and forgotten. VeriGo makes your AML Program a living, working system that drives every compliance decision your team makes.
            </p>
            <p className="text-slate-600 leading-relaxed mb-8">
              The program is not a PDF. It is the engine behind your onboarding rules, risk thresholds, monitoring triggers, and reporting obligations. When AUSTRAC comes calling, you can demonstrate compliance from the program level down to individual transaction decisions.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/solutions/aml-program" className="pub-btn-primary">
                Explore AML Program <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/start-trial" className="pub-btn-secondary">Start Free Trial</Link>
            </div>
          </div>

          {/* Right: component cards */}
          <div className="grid grid-cols-2 gap-3">
            {components.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="pub-card py-5 px-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm mb-1">{title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
            <div className="pub-card py-5 px-5 bg-blue-600 flex flex-col gap-3 justify-center items-center text-center">
              <BookOpen className="w-8 h-8 text-white" />
              <p className="text-white font-bold text-sm">All included in every plan</p>
              <p className="text-blue-200 text-xs">AUSTRAC-compliant templates, ready to use</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    { n: '1', title: 'Configure your compliance pack', desc: 'Select your regulated industry. VeriGo loads the correct AML/CTF compliance pack automatically — pre-configured rules, risk thresholds, and AUSTRAC reporting templates.' },
    { n: '2', title: 'Onboard customers with guided KYC/KYB', desc: 'Collect customer information digitally with guided onboarding flows. KYC checks, document collection, and risk scoring run automatically in the background.' },
    { n: '3', title: 'Screen against sanctions, PEP, and adverse media', desc: 'Every customer is automatically screened against global sanctions lists, PEP databases, and adverse media sources. Enhanced due diligence triggers for high-risk customers.' },
    { n: '4', title: 'Monitor transactions for suspicious patterns', desc: 'Automated rule-based monitoring detects suspicious activity 24/7. Structuring, velocity anomalies, high-risk jurisdictions, and unusual patterns are flagged instantly.' },
    { n: '5', title: 'Auto-generate SMR, IFTI, and TTR reports', desc: 'Regulatory reports are pre-populated from your transaction data and case management records. Built-in AUSTRAC validation ensures accurate, on-time submissions.' },
    { n: '6', title: 'Manage cases and maintain your audit trail', desc: 'Every alert becomes a case. Every case is investigated, documented, and resolved with a complete audit trail that satisfies AUSTRAC and internal governance requirements.' },
  ]

  return (
    <section className="pub-section bg-gradient-to-b from-blue-600 to-blue-700">
      <div className="pub-container">
        <div className="text-center mb-16">
          <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold text-white mb-4 block w-fit mx-auto">How It Works</span>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight tracking-tight mb-4">
            Six steps to full compliance.
          </h2>
          <p className="text-blue-100 max-w-xl mx-auto">
            From first customer to first AUSTRAC report — VeriGo guides your team through every compliance step.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {steps.map(step => (
            <div key={step.n} className="bg-white/10 backdrop-blur rounded-2xl p-6 ring-1 ring-white/20">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 font-black text-lg flex-shrink-0 mb-4">
                {step.n}
              </div>
              <h3 className="font-bold text-white mb-2">{step.title}</h3>
              <p className="text-blue-100 text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function IndustriesSection() {
  const current = industries.filter(i => i.regime === 'current')
  const expanded = industries.filter(i => i.regime === 'expanded')

  return (
    <section className="pub-section bg-white" id="industries">
      <div className="pub-container">
        <div className="text-center mb-16">
          <span className="pub-label mb-4 block w-fit mx-auto">Industries</span>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight mb-4">
            Industries We Serve
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto">
            Select your industry and VeriGo loads the correct compliance pack, risk matrix, and reporting templates automatically.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <h3 className="text-lg font-bold text-slate-900">Current Reporting Entities</h3>
              <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-700/10">Active now</span>
            </div>
            <div className="space-y-3">
              {current.map(ind => (
                <Link key={ind.id} href={`/solutions/${ind.id}`} className="pub-card-hover flex items-center gap-4 group">
                  <div className={`w-10 h-10 bg-gradient-to-br ${ind.color} rounded-xl flex items-center justify-center text-xl flex-shrink-0`}>{ind.icon}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{ind.label}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{ind.packName}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-6">
              <h3 className="text-lg font-bold text-slate-900">Tranche 2 — Effective 2026</h3>
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-700/10">Prepare now</span>
            </div>
            <div className="space-y-3">
              {expanded.map(ind => (
                <Link key={ind.id} href={`/solutions/${ind.id}`} className="pub-card-hover flex items-center gap-4 group">
                  <div className={`w-10 h-10 bg-gradient-to-br ${ind.color} rounded-xl flex items-center justify-center text-xl flex-shrink-0`}>{ind.icon}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{ind.label}</div>
                    <div className="text-amber-600 text-xs font-semibold mt-0.5">{ind.packName}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center mt-10">
          <Link href="/industries" className="pub-btn-secondary">View all industry compliance packs</Link>
        </div>
      </div>
    </section>
  )
}

function WhyChooseVerigo() {
  return (
    <section className="pub-section bg-slate-50">
      <div className="pub-container">
        <div className="text-center mb-16">
          <span className="pub-label mb-4 block w-fit mx-auto">Why VeriGo</span>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight mb-4">
            Why Australian businesses choose VeriGo
          </h2>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="pub-card">
            <div className="text-3xl mb-4">🇦🇺</div>
            <h3 className="font-bold text-slate-900 text-lg mb-3">Built for Australian Law</h3>
            <p className="text-slate-500 leading-relaxed mb-4">
              VeriGo is built specifically for the AML/CTF Act 2006, AUSTRAC regulatory guidance, and the AML/CTF Amendment Act 2024. We don&apos;t adapt a global product for Australia — we build for Australia first.
            </p>
            <ul className="space-y-2 text-sm text-slate-600">
              {['AUSTRAC report templates (SMR, IFTI, TTR)', 'Industry packs aligned to AU obligations', 'Tranche 2 ready for all new entity types'].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="pub-card">
            <div className="text-3xl mb-4">⚡</div>
            <h3 className="font-bold text-slate-900 text-lg mb-3">No Compliance Team Required</h3>
            <p className="text-slate-500 leading-relaxed mb-4">
              VeriGo is designed to be operated by a small compliance team — or even a single person wearing multiple hats. Automation handles the routine. The platform guides you through the complex.
            </p>
            <ul className="space-y-2 text-sm text-slate-600">
              {['Pre-built workflows for every compliance task', 'Guided onboarding — live in minutes, not months', 'Plain-English compliance guidance built in'].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="pub-card">
            <div className="text-3xl mb-4">🔒</div>
            <h3 className="font-bold text-slate-900 text-lg mb-3">Your Data Stays in Australia</h3>
            <p className="text-slate-500 leading-relaxed mb-4">
              All VeriGo customer and compliance data is hosted in Australian AWS data centres. We never transfer your compliance data offshore. Australian data sovereignty is a core product commitment — not a marketing claim.
            </p>
            <ul className="space-y-2 text-sm text-slate-600">
              {['AWS Australia (Sydney) data residency', 'AES-256 encryption at rest and in transit', 'SOC 2 Type II roadmap underway'].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

function SecurityGovernance() {
  const features = [
    { icon: Lock, title: 'AES-256 Encryption', desc: 'All data encrypted at rest and in transit using AES-256. Your compliance data never leaves Australian shores unencrypted.' },
    { icon: Shield, title: 'Multi-Factor Authentication', desc: 'TOTP-based MFA enforced for all users by default. Hardware security key support available for enterprise teams.' },
    { icon: Users, title: 'Role-Based Access Control', desc: 'Granular permissions from viewer to MLRO. Enforce least-privilege access across your compliance team with configurable RBAC.' },
    { icon: Activity, title: 'Immutable Audit Logs', desc: 'Every action is logged with timestamp, user attribution, and context. Tamper-proof records available for regulatory inspection at any time.' },
    { icon: Database, title: 'Australian Data Residency', desc: 'All data hosted in AWS Sydney. No cross-border data transfer. Full Australian data sovereignty guaranteed by contract.' },
    { icon: CheckCircle, title: 'SOC 2 Type II Roadmap', desc: 'VeriGo is working toward SOC 2 Type II certification. Security controls are designed and operated to meet SOC 2 Trust Service Criteria.' },
  ]

  return (
    <section className="pub-section bg-white">
      <div className="pub-container">
        <div className="text-center mb-16">
          <span className="pub-label mb-4 block w-fit mx-auto">Security & Governance</span>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight mb-4">
            Enterprise security. Built in by default.
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto">
            Security isn&apos;t an add-on — it&apos;s how VeriGo was architected from day one. Because compliance data is some of the most sensitive information your business holds.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="pub-card flex gap-4">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link href="/trust-centre" className="pub-btn-secondary">View our Trust Centre</Link>
        </div>
      </div>
    </section>
  )
}

function CTASection() {
  return (
    <section className="pub-section bg-slate-900">
      <div className="pub-container text-center">
        <h2 className="text-4xl md:text-5xl font-black text-white leading-tight tracking-tight mb-4">
          Ready to get compliant?
        </h2>
        <p className="text-slate-400 text-xl max-w-xl mx-auto mb-10">
          7-day free trial. No credit card. Full access to all features.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
          <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
            Start Free Trial <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="/live-demo" className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-8 py-4 text-base font-semibold text-white ring-1 ring-slate-700 hover:bg-slate-700 transition-colors">
            Book a Demo
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

export default function HomePage() {
  return (
    <div className="bg-white text-slate-900">
      <Hero />
      <SocialProof />
      <WhyComplianceMatters />
      <AMLReformTimeline />
      <PlatformCapabilities />
      <AMLProgramSpotlight />
      <HowItWorks />
      <IndustriesSection />
      <WhyChooseVerigo />
      <SecurityGovernance />
      <CTASection />
    </div>
  )
}
