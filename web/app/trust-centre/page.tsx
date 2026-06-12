import Link from 'next/link'
import { Lock, Shield, Users, Activity, Database, CheckCircle, ArrowRight, Key, Eye, FileText, Server } from 'lucide-react'

export const metadata = {
  title: 'Trust Centre | Verigo',
  description: 'VeriGo\'s security architecture, Australian data residency, access controls, audit logging, and compliance governance. Your customer data is protected to the highest standard.',
}

const securityFeatures = [
  {
    icon: Lock,
    title: 'AES-256 Encryption',
    color: 'bg-blue-50 text-blue-600',
    body: `All customer data stored in VeriGo is encrypted at rest using AES-256 — the same standard used by government agencies and financial institutions worldwide. All data in transit between your browser, the VeriGo application, and our data centres is protected with TLS 1.3.

Encryption keys are managed using hardware security modules (HSMs) and rotated on a regular schedule. Customer compliance data is never stored in plaintext at any point in the platform's data lifecycle.`,
  },
  {
    icon: Key,
    title: 'Multi-Factor Authentication',
    color: 'bg-purple-50 text-purple-600',
    body: `Multi-factor authentication is required for all VeriGo user accounts. Time-based one-time passwords (TOTP) via authenticator apps (Google Authenticator, Authy, Microsoft Authenticator) are supported. Hardware security key support is available for Enterprise accounts.

MFA cannot be disabled by individual users — it is enforced at the platform level as a baseline security control. This protects your compliance data even if a user's password is compromised.`,
  },
  {
    icon: Users,
    title: 'Role-Based Access Control',
    color: 'bg-indigo-50 text-indigo-600',
    body: `VeriGo implements granular role-based access control (RBAC) across all platform modules. Predefined roles include: Compliance Officer (full access), Reviewer (read and review, cannot approve), Administrator (user management, configuration), and Read-Only (reporting and audit access only).

Custom roles are available on Enterprise plans. Access is governed by the principle of least privilege — users see and interact with only the data and functions their role requires. All role assignments are logged and auditable.`,
  },
  {
    icon: Activity,
    title: 'Immutable Audit Logs',
    color: 'bg-amber-50 text-amber-600',
    body: `Every action taken in VeriGo — login, data access, record creation, modification, report generation, approval, rejection, and deletion — is logged with a timestamp, the user who performed the action, and the IP address from which it was performed.

Audit logs cannot be modified or deleted by any user, including administrators. They are retained for a minimum of 7 years in line with AML/CTF Act record-keeping requirements. Audit logs can be exported for internal audit, regulatory inspection, or external assurance review.`,
  },
  {
    icon: Database,
    title: 'Australian Data Residency',
    color: 'bg-emerald-50 text-emerald-600',
    body: `All VeriGo customer and compliance data is hosted in AWS data centres located in Sydney, Australia. No customer data is replicated, transferred, or processed outside of Australia. This commitment is contractually guaranteed in VeriGo's terms of service.

Australian data residency ensures compliance with the Australian Privacy Act 1988, the Privacy (Australian Government Agencies - Governance) APP Code, and the requirements of the AML/CTF Act for record retention on Australian soil.`,
  },
  {
    icon: Shield,
    title: 'SOC 2 Type II Roadmap',
    color: 'bg-slate-100 text-slate-600',
    body: `VeriGo is currently pursuing SOC 2 Type II certification. SOC 2 evaluates the design and operating effectiveness of controls across five Trust Service Criteria: Security, Availability, Processing Integrity, Confidentiality, and Privacy.

Enterprise customers can request VeriGo's current security posture documentation, including our security control framework and penetration testing results. We expect to complete the SOC 2 Type II audit in 2025.`,
  },
]

export default function TrustCentrePage() {
  return (
    <div className="bg-white text-slate-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <span className="pub-label mb-6 block w-fit mx-auto">Trust Centre</span>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 leading-tight tracking-tight mb-6">
            Security and privacy<br />built into every layer.
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-8">
            VeriGo is designed to protect the sensitive customer compliance data you hold on behalf of your
            AML/CTF obligations. Here&apos;s exactly how.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              'AES-256 Encryption',
              'Australian Data Hosting',
              'MFA Required',
              'Immutable Audit Logs',
              'SOC 2 Roadmap',
            ].map(b => (
              <span key={b} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" /> {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Security architecture */}
      <section className="pub-section bg-white">
        <div className="pub-container">
          <div className="text-center mb-14">
            <span className="pub-label mb-4 block w-fit mx-auto">Security Architecture</span>
            <h2 className="text-4xl font-black text-slate-900 mb-4">How we protect your data.</h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              Security is not an add-on — it&apos;s how VeriGo was architected from the first line of code.
              Compliance data is among the most sensitive information any business handles. We treat it accordingly.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {securityFeatures.map(({ icon: Icon, title, color, body }) => (
              <div key={title} className="pub-card">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg">{title}</h3>
                </div>
                <div className="space-y-3">
                  {body.split('\n\n').map((para, i) => (
                    <p key={i} className="text-slate-600 text-sm leading-relaxed">{para}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Customer-owned storage */}
      <section className="pub-section bg-slate-50">
        <div className="pub-container">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <span className="pub-label mb-4 block w-fit">Customer-Owned Storage</span>
              <h2 className="text-3xl font-black text-slate-900 mb-4">Your documents, in your environment.</h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                VeriGo supports customer-managed document storage. Rather than holding identity documents
                and compliance records in VeriGo&apos;s own infrastructure, you can connect your own Google Drive,
                Microsoft OneDrive, or SharePoint instance.
              </p>
              <p className="text-slate-600 leading-relaxed mb-4">
                When customer-owned storage is enabled, VeriGo stores and retrieves documents from your environment
                directly. VeriGo never holds your documents — we only hold the metadata (file names, upload dates,
                verification outcomes) required to operate compliance workflows.
              </p>
              <p className="text-slate-600 leading-relaxed mb-6">
                This architecture is particularly valued by financial institutions, law firms, and government-aligned
                organisations with strict data governance requirements.
              </p>
              <ul className="space-y-2">
                {['Google Drive (Google Workspace)', 'Microsoft OneDrive & SharePoint', 'Dropbox Business'].map(s => (
                  <li key={s} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="pub-label mb-4 block w-fit">Compliance Governance</span>
              <h2 className="text-3xl font-black text-slate-900 mb-4">We practice what we preach.</h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                VeriGo maintains its own AML/CTF Program as a reporting entity. We understand the obligations
                we help our customers meet from the inside — not just as software developers, but as practitioners
                who have read every AUSTRAC guidance note and tested our workflows against the AML/CTF Rules.
              </p>
              <p className="text-slate-600 leading-relaxed mb-4">
                Our compliance team conducts an annual independent audit of our own AML/CTF Program. We apply
                the same risk-based approach to our own customer due diligence that we build into the platform.
              </p>
              <p className="text-slate-600 leading-relaxed">
                This means when AUSTRAC guidance changes, we understand the operational implications for our
                customers before anyone else — and we update the platform accordingly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="pub-section bg-white">
        <div className="pub-container">
          <div className="max-w-3xl mx-auto text-center">
            <span className="pub-label mb-4 block w-fit mx-auto">Privacy</span>
            <h2 className="text-3xl font-black text-slate-900 mb-6">Your data is yours. Full stop.</h2>
            <div className="grid md:grid-cols-3 gap-5 mb-10">
              {[
                { icon: Eye, title: 'No data selling', desc: 'VeriGo never sells, shares, or rents customer compliance data to any third party under any circumstances.' },
                { icon: FileText, title: 'Minimal data collection', desc: 'We collect only the data required to operate the platform. No marketing profiling, no behavioural analytics sold externally.' },
                { icon: Server, title: 'Australian Privacy Act', desc: 'VeriGo complies with the Australian Privacy Act 1988 and all Australian Privacy Principles (APPs) applicable to our operations.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="pub-card text-center">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Icon className="w-5 h-5 text-slate-600" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2 text-sm">{title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
            <p className="text-slate-500 text-sm mb-8">
              Our full Privacy Policy details exactly what data we collect, how we use it, how long we retain it,
              and your rights regarding your data. We update it when our practices change — not just when required by law.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="#" className="pub-btn-secondary">Read our Privacy Policy</Link>
              <Link href="/contact" className="pub-btn-primary">
                Questions? Contact our team <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
