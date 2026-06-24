import React from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle, ArrowRight, Shield, Users, Search, BarChart3,
  FileText, Zap, AlertTriangle, Clock, Package,
  Coins, Globe, Gem, Home, FileCheck, Scale, Calculator, Building2, Network,
} from 'lucide-react'
import { industries, getIndustry } from '@/lib/industries'

// ── Per-pack supplementary content ───────────────────────────────────────────

type PackExtra = {
  setupTime: string
  customerLimit: string
  headline: string
  whatIsIncluded: {
    category: string
    items: string[]
  }[]
  kycRules: string[]
  monitoringRules: string[]
  amlProgramComponents: string[]
  reportTemplates: string[]
  gettingStarted: string[]
}

const industryIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'vasp': Coins,
  'remittance': Globe,
  'bullion_dealers': Gem,
  'real_estate': Home,
  'conveyancers': FileCheck,
  'legal_professionals': Scale,
  'accountants': Calculator,
  'precious_metals': Gem,
  'pubs_clubs': Building2,
  'reporting_group': Network,
}

const packExtras: Record<string, PackExtra> = {
  'vasp': {
    setupTime: '< 10 minutes',
    customerLimit: 'Unlimited retail and institutional customers',
    headline: 'Everything a Digital Currency Exchange needs to meet AUSTRAC obligations from day one.',
    whatIsIncluded: [
      {
        category: 'Customer Onboarding & KYC',
        items: [
          'Photo ID verification (passport, driver licence)',
          'Real-time biometric liveness check',
          'Address verification via document or utility bill',
          'Source of funds declaration workflow for high-value customers',
          'Enhanced due diligence trigger rules (risk-based)',
          'Automated risk scoring at account opening',
        ],
      },
      {
        category: 'Transaction Monitoring Rules',
        items: [
          'Cryptocurrency structuring detection (deposits/withdrawals below threshold)',
          'Smurfing pattern recognition across multiple accounts',
          'High-risk jurisdiction transaction flags (FATF grey/black list countries)',
          'Rapid fund movement velocity alerts',
          'Wallet address screening against blockchain analytics databases',
          'Large single-transaction alerts ($10,000+ equivalent)',
        ],
      },
      {
        category: 'AUSTRAC Report Templates',
        items: [
          'IFTI IN — international value transfer receipts',
          'IFTI OUT — international value transfer instructions',
          'TTR — threshold transaction reports ($10,000+ cash equivalent)',
          'SMR — suspicious matter reports with AUSTRAC field validation',
          'Bulk transaction import for batch IFTI/TTR submission',
        ],
      },
      {
        category: 'AML/CTF Program Templates',
        items: [
          'Part A program template (risk assessment, governance, policies)',
          'Part B program template (customer identification and verification procedures)',
          'Risk Assessment Matrix — DCE-specific risk factors pre-populated',
          'AUSTRAC Registration Checklist',
          'Ongoing CDD Review Schedule',
        ],
      },
    ],
    kycRules: [
      'Standard CDD — all retail customers',
      'Enhanced CDD — PEP matches, high-risk jurisdictions, high transaction volumes',
      'Simplified CDD — not available (DCEs require full KYC)',
      'Periodic KYC re-verification at 12-month intervals',
    ],
    monitoringRules: [
      'Structuring: 3+ transactions under $10,000 within 72h totalling $10,000+',
      'Velocity: >$50,000 in 30 days (configurable)',
      'High-risk country: any transaction involving FATF non-cooperative jurisdictions',
      'Wallet risk: screening against Chainalysis/Elliptic-style address risk scores',
    ],
    amlProgramComponents: [
      'AML/CTF Risk Assessment (Part A)',
      'Customer Identification and Verification Procedures (Part B)',
      'Employee Due Diligence Register',
      'Training Record Register',
      'Board Approval & Signoff Workflow',
      'Annual Review Reminder',
    ],
    reportTemplates: ['SMR', 'IFTI IN', 'IFTI OUT', 'TTR'],
    gettingStarted: [
      'Select "Crypto Pack" on account creation',
      'Upload your AUSTRAC registration number',
      'Configure your risk thresholds (defaults pre-set)',
      'Invite your compliance team',
      'Go live — onboard your first customer',
    ],
  },
  'remittance': {
    setupTime: '< 10 minutes',
    customerLimit: 'Unlimited senders and beneficiaries',
    headline: 'Built for the remittance sector — covering sender KYC, beneficiary capture, IFTI IN/OUT, and suspicious activity reporting.',
    whatIsIncluded: [
      {
        category: 'Sender & Beneficiary Capture',
        items: [
          'Sender KYC — photo ID and address verification',
          'Beneficiary identification (name, account, destination country)',
          'Purpose of remittance capture for high-value transfers',
          'Enhanced due diligence for transfers to high-risk corridors',
          'Beneficial ownership for business senders',
          'Ongoing periodic review for frequent senders',
        ],
      },
      {
        category: 'Transaction Monitoring Rules',
        items: [
          'IFTI threshold detection — auto-flag transfers ≥ $10,000 AUD',
          'Structuring detection — multiple transfers below threshold',
          'High-risk corridor monitoring (FATF grey/blacklist destinations)',
          'Third-party sender pattern detection',
          'Hawala indicator rules',
          'Rapid consecutive transfer velocity checks',
        ],
      },
      {
        category: 'AUSTRAC Report Templates',
        items: [
          'IFTI IN — inbound international value transfers',
          'IFTI OUT — outbound international value transfers',
          'SMR — suspicious matter reports',
          'TTR — threshold cash transaction reports',
          'Bulk IFTI import for high-volume corridors',
        ],
      },
      {
        category: 'AML/CTF Program Templates',
        items: [
          'Remittance Provider Risk Assessment',
          'Correspondent and Sub-agent Due Diligence procedures',
          'Corridor Risk Register',
          'Part A and Part B program templates',
          'Annual AML/CTF Program Review template',
        ],
      },
    ],
    kycRules: [
      'Full KYC on all senders regardless of transaction amount',
      'Beneficiary identification for all international transfers',
      'Enhanced due diligence for transfers above $10,000 or to high-risk jurisdictions',
      'Business sender KYB including beneficial ownership mapping',
    ],
    monitoringRules: [
      'IFTI threshold: auto-detect transfers ≥ $10,000 AUD equivalent',
      'Structuring: 3+ transfers to same beneficiary under threshold within 5 business days',
      'Corridor risk: elevated monitoring for transfers to FATF non-cooperative countries',
      'Agent network: periodic review of sub-agent compliance status',
    ],
    amlProgramComponents: [
      'Part A — Governance, Risk Assessment, Policies',
      'Part B — Sender and Beneficiary Identification Procedures',
      'Correspondent/Sub-agent Due Diligence Register',
      'Corridor Risk Assessment Matrix',
      'Training Log',
      'Board Approval Workflow',
    ],
    reportTemplates: ['SMR', 'IFTI IN', 'IFTI OUT', 'TTR'],
    gettingStarted: [
      'Select "Remittance Pack" on account creation',
      'Configure your corridors and risk thresholds',
      'Set IFTI threshold alert rules (default: $10,000 AUD)',
      'Invite your compliance and operations team',
      'Submit your first IFTI report',
    ],
  },
  'foreign-exchange': {
    setupTime: '< 15 minutes',
    customerLimit: 'Unlimited retail and wholesale FX customers',
    headline: 'Designed for FX dealers — covering KYC/KYB, PEP screening, IFTI reporting, and ongoing transaction surveillance.',
    whatIsIncluded: [
      {
        category: 'Customer Due Diligence',
        items: [
          'Retail customer KYC — photo ID and address verification',
          'Business customer KYB — ASIC verification and beneficial ownership',
          'PEP identification with enhanced due diligence trigger',
          'Source of funds documentation for large FX transactions',
          'Ongoing periodic re-verification',
          'Risk-based CDD tier classification',
        ],
      },
      {
        category: 'Transaction Monitoring Rules',
        items: [
          'IFTI threshold detection for international payments ≥ $10,000 AUD',
          'Currency structuring pattern detection',
          'High-risk jurisdiction transaction monitoring',
          'PEP-linked transaction enhanced review',
          'Large single transaction alerts',
          'Unusual currency pair pattern detection',
        ],
      },
      {
        category: 'AUSTRAC Report Templates',
        items: [
          'IFTI IN — inbound international currency receipts',
          'IFTI OUT — outbound international currency transfers',
          'SMR — suspicious matter reporting',
          'TTR — cash transactions above threshold',
        ],
      },
      {
        category: 'AML/CTF Program Templates',
        items: [
          'FX Provider Risk Assessment Matrix',
          'Customer Identification Procedures (retail and wholesale)',
          'Correspondent Banking Due Diligence checklist',
          'Part A and Part B program templates',
        ],
      },
    ],
    kycRules: [
      'Standard CDD for all retail FX customers',
      'KYB and UBO mapping for all business customers',
      'Enhanced CDD for PEPs and high-risk jurisdiction customers',
      'Ongoing monitoring for customers transacting above risk thresholds',
    ],
    monitoringRules: [
      'IFTI threshold: auto-detect international payments ≥ $10,000 AUD',
      'Currency structuring: multiple transactions under threshold to same beneficiary',
      'PEP transaction: all transactions by PEP-identified customers auto-flagged for review',
    ],
    amlProgramComponents: [
      'Part A — Risk Assessment and Governance',
      'Part B — Customer Identification Procedures',
      'Correspondent Bank Due Diligence Register',
      'High-Risk Customer Register',
      'Training Records',
    ],
    reportTemplates: ['SMR', 'IFTI IN', 'IFTI OUT', 'TTR'],
    gettingStarted: [
      'Select "FX Pack" on account creation',
      'Configure risk thresholds for your customer base',
      'Connect your transaction feed or use manual entry',
      'Invite your compliance team',
      'Onboard your first customer',
    ],
  },
  'payment-service-provider': {
    setupTime: '< 15 minutes',
    customerLimit: 'Unlimited merchants and end customers',
    headline: 'Purpose-built for payment service providers — merchant KYB, transaction monitoring, and full AUSTRAC reporting obligations.',
    whatIsIncluded: [
      {
        category: 'Merchant & Customer Verification',
        items: [
          'Merchant KYB — business verification via ASIC and CreditorWatch',
          'Ultimate beneficial owner (UBO) identification at 25% threshold',
          'Individual UBO KYC including sanctions and PEP screening',
          'End-customer KYC for direct-access payment products',
          'Risk-based enhanced due diligence for high-risk merchant categories',
          'Ongoing monitoring for changes in merchant ownership',
        ],
      },
      {
        category: 'Transaction Monitoring Rules',
        items: [
          'High-value merchant transaction velocity alerts',
          'Unusual settlement pattern detection',
          'Refund ratio anomaly monitoring',
          'High-risk MCC (merchant category code) flags',
          'International transfer monitoring for IFTI obligations',
          'Structuring detection across merchant accounts',
        ],
      },
      {
        category: 'AUSTRAC Report Templates',
        items: [
          'IFTI IN — inbound international payment receipts',
          'IFTI OUT — outbound international payment instructions',
          'SMR — suspicious matter reports',
          'TTR — threshold cash transaction reports',
        ],
      },
      {
        category: 'AML/CTF Program Templates',
        items: [
          'PSP Risk Assessment Matrix',
          'Merchant Onboarding Due Diligence procedures',
          'Payment Card Industry AML overlay',
          'Part A and Part B program templates',
          'Merchant Risk Tier Classification Framework',
        ],
      },
    ],
    kycRules: [
      'Full KYB and UBO mapping for all merchant customers',
      'Individual KYC for all identified UBOs',
      'Enhanced due diligence for high-risk merchant categories',
      'Ongoing monitoring for ownership structure changes',
    ],
    monitoringRules: [
      'Settlement velocity: flag merchants with >200% month-on-month growth',
      'Refund ratio: alert on refund rates above 10% of transaction volume',
      'IFTI threshold: auto-detect international transfers ≥ $10,000 AUD',
      'High-risk MCC: enhanced monitoring for adult, gambling, and crypto-adjacent merchants',
    ],
    amlProgramComponents: [
      'Part A — Risk Assessment and Policy',
      'Part B — Merchant Identification Procedures',
      'Merchant Risk Register',
      'High-Risk Category Policy',
      'Scheme Compliance Overlay (Visa/Mastercard AML requirements)',
    ],
    reportTemplates: ['SMR', 'IFTI IN', 'IFTI OUT', 'TTR'],
    gettingStarted: [
      'Select "PSP Pack" on account creation',
      'Configure merchant risk categories',
      'Set monitoring thresholds for your portfolio',
      'Import existing merchant list (CSV supported)',
      'Begin KYB verification on highest-risk merchants first',
    ],
  },
  'real_estate': {
    setupTime: '< 20 minutes',
    customerLimit: 'Unlimited buyers, vendors, and transactions',
    headline: 'Designed for real estate professionals preparing for Tranche 2 — buyer CDD, beneficial ownership mapping, source of funds, and AML program templates for 2026 compliance.',
    whatIsIncluded: [
      {
        category: 'Buyer & Vendor Due Diligence',
        items: [
          'Buyer identity verification — photo ID and address',
          'Corporate buyer KYB — ASIC verification and UBO mapping',
          'Trust structure identification and beneficiary documentation',
          'Source of funds documentation and verification workflow',
          'Source of wealth verification for high-value property transactions',
          'PEP screening for all buyers and their beneficial owners',
        ],
      },
      {
        category: 'Transaction Monitoring',
        items: [
          'High-value property transaction risk flags',
          'Third-party payment detection (funds from unrelated parties)',
          'Foreign buyer monitoring and FIRB status checks',
          'Cash component detection and threshold alerts',
          'Rapid sequential property purchase pattern detection',
          'Off-plan purchase deposit monitoring',
        ],
      },
      {
        category: 'AML/CTF Program Templates',
        items: [
          'Real Estate Professional Risk Assessment (Tranche 2 compliant)',
          'Designated Service Identification — which services trigger obligations',
          'Customer Identification and Verification Procedures',
          'Ongoing Due Diligence Policy',
          'AUSTRAC Enrolment Preparation Checklist',
          'Staff AML Training Module',
        ],
      },
      {
        category: 'AUSTRAC Report Templates',
        items: [
          'SMR — suspicious matter reports (primary reporting obligation)',
          'TTR — threshold cash transaction reports',
          'AUSTRAC Enrolment Application guidance',
        ],
      },
    ],
    kycRules: [
      'CDD required for all buyers of real property',
      'Enhanced CDD for corporate buyers, trusts, and foreign purchasers',
      'Source of funds documentation required for all transactions',
      'UBO identification required for all non-individual buyers',
    ],
    monitoringRules: [
      'Third-party payment: flag transactions where deposit source differs from buyer identity',
      'Cash contribution: any cash component above $10,000 triggers TTR review',
      'Foreign buyer: enhanced monitoring for buyers from FATF non-cooperative jurisdictions',
      'Rapid resale: flag properties purchased and resold within 6 months',
    ],
    amlProgramComponents: [
      'Tranche 2 Risk Assessment',
      'Designated Services Register',
      'Customer Identification Procedures',
      'Ongoing CDD Policy',
      'AUSTRAC Enrolment Checklist',
      'Annual AML Program Review',
    ],
    reportTemplates: ['SMR', 'TTR'],
    gettingStarted: [
      'Select "Real Estate Pack" on account creation',
      'Review your designated services and confirm scope',
      'Configure buyer risk thresholds',
      'Run CDD on your existing client base (backlog tool included)',
      'Complete your AML/CTF Program using included templates',
    ],
  },
  'conveyancers': {
    setupTime: '< 20 minutes',
    customerLimit: 'Unlimited clients and property matters',
    headline: 'Built for conveyancers navigating Tranche 2 — client CDD, source of funds, and AML program templates ready for 2026 AUSTRAC obligations.',
    whatIsIncluded: [
      {
        category: 'Client Due Diligence',
        items: [
          'Individual client KYC — photo ID and address verification',
          'Corporate client KYB — ASIC verification and UBO identification',
          'Trust client due diligence — beneficiary and trustee identification',
          'Source of funds documentation for all conveyancing matters',
          'PEP screening for clients and their beneficial owners',
          'Ongoing re-verification for repeat clients',
        ],
      },
      {
        category: 'Matter-Level Monitoring',
        items: [
          'Third-party payment source detection',
          'Settlement fund discrepancy alerts',
          'Foreign client transaction monitoring',
          'Cash component threshold detection',
          'High-value matter enhanced review triggers',
        ],
      },
      {
        category: 'AML/CTF Program Templates',
        items: [
          'Conveyancer AML/CTF Risk Assessment (Tranche 2)',
          'Client Identification and Verification Procedures',
          'Matter Intake Due Diligence checklist',
          'Source of Funds Policy',
          'AUSTRAC Enrolment Preparation Checklist',
          'Staff Training Module',
        ],
      },
      {
        category: 'AUSTRAC Report Templates',
        items: [
          'SMR — suspicious matter reports',
          'TTR — threshold cash transaction reports',
        ],
      },
    ],
    kycRules: [
      'CDD required for all clients on designated conveyancing matters',
      'Enhanced CDD for corporate and trust clients',
      'Source of funds required for all property settlement matters',
      'Ongoing review triggered by changes in matter status or client risk profile',
    ],
    monitoringRules: [
      'Third-party funds: flag settlement funds from accounts not matching client identity',
      'Cash component: any cash amount in settlement triggers review',
      'Multiple matters: clients with >3 concurrent matters flagged for enhanced review',
    ],
    amlProgramComponents: [
      'Tranche 2 Risk Assessment',
      'Client Identification Procedures',
      'Source of Funds Policy',
      'Matter Register',
      'AUSTRAC Enrolment Checklist',
    ],
    reportTemplates: ['SMR', 'TTR'],
    gettingStarted: [
      'Select "Conveyancer Pack" on account creation',
      'Review designated services scope',
      'Configure matter intake CDD workflow',
      'Apply CDD to active matters',
      'Complete your AML/CTF Program templates',
    ],
  },
  'legal_professionals': {
    setupTime: '< 20 minutes',
    customerLimit: 'Unlimited clients and matters',
    headline: 'Purpose-built for law firms entering the AML/CTF regime under Tranche 2 — client CDD, matter-level risk management, and AML program templates for 2026.',
    whatIsIncluded: [
      {
        category: 'Client & Matter Due Diligence',
        items: [
          'Individual client KYC at matter inception',
          'Corporate client KYB — ASIC verification and beneficial ownership',
          'Trust and estate client due diligence',
          'Source of funds for designated legal services',
          'PEP screening for all clients and beneficial owners',
          'Conflict of interest and sanctions cross-check',
        ],
      },
      {
        category: 'Designated Services Monitoring',
        items: [
          'Real estate transaction monitoring (buyer/vendor)',
          'Company formation and management monitoring',
          'Trust establishment and management screening',
          'Fund transfer monitoring for client accounts',
          'High-value matter risk escalation rules',
        ],
      },
      {
        category: 'AML/CTF Program Templates',
        items: [
          'Law Firm AML/CTF Risk Assessment (Tranche 2)',
          'Designated Services Register for your practice areas',
          'Client Identification and Verification Procedures',
          'Matter Acceptance Due Diligence Policy',
          'AUSTRAC Enrolment Checklist',
          'Staff AML Training Module and log',
        ],
      },
      {
        category: 'AUSTRAC Report Templates',
        items: [
          'SMR — suspicious matter reports',
          'TTR — threshold cash transaction reports',
          'Legal Professional Privilege guidance notes',
        ],
      },
    ],
    kycRules: [
      'CDD required at matter inception for all designated legal services',
      'Enhanced CDD for PEP-connected clients and high-risk matters',
      'KYB and UBO mapping for all corporate and trust clients',
      'Ongoing review triggered by material changes in matter or client risk profile',
    ],
    monitoringRules: [
      'Large client account deposits: flag receipts above $10,000 for source of funds review',
      'PEP-linked matters: all matters involving identified PEPs flagged for MLRO review',
      'Trust matter funds: enhanced monitoring for trust establishment and management matters',
    ],
    amlProgramComponents: [
      'Law Firm Tranche 2 Risk Assessment',
      'Designated Services Identification Register',
      'Client Identification Procedures',
      'Matter Acceptance Policy',
      'AUSTRAC Enrolment Preparation Checklist',
      'CDD Records Register',
    ],
    reportTemplates: ['SMR', 'TTR'],
    gettingStarted: [
      'Select "Law Firm Pack" on account creation',
      'Map your practice areas to designated services',
      'Configure matter intake CDD workflow',
      'Apply CDD to active matters for existing clients',
      'Complete AML/CTF Program and AUSTRAC enrolment',
    ],
  },
  'accountants': {
    setupTime: '< 20 minutes',
    customerLimit: 'Unlimited clients and engagements',
    headline: 'Built for accounting firms preparing for Tranche 2 — client CDD, designated services tracking, and AML program templates for 2026 AUSTRAC obligations.',
    whatIsIncluded: [
      {
        category: 'Client Due Diligence',
        items: [
          'Individual client KYC — identity and address verification',
          'Corporate client KYB — ASIC verification and UBO mapping',
          'Trust and SMSF client due diligence',
          'PEP screening for all clients and beneficial owners',
          'Source of funds for asset or fund management engagements',
          'Ongoing periodic re-verification',
        ],
      },
      {
        category: 'Designated Services Monitoring',
        items: [
          'Company formation and management service flags',
          'Trust establishment and management monitoring',
          'Tax advisory for complex structures — enhanced review',
          'Asset management and investment advisory monitoring',
          'SMSF setup and management screening',
        ],
      },
      {
        category: 'AML/CTF Program Templates',
        items: [
          'Accounting Firm AML/CTF Risk Assessment (Tranche 2)',
          'Designated Services Register for your service lines',
          'Client Identification and Verification Procedures',
          'Engagement Acceptance Due Diligence Policy',
          'AUSTRAC Enrolment Checklist',
          'Staff Training Module',
        ],
      },
      {
        category: 'AUSTRAC Report Templates',
        items: [
          'SMR — suspicious matter reports',
          'TTR — threshold cash transaction reports',
        ],
      },
    ],
    kycRules: [
      'CDD required at engagement acceptance for all designated accounting services',
      'Enhanced CDD for corporate clients, trusts, and SMSFs',
      'UBO mapping required for all non-individual clients',
      'Ongoing review at each annual engagement renewal',
    ],
    monitoringRules: [
      'Complex structure indicator: flag clients requesting company formation in multiple jurisdictions',
      'Fund movement: monitor trust fund transactions for anomalous patterns',
      'PEP engagement: all engagements involving identified PEPs escalated to senior partner review',
    ],
    amlProgramComponents: [
      'Tranche 2 Risk Assessment',
      'Designated Services Register',
      'Client Identification Procedures',
      'Engagement Acceptance Policy',
      'AUSTRAC Enrolment Checklist',
      'CDD Records Register',
    ],
    reportTemplates: ['SMR', 'TTR'],
    gettingStarted: [
      'Select "Accounting Firm Pack" on account creation',
      'Identify your designated service lines',
      'Configure client risk tiers',
      'Run CDD on existing client base (bulk import tool included)',
      'Complete AML/CTF Program and AUSTRAC enrolment',
    ],
  },
  'precious_metals': {
    setupTime: '< 15 minutes',
    customerLimit: 'Unlimited buyers, sellers, and transactions',
    headline: 'Designed for precious metal dealers preparing for Tranche 2 — transaction monitoring, threshold cash reporting, and AML program templates for 2026.',
    whatIsIncluded: [
      {
        category: 'Customer Due Diligence',
        items: [
          'Customer KYC for all cash transactions above $10,000',
          'Business customer KYB and beneficial ownership mapping',
          'PEP screening for all customers',
          'Source of funds documentation for large purchases',
          'Enhanced CDD for repeat high-value customers',
          'Walk-in customer identification workflow',
        ],
      },
      {
        category: 'Transaction Monitoring Rules',
        items: [
          'TTR threshold detection — cash transactions ≥ $10,000 AUD',
          'Structuring detection — multiple transactions under threshold',
          'Repeat high-value customer velocity monitoring',
          'Bulk bullion transaction pattern detection',
          'Third-party payment for customer transactions',
          'Unusual product mix or weight pattern alerts',
        ],
      },
      {
        category: 'AML/CTF Program Templates',
        items: [
          'Precious Metal Dealer AML/CTF Risk Assessment (Tranche 2)',
          'Customer Identification Procedures for sales and purchases',
          'Cash Transaction Recording Policy',
          'Staff Training Module',
          'AUSTRAC Enrolment Preparation Checklist',
        ],
      },
      {
        category: 'AUSTRAC Report Templates',
        items: [
          'SMR — suspicious matter reports',
          'TTR — threshold cash transaction reports ($10,000+ cash)',
        ],
      },
    ],
    kycRules: [
      'CDD required for all cash transactions ≥ $10,000',
      'CDD required for business customers regardless of transaction value',
      'Enhanced CDD for PEP-connected customers',
      'Ongoing monitoring for customers with high transaction frequency',
    ],
    monitoringRules: [
      'TTR threshold: auto-detect and report all cash transactions ≥ $10,000 AUD',
      'Structuring: 3+ transactions under $10,000 within 72 hours by same customer',
      'Bulk bullion: large-volume gold/silver purchases outside normal customer profile',
    ],
    amlProgramComponents: [
      'Tranche 2 Risk Assessment',
      'Customer Identification Procedures',
      'Cash Transaction Recording Policy',
      'Structuring Detection Policy',
      'AUSTRAC Enrolment Checklist',
    ],
    reportTemplates: ['SMR', 'TTR'],
    gettingStarted: [
      'Select "Precious Metals Pack" on account creation',
      'Configure TTR and structuring detection thresholds',
      'Set up your transaction recording workflow',
      'Train staff on AML obligations using included module',
      'Complete AML/CTF Program and AUSTRAC enrolment',
    ],
  },
}

// ── Static params ─────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  return industries.map(i => ({ industry: i.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ industry: string }> }) {
  const { industry } = await params
  const ind = getIndustry(industry)
  if (!ind) return {}
  return {
    title: `${ind.packName} — ${ind.label} Compliance Pack | Verigo`,
    description: `Everything ${ind.label.toLowerCase()} businesses need to meet AUSTRAC AML/CTF obligations. ${ind.packName} includes KYC workflows, transaction monitoring rules, AUSTRAC report templates, and AML program templates — configured for your sector.`,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PackPage({ params }: { params: Promise<{ industry: string }> }) {
  const { industry } = await params
  const ind = getIndustry(industry)
  if (!ind) notFound()

  const extra = packExtras[ind.id]

  const regimeBadge = ind.regime === 'current'
    ? { label: 'Obligations active now', cls: 'bg-green-50 text-green-700 ring-green-700/10' }
    : { label: 'Tranche 2 — obligations from 2026', cls: 'bg-amber-50 text-amber-700 ring-amber-700/10' }

  return (
    <div className="bg-white text-slate-900">

      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href={`/solutions/${ind.slug}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-8">
            ← {ind.label} compliance guide
          </Link>
          <div className="flex items-start gap-6 mb-8">
            <div className={`w-16 h-16 bg-gradient-to-br ${ind.color} rounded-2xl flex items-center justify-center flex-shrink-0`}>{(() => { const Icon = industryIconMap[ind.id] ?? Shield; return <Icon className="w-8 h-8 text-white" /> })()}</div>
            <div>
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                  <Package className="w-3 h-3 mr-1" /> Compliance Pack
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${regimeBadge.cls}`}>
                  {regimeBadge.label}
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-3">{ind.packName}</h1>
              {extra && <p className="text-xl text-slate-500 max-w-2xl">{extra.headline}</p>}
            </div>
          </div>

          {/* Quick stats */}
          {extra && (
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: Clock, label: 'Setup time', value: extra.setupTime },
                { icon: Users, label: 'Customer capacity', value: extra.customerLimit },
                { icon: Shield, label: 'AUSTRAC alignment', value: 'AML/CTF Act 2006 compliant' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 bg-slate-50 rounded-xl px-5 py-4">
                  <Icon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400 font-medium">{label}</p>
                    <p className="text-sm font-semibold text-slate-900">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="pub-section pt-8">
        <div className="pub-container space-y-16">

          {/* What's included — detailed breakdown */}
          {extra && (
            <div>
              <h2 className="text-2xl font-black text-slate-900 mb-8">What&apos;s included in the {ind.packName}</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {extra.whatIsIncluded.map(section => (
                  <div key={section.category} className="pub-card">
                    <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wide text-blue-600">{section.category}</h3>
                    <ul className="space-y-2.5">
                      {section.items.map(item => (
                        <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Report templates */}
          {extra && (
            <div>
              <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <FileText className="w-6 h-6 text-blue-600" /> AUSTRAC Report Templates Included
              </h2>
              <div className="flex flex-wrap gap-3 mb-4">
                {extra.reportTemplates.map(t => (
                  <span key={t} className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white">
                    {t}
                  </span>
                ))}
              </div>
              <p className="text-slate-500 text-sm">{ind.reportingRequirements.details}</p>
            </div>
          )}

          {/* AML Program components */}
          {extra && (
            <div>
              <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <Shield className="w-6 h-6 text-blue-600" /> AML/CTF Program Components
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {extra.amlProgramComponents.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-xl px-4 py-3">
                    <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                    <p className="text-slate-700 text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key risks this pack addresses */}
          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500" /> Risk Areas This Pack Addresses
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {ind.risks.map((r, i) => (
                <div key={i} className="flex items-start gap-3 pub-card py-4">
                  <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-2" />
                  <p className="text-slate-600 text-sm">{r}</p>
                </div>
              ))}
            </div>
          </div>

          {/* How Verigo helps */}
          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
              <Zap className="w-6 h-6 text-blue-600" /> How VeriGo Automates Your Obligations
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {ind.howVerigoHelps.map((h, i) => (
                <div key={i} className="flex items-start gap-3 pub-card py-4">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-700 text-sm">{h}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Getting started steps */}
          {extra && (
            <div>
              <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-blue-600" /> Getting Started in 5 Steps
              </h2>
              <div className="space-y-3">
                {extra.gettingStarted.map((step, i) => (
                  <div key={i} className="flex items-center gap-4 bg-slate-50 rounded-xl px-5 py-4">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">{i + 1}</div>
                    <p className="text-slate-700 text-sm font-medium">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="pub-card bg-blue-600 text-white">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl`}>{ind.icon}</div>
                <div>
                  <h3 className="font-bold text-white">{ind.packName}</h3>
                  <p className="text-blue-200 text-xs">7-day free trial — no credit card</p>
                </div>
              </div>
              <p className="text-blue-100 text-sm mb-6 leading-relaxed">
                Start your free trial and the {ind.packName} is configured automatically on day one. No consultants, no setup fees, no surprises.
              </p>
              <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="pub-card bg-slate-900 text-white">
              <h3 className="text-lg font-bold text-white mb-3">Want a guided walkthrough?</h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Book a 30-minute demo with our compliance team. We&apos;ll walk through exactly how the {ind.packName} works for your business and answer any AUSTRAC-specific questions.
              </p>
              <ul className="space-y-2 mb-6">
                {['Live platform demonstration', 'Your specific compliance questions answered', 'Pack configuration walkthrough', 'Pricing and implementation timeline'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-6 py-3 text-sm font-semibold text-white ring-1 ring-slate-600 hover:bg-slate-600 transition-colors">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Navigation to other packs */}
          <div>
            <h2 className="text-xl font-black text-slate-900 mb-6">Other compliance packs</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {industries.filter(i => i.id !== ind.id).slice(0, 6).map(other => (
                <Link key={other.id} href={`/packs/${other.id}`} className="pub-card-hover group flex items-center gap-4 py-4">
                  <div className={`w-10 h-10 bg-gradient-to-br ${other.color} rounded-xl flex items-center justify-center text-lg flex-shrink-0`}>{other.icon}</div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{other.packName}</p>
                    <p className="text-xs text-slate-400">{other.shortLabel}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 ml-auto transition-colors" />
                </Link>
              ))}
            </div>
          </div>

        </div>
      </section>
    </div>
  )
}
