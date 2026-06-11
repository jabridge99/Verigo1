import { CheckCircle, ArrowRight, Code2, Globe, Database, Zap } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'API & Integrations | Trust Verify Go' }

const freeConnectors = [
  { name: 'DFAT Sanctions List', desc: 'Australian Department of Foreign Affairs and Trade consolidated list', tag: 'Free' },
  { name: 'OFAC SDN', desc: 'US Treasury Office of Foreign Assets Control Specially Designated Nationals', tag: 'Free' },
  { name: 'UN Security Council', desc: 'United Nations consolidated sanctions list', tag: 'Free' },
  { name: 'EU Consolidated List', desc: 'European Union financial sanctions list', tag: 'Free' },
  { name: 'UK HMT', desc: "UK His Majesty's Treasury financial sanctions", tag: 'Free' },
  { name: 'ABR Lookup', desc: 'Australian Business Register — ABN verification', tag: 'Free' },
  { name: 'ASIC Connect', desc: 'ASIC company and officer search integration', tag: 'Free' },
]

const premiumConnectors = [
  { name: 'ComplyAdvantage', desc: 'PEP, sanctions, adverse media — global coverage' },
  { name: 'CreditorWatch', desc: 'Australian business credit and risk intelligence' },
  { name: 'Trulioo', desc: 'Global identity verification and document check' },
  { name: 'Loqate', desc: 'Address validation and geocoding — 250+ countries' },
]

export default function APIPage() {
  return (
    <div className="section">
      <div className="container-xl mx-auto">
        <div className="text-center mb-16">
          <span className="badge bg-brand-900/50 text-brand-400 border border-brand-700/30 mb-4">API & Integrations</span>
          <h1 className="text-5xl font-black mb-6">Connect everything.<br /><span className="gradient-text">Automate compliance.</span></h1>
          <p className="text-white/60 text-xl max-w-2xl mx-auto">REST API, free watchlist connectors, premium data partners, and a connector marketplace — all designed to slot into your existing stack.</p>
        </div>
        <div className="card mb-12 border-brand-700/30 bg-brand-900/5">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex items-center gap-3 mb-4"><Code2 className="w-6 h-6 text-brand-400" /><h2 className="text-2xl font-bold">REST API</h2></div>
              <p className="text-white/60 mb-6 leading-relaxed">Full programmatic access to every Trust Verify Go module. Customer onboarding, KYC orchestration, transaction submission, report generation — all via API.</p>
              <ul className="space-y-2">
                {['JSON REST API', 'Webhook event delivery', 'Bearer token auth', 'Rate limiting and usage metering', 'OpenAPI 3.0 spec', 'SDKs: Python, Node.js (planned)'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/70"><CheckCircle className="w-4 h-4 text-green-400" /> {f}</li>
                ))}
              </ul>
            </div>
            <div className="bg-navy-900 rounded-xl p-5 font-mono text-sm">
              <div className="text-white/30 mb-3 text-xs">// POST /api/v1/customers</div>
              <pre className="text-green-400 text-xs leading-relaxed overflow-x-auto">{`{
  "full_name": "Jane Smith",
  "date_of_birth": "1985-03-15",
  "nationality": "AU",
  "id_type": "passport",
  "id_number": "PA1234567",
  "industry": "digital_currency_exchange"
}`}</pre>
              <div className="border-t border-white/10 mt-4 pt-3 text-white/30 text-xs">// Response</div>
              <pre className="text-brand-400 text-xs leading-relaxed">{`{
  "customer_id": "CUST-A3F8C92D",
  "status": "pending",
  "risk_level": "low",
  "risk_score": 15.0
}`}</pre>
            </div>
          </div>
        </div>
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3"><Globe className="w-6 h-6 text-green-400" />Free watchlist connectors</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {freeConnectors.map(c => (
              <div key={c.name} className="card flex items-start gap-4">
                <div className="w-10 h-10 bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0"><Database className="w-5 h-5 text-green-400" /></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{c.name}</h3>
                    <span className="badge bg-green-900/30 text-green-400 border border-green-700/30 text-xs">{c.tag}</span>
                  </div>
                  <p className="text-white/50 text-xs mt-1">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-3"><Zap className="w-6 h-6 text-amber-400" />Premium connector marketplace</h2>
          <p className="text-white/50 text-sm mb-6">Bring your own API keys. Pay your vendor directly. Trust Verify Go acts as the orchestration layer.</p>
          <div className="grid md:grid-cols-2 gap-4">
            {premiumConnectors.map(c => (
              <div key={c.name} className="card flex items-start gap-4">
                <div className="w-10 h-10 bg-amber-900/20 rounded-lg flex items-center justify-center flex-shrink-0"><Zap className="w-5 h-5 text-amber-400" /></div>
                <div><h3 className="font-semibold text-sm">{c.name}</h3><p className="text-white/50 text-xs mt-1">{c.desc}</p></div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-center">
          <Link href="/start-trial" className="btn-gold text-base px-10 py-4">Start Free Trial — Full API access <ArrowRight className="w-5 h-5" /></Link>
        </div>
      </div>
    </div>
  )
}
