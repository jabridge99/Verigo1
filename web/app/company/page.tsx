import Link from 'next/link'
import { ArrowRight, Shield, CheckCircle, Heart, Eye, FileText, Cpu } from 'lucide-react'

export const metadata = {
  title: 'Our Company | Verigo',
  description: 'Verigo is built for Australian compliance teams who deserve better tools. Learn our story, mission, and principles.',
}

export default function CompanyPage() {
  return (
    <div className="bg-white text-slate-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl">
            <span className="pub-label mb-6 block w-fit">Our Company</span>
            <h1 className="text-5xl md:text-6xl font-black text-slate-900 leading-tight tracking-tight mb-6">
              Built for Australian<br />compliance teams.
            </h1>
            <p className="text-xl text-slate-600 leading-relaxed mb-8">
              Verigo exists because compliance teams in Australia&apos;s regulated businesses deserve modern, purpose-built tools — not spreadsheets, legacy software, and manual workarounds.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/start-trial" className="pub-btn-lg">
                Start Free Trial <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/live-demo" className="pub-btn-secondary-lg">
                Book Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Our Mission */}
      <section className="pub-section">
        <div className="pub-container">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="pub-label mb-6 block w-fit">Our Mission</span>
              <h2 className="text-4xl font-black text-slate-900 leading-tight mb-6">
                We built Verigo because compliance deserved better.
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Australian compliance professionals have been underserved for too long. The tools available were either designed for global financial institutions with million-dollar budgets, or cobbled together from generic software that was never meant for AML/CTF work.
              </p>
              <p className="text-slate-600 leading-relaxed mb-4">
                We saw compliance officers juggling spreadsheets, copying transaction data into government portals by hand, and losing sleep over whether their SMR submissions would pass AUSTRAC validation.
              </p>
              <p className="text-slate-600 leading-relaxed">
                Verigo is our answer: a modern, practical compliance operating system built from the ground up for Australian obligations — with the right level of automation, the right templates, and a user experience that doesn&apos;t require a manual to navigate.
              </p>
            </div>
            <div className="space-y-4">
              {[
                { stat: '9', label: 'Industry compliance packs' },
                { stat: '8', label: 'Platform capabilities' },
                { stat: '100%', label: 'Australian data sovereignty' },
                { stat: '7-day', label: 'Free trial, no credit card' },
              ].map(s => (
                <div key={s.stat} className="pub-card flex items-center gap-6">
                  <div className="text-4xl font-black text-blue-600 min-w-[80px]">{s.stat}</div>
                  <div className="text-slate-600">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why We Built This */}
      <section className="pub-section bg-slate-50">
        <div className="pub-container">
          <div className="text-center mb-12">
            <span className="pub-label mb-4 block w-fit mx-auto">Why We Built This</span>
            <h2 className="text-4xl font-black text-slate-900 leading-tight mb-4">
              The compliance software gap<br />for Australian SMEs
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Large Australian banks have compliance teams of hundreds and budgets for enterprise software. Small and mid-sized regulated businesses have neither.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {[
              {
                title: 'The Old Way',
                items: [
                  'Compliance tracked in spreadsheets',
                  'Manual copy-paste into AUSTRAC portals',
                  'No automated transaction monitoring',
                  'KYC done on paper and scanned',
                  'No audit trail for regulators',
                  'Compliance as a checkbox, not a programme',
                ],
                bad: true,
              },
              {
                title: 'Enterprise Software',
                items: [
                  'Built for Tier 1 banks',
                  'Six-figure annual licence fees',
                  '12–18 month implementation timelines',
                  'Requires dedicated IT teams',
                  'Overkill for SME obligations',
                  'Not designed for Australian law',
                ],
                bad: true,
              },
              {
                title: 'Verigo',
                items: [
                  'Purpose-built for Australian obligations',
                  'Affordable monthly pricing',
                  'Live in minutes, not months',
                  'Self-service with guidance built in',
                  'AUSTRAC-aligned from day one',
                  'Scales with your business',
                ],
                bad: false,
              },
            ].map(col => (
              <div key={col.title} className={`pub-card ${!col.bad ? 'ring-blue-300 bg-blue-50' : ''}`}>
                <h3 className={`font-bold mb-4 ${!col.bad ? 'text-blue-700' : 'text-slate-500'}`}>{col.title}</h3>
                <ul className="space-y-2.5">
                  {col.items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                      {col.bad
                        ? <span className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5 font-bold">✗</span>
                        : <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      }
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Australian Focus */}
      <section className="pub-section" id="aml-reform">
        <div className="pub-container">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10 mb-6 block w-fit">🇦🇺 Australian Focus</span>
              <h2 className="text-4xl font-black text-slate-900 leading-tight mb-6">
                Built for Australian law.<br />Not adapted from elsewhere.
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Verigo is built specifically for the Anti-Money Laundering and Counter-Terrorism Financing Act 2006, AUSTRAC regulatory guidance, and the AML/CTF Amendment Act 2024 Tranche 2 reforms.
              </p>
              <p className="text-slate-600 leading-relaxed mb-4">
                Our report templates are designed for AUSTRAC&apos;s AUSTRAC Online portal. Our risk frameworks follow AUSTRAC&apos;s risk-based approach guidance. Our industry packs map directly to Australian regulatory obligations.
              </p>
              <p className="text-slate-600 leading-relaxed">
                All data is stored in Australian data centres. We don&apos;t adapt a global product — we build for Australia first.
              </p>
            </div>
            <div className="space-y-4">
              {[
                { title: 'AML/CTF Act 2006', desc: 'Every feature maps to a specific legal obligation under Australian law.' },
                { title: 'AUSTRAC Alignment', desc: 'Report templates, risk frameworks, and guidance aligned to AUSTRAC requirements.' },
                { title: 'Tranche 2 Ready', desc: 'Pre-built packs for every new entity type captured under the 2024 amendments.' },
                { title: 'Australian Data Sovereignty', desc: 'All compliance data hosted in Australian AWS regions. Never offshore.' },
              ].map(item => (
                <div key={item.title} className="pub-card flex gap-4">
                  <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2" />
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">{item.title}</h3>
                    <p className="text-slate-500 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Future of Compliance */}
      <section className="pub-section bg-slate-50">
        <div className="pub-container">
          <div className="text-center mb-12">
            <span className="pub-label mb-4 block w-fit mx-auto">Looking Forward</span>
            <h2 className="text-4xl font-black text-slate-900 leading-tight mb-4">
              Where compliance is headed
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Regulation in Australia is evolving rapidly. Tranche 2 is just the beginning. We&apos;re building for where compliance is going, not where it&apos;s been.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { title: 'More entities regulated', desc: 'Tranche 2 brings DNFBPs in from 2026. More categories will follow as FATF pressure continues.' },
              { title: 'Higher penalties', desc: 'AUSTRAC is increasingly enforcement-focused. The era of warnings is over — penalties are real and significant.' },
              { title: 'Technology expectations', desc: 'Regulators increasingly expect automated controls, not manual processes, as the compliance baseline.' },
              { title: 'Real-time compliance', desc: 'The future is continuous compliance monitoring — not annual reviews and periodic checks.' },
            ].map(item => (
              <div key={item.title} className="pub-card">
                <h3 className="font-semibold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="pub-section">
        <div className="pub-container">
          <div className="text-center mb-12">
            <span className="pub-label mb-4 block w-fit mx-auto">Our Principles</span>
            <h2 className="text-4xl font-black text-slate-900 leading-tight mb-4">How we operate</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                icon: Heart,
                title: 'Trust',
                desc: 'We never sell your data. Ever. Your compliance data is some of the most sensitive information your business holds. We treat it accordingly.',
              },
              {
                icon: Eye,
                title: 'Transparency',
                desc: 'Clear pricing, clear terms, no surprises. You know exactly what you&apos;re getting, what it costs, and what we do with your data.',
              },
              {
                icon: FileText,
                title: 'Practical Compliance',
                desc: 'We help you comply, not drown in paperwork. Every feature is designed to reduce your compliance burden — not add to it.',
              },
              {
                icon: Cpu,
                title: 'Technology with Purpose',
                desc: 'Every feature in Verigo solves a real compliance problem faced by real Australian businesses. We don&apos;t build for the sake of building.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="pub-card flex gap-5">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2">{title}</h3>
                  <p className="text-slate-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pub-section bg-slate-900">
        <div className="pub-container text-center">
          <h2 className="text-4xl font-black text-white mb-4">Start your compliance journey today</h2>
          <p className="text-slate-400 text-xl mb-10">7-day free trial. No credit card. Full access to all features.</p>
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
