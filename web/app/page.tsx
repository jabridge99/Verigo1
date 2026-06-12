import Link from 'next/link'
import {
  Shield, CheckCircle, AlertTriangle, FileText, Users, Globe, Lock,
  Zap, BarChart3, ArrowRight, Building2, Search, Bell, Database, Scale
} from 'lucide-react'
import { industries } from '@/lib/industries'

function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy-900 section">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-700/10 rounded-full blur-3xl" />
      </div>
      <div className="container-xl mx-auto text-center relative z-10">
        <div className="inline-flex items-center gap-2 bg-brand-900/50 border border-brand-700/40 rounded-full px-4 py-2 text-sm text-brand-300 mb-8">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Australian AML/CTF Tranche 2 reforms are coming — are you ready?
        </div>
        <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6">
          Compliance shouldn&apos;t<br />
          <span className="gradient-text">slow you down.</span>
        </h1>
        <p className="text-xl text-white/60 max-w-3xl mx-auto mb-10 leading-relaxed">
          Verigo is Australia&apos;s first end-to-end Compliance Operating System —
          built for regulated businesses navigating AUSTRAC requirements, FATF recommendations,
          and the upcoming Tranche 2 reforms.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link href="/start-trial" className="btn-gold text-base px-8 py-4">
            Start 7-Day Free Trial <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="/live-demo" className="btn-secondary text-base px-8 py-4">
            Book a Demo
          </Link>
        </div>
        <div className="flex flex-wrap justify-center gap-6 text-sm text-white/50">
          {['AUSTRAC aligned', 'FATF-recommended controls', 'SOC 2 ready', 'Australian data sovereignty', 'Tranche 2 ready'].map(t => (
            <span key={t} className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" /> {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function WhyKYC() {
  return (
    <section className="section bg-navy-800/50">
      <div className="container-xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <span className="badge bg-brand-900/50 text-brand-400 border border-brand-700/30 mb-4">Why KYC Matters</span>
            <h2 className="text-4xl font-bold mb-6">Know who you&apos;re doing business with — before it&apos;s too late.</h2>
            <p className="text-white/60 leading-relaxed mb-6">
              Know Your Customer (KYC) is the foundation of every compliant business. It is the process of verifying the
              identity of your customers to ensure they are who they claim to be — and that your business is not
              unknowingly facilitating money laundering, terrorism financing, or fraud.
            </p>
            <p className="text-white/60 leading-relaxed mb-8">
              Under the AML/CTF Act 2006, reporting entities must identify and verify customers before providing designated
              services. Failure to do so exposes your business to civil penalties, criminal prosecution, and reputational damage.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { stat: '$222M+', label: 'AUSTRAC penalties issued 2020–2024' },
                { stat: '6,500+', label: 'Reporting entities in Australia' },
                { stat: '$1.7B', label: 'Largest single AML penalty in AU history' },
                { stat: '2026', label: 'Tranche 2 reform deadline' },
              ].map(s => (
                <div key={s.stat} className="card">
                  <div className="text-3xl font-black text-brand-400">{s.stat}</div>
                  <div className="text-white/60 text-sm mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {[
              { icon: Shield, title: 'Identity Verification', desc: 'Verify government-issued IDs, passports, and driving licences with OCR and document validation.' },
              { icon: Search, title: 'Sanctions Screening', desc: 'Screen customers against OFAC, UN, EU, DFAT and UK HMT consolidated lists in real time.' },
              { icon: AlertTriangle, title: 'PEP Screening', desc: 'Identify Politically Exposed Persons and apply enhanced due diligence automatically.' },
              { icon: Globe, title: 'Beneficial Ownership', desc: 'Map complex ownership structures and verify ultimate beneficial owners for KYB compliance.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4 card">
                <div className="w-10 h-10 bg-brand-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-brand-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function WhyAML() {
  return (
    <section className="section">
      <div className="container-xl mx-auto">
        <div className="text-center mb-16">
          <span className="badge bg-red-900/30 text-red-400 border border-red-700/30 mb-4">Why AML Matters</span>
          <h2 className="text-4xl font-bold mb-4">Money laundering costs Australia billions every year.</h2>
          <p className="text-white/60 max-w-2xl mx-auto">
            Anti-Money Laundering (AML) programs detect, report and prevent the movement of proceeds of crime through
            legitimate financial systems. AUSTRAC requires regulated businesses to implement risk-based AML programs.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: BarChart3, color: 'text-blue-400 bg-blue-900/30', title: 'Transaction Monitoring', desc: 'Automated rule-based and risk-scored monitoring for structuring, velocity, high-risk countries, cash activity, and unusual patterns.' },
            { icon: FileText, color: 'text-green-400 bg-green-900/30', title: 'Regulatory Reporting', desc: 'Prepare and submit IFTI IN, IFTI OUT, TTR, and SMR reports to AUSTRAC using prefilled templates, bulk import, and built-in validation.' },
            { icon: Bell, color: 'text-amber-400 bg-amber-900/30', title: 'Case Management', desc: 'Auto-generate compliance cases from alerts and assign to analysts. Full audit trail, escalation paths, and four-eyes approval.' },
          ].map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="card text-center">
              <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center mx-auto mb-6`}>
                <Icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Tranche2() {
  const expanded = industries.filter(i => i.regime === 'expanded')
  return (
    <section className="section bg-navy-800/30">
      <div className="container-xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <span className="badge bg-amber-900/30 text-amber-400 border border-amber-700/30 mb-4">🇦🇺 Australian AML/CTF Reforms</span>
            <h2 className="text-4xl font-bold mb-6">Tranche 2 is coming.<br />Is your business ready?</h2>
            <p className="text-white/60 leading-relaxed mb-6">
              The AML/CTF Amendment Act 2024 brings Australian law into alignment with FATF Recommendations 22 and 23,
              extending AML/CTF obligations to Designated Non-Financial Businesses and Professions (DNFBPs).
            </p>
            <p className="text-white/60 leading-relaxed mb-8">
              From 2026, real estate professionals, conveyancers, lawyers, accountants, and precious metal dealers must
              implement full AML/CTF programs, conduct customer due diligence, and report suspicious activity to AUSTRAC.
            </p>
            <div className="card border-amber-700/30 bg-amber-900/10">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-300 font-semibold text-sm mb-1">Non-compliance risk</p>
                  <p className="text-white/60 text-sm">Penalties of up to $22.2 million for body corporates. Criminal prosecution for individuals.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-white/50 text-sm font-semibold uppercase tracking-wider mb-4">Newly captured industries</p>
            {expanded.map(ind => (
              <div key={ind.id} className="flex items-center gap-4 card-hover">
                <span className="text-2xl">{ind.icon}</span>
                <div className="flex-1">
                  <div className="font-semibold text-white">{ind.label}</div>
                  <div className="text-white/50 text-xs mt-0.5">{ind.austracRef}</div>
                </div>
                <Link href={`/solutions/${ind.id}`} className="text-brand-400 text-sm hover:text-brand-300 flex items-center gap-1">
                  View pack <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ))}
            <Link href="/solutions" className="btn-secondary w-full justify-center mt-4">View all industry solutions</Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function Industries() {
  const current = industries.filter(i => i.regime === 'current')
  const expanded = industries.filter(i => i.regime === 'expanded')
  return (
    <section className="section bg-navy-800/30" id="solutions">
      <div className="container-xl mx-auto">
        <div className="text-center mb-12">
          <span className="badge bg-brand-900/50 text-brand-400 border border-brand-700/30 mb-4">Industry Solutions</span>
          <h2 className="text-4xl font-bold mb-4">Built for your industry.</h2>
          <p className="text-white/60 max-w-xl mx-auto">Select your industry and Verigo loads the right compliance pack automatically.</p>
        </div>
        <div className="mb-10">
          <p className="text-white/50 text-sm font-semibold uppercase tracking-wider mb-4">Current Reporting Entities</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {current.map(ind => (
              <Link key={ind.id} href={`/solutions/${ind.id}`} className="card-hover flex items-start gap-4">
                <span className="text-3xl">{ind.icon}</span>
                <div><div className="font-semibold text-white">{ind.label}</div><div className="text-white/50 text-xs mt-1">{ind.packName}</div></div>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="text-white/50 text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2">
            Tranche 2 — Expanded Regime (2026)
            <span className="badge bg-amber-900/30 text-amber-400 border border-amber-700/30">Coming 2026</span>
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {expanded.map(ind => (
              <Link key={ind.id} href={`/solutions/${ind.id}`} className="card-hover flex items-start gap-4">
                <span className="text-3xl">{ind.icon}</span>
                <div><div className="font-semibold text-white">{ind.label}</div><div className="text-white/50 text-xs mt-1">{ind.packName}</div></div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="section bg-gradient-to-b from-brand-900/20 to-navy-900">
      <div className="container-xl mx-auto text-center">
        <h2 className="text-5xl font-black mb-6">Start compliant.<br /><span className="gradient-text">Stay compliant.</span></h2>
        <p className="text-white/60 text-xl max-w-xl mx-auto mb-10">7-day free trial. No credit card. Full access to all features. AUSTRAC-aligned from day one.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/start-trial" className="btn-gold text-base px-10 py-4">Start Free Trial <ArrowRight className="w-5 h-5" /></Link>
          <Link href="/live-demo" className="btn-secondary text-base px-10 py-4">Book a Demo</Link>
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <WhyKYC />
      <WhyAML />
      <Tranche2 />
      <Industries />
      <CTA />
    </>
  )
}
