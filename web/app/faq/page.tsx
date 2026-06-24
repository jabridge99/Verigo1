import Link from 'next/link'
import { Shield, ArrowRight } from 'lucide-react'
import FAQAccordion, { type FAQItem } from './FAQAccordion'

export const metadata = {
  title: 'AML Compliance FAQ | Verigo',
  description: 'Answers to the most common questions about AML software, Australian compliance obligations, AUSTRAC reporting, and how VeriGo helps regulated businesses.',
}

const faqs: FAQItem[] = [
  {
    question: 'What is an AML solution?',
    answer: `An AML (Anti-Money Laundering) solution is software that helps regulated businesses meet their legal obligations to detect, prevent, and report money laundering and financial crime. It typically combines customer due diligence (KYC/KYB), sanctions and PEP screening, transaction monitoring, case management, and regulatory reporting into a single platform.

In Australia, AML solutions help businesses comply with the AML/CTF Act 2006 and report to AUSTRAC — the financial intelligence agency responsible for detecting and disrupting money laundering, terrorism financing, and other serious crimes.

A good AML solution replaces manual spreadsheets and disconnected processes with an integrated compliance operating system — so your team spends less time on administration and more time on decisions that matter.`,
  },
  {
    question: 'How can you improve your AML compliance?',
    answer: `Most compliance failures come from the same root causes: manual processes that are inconsistent, records scattered across email and spreadsheets, and teams with no visibility over what is due and what is overdue.

The most effective ways to improve AML compliance are:

1. **Automate customer onboarding and identity verification** — ensure every customer gets the same documented due diligence process, every time.
2. **Use real-time sanctions and PEP screening** — manual checks go stale. Automated screening catches what a one-time check misses.
3. **Implement transaction monitoring rules** — suspicious activity hides in volume. Automated rules catch patterns no analyst can spot manually.
4. **Maintain a living AML/CTF Program** — not a document in a drawer, but an active program that reflects how your business operates today.
5. **Use a purpose-built platform** — purpose-built AML software gives you an audit trail for every decision. When AUSTRAC asks to see your compliance record, you can respond in minutes, not days.

VeriGo is built specifically for Australian regulated businesses and pre-configures these controls for your industry from day one.`,
  },
  {
    question: 'What software does an AML analyst use?',
    answer: `AML analysts typically work across several tools — although the best-practice approach is to consolidate these into a single platform. Commonly used tools include:

- **Customer due diligence (CDD) platforms** for collecting and verifying customer identity documents, conducting KYC and KYB checks, and maintaining ongoing due diligence records.
- **Sanctions and watchlist screening tools** that check customers against global sanctions lists (OFAC, UN, EU, DFAT, UK HMT) and PEP databases.
- **Transaction monitoring systems** that apply rule-based logic to flag suspicious patterns — structuring, velocity anomalies, high-risk corridor activity.
- **Case management systems** to track suspicious matter investigations from alert to resolution.
- **Regulatory reporting tools** to prepare and submit AUSTRAC reports (SMR, IFTI, TTR) accurately and on time.

In practice, many compliance teams still rely on spreadsheets to fill gaps between these tools. VeriGo replaces all of these with a single integrated platform purpose-built for Australian AML obligations.`,
  },
  {
    question: 'What are the benefits of AML software?',
    answer: `The core benefits of AML software fall into three categories:

**Regulatory protection**
Every customer action, screening result, and compliance decision is automatically logged with a timestamp and the identity of who made it. If AUSTRAC audits your business, you can produce a complete compliance record in minutes — not days of manual reconstruction.

**Operational efficiency**
Automating KYC verification, sanctions screening, transaction monitoring, and report generation can reduce compliance administration time by 60% or more. Your team focuses on complex judgement calls, not data entry.

**Consistency**
Manual processes produce inconsistent outcomes — different staff apply different standards. AML software applies the same rule to every customer, every transaction, every time. This reduces regulatory risk and removes the compliance gaps that create findings.

For Australian businesses facing AUSTRAC obligations, AML software is increasingly a practical necessity rather than a luxury — particularly with the Tranche 2 reforms bringing new sectors into scope from 1 July 2026.`,
  },
  {
    question: 'What does anti-money laundering software do?',
    answer: `Anti-money laundering software performs five core functions:

1. **Customer identification and verification (KYC/KYB)** — Collects customer identity information, verifies documents, runs biometric liveness checks, and maps ownership structures for business customers — producing a documented, auditable identity record.
2. **Sanctions, PEP, and adverse media screening** — Checks every customer against global watchlists and political exposure databases at onboarding and on an ongoing basis. Alerts are generated when a customer's status changes.
3. **Transaction monitoring** — Applies configurable rules to detect suspicious activity — structuring, velocity anomalies, high-risk jurisdiction exposure, unusual patterns. Generates alerts when rules are breached.
4. **Case management and investigation** — Creates a case for every alert. Routes investigations to analysts, captures findings, enables four-eyes review, and produces AUSTRAC-ready documentation.
5. **Regulatory reporting** — Pre-populates AUSTRAC reports (SMR, IFTI, TTR) from existing transaction and customer data, validates fields against AUSTRAC requirements, and submits with a full audit trail of who prepared, reviewed, and approved each report.`,
  },
  {
    question: 'Who needs AML compliance software?',
    answer: `In Australia, any business that is a "reporting entity" under the AML/CTF Act 2006 has legal obligations that AML software helps meet. This currently includes:

**Financial services — Tranche 1 (obligations active now)**
- Virtual asset service providers (VASPs) and digital currency exchanges (DCEs)
- Remittance providers and money transfer services
- Foreign exchange dealers
- Payment service providers
- Banks and credit providers
- Stockbrokers and securities dealers

**Professional services — Tranche 2 (obligations from 1 July 2026)**
- Real estate agents and buyers' agents
- Conveyancers
- Law firms providing property, trust, or company services
- Accounting firms providing designated services
- Precious metal dealers

Regulated businesses in particular need AML solutions — especially in financial services (fintechs, banks, crypto), iGaming, and legal sectors where they are handling financial transactions or sensitive customer data. The common thread is this: any business that could be used — knowingly or unknowingly — to move, hide, or legitimise criminal proceeds has an interest in robust AML controls.`,
  },
  {
    question: 'How do I choose the best AML software?',
    answer: `The right AML software depends on your industry, transaction volume, and regulatory obligations. Here is what to evaluate:

1. **Industry fit** — Generic compliance software forces you to build everything from scratch. Look for a platform that pre-configures KYC rules, monitoring thresholds, and report templates to your specific sector — VASP, remittance, law firm, etc.
2. **AUSTRAC alignment** — If you operate in Australia, the platform needs to generate AUSTRAC-compliant reports (SMR, IFTI, TTR) with correct field mappings and submission capability. Not all international AML platforms support Australian reporting requirements.
3. **Audit trail quality** — When AUSTRAC asks to see your compliance record, you need to produce it immediately. Every customer decision, screening result, and report submission should be timestamped, attributed to a user, and immutable.
4. **Ease of use** — Compliance software your team doesn't use consistently is worse than no software at all. Evaluate whether the workflow matches how your team actually operates.
5. **Pricing model** — Understand whether you're paying per-customer, per-transaction, per-report, or a flat annual fee. For businesses with variable volumes, a flat annual fee gives cost certainty.
6. **Support and updates** — AML law changes. AUSTRAC guidance evolves. Your software provider should update the platform as legislation and regulatory expectations change — without charging separately for each update.`,
  },
  {
    question: 'What features should AML software have?',
    answer: `A capable AML platform should include all of the following:

- **KYC identity verification** — automated document capture, authenticity checking, and biometric liveness verification
- **KYB business verification** — company registry integration (ASIC), ownership structure mapping, and UBO identification
- **Sanctions screening** — real-time checks against OFAC, UN, EU, DFAT, and UK HMT lists with ongoing monitoring
- **PEP screening** — politically exposed person identification with automatic EDD escalation
- **Adverse media screening** — open-source media checks for financial crime exposure
- **Transaction monitoring** — configurable rule engine with alert generation and case routing
- **Case management** — structured investigation workflows with four-eyes approval and full audit trail
- **AML/CTF Program management** — living program documentation, risk assessment, and annual review workflow
- **Regulatory reporting** — pre-populated AUSTRAC report templates (SMR, IFTI, TTR) with validation and submission capability
- **Workflow automation** — no-code triggers for KYC renewals, escalations, and compliance task assignment
- **Australian data hosting** — all data stored in Australian AWS regions with AES-256 encryption

VeriGo includes all of these in a single platform, pre-configured for your industry from day one.`,
  },
  {
    question: 'How much does AML software cost?',
    answer: `AML software pricing varies significantly depending on the vendor, feature set, and pricing model. Common approaches include:

- **Per-customer or per-check pricing** — you pay for each KYC verification or screening check. This is unpredictable for growing businesses.
- **Transaction-based pricing** — common in transaction monitoring tools. Costs scale with volume.
- **Annual licence fees** — a flat annual cost regardless of customer or transaction volume. Predictable and often better value for businesses with steady or growing volumes.
- **Enterprise contracts** — custom pricing for large organisations, reporting groups, or businesses with specific integration requirements.

**VeriGo pricing:**
- **Starter — $299/mo** (or $2,870.40/yr billed annually). Up to 500 customers, 5 users. Core KYC, KYB, IFTI/SMR/TTR reporting, and essential integrations (email, cloud storage).
- **Professional — $799/mo** (or $7,670.40/yr billed annually). Up to 5,000 customers, 25 users. Everything in Starter plus advanced monitoring, case management, workflow automation, AML data connectors, and the ability to connect Verigo to your existing systems.
- **Enterprise — $1,999/mo** (or $19,190.40/yr billed annually). Unlimited customers and users.
- **VVIP — Custom pricing** for reporting groups, large institutions, and SaaS resellers.

All plans include a 7-day free trial with no credit card required. The AML/CTF Program included is a basic reference template — tailoring it to your specific business is available as an additional service.`,
  },
  {
    question: 'Can AML software integrate with existing systems?',
    answer: `Yes — integration capability is an important consideration when choosing AML software. Common integration needs include:

- **Document and data storage** — cloud storage integrations allow compliance documents to be synced with your existing file management systems.
- **Communication tools** — email integrations ensure compliance alerts and KYC renewal reminders are delivered through existing channels.
- **Core business systems** — Verigo can connect to your core banking system, CRM, or payment platform so compliance checks run automatically as part of your existing workflow.
- **Specialist AML data providers** — for businesses with higher-risk profiles (crypto exchanges, PSPs, FX dealers), integrations with AML data connectors and global watchlist databases add an additional layer of intelligence.

**VeriGo integrations by plan:**
- **Starter:** Email and cloud storage
- **Professional:** Essential integrations plus AML data connectors and the ability to connect Verigo to your existing systems
- **Enterprise / VVIP:** All of the above with BYO vendor contracts, custom integration support, and dedicated technical onboarding`,
  },
]

export default function FAQPage() {
  return (
    <div className="bg-white text-slate-900">

      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-950 to-slate-900 pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 ring-1 ring-blue-500/20 mb-6">
            Frequently Asked Questions
          </span>
          <h1 className="text-5xl md:text-6xl font-black text-white leading-tight tracking-tight mb-6">
            Everything you need to know<br />
            <span className="text-blue-400">about AML compliance.</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Answers to the most common questions about AML software, Australian compliance obligations, and how VeriGo helps regulated businesses stay ahead.
          </p>
        </div>
      </section>

      {/* Accordion */}
      <section className="pub-section">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <FAQAccordion faqs={faqs} />
        </div>
      </section>

      {/* CTA */}
      <section className="pub-section pt-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-900 rounded-3xl p-10 text-center">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-3xl font-black text-white mb-3">Still have questions?</h2>
            <p className="text-slate-400 max-w-lg mx-auto mb-8">
              Book a 20-minute demo and see how VeriGo handles your specific industry, obligations, and compliance questions.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
                Start Free Trial <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-8 py-4 text-base font-semibold text-white ring-1 ring-white/15 hover:bg-white/10 transition-colors">
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
