import Link from 'next/link'
import { ArrowRight, Code2, Database, Zap, Globe, CheckCircle, Shield, Building2, Users } from 'lucide-react'

export const metadata = {
  title: 'API & Integrations | Verigo',
  description: 'Connect VeriGo to your existing CRM, identity verification, AML screening, and document storage stack. Pre-built integrations for GreenID, Sumsub, ComplyAdvantage, Zoho CRM, HubSpot, CreditorWatch, and more.',
}

const categories = [
  {
    icon: Shield,
    label: 'Identity Verification',
    color: 'bg-blue-50 text-blue-600',
    integrations: [
      {
        name: 'GreenID (Equifax)',
        tag: 'Popular',
        tagColor: 'bg-green-50 text-green-700 ring-green-700/10',
        desc: 'Australia\'s most widely used electronic identity verification service. DVS-connected verification of Australian passports, driver licences, Medicare cards, and birth certificates — integrated directly into VeriGo\'s KYC workflow.',
        uses: ['Individual KYC for Australian customers', 'Address and identity document verification', 'Electronic identity check without physical document handling'],
      },
      {
        name: 'Sumsub',
        tag: 'Global',
        tagColor: 'bg-blue-50 text-blue-700 ring-blue-700/10',
        desc: 'Global KYC/KYB platform combining document capture, facial biometrics, liveness detection, and database checks. Supports 6,000+ document types across 220+ countries. Ideal for businesses with international customers.',
        uses: ['Biometric identity verification', 'Cross-border customer onboarding', 'High-risk account enhanced verification'],
      },
      {
        name: 'Trulioo',
        tag: 'Global',
        tagColor: 'bg-blue-50 text-blue-700 ring-blue-700/10',
        desc: 'International identity network covering 195 countries. Programmatic identity verification using local data sources — useful for businesses with significant cross-border customer bases requiring verification in local jurisdictions.',
        uses: ['Foreign national identity verification', 'Cross-border customer onboarding', 'International market expansion'],
      },
      {
        name: 'Jumio',
        tag: 'AI-Powered',
        tagColor: 'bg-purple-50 text-purple-700 ring-purple-700/10',
        desc: 'AI-powered identity verification with integrated fraud detection signals. Real-time document authentication, face match, and liveness detection with fraud risk scoring fed directly into VeriGo\'s customer risk assessment.',
        uses: ['High-value account verification', 'Fraud prevention at onboarding', 'Enhanced due diligence support'],
      },
    ],
  },
  {
    icon: Database,
    label: 'AML & Sanctions Screening',
    color: 'bg-red-50 text-red-600',
    integrations: [
      {
        name: 'ComplyAdvantage',
        tag: 'Popular',
        tagColor: 'bg-green-50 text-green-700 ring-green-700/10',
        desc: 'Real-time AML intelligence platform covering global sanctions lists, comprehensive PEP databases, and adverse media. Continuous monitoring with configurable alert thresholds — integrated into VeriGo\'s screening and ongoing monitoring workflows.',
        uses: ['Real-time sanctions screening at onboarding', 'PEP identification and EDD triggering', 'Ongoing customer monitoring against list updates'],
      },
      {
        name: 'Refinitiv World-Check',
        tag: 'Enterprise',
        tagColor: 'bg-slate-100 text-slate-700 ring-slate-700/10',
        desc: 'Comprehensive risk intelligence database used by global financial institutions. Extensive PEP and sanctions coverage with particularly strong APAC data — including domestic Australian PEPs and politically exposed persons across the Asia-Pacific region.',
        uses: ['Institutional-grade PEP screening', 'High-risk customer due diligence', 'Correspondent banking relationship assessment'],
      },
      {
        name: 'Dow Jones Risk & Compliance',
        tag: 'Enterprise',
        tagColor: 'bg-slate-100 text-slate-700 ring-slate-700/10',
        desc: 'Enterprise risk intelligence platform combining structured sanctions and PEP data with news analytics and adverse media. Used by major financial institutions for enhanced due diligence on high-risk corporate customers and complex ownership structures.',
        uses: ['Enhanced due diligence for complex corporate structures', 'High-risk relationship management', 'Adverse media combined with sanctions screening'],
      },
    ],
  },
  {
    icon: Building2,
    label: 'Business Verification (KYB)',
    color: 'bg-amber-50 text-amber-600',
    integrations: [
      {
        name: 'CreditorWatch',
        tag: 'Australian',
        tagColor: 'bg-green-50 text-green-700 ring-green-700/10',
        desc: 'Australian business intelligence combining real-time ASIC data, credit risk indicators, court actions, payment defaults, and directorship information. VeriGo uses CreditorWatch to automate the Australian company verification step of KYB — extracting company details, directors, and registered addresses programmatically.',
        uses: ['Australian Pty Ltd and company KYB', 'Director and officer verification', 'Business credit risk assessment alongside AML CDD'],
      },
    ],
  },
  {
    icon: Users,
    label: 'CRM & Business Systems',
    color: 'bg-indigo-50 text-indigo-600',
    integrations: [
      {
        name: 'Zoho CRM',
        tag: 'Available',
        tagColor: 'bg-blue-50 text-blue-700 ring-blue-700/10',
        desc: 'Sync customer records between Zoho CRM and VeriGo. Trigger KYC and compliance onboarding workflows automatically when new contacts are created or converted in Zoho. Push verification status, risk ratings, and compliance flags back to Zoho customer records.',
        uses: ['CRM-driven compliance onboarding', 'Verification status visibility in CRM', 'Compliance task creation from CRM events'],
      },
      {
        name: 'HubSpot',
        tag: 'Available',
        tagColor: 'bg-blue-50 text-blue-700 ring-blue-700/10',
        desc: 'Connect HubSpot\'s deal pipeline to VeriGo compliance workflows. Automatically initiate KYC when deals progress to defined stages. Ideal for professional services firms where the client onboarding process is managed through HubSpot before the compliance workflow begins.',
        uses: ['Pipeline-triggered compliance onboarding', 'Deal stage compliance gating', 'Verification status in HubSpot contact records'],
      },
      {
        name: 'Salesforce',
        tag: 'Enterprise',
        tagColor: 'bg-slate-100 text-slate-700 ring-slate-700/10',
        desc: 'Bidirectional enterprise CRM integration for organisations with Salesforce as their system of record. Customer data, verification status, risk ratings, and compliance flags are synchronised in real time. Custom field mapping supports complex enterprise data models.',
        uses: ['Enterprise CRM compliance integration', 'Real-time risk rating sync', 'Custom compliance workflow triggers from Salesforce events'],
      },
      {
        name: 'Monday.com',
        tag: 'Available',
        tagColor: 'bg-blue-50 text-blue-700 ring-blue-700/10',
        desc: 'Task and project management integration for compliance teams using Monday.com. VeriGo compliance tasks, case management actions, and periodic review assignments surface as Monday items. Status updates in Monday are reflected in VeriGo workflows.',
        uses: ['Compliance task management in Monday', 'Case management action tracking', 'Periodic review scheduling and assignment'],
      },
    ],
  },
  {
    icon: Globe,
    label: 'Document Storage',
    color: 'bg-emerald-50 text-emerald-600',
    integrations: [
      {
        name: 'Google Drive',
        tag: 'Available',
        tagColor: 'bg-blue-50 text-blue-700 ring-blue-700/10',
        desc: 'Store compliance documents directly in your Google Workspace environment. When customer-owned storage is enabled, VeriGo stores and retrieves identity documents, KYC records, and case evidence in your Google Drive — not in VeriGo\'s own storage.',
        uses: ['Customer-owned document storage', 'Google Workspace organisations', 'Compliance document organisation in Drive folders'],
      },
      {
        name: 'Microsoft OneDrive / SharePoint',
        tag: 'Enterprise',
        tagColor: 'bg-slate-100 text-slate-700 ring-slate-700/10',
        desc: 'Enterprise document management for Microsoft 365 organisations. Full SharePoint integration supports governance-grade document management with version control, retention policies, and audit logging aligned to your organisation\'s document governance framework.',
        uses: ['Microsoft 365 organisations', 'Enterprise document governance', 'SharePoint document library compliance storage'],
      },
      {
        name: 'Dropbox Business',
        tag: 'Available',
        tagColor: 'bg-blue-50 text-blue-700 ring-blue-700/10',
        desc: 'Sync compliance documents to Dropbox for teams using Dropbox as their primary document repository. VeriGo writes customer identity documents and compliance records to configured Dropbox folders — keeping your compliance data in your own environment.',
        uses: ['Dropbox-first organisations', 'Customer-owned storage for compliance records', 'Team document sharing for compliance reviews'],
      },
    ],
  },
]

const freeConnectors = [
  { name: 'DFAT Consolidated Sanctions List', desc: 'Australian Department of Foreign Affairs and Trade — mandatory for all Australian reporting entities' },
  { name: 'OFAC SDN List', desc: 'US Treasury Office of Foreign Assets Control Specially Designated Nationals — global standard' },
  { name: 'UN Security Council Sanctions', desc: 'United Nations consolidated sanctions list implemented in Australian law' },
  { name: 'EU Consolidated Sanctions', desc: 'European Union financial sanctions list — important for businesses with EU-connected customers' },
  { name: 'UK OFSI Sanctions', desc: "UK Office of Financial Sanctions Implementation — post-Brexit UK autonomous sanctions list" },
  { name: 'ABR Lookup (ABN)', desc: 'Australian Business Register — ABN and ACN verification for business customers' },
  { name: 'ASIC Connect', desc: 'ASIC company and officer search — automated company extract for KYB verification' },
]

export default function APIIntegrationsPage() {
  return (
    <div className="bg-white text-slate-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <span className="pub-label mb-6 block w-fit mx-auto">API & Integrations</span>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 leading-tight tracking-tight mb-6">
            Connect VeriGo to the<br />tools you already use.
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-8">
            VeriGo&apos;s open API and pre-built integrations plug compliance into your existing identity
            verification, CRM, AML screening, and document management stack — without rebuilding your workflows.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/start-trial" className="pub-btn-lg">Start Free Trial <ArrowRight className="w-5 h-5" /></Link>
            <Link href="/live-demo" className="pub-btn-secondary-lg">See Integrations in Demo</Link>
          </div>
        </div>
      </section>

      {/* REST API */}
      <section className="pub-section bg-white">
        <div className="pub-container">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <span className="pub-label mb-4 block w-fit">REST API</span>
              <h2 className="text-3xl font-black text-slate-900 mb-4">Full programmatic access to every VeriGo module.</h2>
              <p className="text-slate-600 leading-relaxed mb-6">
                VeriGo provides a RESTful API with complete CRUD operations on customers, transactions, cases, and
                reports. Build automated compliance workflows, integrate VeriGo into your existing systems, or
                develop custom reporting dashboards.
              </p>
              <ul className="space-y-3">
                {[
                  'JSON REST API with OpenAPI 3.0 specification',
                  'Webhook event delivery for real-time notifications',
                  'Bearer token authentication with scoped API keys',
                  'Rate limiting and usage metering per plan',
                  'Full API access on Professional and Enterprise plans',
                  'SDKs: Python, Node.js (roadmap)',
                ].map(f => (
                  <li key={f} className="flex items-start gap-3 text-sm text-slate-700">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-900 rounded-2xl p-6 font-mono text-sm">
              <div className="text-slate-500 mb-3 text-xs">// POST /api/v1/customers</div>
              <pre className="text-green-400 text-xs leading-relaxed overflow-x-auto">{`{
  "full_name": "Jane Smith",
  "date_of_birth": "1985-03-15",
  "nationality": "AU",
  "id_type": "passport",
  "id_number": "PA1234567",
  "industry": "digital_currency_exchange"
}`}</pre>
              <div className="border-t border-slate-700 mt-4 pt-4 text-slate-500 text-xs mb-2">// Response</div>
              <pre className="text-blue-400 text-xs leading-relaxed">{`{
  "customer_id": "CUST-A3F8C92D",
  "status": "pending_verification",
  "risk_level": "low",
  "risk_score": 15.0,
  "screening": {
    "sanctions": "clear",
    "pep": "clear"
  }
}`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Free connectors */}
      <section className="pub-section bg-slate-50">
        <div className="pub-container">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-2xl font-black text-slate-900">Included watchlist connectors</h2>
            <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-700/10">Included on all plans</span>
          </div>
          <p className="text-slate-600 mb-8 max-w-2xl">
            The following sanctions and regulatory databases are pre-integrated and included on every VeriGo plan at no additional cost.
            Australian reporting entities are legally required to screen against the DFAT Consolidated List as a minimum.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {freeConnectors.map(c => (
              <div key={c.name} className="pub-card flex items-start gap-4">
                <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm mb-0.5">{c.name}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration catalogue */}
      <section className="pub-section bg-white">
        <div className="pub-container">
          <div className="text-center mb-16">
            <span className="pub-label mb-4 block w-fit mx-auto">Integration Catalogue</span>
            <h2 className="text-4xl font-black text-slate-900 mb-4">Premium integrations for every part of your stack.</h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              Bring your own vendor contracts. VeriGo acts as the orchestration layer — connecting your preferred
              providers into a single compliant workflow.
            </p>
          </div>

          <div className="space-y-20">
            {categories.map(cat => (
              <div key={cat.label}>
                <div className="flex items-center gap-3 mb-8">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cat.color}`}>
                    <cat.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">{cat.label}</h3>
                </div>
                <div className="grid md:grid-cols-2 gap-5">
                  {cat.integrations.map(intg => (
                    <div key={intg.name} className="pub-card flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-4">
                        <h4 className="font-bold text-slate-900">{intg.name}</h4>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset flex-shrink-0 ${intg.tagColor}`}>
                          {intg.tag}
                        </span>
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed">{intg.desc}</p>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Use cases</p>
                        <ul className="space-y-1.5">
                          {intg.uses.map(u => (
                            <li key={u} className="flex items-start gap-2 text-xs text-slate-600">
                              <CheckCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" /> {u}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Address validation */}
      <section className="pub-section bg-slate-50">
        <div className="pub-container">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="pub-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
                  <Globe className="w-4 h-4 text-slate-600" />
                </div>
                <h3 className="font-bold text-slate-900">Loqate Address Validation</h3>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-700/10">Add-on</span>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Global address validation and geocoding covering 250+ countries. Verify and standardise customer
                addresses in real time during onboarding — reducing data entry errors and improving the quality
                of customer identification records.
              </p>
              <ul className="space-y-1.5">
                {['Real-time address autocomplete during KYC', 'Address standardisation for AUSTRAC reporting', 'High-risk jurisdiction flag from address data'].map(u => (
                  <li key={u} className="flex items-start gap-2 text-xs text-slate-600">
                    <CheckCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" /> {u}
                  </li>
                ))}
              </ul>
            </div>

            <div className="pub-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center">
                  <Code2 className="w-4 h-4 text-slate-600" />
                </div>
                <h3 className="font-bold text-slate-900">Don&apos;t see your provider?</h3>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                VeriGo&apos;s open API and webhook architecture supports custom integrations with any provider.
                If you have an existing contract with a verification or screening provider not listed here,
                contact our team to discuss a custom connector.
              </p>
              <p className="text-slate-600 text-sm leading-relaxed mb-5">
                Enterprise customers receive dedicated integration support as part of their onboarding
                engagement.
              </p>
              <Link href="/contact" className="pub-btn-secondary text-sm">
                Discuss a custom integration
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pub-section bg-slate-900">
        <div className="pub-container text-center">
          <h2 className="text-4xl font-black text-white mb-4">Start integrating today.</h2>
          <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
            API access is included on Professional and Enterprise plans. Start a free 7-day trial and explore the API documentation.
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
