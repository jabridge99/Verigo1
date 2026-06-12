import Link from 'next/link'
import {
  Shield, CheckCircle, AlertTriangle, FileText, Users, Lock,
  Zap, BarChart3, ArrowRight, Building2, Search, Activity,
  Database, Folder
} from 'lucide-react'
import { industries } from '@/lib/industries'

export const metadata = {
  title: 'Verigo — Australia\'s Compliance Operating System',
  description: 'The modern AML/CTF compliance platform for Australian regulated businesses. Built for AUSTRAC, ready for Tranche 2.',
}

function Hero() {
  return (
    <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-700/10 mb-8">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Australia&apos;s Compliance Operating System
        </div>

        <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-[1.05] tracking-tight mb-6">
          Compliance<br />
          <span className="text-blue-600">Made Practical.</span>
        </h1>

        <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed">
          A modern compliance operating system built for Australian reporting entities and businesses preparing for AML reforms.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link href="/start-trial" className="pub-btn-lg">
            Start Free Trial <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="/live-demo" className="pub-btn-secondary-lg">
            Book Demo
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-slate-500 mb-16">
          {['AUSTRAC aligned', '7-day free trial', 'No credit card', 'Australian data', 'FATF ready'].map(t => (
            <span key={t} className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> {t}
            </span>
          ))}
        </div>

        {/* Workflow strip */}
        <div className="max-w-5xl mx-auto bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-6 overflow-hidden">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">How Verigo Works</p>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 overflow-x-auto pb-1 scrollbar-hide">
            {[
              'Choose Industry',
              'Onboard Customer',
              'Verify & Assess Risk',
              'Monitor Transactions',
              'Generate Reports',
              'Stay Compliant',
            ].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-2">
                <span className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  {step}
                </span>
                {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function WhyComplianceMatters() {
  return (
    <section className="pub-section bg-white">
      <div className="pub-container">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <span className="pub-label mb-6 block w-fit">Why It Matters</span>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight mb-6">
              Compliance isn&apos;t optional.<br />It&apos;s how trust is built.
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Under the Anti-Money Laundering and Counter-Terrorism Financing Act 2006, Australian reporting entities must implement robust AML/CTF programs, conduct customer due diligence, and report suspicious activity to AUSTRAC.
            </p>
            <p className="text-slate-600 leading-relaxed mb-8">
              Failure to comply carries severe consequences — from civil penalties of up to $22.2 million per breach to criminal prosecution for individuals and reputational damage that can end a business overnight.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {[
                { stat: '$222M+', label: 'AUSTRAC penalties issued 2020–2024' },
                { stat: '6,500+', label: 'Reporting entities in Australia' },
                { stat: '$1.7B', label: 'Largest single AML penalty in AU history' },
                { stat: '2026', label: 'Tranche 2 reform deadline' },
              ].map(s => (
                <div key={s.stat} className="pub-card">
                  <div className="text-3xl font-black text-blue-600 mb-1">{s.stat}</div>
                  <div className="text-slate-500 text-sm">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-4">
            {[
              { icon: Shield, title: 'Fraud Prevention', desc: 'Identify high-risk customers before they cause harm. Automated KYC, sanctions screening, and PEP detection protect your business and your customers.' },
              { icon: BarChart3, title: 'Risk Reduction', desc: 'Real-time transaction monitoring and automated risk scoring dramatically reduce your exposure to financial crime and regulatory action.' },
              { icon: Users, title: 'Customer Trust', desc: 'Customers expect their service providers to have robust compliance programmes. Meeting your obligations signals professionalism and builds lasting trust.' },
              { icon: CheckCircle, title: 'Regulatory Readiness', desc: 'Stay ahead of AUSTRAC requirements with pre-built compliance packs, automated reporting templates, and a living audit trail.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="pub-card flex gap-4">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-blue-600" />
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

function AMLReform() {
  const expanded = industries.filter(i => i.regime === 'expanded')
  return (
    <section className="pub-section bg-slate-50" id="aml-reform">
      <div className="pub-container">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-700/10 mb-6 block w-fit">🇦🇺 Australian Regulation</span>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight mb-6">
              Tranche 2 is coming.<br />Is your business ready?
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              The AML/CTF Amendment Act 2024 brings Australian law into alignment with FATF Recommendations 22 and 23, extending AML/CTF obligations to Designated Non-Financial Businesses and Professions (DNFBPs).
            </p>
            <p className="text-slate-600 leading-relaxed mb-6">
              From 2026, real estate professionals, conveyancers, lawyers, accountants, and precious metal dealers must implement full AML/CTF programs, conduct customer due diligence, and report suspicious activity to AUSTRAC.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900 text-sm mb-1">Non-compliance penalty</p>
                  <p className="text-amber-800 text-sm">Up to $22.2 million for body corporates. Criminal prosecution for individuals responsible for AML/CTF failures.</p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-4">
              {[
                { year: '2006', title: 'AML/CTF Act enacted', desc: 'Financial services, DCEs, remittance providers regulated' },
                { year: '2024', title: 'Amendment Act passed', desc: 'New entities captured, 2-year transition period begins' },
                { year: '2026', title: 'Tranche 2 live', desc: 'DNFBPs must have full AML/CTF programs in place' },
              ].map((item, i) => (
                <div key={item.year} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {item.year.slice(2)}
                    </div>
                    {i < 2 && <div className="w-0.5 h-6 bg-slate-200 mt-1" />}
                  </div>
                  <div className="pb-2">
                    <p className="text-xs text-slate-400 font-semibold">{item.year}</p>
                    <p className="font-semibold text-slate-900 text-sm">{item.title}</p>
                    <p className="text-slate-500 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Newly captured industries from 2026</p>
            <div className="space-y-3">
              {expanded.map(ind => (
                <Link
                  key={ind.id}
                  href={`/solutions/${ind.id}`}
                  className="pub-card-hover flex items-center gap-4 group"
                >
                  <span className="text-2xl">{ind.icon}</span>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{ind.label}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{ind.austracRef}</div>
                  </div>
                  <span className="text-blue-600 text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                    View pack <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              ))}
            </div>
            <Link href="/solutions" className="pub-btn-secondary w-full justify-center mt-5">View all industry solutions</Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function WhoWeHelp() {
  const current = industries.filter(i => i.regime === 'current')
  const expanded = industries.filter(i => i.regime === 'expanded')
  return (
    <section className="pub-section bg-white" id="industries">
      <div className="pub-container">
        <div className="text-center mb-16">
          <span className="pub-label mb-4 block w-fit mx-auto">Industries</span>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight mb-4">
            Built for every<br />regulated business.
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto">
            Select your industry and Verigo loads the correct compliance pack, risk matrix, and reporting templates automatically.
          </p>
        </div>

        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <h3 className="text-xl font-bold text-slate-900">Current Reporting Entities</h3>
            <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-700/10">Active obligations now</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {current.map(ind => (
              <Link key={ind.id} href={`/solutions/${ind.id}`} className="pub-card-hover flex items-start gap-4 group">
                <span className="text-3xl">{ind.icon}</span>
                <div>
                  <div className="font-semibold text-slate-900">{ind.label}</div>
                  <div className="text-slate-400 text-xs mt-1">{ind.packName}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors ml-auto mt-0.5 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-6">
            <h3 className="text-xl font-bold text-slate-900">Expanded Regime — Tranche 2</h3>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-700/10">Coming 2026</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {expanded.map(ind => (
              <Link key={ind.id} href={`/solutions/${ind.id}`} className="pub-card-hover flex items-start gap-4 group">
                <span className="text-3xl">{ind.icon}</span>
                <div>
                  <div className="font-semibold text-slate-900">{ind.label}</div>
                  <div className="text-slate-400 text-xs mt-1">{ind.packName}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors ml-auto mt-0.5 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function PlatformCapabilities() {
  const capabilities = [
    { icon: Shield, title: 'Compliance Operations', slug: 'compliance-operations', desc: 'Central compliance command centre' },
    { icon: Users, title: 'Customer Onboarding', slug: 'customer-onboarding', desc: 'Digital onboarding with built-in KYC' },
    { icon: Search, title: 'KYC & KYB', slug: 'kyc-kyb', desc: 'Identity and business verification' },
    { icon: BarChart3, title: 'Transaction Monitoring', slug: 'transaction-monitoring', desc: 'Automated AML surveillance' },
    { icon: Folder, title: 'Case Management', slug: 'case-management', desc: 'Alert-to-resolution case workflows' },
    { icon: FileText, title: 'Regulatory Reporting', slug: 'regulatory-reporting', desc: 'AUSTRAC-ready report generation' },
    { icon: Building2, title: 'Reporting Groups', slug: 'reporting-groups', desc: 'Multi-entity group compliance' },
    { icon: Zap, title: 'Workflow Automation', slug: 'workflow-automation', desc: 'No-code compliance automation' },
  ]

  return (
    <section className="pub-section bg-slate-50">
      <div className="pub-container">
        <div className="text-center mb-16">
          <span className="pub-label mb-4 block w-fit mx-auto">Platform</span>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight mb-4">
            Everything you need<br />to stay compliant.
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto">
            One platform. Eight integrated capabilities. Designed to eliminate the complexity of AML/CTF compliance.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {capabilities.map(({ icon: Icon, title, slug, desc }) => (
            <Link key={slug} href={`/solutions/${slug}`} className="pub-card-hover group flex flex-col gap-4">
              <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center">
                <Icon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
                <p className="text-slate-500 text-sm">{desc}</p>
              </div>
              <span className="text-blue-600 text-sm font-semibold group-hover:underline mt-auto">Learn more →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    { n: '1', title: 'Choose Your Industry', desc: 'Select your regulated industry. Verigo loads the correct compliance pack automatically — pre-configured rules, risk thresholds, and AUSTRAC templates.' },
    { n: '2', title: 'Onboard Your Customers', desc: 'Collect customer information digitally with guided onboarding flows. KYC checks and document collection run automatically in the background.' },
    { n: '3', title: 'Verify & Assess Risk', desc: 'Run identity checks, sanctions screening, PEP detection, and automated risk scoring. Enhanced due diligence triggers automatically for high-risk customers.' },
    { n: '4', title: 'Monitor Transactions', desc: 'Automated rule-based monitoring detects suspicious activity 24/7. Structuring, velocity, high-risk countries, and unusual patterns are flagged instantly.' },
    { n: '5', title: 'Generate Reports', desc: 'Prepare TTR, IFTI, and SMR reports with pre-filled templates. Validate against AUSTRAC requirements and submit with confidence.' },
    { n: '6', title: 'Stay Compliant', desc: 'Maintain a live audit trail for every action. Stay ahead of regulatory change with automatic pack updates when the rules change.' },
  ]

  return (
    <section className="pub-section bg-gradient-to-b from-blue-50 to-white">
      <div className="pub-container">
        <div className="text-center mb-16">
          <span className="pub-label mb-4 block w-fit mx-auto">How It Works</span>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight mb-4">
            Six steps to<br />full compliance.
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto">
            From first customer to first AUSTRAC report — Verigo guides your team through every step.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {steps.map(step => (
            <div key={step.n} className="pub-card flex gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                {step.n}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SecurityGovernance() {
  const features = [
    { icon: Lock, title: 'Multi-Factor Authentication', desc: 'TOTP-based MFA for all users by default. Hardware key support available for enterprise.' },
    { icon: Activity, title: 'Audit Trails', desc: 'Every action logged with timestamp and user attribution. Tamper-proof records for regulatory inspection.' },
    { icon: Users, title: 'Role-Based Access Control', desc: 'Granular permissions from viewer to MLRO. Enforce least-privilege access across your entire team.' },
    { icon: Database, title: 'Secure Document Storage', desc: 'Encrypted document vault with access controls. Australian data residency guaranteed.' },
    { icon: Shield, title: 'End-to-End Encryption', desc: 'AES-256 encryption at rest and in transit. Your compliance data never leaves Australian shores unencrypted.' },
    { icon: CheckCircle, title: 'Workflow Governance', desc: 'Four-eyes approval and escalation workflows. Enforce oversight on high-risk decisions.' },
  ]

  return (
    <section className="pub-section bg-white">
      <div className="pub-container">
        <div className="text-center mb-16">
          <span className="pub-label mb-4 block w-fit mx-auto">Security</span>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight mb-4">
            Enterprise security.<br />Built in by default.
          </h2>
          <p className="text-slate-600 max-w-xl mx-auto">
            Security isn&apos;t a feature you bolt on — it&apos;s how Verigo was built from day one.
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
      </div>
    </section>
  )
}

function CTASection() {
  return (
    <section className="pub-section bg-slate-900">
      <div className="pub-container text-center">
        <h2 className="text-4xl md:text-5xl font-black text-white leading-tight tracking-tight mb-4">
          Ready to start compliant?
        </h2>
        <p className="text-slate-400 text-xl max-w-xl mx-auto mb-10">
          7-day free trial. No credit card. Full access to all features.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
          <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
            Start Free Trial <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="/live-demo" className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-8 py-4 text-base font-semibold text-white ring-1 ring-slate-700 hover:bg-slate-700 transition-colors">
            Book Demo
          </Link>
        </div>
        <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
          {['AUSTRAC aligned', 'Australian data hosting', 'FATF ready controls', 'No lock-in contracts'].map(t => (
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
      <WhyComplianceMatters />
      <AMLReform />
      <WhoWeHelp />
      <PlatformCapabilities />
      <HowItWorks />
      <SecurityGovernance />
      <CTASection />
    </div>
  )
}
