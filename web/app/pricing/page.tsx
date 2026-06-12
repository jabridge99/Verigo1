import Link from 'next/link'
import { CheckCircle, X, ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'Pricing | Verigo',
  description: 'Simple, transparent pricing for Australian regulated businesses. Start with a 7-day free trial.',
}

const plans = [
  {
    name: 'Essential',
    price: '$299',
    period: '/month',
    badge: null,
    description: 'For small reporting entities building their first AML/CTF programme.',
    highlight: false,
    features: [
      { label: 'Up to 500 customers', included: true },
      { label: '1 industry compliance pack', included: true },
      { label: 'KYC identity verification', included: true },
      { label: 'Sanctions & PEP screening', included: true },
      { label: 'Basic transaction monitoring', included: true },
      { label: 'SMR & TTR reporting', included: true },
      { label: 'Email support', included: true },
      { label: 'IFTI reporting', included: false },
      { label: 'No-code workflow automation', included: false },
      { label: 'Multi-entity / white label', included: false },
      { label: 'Full API access', included: false },
    ],
    cta: 'Start Free Trial',
    href: '/start-trial',
  },
  {
    name: 'Professional',
    price: '$799',
    period: '/month',
    badge: 'Most Popular',
    description: 'For growing compliance teams with full AUSTRAC reporting obligations.',
    highlight: true,
    features: [
      { label: 'Up to 5,000 customers', included: true },
      { label: '3 industry compliance packs', included: true },
      { label: 'KYC + KYB verification', included: true },
      { label: 'Sanctions, PEP + adverse media', included: true },
      { label: 'Advanced transaction monitoring', included: true },
      { label: 'IFTI IN & OUT reporting', included: true },
      { label: 'SMR & TTR reporting', included: true },
      { label: 'Case management workflows', included: true },
      { label: 'No-code workflow automation', included: true },
      { label: 'Priority support', included: true },
      { label: 'Multi-entity / white label', included: false },
      { label: 'Full API access', included: false },
    ],
    cta: 'Start Free Trial',
    href: '/start-trial',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    badge: null,
    description: 'For reporting groups, financial institutions, and SaaS resellers.',
    highlight: false,
    features: [
      { label: 'Unlimited customers', included: true },
      { label: 'All compliance packs', included: true },
      { label: 'KYC, KYB + beneficial ownership', included: true },
      { label: 'Premium data connectors (BYO keys)', included: true },
      { label: 'Full AUSTRAC reporting suite', included: true },
      { label: 'No-code workflow automation', included: true },
      { label: 'Multi-entity & white label', included: true },
      { label: 'Reporting groups', included: true },
      { label: 'Full REST API access', included: true },
      { label: 'Dedicated compliance support', included: true },
      { label: 'SLA guarantee', included: true },
    ],
    cta: 'Contact Sales',
    href: '/live-demo',
  },
]

const compareRows = [
  { feature: 'Customer limit', values: ['500', '5,000', 'Unlimited'] },
  { feature: 'Compliance packs', values: ['1 pack', '3 packs', 'All packs'] },
  { feature: 'KYC verification', values: ['✓', '✓', '✓'] },
  { feature: 'KYB verification', values: ['✗', '✓', '✓'] },
  { feature: 'Sanctions & PEP screening', values: ['✓', '✓', '✓'] },
  { feature: 'Transaction monitoring', values: ['Basic', 'Advanced', 'Advanced'] },
  { feature: 'IFTI reporting', values: ['✗', '✓', '✓'] },
  { feature: 'SMR & TTR reporting', values: ['✓', '✓', '✓'] },
  { feature: 'Case management', values: ['✗', '✓', '✓'] },
  { feature: 'Workflow automation', values: ['✗', '✓', '✓'] },
  { feature: 'Reporting groups', values: ['✗', '✗', '✓'] },
  { feature: 'White label', values: ['✗', '✗', '✓'] },
  { feature: 'API access', values: ['✗', '✗', '✓'] },
  { feature: 'Support', values: ['Email', 'Priority', 'Dedicated'] },
]

export default function PricingPage() {
  return (
    <div className="bg-white text-slate-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <span className="pub-label mb-6 block w-fit mx-auto">Pricing</span>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 leading-tight tracking-tight mb-6">
            Simple, transparent pricing.<br />
            <span className="text-blue-600">Start free for 7 days.</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-xl mx-auto">
            No credit card required for trial. Cancel anytime. All plans include Australian data sovereignty and AUSTRAC-aligned controls.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="pub-section">
        <div className="pub-container">

          {/* Free Trial Banner */}
          <div className="bg-blue-600 rounded-2xl p-8 mb-12 text-center text-white">
            <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1 text-sm font-semibold mb-4">
              🎉 No credit card required
            </div>
            <h2 className="text-3xl font-black mb-3">Try Verigo free for 7 days</h2>
            <p className="text-blue-100 text-lg mb-6 max-w-xl mx-auto">Full access to every feature. All compliance packs. Set up in under 10 minutes.</p>
            <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-blue-600 hover:bg-blue-50 transition-colors">
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <div className="flex flex-wrap justify-center gap-6 mt-6 text-sm text-blue-200">
              {['7 days full access', 'All industry packs', 'No credit card', 'Cancel anytime'].map(t => (
                <span key={t} className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4" />{t}</span>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {plans.map(plan => (
              <div
                key={plan.name}
                className={`pub-card flex flex-col ${plan.highlight ? 'ring-2 ring-blue-600 shadow-lg shadow-blue-600/10' : ''}`}
              >
                {plan.badge && (
                  <div className="mb-4">
                    <span className="inline-flex items-center rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">{plan.badge}</span>
                  </div>
                )}
                <h2 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h2>
                <p className="text-slate-500 text-sm mb-5">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-black text-slate-900">{plan.price}</span>
                  <span className="text-slate-400">{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f.label} className={`flex items-start gap-2 text-sm ${f.included ? 'text-slate-700' : 'text-slate-300'}`}>
                      {f.included
                        ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        : <X className="w-4 h-4 text-slate-200 flex-shrink-0 mt-0.5" />
                      }
                      {f.label}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors w-full justify-center ${plan.highlight ? 'pub-btn-primary' : 'pub-btn-secondary'}`}
                >
                  {plan.cta} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>

          {/* What's included */}
          <div className="pub-card mb-16 text-center">
            <h3 className="text-2xl font-bold text-slate-900 mb-6">All plans include</h3>
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-slate-600">
              {[
                'Australian data hosting',
                '99.9% uptime SLA',
                'AUSTRAC-aligned templates',
                'SOC 2 ready controls',
                'Onboarding support',
                'Regular compliance updates',
              ].map(f => (
                <span key={f} className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> {f}
                </span>
              ))}
            </div>
          </div>

          {/* Compare plans table */}
          <div>
            <h2 className="text-3xl font-black text-slate-900 mb-8 text-center">Compare plans</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 pr-8 text-sm font-semibold text-slate-500 w-1/3">Feature</th>
                    {plans.map(p => (
                      <th key={p.name} className={`py-3 px-4 text-sm font-bold text-center ${p.highlight ? 'text-blue-600' : 'text-slate-900'}`}>
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row, i) => (
                    <tr key={row.feature} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                      <td className="py-3 pr-8 text-sm text-slate-600 font-medium">{row.feature}</td>
                      {row.values.map((val, vi) => (
                        <td key={vi} className={`py-3 px-4 text-sm text-center ${plans[vi].highlight ? 'font-semibold' : ''} ${val === '✓' ? 'text-green-600' : val === '✗' ? 'text-slate-200' : 'text-slate-700'}`}>
                          {val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ / CTA */}
      <section className="pub-section bg-slate-900">
        <div className="pub-container text-center">
          <h2 className="text-4xl font-black text-white mb-4">Ready to start compliant?</h2>
          <p className="text-slate-400 text-xl mb-10">
            7-day free trial. No credit card. Full access to all features.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/live-demo" className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-8 py-4 text-base font-semibold text-white ring-1 ring-slate-700 hover:bg-slate-700 transition-colors">
              Talk to Sales
            </Link>
          </div>
          <p className="text-slate-500 text-sm">
            Questions about pricing?{' '}
            <Link href="/live-demo" className="text-slate-400 underline hover:text-slate-300">Book a demo</Link>{' '}
            and we&apos;ll walk you through the right plan for your business.
          </p>
        </div>
      </section>
    </div>
  )
}
