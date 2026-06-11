import Link from 'next/link'
import { CheckCircle, X, ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'Pricing | Trust Verify Go',
  description: 'Simple, transparent pricing for Australian regulated businesses. Start with a 7-day free trial.',
}

const plans = [
  {
    name: 'Starter', price: '$299', period: '/month',
    description: 'For small businesses beginning their compliance journey.',
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
      { label: 'No-code rule builder', included: false },
      { label: 'Multi-tenant / white label', included: false },
      { label: 'API access', included: false },
    ],
    cta: 'Start Free Trial', href: '/start-trial',
  },
  {
    name: 'Professional', price: '$799', period: '/month',
    description: 'For growing businesses with full AUSTRAC reporting obligations.',
    highlight: true,
    features: [
      { label: 'Up to 5,000 customers', included: true },
      { label: '3 industry compliance packs', included: true },
      { label: 'KYC + KYB verification', included: true },
      { label: 'Sanctions, PEP + adverse media', included: true },
      { label: 'Advanced transaction monitoring', included: true },
      { label: 'IFTI IN & OUT reporting', included: true },
      { label: 'SMR, TTR reporting', included: true },
      { label: 'Case management', included: true },
      { label: 'No-code rule builder', included: true },
      { label: 'Priority support', included: true },
      { label: 'Multi-tenant / white label', included: false },
      { label: 'Full API access', included: false },
    ],
    cta: 'Start Free Trial', href: '/start-trial',
  },
  {
    name: 'Enterprise', price: 'Custom', period: '',
    description: 'For reporting groups, financial institutions, and SaaS resellers.',
    highlight: false,
    features: [
      { label: 'Unlimited customers', included: true },
      { label: 'All compliance packs', included: true },
      { label: 'KYC, KYB + Beneficial ownership', included: true },
      { label: 'Premium data connectors (BYO keys)', included: true },
      { label: 'Full AUSTRAC reporting suite', included: true },
      { label: 'No-code rule builder', included: true },
      { label: 'Multi-tenant & white label', included: true },
      { label: 'Reporting groups', included: true },
      { label: 'Full REST API access', included: true },
      { label: 'Dedicated compliance support', included: true },
      { label: 'SLA guarantee', included: true },
    ],
    cta: 'Contact Sales', href: '/live-demo',
  },
]

export default function PricingPage() {
  return (
    <div className="section">
      <div className="container-xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-black mb-6">Simple, transparent pricing.<br /><span className="gradient-text">Start free for 7 days.</span></h1>
          <p className="text-white/60 text-xl max-w-xl mx-auto">No credit card required for trial. Cancel anytime. All plans include Australian data sovereignty and AUSTRAC-aligned controls.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {plans.map(plan => (
            <div key={plan.name} className={`card flex flex-col ${plan.highlight ? 'border-brand-600 glow ring-1 ring-brand-600/30' : ''}`}>
              {plan.highlight && <div className="text-center mb-4"><span className="badge bg-brand-600 text-white text-xs">Most Popular</span></div>}
              <h2 className="text-xl font-bold mb-1">{plan.name}</h2>
              <p className="text-white/50 text-sm mb-4">{plan.description}</p>
              <div className="mb-6"><span className="text-4xl font-black">{plan.price}</span><span className="text-white/50">{plan.period}</span></div>
              <ul className="space-y-2 mb-8 flex-1">
                {plan.features.map(f => (
                  <li key={f.label} className={`flex items-center gap-2 text-sm ${f.included ? 'text-white/80' : 'text-white/30'}`}>
                    {f.included ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" /> : <X className="w-4 h-4 text-white/20 flex-shrink-0" />}
                    {f.label}
                  </li>
                ))}
              </ul>
              <Link href={plan.href} className={plan.highlight ? 'btn-gold justify-center' : 'btn-secondary justify-center'}>
                {plan.cta} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
        <div className="card border-white/5 text-center">
          <h3 className="text-2xl font-bold mb-2">All plans include</h3>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 mt-6 text-sm text-white/70">
            {['Australian data hosting', '99.9% uptime SLA', 'SOC 2 ready controls', 'AUSTRAC-aligned templates', '7-day free trial', 'Onboarding support'].map(f => (
              <span key={f} className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> {f}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
