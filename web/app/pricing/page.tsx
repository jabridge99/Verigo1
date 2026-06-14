import Link from 'next/link'
import { CheckCircle, X, ArrowRight, Shield, Zap, Database, Minus, Info } from 'lucide-react'

export const metadata = {
  title: 'Pricing | Verigo',
  description: 'Simple, transparent annual pricing for Australian regulated businesses. Start with a 7-day free trial.',
}

const plans = [
  {
    name: 'Free Trial',
    price: 'Free',
    period: '',
    billing: '',
    badge: null,
    description: '7 days full access. No credit card required.',
    highlight: false,
    features: [
      { label: 'Full platform access for 7 days', included: true },
      { label: '1 industry compliance pack (your sector)', included: true },
      { label: 'KYC identity verification', included: true },
      { label: 'KYB business verification', included: true },
      { label: 'AML/CTF Program — basic reference template', included: true, note: true },
      { label: 'IFTI IN & OUT reporting', included: true },
      { label: 'SMR & TTR reporting', included: true },
      { label: 'Transaction monitoring', included: true },
      { label: 'Email support during trial', included: true },
    ],
    cta: 'Start Free Trial',
    href: '/start-trial',
  },
  {
    name: 'Essential',
    price: '$299',
    period: '/year',
    billing: 'Billed annually',
    badge: null,
    description: 'For small reporting entities building their first AML/CTF programme.',
    highlight: false,
    features: [
      { label: 'Up to 500 customers', included: true },
      { label: '1 industry compliance pack', included: true },
      { label: 'KYC identity verification', included: true },
      { label: 'KYB business verification', included: true },
      { label: 'AML/CTF Program — basic reference template', included: true, note: true },
      { label: 'IFTI IN, OUT & bulk import', included: true },
      { label: 'SMR & TTR reporting', included: true },
      { label: 'Basic transaction monitoring', included: true },
      { label: 'Sanctions & PEP screening', included: false },
      { label: 'Adverse media screening', included: false },
      { label: 'Case management', included: false },
      { label: 'Workflow automation', included: false },
      { label: 'API access', included: false },
    ],
    cta: 'Start Free Trial',
    href: '/start-trial',
  },
  {
    name: 'Professional',
    price: '$799',
    period: '/year',
    billing: 'Billed annually',
    badge: 'Most Popular',
    description: 'For growing compliance teams with full AUSTRAC reporting obligations.',
    highlight: true,
    features: [
      { label: 'Up to 5,000 customers', included: true },
      { label: '1 industry compliance pack', included: true },
      { label: 'KYC + KYB verification', included: true },
      { label: 'AML/CTF Program — basic reference template', included: true, note: true },
      { label: 'IFTI IN, OUT & bulk import', included: true },
      { label: 'SMR & TTR reporting', included: true },
      { label: 'Sanctions, PEP + adverse media', included: true },
      { label: 'Advanced transaction monitoring', included: true },
      { label: 'EDD workflows', included: true },
      { label: 'Case management', included: true },
      { label: 'Reporting Hub (consolidated)', included: true },
      { label: 'Workflow automation', included: true },
      { label: 'API access', included: true },
    ],
    cta: 'Start Free Trial',
    href: '/start-trial',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    billing: 'Tailored to your organisation',
    badge: null,
    description: 'For reporting groups, financial institutions, and SaaS resellers.',
    highlight: false,
    features: [
      { label: 'Unlimited customers', included: true },
      { label: 'All compliance packs', included: true },
      { label: 'KYC, KYB + beneficial ownership', included: true },
      { label: 'AML/CTF Program — tailored to your industry', included: true },
      { label: 'Full IFTI, SMR, TTR suite', included: true },
      { label: 'Premium data connectors (BYO keys)', included: true },
      { label: 'Reporting groups (multi-entity)', included: true },
      { label: 'White label branding', included: true },
      { label: 'Dedicated compliance support', included: true },
      { label: 'Full REST API access', included: true },
      { label: 'SLA guarantee', included: true },
    ],
    cta: 'Contact Sales',
    href: '/live-demo',
  },
]

type CellValue = true | false | string

const compareGroups: { group: string; rows: { feature: string; tooltip?: string; values: CellValue[] }[] }[] = [
  {
    group: 'Platform',
    rows: [
      { feature: 'Customer limit', values: ['Trial only', '500', '5,000', 'Unlimited'] },
      { feature: 'Industry compliance packs', values: ['1 pack (trial)', '1 pack', '1 pack', 'All packs'] },
      { feature: 'AML/CTF Program', tooltip: 'Basic reference template preloaded. Tailoring to your specific business is an additional service.', values: ['Reference only', 'Reference only', 'Reference only', 'Tailored'] },
      { feature: 'Annual review workflow', values: [true, true, true, true] },
    ],
  },
  {
    group: 'Customer Verification',
    rows: [
      { feature: 'KYC — identity verification', values: [true, true, true, true] },
      { feature: 'KYB — business verification', values: [true, true, true, true] },
      { feature: 'Beneficial ownership mapping', values: [true, true, true, true] },
      { feature: 'Enhanced due diligence (EDD)', values: [true, false, true, true] },
      { feature: 'Ongoing periodic re-verification', values: [true, true, true, true] },
    ],
  },
  {
    group: 'Screening',
    rows: [
      { feature: 'Sanctions screening (OFAC, UN, EU, DFAT, UK HMT)', values: [true, false, true, true] },
      { feature: 'PEP screening', values: [true, false, true, true] },
      { feature: 'Adverse media monitoring', values: [true, false, true, true] },
    ],
  },
  {
    group: 'Transaction Monitoring',
    rows: [
      { feature: 'Transaction monitoring rules', values: [true, 'Basic', 'Advanced', 'Advanced'] },
      { feature: 'Structuring & velocity detection', values: [true, false, true, true] },
      { feature: 'High-risk jurisdiction flags', values: [true, false, true, true] },
    ],
  },
  {
    group: 'AUSTRAC Reporting',
    rows: [
      { feature: 'IFTI IN & OUT reporting', values: [true, true, true, true] },
      { feature: 'IFTI bulk import', values: [true, true, true, true] },
      { feature: 'SMR reporting', values: [true, true, true, true] },
      { feature: 'TTR reporting', values: [true, true, true, true] },
      { feature: 'Report review & MLRO sign-off', values: [true, true, true, true] },
    ],
  },
  {
    group: 'Case Management & Automation',
    rows: [
      { feature: 'Case management & investigation', values: [true, false, true, true] },
      { feature: 'No-code workflow automation', values: [true, false, true, true] },
      { feature: 'Reporting groups (multi-entity)', values: [true, false, false, true] },
      { feature: 'White label branding', values: [false, false, false, true] },
      { feature: 'REST API access', values: [false, false, true, true] },
    ],
  },
  {
    group: 'Support & Infrastructure',
    rows: [
      { feature: 'Australian data hosting', values: [true, true, true, true] },
      { feature: 'AES-256 encryption', values: [true, true, true, true] },
      { feature: '99.9% uptime SLA', values: [true, true, true, true] },
      { feature: 'Support level', values: ['Email (trial)', 'Email', 'Priority', 'Dedicated'] },
    ],
  },
]

const highlights = [
  { icon: Shield, title: 'Australian data hosting', desc: 'All data stored in Australian AWS regions. No offshore data transfer.' },
  { icon: Database, title: 'AUSTRAC-aligned templates', desc: 'SMR, IFTI, and TTR templates built to AUSTRAC specifications.' },
  { icon: Zap, title: 'Regular compliance updates', desc: 'Platform updated as AUSTRAC guidance and legislation evolves.' },
]

function CellDisplay({ value, highlight }: { value: CellValue; highlight: boolean }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 mx-auto">
        <CheckCircle className="w-4 h-4 text-green-600" />
      </span>
    )
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 mx-auto">
        <Minus className="w-3.5 h-3.5 text-slate-300" />
      </span>
    )
  }
  // String — label value like 'Advanced', 'Custom', 'Priority'
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
      highlight
        ? 'text-blue-700 bg-blue-100'
        : 'text-slate-700 bg-slate-100'
    }`}>
      {value}
    </span>
  )
}

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
          <p className="text-xl text-slate-600 max-w-xl mx-auto mb-4">
            Annual plans. No hidden fees. All plans include IFTI reporting, SMR/TTR generation, and Australian data sovereignty.
          </p>
          <p className="text-sm text-slate-400">No credit card required for trial. Cancel anytime.</p>
        </div>
      </section>

      {/* Plans */}
      <section className="pub-section pt-8">
        <div className="pub-container">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
            {plans.map(plan => (
              <div
                key={plan.name}
                className={`flex flex-col rounded-2xl p-8 ring-1 ${plan.highlight ? 'ring-blue-500 shadow-lg shadow-blue-100 bg-blue-50' : 'ring-slate-200 bg-white shadow-sm'}`}
              >
                {plan.badge && (
                  <div className="mb-4">
                    <span className="inline-flex items-center rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">{plan.badge}</span>
                  </div>
                )}
                <h2 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h2>
                <p className="text-slate-500 text-sm mb-5">{plan.description}</p>
                <div className="mb-1">
                  <span className="text-4xl font-black text-slate-900">{plan.price}</span>
                  <span className="text-slate-400 text-lg">{plan.period}</span>
                </div>
                {plan.billing && (
                  <p className="text-xs text-slate-400 mb-6">{plan.billing}</p>
                )}
                {!plan.billing && <div className="mb-6" />}
                <ul className="space-y-2 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f.label} className={`flex items-start gap-2 text-sm ${f.included ? 'text-slate-700' : 'text-slate-300'}`}>
                      {f.included
                        ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        : <X className="w-4 h-4 text-slate-200 flex-shrink-0 mt-0.5" />
                      }
                      <span>
                        {f.label}
                        {'note' in f && f.note && (
                          <span className="ml-1 text-xs text-amber-600 font-medium">†</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors ${plan.highlight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                >
                  {plan.cta} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>

          {/* AML program note */}
          <div className="flex items-start gap-3 bg-amber-50 ring-1 ring-amber-200 rounded-2xl px-5 py-4 mb-8">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-amber-800 text-sm leading-relaxed">
              <span className="font-semibold">† AML/CTF Program — basic reference template only.</span>{' '}
              Every Essential and Professional plan includes a preloaded industry reference template to help you get started.
              Each business must tailor its own AML/CTF Program to reflect its specific operations, customer types, and risk profile.
              Program tailoring and review services are available as an additional engagement — <Link href="/live-demo" className="underline hover:text-amber-900">contact us</Link> to discuss.
            </p>
          </div>

          {/* Platform highlights */}
          <div className="grid md:grid-cols-3 gap-5 mb-16">
            {highlights.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4 pub-card">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm mb-1">{title}</h4>
                  <p className="text-slate-500 text-sm">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Compare plans table */}
          <div>
            <h2 className="text-3xl font-black text-slate-900 mb-2 text-center">Compare plans</h2>
            <p className="text-slate-500 text-center mb-10">Every feature, every plan — side by side.</p>

            <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-200 shadow-sm">
              <table className="w-full border-collapse min-w-[640px]">

                {/* Sticky header */}
                <thead className="sticky top-0 z-10">
                  <tr className="bg-white border-b-2 border-slate-200">
                    <th className="text-left py-5 px-6 text-sm font-semibold text-slate-400 w-2/5">Feature</th>
                    {plans.map(p => (
                      <th
                        key={p.name}
                        className={`py-5 px-4 text-center w-[15%] ${p.highlight ? 'bg-blue-50' : 'bg-white'}`}
                      >
                        <div className={`text-base font-black ${p.highlight ? 'text-blue-600' : 'text-slate-900'}`}>{p.name}</div>
                        {p.price !== 'Free' && p.price !== 'Custom' && (
                          <div className="text-sm font-semibold text-slate-700 mt-0.5">{p.price}<span className="text-xs text-slate-400 font-normal">{p.period}</span></div>
                        )}
                        {p.price === 'Free' && <div className="text-sm text-slate-400 font-normal mt-0.5">7 days</div>}
                        {p.price === 'Custom' && <div className="text-sm text-slate-400 font-normal mt-0.5">Tailored</div>}
                        {p.badge && (
                          <div className="mt-1.5">
                            <span className="inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">{p.badge}</span>
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {compareGroups.map((group, gi) => (
                    <>
                      {/* Category group header */}
                      <tr key={`group-${gi}`} className="bg-slate-50 border-y border-slate-200">
                        <td colSpan={5} className="py-2.5 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {group.group}
                        </td>
                      </tr>

                      {group.rows.map((row, ri) => (
                        <tr
                          key={`${gi}-${ri}`}
                          className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="py-3.5 px-6">
                            <span className="text-sm text-slate-700 font-medium">{row.feature}</span>
                            {row.tooltip && (
                              <span className="block text-xs text-slate-400 mt-0.5">{row.tooltip}</span>
                            )}
                          </td>
                          {row.values.map((val, vi) => (
                            <td
                              key={vi}
                              className={`py-3.5 px-4 text-center ${plans[vi].highlight ? 'bg-blue-50/40' : ''}`}
                            >
                              <CellDisplay value={val} highlight={plans[vi].highlight} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>

                {/* Footer CTA row */}
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="py-5 px-6 text-sm text-slate-500">Ready to get started?</td>
                    {plans.map(p => (
                      <td key={p.name} className={`py-5 px-4 text-center ${p.highlight ? 'bg-blue-50/40' : ''}`}>
                        <Link
                          href={p.href}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${p.highlight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                        >
                          {p.cta}
                        </Link>
                      </td>
                    ))}
                  </tr>
                </tfoot>

              </table>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pub-section bg-slate-900">
        <div className="pub-container text-center">
          <h2 className="text-4xl font-black text-white mb-4">Ready to start compliant?</h2>
          <p className="text-slate-400 text-xl mb-10">
            7-day free trial. No credit card. Full access to all features including IFTI, SMR, and TTR reporting.
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
