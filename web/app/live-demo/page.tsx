import Link from 'next/link'
import { CheckCircle, Calendar, Clock, Users, ArrowRight, Play, BarChart3, FileText, Folder, Shield } from 'lucide-react'
import { industries } from '@/lib/industries'

export const metadata = {
  title: 'Book a Live Demo | Verigo',
  description: 'Book a 30-minute guided demo of VeriGo with a compliance specialist. We walk through your industry obligations, customer onboarding, transaction monitoring, and AUSTRAC reporting live.',
}

const demoSteps = [
  {
    icon: Shield,
    title: 'Platform Tour',
    desc: 'We start with a complete walkthrough of the dashboard — your compliance overview, pending tasks, and active alerts. You\'ll understand how VeriGo maps to your daily compliance workflow.',
  },
  {
    icon: Users,
    title: 'Industry Configuration',
    desc: 'We configure the platform for your specific industry and walk through your pre-loaded compliance pack: AML/CTF Program template, KYC/KYB workflows, risk matrix, and AUSTRAC report templates.',
  },
  {
    icon: CheckCircle,
    title: 'Customer Onboarding',
    desc: 'We onboard a sample customer live — collecting identity documents, running KYC verification, screening against sanctions and PEP lists, and assigning a risk rating. You\'ll see the full audit trail created in real time.',
  },
  {
    icon: BarChart3,
    title: 'Transaction Monitoring',
    desc: 'We create a sample transaction, trigger a monitoring rule, and walk through the alert generation and investigation workflow — from alert to case to resolution.',
  },
  {
    icon: FileText,
    title: 'AUSTRAC Reporting',
    desc: 'We generate a sample SMR or IFTI report — showing how it\'s pre-populated from verified customer and transaction data, reviewed, approved, and submitted to AUSTRAC.',
  },
  {
    icon: Folder,
    title: 'Case Management',
    desc: 'We walk through a complete investigation: from monitoring alert to case creation, evidence linking, analyst notes, escalation, and final resolution — with a full immutable audit trail.',
  },
  {
    icon: Play,
    title: 'Your Questions',
    desc: 'The final 10 minutes are yours. Ask about your specific compliance situation, team structure, integration requirements, or how VeriGo maps to your existing processes.',
  },
]

export default function LiveDemoPage() {
  return (
    <div className="bg-white text-slate-900">
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-start">

            {/* Left column */}
            <div>
              <span className="pub-label mb-6 block w-fit">Live Demo</span>
              <h1 className="text-4xl font-black text-slate-900 mb-4 leading-tight">
                See VeriGo in action — built around your industry.
              </h1>
              <p className="text-slate-600 leading-relaxed mb-8">
                Our 30-minute guided demo is led by a compliance specialist and uses your industry as the working
                example. You&apos;ll leave with a clear picture of how VeriGo maps to your specific AML/CTF obligations
                and what implementation looks like for your team.
              </p>

              {/* Session info */}
              <div className="space-y-3 mb-10">
                {[
                  { icon: Calendar, text: '30-minute focused session — no sales pitch, just the platform' },
                  { icon: Users, text: 'Led by a compliance specialist who understands your industry' },
                  { icon: Clock, text: 'Available weekdays 9am–5pm AEST' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3">
                    <Icon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <span className="text-slate-700 text-sm font-medium">{text}</span>
                  </div>
                ))}
              </div>

              {/* Demo flow */}
              <div className="pub-card">
                <p className="text-sm font-bold text-slate-900 mb-5">What we&apos;ll cover in 30 minutes:</p>
                <div className="space-y-5">
                  {demoSteps.map((step, i) => (
                    <div key={step.title} className="flex gap-4">
                      <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm mb-1">{step.title}</p>
                        <p className="text-slate-500 text-xs leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column — form */}
            <div className="pub-card lg:sticky lg:top-24">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Book your demo</h2>
              <p className="text-slate-500 text-sm mb-6">We&apos;ll confirm your booking within one business day.</p>
              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">First name</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Jane"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Last name</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Smith"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Work email</label>
                  <input
                    type="email"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="jane@company.com.au"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company name</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Acme Pty Ltd"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                  <select className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                    <option value="">Select your industry</option>
                    {industries.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.label}{i.regime === 'expanded' ? ' (Tranche 2 — 2026)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preferred time</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. Tuesday 2pm AEST"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">What do you want to see? <span className="text-slate-400 font-normal">(optional)</span></label>
                  <textarea
                    rows={3}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="e.g. We want to see the KYC workflow and how SMRs are generated..."
                  />
                </div>
                <button type="submit" className="pub-btn-primary w-full justify-center py-3">
                  Request Demo <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-slate-400 text-xs text-center">
                  Not ready for a demo?{' '}
                  <Link href="/start-trial" className="text-blue-600 hover:underline font-medium">
                    Start a free 7-day trial instead
                  </Link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
