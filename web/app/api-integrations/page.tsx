import Link from 'next/link'
import { ArrowRight, Database, Shield, Building2, Users, Globe, Code2 } from 'lucide-react'

export const metadata = {
  title: 'API & Integrations | Verigo',
  description: 'Connect VeriGo to your existing identity verification, AML screening, CRM, and document storage stack.',
}

const categories = [
  {
    icon: Shield,
    label: 'Identity Verification',
    color: 'bg-blue-50 text-blue-600',
    integrations: [
      { name: 'GreenID (Equifax)', tag: 'Popular', tagColor: 'bg-green-50 text-green-700 ring-green-700/10' },
      { name: 'Sumsub', tag: 'Global', tagColor: 'bg-blue-50 text-blue-700 ring-blue-700/10' },
      { name: 'Trulioo', tag: 'Global', tagColor: 'bg-blue-50 text-blue-700 ring-blue-700/10' },
      { name: 'Jumio', tag: 'AI-Powered', tagColor: 'bg-purple-50 text-purple-700 ring-purple-700/10' },
    ],
  },
  {
    icon: Database,
    label: 'AML & Sanctions Screening',
    color: 'bg-red-50 text-red-600',
    integrations: [
      { name: 'ComplyAdvantage', tag: 'Popular', tagColor: 'bg-green-50 text-green-700 ring-green-700/10' },
      { name: 'Refinitiv World-Check', tag: 'Enterprise', tagColor: 'bg-slate-100 text-slate-700 ring-slate-700/10' },
      { name: 'Dow Jones Risk & Compliance', tag: 'Enterprise', tagColor: 'bg-slate-100 text-slate-700 ring-slate-700/10' },
    ],
  },
  {
    icon: Building2,
    label: 'Business Verification (KYB)',
    color: 'bg-amber-50 text-amber-600',
    integrations: [
      { name: 'CreditorWatch', tag: 'Australian', tagColor: 'bg-green-50 text-green-700 ring-green-700/10' },
    ],
  },
  {
    icon: Users,
    label: 'CRM & Business Systems',
    color: 'bg-indigo-50 text-indigo-600',
    integrations: [
      { name: 'Zoho CRM', tag: 'Available', tagColor: 'bg-blue-50 text-blue-700 ring-blue-700/10' },
      { name: 'HubSpot', tag: 'Available', tagColor: 'bg-blue-50 text-blue-700 ring-blue-700/10' },
      { name: 'Salesforce', tag: 'Enterprise', tagColor: 'bg-slate-100 text-slate-700 ring-slate-700/10' },
      { name: 'Monday.com', tag: 'Available', tagColor: 'bg-blue-50 text-blue-700 ring-blue-700/10' },
    ],
  },
  {
    icon: Globe,
    label: 'Document Storage',
    color: 'bg-emerald-50 text-emerald-600',
    integrations: [
      { name: 'Google Drive', tag: 'Available', tagColor: 'bg-blue-50 text-blue-700 ring-blue-700/10' },
      { name: 'Microsoft OneDrive / SharePoint', tag: 'Enterprise', tagColor: 'bg-slate-100 text-slate-700 ring-slate-700/10' },
      { name: 'Dropbox Business', tag: 'Available', tagColor: 'bg-blue-50 text-blue-700 ring-blue-700/10' },
    ],
  },
]

const includedConnectors = [
  'DFAT Consolidated Sanctions List',
  'OFAC SDN List',
  'UN Security Council Sanctions',
  'EU Consolidated Sanctions',
  'UK OFSI Sanctions',
  'ABR Lookup (ABN)',
  'ASIC Connect',
]

export default function APIIntegrationsPage() {
  return (
    <div className="bg-white text-slate-900">

      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <span className="pub-label mb-6 block w-fit mx-auto">Integrations</span>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 leading-tight tracking-tight mb-6">
            Premium integrations for<br />every part of your stack.
          </h1>
          <p className="text-xl text-slate-600 max-w-xl mx-auto mb-8">
            Bring your own vendor contracts. VeriGo connects your preferred providers into one compliant workflow.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/start-trial" className="pub-btn-lg">Start Free Trial <ArrowRight className="w-5 h-5" /></Link>
            <Link href="/live-demo" className="pub-btn-secondary-lg">Book a Demo</Link>
          </div>
        </div>
      </section>

      {/* Included connectors */}
      <section className="pub-section bg-slate-50">
        <div className="pub-container">
          <div className="flex items-center gap-3 mb-8">
            <h2 className="text-2xl font-black text-slate-900">Included on all plans</h2>
            <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-700/10">No extra charge</span>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {includedConnectors.map(name => (
              <div key={name} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 ring-1 ring-slate-100">
                <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-3.5 h-3.5 text-green-600" />
                </div>
                <span className="text-sm font-medium text-slate-800">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration catalogue */}
      <section className="pub-section bg-white">
        <div className="pub-container">
          <div className="space-y-14">
            {categories.map(cat => (
              <div key={cat.label}>
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cat.color}`}>
                    <cat.icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">{cat.label}</h3>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cat.integrations.map(intg => (
                    <div key={intg.name} className="flex items-center justify-between gap-4 bg-slate-50 rounded-xl px-4 py-3.5 ring-1 ring-slate-100">
                      <span className="font-semibold text-slate-900 text-sm">{intg.name}</span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset flex-shrink-0 ${intg.tagColor}`}>
                        {intg.tag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Custom integration */}
      <section className="pub-section bg-slate-50">
        <div className="pub-container max-w-2xl mx-auto text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Code2 className="w-5 h-5 text-slate-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-3">Don&apos;t see your provider?</h2>
          <p className="text-slate-600 text-sm leading-relaxed mb-6">
            VeriGo supports custom integrations with any provider. Enterprise customers receive dedicated integration support as part of their onboarding.
          </p>
          <Link href="/contact" className="pub-btn-secondary inline-flex">
            Discuss a custom integration
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="pub-section bg-slate-900">
        <div className="pub-container text-center">
          <h2 className="text-4xl font-black text-white mb-4">Start connecting today.</h2>
          <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
            System integrations are available on Professional and Enterprise plans. Start a 7-day free trial to explore.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/live-demo" className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-8 py-4 text-base font-semibold text-white ring-1 ring-slate-700 hover:bg-slate-700 transition-colors">
              Book a Demo
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
