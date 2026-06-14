import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle, ArrowRight, Shield, AlertTriangle, Users,
  Folder, FileText, Building2, Zap, Eye, ClipboardList,
  BookOpen, ScanFace, ShieldAlert, Newspaper, Activity, Network,
  Database, RefreshCw, GraduationCap, TrendingUp, UserCheck,
  Coins, Globe, ArrowLeftRight, CreditCard, Home, FileCheck,
  Scale, Calculator, Gem, Landmark,
} from 'lucide-react'
import { industries, getIndustry } from '@/lib/industries'
import { capabilities as libCapabilities } from '@/lib/capabilities'

// ─────────────────────────────────────────────────────────────────────────────
// INDUSTRY ICON MAP
// ─────────────────────────────────────────────────────────────────────────────

const industryIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'digital-currency-exchange': Coins,
  'remittance-provider': Globe,
  'foreign-exchange': ArrowLeftRight,
  'payment-service-provider': CreditCard,
  'real-estate': Home,
  'conveyancer': FileCheck,
  'law-firm': Scale,
  'accounting-firm': Calculator,
  'precious-metals': Gem,
  'reporting-group': Network,
  'mortgage-broker': Landmark,
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type WorkflowStep = { title: string; desc: string }
type IndustryExample = { industry: string; example: string }

type Capability = {
  slug: string
  title: string
  tagline: string
  color: string
  // Pain
  problem: string
  painPoints: string[]
  // Why it matters
  whyMatters: string
  stats: { stat: string; label: string }[]
  // Solution
  solution: string
  // Workflow
  workflow: WorkflowStep[]
  // Benefits (outcome-focused)
  benefits: string[]
  // Industry examples
  industryExamples: IndustryExample[]
  // Legacy
  outcome: string
  useCases: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// ICON MAP
// ─────────────────────────────────────────────────────────────────────────────

const capabilityIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'aml-program': BookOpen,
  'compliance-operations': Shield,
  'customer-onboarding': UserCheck,
  'kyc-kyb': ScanFace,
  'kyc-identity-verification': ScanFace,
  'kyb-business-verification': Building2,
  'sanctions-screening': ShieldAlert,
  'pep-screening': Eye,
  'adverse-media': Newspaper,
  'transaction-monitoring': Activity,
  'case-management': Folder,
  'regulatory-reporting': FileText,
  'reporting-groups': Network,
  'workflow-automation': Zap,
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPABILITIES DATA — 70% outcomes, 30% features
// ─────────────────────────────────────────────────────────────────────────────

const capabilitiesData: Capability[] = [
  {
    slug: 'compliance-operations',
    title: 'Compliance Operations',
    tagline: 'One platform. Full visibility. Zero gaps.',
    color: 'from-blue-500 to-blue-600',
    problem: 'Managing compliance across multiple obligations is manual, fragmented, and exhausting. Teams track tasks in spreadsheets, store documents in email chains, and have no single view of what is done and what is overdue.',
    painPoints: [
      'Compliance tasks tracked in spreadsheets that fall out of date',
      'No visibility over what obligations are due and who is responsible',
      'Audit requests take days to respond to — evidence is scattered',
    ],
    whyMatters: "AUSTRAC doesn't just assess whether your policies exist — they assess whether your business actually operates by them. Fragmented compliance tools create gaps that become findings. One missed obligation can trigger a full audit.",
    stats: [
      { stat: '60%', label: 'Reduction in compliance admin time' },
      { stat: '1 view', label: 'Of all obligations, tasks, and risks' },
      { stat: 'Instant', label: 'Audit response — evidence always ready' },
    ],
    solution: 'Verigo consolidates every compliance workflow — onboarding, screening, monitoring, reporting, case management — into one operating system. Your team sees what is due, who owns it, and what has been done. AUSTRAC audit requests take minutes, not days.',
    workflow: [
      { title: 'Configure obligations', desc: 'Set up your AML Program, reporting obligations, and review cadence.' },
      { title: 'Assign and track', desc: 'Tasks auto-assigned to responsible team members with deadlines.' },
      { title: 'Complete and document', desc: 'Every action logged with timestamp, user, and evidence attached.' },
      { title: 'Monitor compliance health', desc: 'Real-time dashboard shows overdue items, risk trends, and gaps.' },
      { title: 'Respond to audits instantly', desc: 'Export a complete compliance record in minutes — not days.' },
    ],
    benefits: [
      'Your team knows exactly what compliance tasks are due and when',
      'Regulators see a complete, consistent compliance record — not a scramble',
      'New staff are guided through obligations — no institutional knowledge required',
      'Compliance gaps surface before they become findings',
      'Senior management get a live view of compliance health without asking for reports',
    ],
    industryExamples: [
      { industry: 'Digital Currency Exchange', example: 'MLRO manages all AUSTRAC obligations from one dashboard — no missed filings, no overdue reviews.' },
      { industry: 'Law Firm (Tranche 2)', example: 'First-time compliance team builds and operates their entire AML program from day one without external consultants.' },
      { industry: 'Reporting Group', example: 'Group CCO monitors compliance status across all entities in one view — spots gaps at subsidiary level before escalation.' },
    ],
    outcome: 'Replace fragmented compliance tools with one operating system. Know what is due, what is done, and where the gaps are.',
    useCases: [
      'Financial institutions managing complex AML obligations',
      'Tranche 2 businesses establishing their first compliance programme',
      'Reporting groups needing centralised oversight across entities',
    ],
  },
  {
    slug: 'aml-program',
    title: 'AML Program',
    tagline: 'Your legally required AML/CTF Program — risk-based, unified, and always current',
    color: 'from-blue-600 to-indigo-600',
    problem: "Every reporting entity must have a written AML/CTF Program — but most treat it as a document exercise. A program that sits in a drawer, disconnected from day-to-day operations, provides no real defence when AUSTRAC asks whether your business actually operates by it.",
    painPoints: [
      'A static Word document that predates your current products and customer types',
      'Annual review forgotten — last update was 3 years ago',
      'No connection between your written policies and what your team actually does',
    ],
    whyMatters: 'Under the AML/CTF Amendment Act 2024 (effective 1 July 2026), the old Part A / Part B structure is replaced by a unified, risk-based program built directly from your ML/TF Risk Assessment. AUSTRAC now expects the Risk Assessment to come first — and the program to be proportionate to the risks it identifies. A static document no longer meets the standard.',
    stats: [
      { stat: 'Required', label: 'By the AML/CTF Act 2006 for all reporting entities' },
      { stat: 'Risk-first', label: 'ML/TF Risk Assessment now drives the entire program' },
      { stat: 'Unified', label: 'Single program replaces the old Part A / Part B structure' },
    ],
    solution: 'VeriGo builds your ML/TF Risk Assessment first — from your industry, customer types, products, and transaction profile — then generates your unified AML/CTF Program directly from it. As your risk profile changes, the program updates. The document AUSTRAC sees reflects exactly how your business operates today.',
    workflow: [
      { title: 'ML/TF Risk Assessment', desc: 'Industry-specific risk matrix pre-populated. Customer types, products, channels, and jurisdictions scored. MLRO reviews and signs off.' },
      { title: 'Unified AML/CTF Program', desc: 'Single program generated from your risk assessment — governance, accountability, CDD procedures, and monitoring rules in one document.' },
      { title: 'Customer Due Diligence procedures', desc: 'CDD and EDD rules embedded in the program and enforced by the platform — not just written in a policy.' },
      { title: 'Registers & Training', desc: 'Employee DD register, training log, and high-risk customer register maintained automatically as your team works.' },
      { title: 'Annual Review', desc: 'Automated reminder. Guided review workflow. Risk Assessment updated first, program updated from it. Signed off and dated.' },
      { title: 'Audit-ready output', desc: 'Current, complete program exported on demand — AUSTRAC receives a document that reflects live operations.' },
    ],
    benefits: [
      'Risk Assessment comes first — your program is proportionate to your actual ML/TF exposure, not a generic template',
      'Unified program structure aligns with the AML/CTF Amendment Act 2024 — no outdated Part A / Part B references',
      'Program updates when your risk profile changes — new products, new customer types, new corridors',
      'AUSTRAC audit requests take minutes — produce a complete, current program on demand',
      'New staff are guided by the same program your compliance team built — no knowledge gaps',
    ],
    industryExamples: [
      { industry: 'Tranche 2 Law Firm', example: 'First-ever AML/CTF Program built from a guided Risk Assessment in a day — compliant with the new unified structure before the 2026 deadline.' },
      { industry: 'VASP / DCE', example: 'MLRO updates the Risk Assessment to reflect new crypto products. Program regenerates automatically — AUSTRAC inspection ready in under an hour.' },
      { industry: 'Remittance Provider', example: 'New payment corridor added. Risk Assessment updated, program reflects the change — without engaging a compliance consultant.' },
    ],
    outcome: 'A living, risk-based AML/CTF Program aligned with the 2026 reforms — built from your Risk Assessment and instantly producible for AUSTRAC.',
    useCases: [
      'Tranche 2 businesses building their first-ever AML/CTF Program aligned to the new unified structure',
      'VASPs and remittance providers updating their program to reflect the 2026 reform requirements',
      'MLRO teams preparing for AUSTRAC audits with a complete, current risk-based program on demand',
    ],
  },
  {
    slug: 'customer-onboarding',
    title: 'Customer Onboarding',
    tagline: 'Onboard faster. Stay compliant. Every single time.',
    color: 'from-green-500 to-emerald-600',
    problem: "Manual customer onboarding is slow, inconsistent, and creates compliance gaps. Paper forms miss required fields. Email-based document collection leaves no audit trail. Some customers get thorough checks — others don't — depending on which staff member handles them.",
    painPoints: [
      'Onboarding takes days when customers expect same-day service',
      'Inconsistent processes mean some customers get less due diligence than required',
      'Paper and email records make it impossible to produce a clean audit trail for AUSTRAC',
    ],
    whyMatters: "AUSTRAC requires documented CDD for every customer before you provide a designated service. 'We did it verbally' is not a defence. One undocumented onboarding in a batch of otherwise compliant records can trigger a broader audit.",
    stats: [
      { stat: 'Minutes', label: 'Not days — average onboarding time with Verigo' },
      { stat: '100%', label: 'Of customers get the same compliant onboarding flow' },
      { stat: 'Instant', label: 'Audit trail for every customer from the moment they apply' },
    ],
    solution: 'Verigo guides every customer through a digital onboarding flow with compliance built in. KYC checks, document collection, and risk scoring happen automatically. No step is skipped. Every decision is logged. Every document is stored.',
    workflow: [
      { title: 'Customer applies', desc: 'Guided digital form collects required CDD information upfront.' },
      { title: 'Documents collected', desc: 'Customer uploads identity documents directly — no email required.' },
      { title: 'Identity verified', desc: 'Automated KYC check runs in the background — no manual lookup.' },
      { title: 'Risk scored', desc: 'Customer assigned a risk level based on profile, activity type, and jurisdiction.' },
      { title: 'Approved or escalated', desc: 'Standard customers approved instantly. High-risk customers routed to EDD.' },
      { title: 'Stored and auditable', desc: 'Full onboarding record stored — producible for AUSTRAC on demand.' },
    ],
    benefits: [
      'Customers get a fast, professional onboarding experience — not a paper form',
      'Every customer receives the same compliant process regardless of who handles them',
      'AUSTRAC can see a complete, documented record for every customer you have onboarded',
      'High-risk customers automatically escalated — no manual triage required',
      'Staff spend time on complex cases, not data entry',
    ],
    industryExamples: [
      { industry: 'Digital Currency Exchange', example: 'Retail crypto customers onboarded in under 5 minutes — KYC, document upload, and risk score complete before approval.' },
      { industry: 'Remittance Provider', example: 'Sender and beneficiary information collected, verified, and stored for every transaction. IFTI obligations automatically flagged.' },
      { industry: 'Law Firm (Tranche 2)', example: 'New matter inception triggers a compliant client intake flow — CDD done before the first billing entry.' },
    ],
    outcome: 'Cut onboarding time from days to minutes. Every customer documented. Every AUSTRAC CDD requirement met.',
    useCases: [
      'DCEs onboarding high volumes of retail crypto customers',
      'Remittance providers collecting sender/receiver information',
      'Law firms capturing client due diligence at matter inception',
    ],
  },
  {
    slug: 'kyc-kyb',
    title: 'KYC & KYB',
    tagline: "Know exactly who you're doing business with",
    color: 'from-purple-500 to-violet-600',
    problem: "Manual identity checks are slow and inconsistent. Sanctions databases need to be searched individually. Business ownership structures can hide the true beneficial owner. The result: some customers get thorough checks, some don't, and your exposure to regulatory risk is higher than it needs to be.",
    painPoints: [
      'Manual database searches miss sanctions hits — databases update daily',
      'Business customers with complex ownership structures are verified inconsistently',
      "Beneficial owners are not always who they appear to be — shell structures are hard to see",
    ],
    whyMatters: "Onboarding a sanctioned individual or entity is an AUSTRAC breach — regardless of whether you knew. 'We checked manually' is not a defence when a prohibited person transacts through your business. Identity confidence is the foundation of everything else.",
    stats: [
      { stat: '100%', label: 'Of customers screened against global sanctions lists' },
      { stat: 'Real-time', label: 'Sanctions and PEP database updates — never stale' },
      { stat: '5+', label: 'Global watchlists checked per customer' },
    ],
    solution: 'Verigo runs automated identity verification, sanctions screening, PEP identification, and adverse media checks on every customer. For businesses, the ownership structure is mapped automatically — beneficial owners surfaced and verified. Nothing is missed.',
    workflow: [
      { title: 'Identity submitted', desc: 'Customer provides name, DOB, and document — individual or entity.' },
      { title: 'Documents verified', desc: 'Automated document authenticity check against biometric data.' },
      { title: 'Sanctions & PEP checked', desc: 'Screened against OFAC, UN, EU, DFAT, UK HMT, and PEP databases.' },
      { title: 'Adverse media scanned', desc: 'Open-source adverse media screening against global news sources.' },
      { title: 'Ownership mapped (KYB)', desc: 'Business ownership structure mapped to ultimate beneficial owners.' },
      { title: 'Risk decision', desc: 'Pass, escalate to EDD, or reject — with documented evidence for each outcome.' },
    ],
    benefits: [
      'Every customer checked against every relevant database — no manual lookups required',
      'Beneficial ownership mapped automatically — no hidden ownership structures',
      "Sanctioned individuals identified before they transact — not after",
      'PEP customers routed to enhanced due diligence automatically',
      'Full screening evidence stored for every customer — producible on demand',
    ],
    industryExamples: [
      { industry: 'Foreign Exchange Dealer', example: 'High-risk international customers screened against all relevant sanctions lists before a transaction is processed.' },
      { industry: 'Payment Service Provider', example: 'Merchant KYB maps full ownership structure — UBOs identified and verified before platform access granted.' },
      { industry: 'Accounting Firm (Tranche 2)', example: 'Corporate client KYB completed at engagement — directors, shareholders, and UBOs all verified and documented.' },
    ],
    outcome: 'Know with confidence who every customer is — individual or business. Catch sanctions hits and PEPs before they become your problem.',
    useCases: [
      'FX providers screening high-risk international customers',
      'Payment service providers verifying merchant identities',
      'Accountants conducting KYB on corporate clients under Tranche 2',
    ],
  },
  {
    slug: 'kyc-identity-verification',
    title: 'KYC / Identity Verification',
    tagline: 'Identity confidence you can rely on',
    color: 'from-violet-500 to-purple-600',
    problem: "Asking customers to email photos of their documents is slow, insecure, and produces poor-quality evidence. Manual verification is inconsistent. Staff make different judgements on the same documents. The result is a compliance record that varies by who handled the onboarding.",
    painPoints: [
      'Document photos emailed by customers are low quality, altered, or unverifiable',
      'Manual review is inconsistent — different staff, different standards',
      'No biometric check means a photo of a document is not proof the person is who they claim',
    ],
    whyMatters: 'Identity verification is the first and most critical compliance control. A false identity gets through every downstream control — monitoring, screening, reporting — because the foundation is wrong. Getting identity right the first time is the highest-value compliance investment you can make.',
    stats: [
      { stat: 'Seconds', label: 'To complete an automated identity check' },
      { stat: '100+', label: 'Identity document types supported' },
      { stat: 'Biometric', label: 'Liveness check confirms the person matches the document' },
    ],
    solution: 'Verigo automates document capture, authenticity verification, and biometric liveness checking. Customers complete identity verification from their phone in under 2 minutes. The result is a cryptographically verified identity record — not an emailed photo.',
    workflow: [
      { title: 'Customer prompted', desc: 'Link sent to customer — complete from any device in 2 minutes.' },
      { title: 'Document scanned', desc: 'Passport, driver licence, or government ID captured and authenticated.' },
      { title: 'Liveness check', desc: 'Biometric selfie confirms the person matches the document.' },
      { title: 'Database verified', desc: 'DVS check confirms document details against government records.' },
      { title: 'Result recorded', desc: 'Verified identity stored with full evidence chain — always retrievable.' },
    ],
    benefits: [
      'Customers verified in under 2 minutes from their phone — no branch visit required',
      'Biometric check eliminates document fraud — photos and photocopies rejected',
      'Every verification decision stored with full evidence — AUSTRAC-ready',
      'Automated checks remove inconsistency — every customer gets the same standard',
      'Failed verifications trigger enhanced review — high-risk customers identified early',
    ],
    industryExamples: [
      { industry: 'Digital Currency Exchange', example: 'Retail customers verified in under 2 minutes — document + biometric. Zero staff involvement for standard customers.' },
      { industry: 'Remittance Provider', example: 'Sender identity verified before first transaction — document authenticity and liveness confirmed automatically.' },
      { industry: 'Real Estate Professional (Tranche 2)', example: 'Purchaser identity verified at the start of a transaction — before any property details are exchanged.' },
    ],
    outcome: 'Know exactly who your customers are — with biometric-grade confidence and a complete evidence trail.',
    useCases: [
      'DCEs verifying retail crypto customers at onboarding',
      'Remittance providers verifying senders before first transaction',
      'Tranche 2 businesses building a verifiable customer identity record from day one',
    ],
  },
  {
    slug: 'kyb-business-verification',
    title: 'KYB / Business Verification',
    tagline: 'Verify the business. Understand who controls it.',
    color: 'from-indigo-500 to-blue-600',
    problem: "Verifying a business customer is hard. An ABN lookup tells you a business exists — it does not tell you who actually controls it. Complex ownership structures with multiple layers of companies can hide the true beneficial owner. Shell companies are a primary vehicle for money laundering.",
    painPoints: [
      'An ABN confirms registration — it does not reveal who is behind the business',
      'Multi-layer ownership structures hide the true beneficial owner',
      'Directors may not be the controlling persons — understanding control is harder than verifying identity',
    ],
    whyMatters: "Businesses are the riskiest customer type for money laundering — not because business owners are criminals, but because legal structures can be used to obscure ownership and legitimise illicit funds. Your AML obligations require you to understand who ultimately benefits from a business relationship.",
    stats: [
      { stat: 'UBO', label: 'Ultimate beneficial ownership mapped automatically' },
      { stat: '25%+', label: 'Ownership threshold triggers UBO identification by default' },
      { stat: 'ASIC', label: 'Direct integration — live company registry verification' },
    ],
    solution: 'Verigo maps the complete ownership structure of every business customer — directors, shareholders, and ultimate beneficial owners. Company data is verified directly against ASIC. Ownership chains are traced until the natural persons in control are identified and verified.',
    workflow: [
      { title: 'Business details submitted', desc: 'ABN / ACN entered. VeriGo looks up ASIC records in real time.' },
      { title: 'Company verified', desc: 'Registered name, status, and registered address confirmed.' },
      { title: 'Directors identified', desc: 'All current directors listed and queued for individual KYC.' },
      { title: 'Ownership mapped', desc: 'Shareholders at 25%+ threshold identified. Parent companies traced.' },
      { title: 'UBOs identified', desc: 'Ownership chain traced to natural persons in control.' },
      { title: 'All parties verified', desc: 'KYC run on all directors and UBOs. Sanctions and PEP screening applied.' },
    ],
    benefits: [
      "You know who actually controls every business you work with — not just who registered it",
      'Ownership structures that would take hours to map manually are produced in minutes',
      'Sanctions and PEP checks applied to every director and beneficial owner automatically',
      'Complex ownership structures flagged for enhanced due diligence',
      'Complete corporate verification record stored — exportable for AUSTRAC on demand',
    ],
    industryExamples: [
      { industry: 'Payment Service Provider', example: 'Merchant KYB complete before platform access — all directors and UBOs identified, screened, and verified.' },
      { industry: 'Accounting Firm (Tranche 2)', example: 'Corporate client onboarding maps full ownership structure — KYB completed as part of engagement intake, not after.' },
      { industry: 'Law Firm (Tranche 2)', example: 'Corporate matter client UBOs identified and verified before advice is provided. EDD triggered where beneficial owners are in high-risk jurisdictions.' },
    ],
    outcome: "See through complex ownership structures to the people who actually control your business relationships.",
    useCases: [
      'PSPs verifying merchant identities and ownership',
      'Accounting firms completing KYB on corporate clients under Tranche 2',
      'Law firms identifying and verifying UBOs on corporate matters',
    ],
  },
  {
    slug: 'sanctions-screening',
    title: 'Sanctions & PEP Screening',
    tagline: 'Catch prohibited customers before they become your problem',
    color: 'from-red-500 to-rose-600',
    problem: "Onboarding a sanctioned individual or a politically exposed person without enhanced due diligence is an AUSTRAC breach. Sanctions lists are updated daily — a customer who was clean last month may be sanctioned today. Manual screening cannot keep up.",
    painPoints: [
      'Sanctions lists update daily — manual checks are always at risk of being stale',
      'PEPs are not always obvious — without a database, identification is inconsistent',
      'A missed sanction hit carries criminal liability — not just a fine',
    ],
    whyMatters: "Facilitating a transaction for a sanctioned party — even unknowingly — can carry criminal liability for your business and its officers. AUSTRAC and the Department of Foreign Affairs and Trade take sanctions breaches seriously. Automated, real-time screening is the only reliable defence.",
    stats: [
      { stat: '1,500+', label: 'Sanctions and watchlists monitored globally' },
      { stat: 'Real-time', label: 'List updates — never screening against stale data' },
      { stat: 'Automatic', label: 'EDD trigger when a PEP is identified' },
    ],
    solution: 'Verigo screens every customer — individual and business — against global sanctions lists, PEP databases, and adverse media sources at onboarding and on an ongoing basis. Any change in status after onboarding triggers an automatic review alert.',
    workflow: [
      { title: 'Customer submitted', desc: 'Name, DOB, and jurisdiction submitted for screening.' },
      { title: 'Sanctions matched', desc: 'Checked against OFAC, UN, EU, DFAT, UK HMT, and more.' },
      { title: 'PEP identified', desc: 'Global PEP database check — includes family and associates.' },
      { title: 'Adverse media scanned', desc: 'Open-source media screening for financial crime exposure.' },
      { title: 'Result actioned', desc: 'Clear = approved. Hit = case created for MLRO review.' },
      { title: 'Ongoing monitoring', desc: 'Alerts triggered if customer status changes post-onboarding.' },
    ],
    benefits: [
      'No sanctioned individual or entity transacts through your business undetected',
      'PEP customers automatically escalated to enhanced due diligence — no manual triage',
      'Post-onboarding alerts mean a customer who becomes sanctioned is caught immediately',
      'Every screening result documented — full evidence trail for AUSTRAC on demand',
      'False positive management built in — analysts resolve alerts with documented reasoning',
    ],
    industryExamples: [
      { industry: 'Foreign Exchange Dealer', example: 'All customers screened at onboarding and on every transaction. Sanctioned individuals identified before funds move.' },
      { industry: 'Remittance Provider', example: 'Sender and beneficiary screened on every transfer. High-risk corridor screening rules applied automatically.' },
      { industry: 'Conveyancer (Tranche 2)', example: 'Purchaser and vendor screened at matter inception. PEPs identified and EDD triggered before settlement.' },
    ],
    outcome: 'Screen every customer, every transaction, against every relevant list — automatically, every time.',
    useCases: [
      'FX dealers screening international customers',
      'Remittance providers with high-risk corridor exposure',
      'Tranche 2 businesses screening customers for the first time',
    ],
  },
  {
    slug: 'transaction-monitoring',
    title: 'Transaction Monitoring',
    tagline: 'Detect suspicious behaviour before it becomes a problem',
    color: 'from-cyan-500 to-blue-600',
    problem: "Suspicious activity hides in the volume of transactions your business processes. No compliance team can manually review thousands of transactions to find structuring patterns, velocity anomalies, or high-risk behaviour. What gets missed becomes a regulatory liability.",
    painPoints: [
      'Structuring and smurfing patterns only become visible at scale — impossible to spot manually',
      'High transaction volumes mean most transactions get no compliance review at all',
      'Missed suspicious activity means missed SMR obligations — and that is an AUSTRAC breach',
    ],
    whyMatters: "Your obligation to submit a Suspicious Matter Report exists whether or not you detect the activity. AUSTRAC holds reporting entities accountable for having monitoring systems capable of detecting suspicious activity — not just for reporting when they happen to notice something.",
    stats: [
      { stat: '100%', label: 'Of transactions reviewed — not a sample' },
      { stat: '24/7', label: 'Automated monitoring — no manual intervention required' },
      { stat: 'Instant', label: 'Alerts when suspicious patterns are detected' },
    ],
    solution: "Verigo's automated rule engine screens every transaction against configurable AML monitoring rules. Structuring, velocity anomalies, high-risk jurisdictions, and unusual behaviour are flagged in real time. Alerts become investigation cases automatically — nothing is dropped.",
    workflow: [
      { title: 'Transaction received', desc: 'Every transaction ingested — in real time or via batch upload.' },
      { title: 'Rules applied', desc: 'Configurable rule engine checks amount, frequency, jurisdiction, and behaviour.' },
      { title: 'Alert generated', desc: 'Rule breach creates an alert with full transaction context attached.' },
      { title: 'Case created', desc: 'Alert routed to case management — assigned to an analyst.' },
      { title: 'Investigation conducted', desc: 'Analyst reviews, documents findings, escalates to MLRO if required.' },
      { title: 'SMR filed or dismissed', desc: 'Suspicious matters reported to AUSTRAC. Dismissed cases documented with rationale.' },
    ],
    benefits: [
      'Every transaction reviewed — not a sample. Suspicious activity cannot hide in volume',
      'Structuring, velocity anomalies, and high-risk patterns detected automatically',
      'Analysts focus on genuine alerts — not manually reviewing transaction exports',
      'SMR preparation begins from the case — no manual re-entry of transaction details',
      'Monitoring effectiveness is demonstrable to AUSTRAC — rule configuration and alert history auditable',
    ],
    industryExamples: [
      { industry: 'Remittance Provider', example: 'Daily high-volume transfers monitored for structuring, high-risk corridor activity, and smurfing patterns — all automatically.' },
      { industry: 'Digital Currency Exchange', example: 'Crypto transaction monitoring detects unusual wallet activity, rapid in/out patterns, and exchange-specific risk signals.' },
      { industry: 'Payment Service Provider', example: 'Merchant transaction monitoring identifies unusual velocity, high refund rates, and off-hours activity that may indicate card fraud or laundering.' },
    ],
    outcome: 'Monitor 100% of transactions. Detect what matters. Build the evidence that satisfies AUSTRAC.',
    useCases: [
      'Remittance providers monitoring high-volume international transfers',
      'DCEs detecting structuring and smurfing patterns',
      'PSPs identifying unusual merchant activity',
    ],
  },
  {
    slug: 'case-management',
    title: 'Case Management',
    tagline: 'From alert to resolution. Every time. Without exception.',
    color: 'from-amber-500 to-orange-500',
    problem: "Compliance alerts without structured workflows become dead ends. Analysts receive an alert, review it in isolation, make a mental note, and move on. There is no trail of what was investigated, who made the decision, and why. When AUSTRAC asks to see your investigation records, you have nothing to show.",
    painPoints: [
      'Alerts reviewed informally — no documented investigation workflow',
      "Suspicious matters not reported because there's no system to track them to resolution",
      'No four-eyes review on high-risk decisions — analyst judgement unchecked',
    ],
    whyMatters: "The obligation to submit a Suspicious Matter Report only starts when you detect suspicious activity — but AUSTRAC also expects you to demonstrate that your investigation process is robust. An alert reviewed in a spreadsheet with no documented reasoning does not meet that standard.",
    stats: [
      { stat: '0', label: 'Cases fall through the cracks — every alert tracked to resolution' },
      { stat: '4-eyes', label: 'Approval for high-risk decisions — enforced by the platform' },
      { stat: 'Full', label: 'Audit trail on every case — decision, reasoning, and evidence' },
    ],
    solution: "Verigo automatically creates a case for every monitoring alert. Cases are assigned to analysts, tracked through investigation stages, escalated to the MLRO for high-risk decisions, and resolved with a complete documented record. SMR preparation flows directly from the case.",
    workflow: [
      { title: 'Alert triggers case', desc: 'Monitoring alert or manual referral automatically creates a case.' },
      { title: 'Assigned to analyst', desc: 'Case routed to the right analyst based on type and queue.' },
      { title: 'Investigation documented', desc: 'Analyst records findings, attaches evidence, and notes conclusions.' },
      { title: 'MLRO escalation', desc: 'High-risk cases escalated for MLRO review with full context.' },
      { title: 'Four-eyes approval', desc: 'Material decisions require a second reviewer — enforced by the platform.' },
      { title: 'SMR filed or closed', desc: 'Suspicious matters sent to AUSTRAC from the case. Closed cases retain full record.' },
    ],
    benefits: [
      'Every alert becomes a case — nothing falls through the cracks',
      'Investigations are documented end to end — not held in analyst memory',
      'AUSTRAC can see every investigation decision with its reasoning and evidence',
      'High-risk decisions reviewed by MLRO — consistent with four-eyes principles',
      'SMR preparation is fast — all transaction and investigation context already in the case',
    ],
    industryExamples: [
      { industry: 'MLRO — Remittance Provider', example: 'Manages a queue of 30–50 weekly alerts. Every case investigated, documented, and resolved without a single falling through.' },
      { industry: 'Compliance Team — DCE', example: 'High-volume alert environment. Automated triage, analyst assignment, and escalation rules mean cases flow without manual coordination.' },
      { industry: 'Law Firm (Tranche 2)', example: 'First-time case management for suspected suspicious client matters. Guided workflow means junior compliance staff follow the same process as experienced MLROs.' },
    ],
    outcome: 'Zero uninvestigated alerts. A complete, documented investigation record. AUSTRAC-ready case files.',
    useCases: [
      'MLRO teams managing suspicious matter investigations',
      'Compliance teams handling high-volume alert queues',
      'Businesses preparing SMRs from investigated cases',
    ],
  },
  {
    slug: 'regulatory-reporting',
    title: 'Regulatory Reporting',
    tagline: 'Submit accurate AUSTRAC reports. On time. Every time.',
    color: 'from-rose-500 to-pink-600',
    problem: "Building AUSTRAC-compliant reports manually is slow, error-prone, and stressful. Fields are missed. Thresholds are miscalculated. Reports are submitted late because the person responsible was also managing a caseload. A late or incorrect AUSTRAC report is not just an administrative failure — it is a breach.",
    painPoints: [
      'Manual report building takes hours — data pulled from multiple systems',
      'Missed or incorrect fields require amendments — attracting regulatory attention',
      'Deadline pressure means reports are submitted without a second review',
    ],
    whyMatters: "AUSTRAC uses your reporting data to build financial intelligence. Late reports mean delayed intelligence. Incorrect reports mean bad intelligence. Both attract scrutiny. Your reporting obligation exists regardless of whether you have time — and AUSTRAC tracks your submission history.",
    stats: [
      { stat: '3 days', label: 'SMR deadline after suspicion formed — non-negotiable' },
      { stat: '10 days', label: 'IFTI deadline for international transfers over $1,000' },
      { stat: '0', label: 'Manual data entry — reports pre-populated from your transaction data' },
    ],
    solution: "Verigo pre-populates every AUSTRAC report from your transaction and case data. SMRs, IFTIs, and TTRs are built automatically — no copy-pasting from spreadsheets. Built-in validation catches errors before submission. Deadlines are tracked and alerts sent before they are missed.",
    workflow: [
      { title: 'Trigger identified', desc: 'Transaction threshold reached, suspicious matter confirmed, or IFTI obligation met.' },
      { title: 'Report auto-populated', desc: 'All required fields pre-filled from transaction and customer data.' },
      { title: 'Validation run', desc: 'Built-in AUSTRAC validation checks format, completeness, and data accuracy.' },
      { title: 'MLRO review', desc: 'Report reviewed and approved before submission — full audit of who approved it.' },
      { title: 'Submitted to AUSTRAC', desc: 'Submitted via AUSTRAC ROMS integration — confirmation number stored.' },
      { title: 'Deadline tracked', desc: 'Upcoming report deadlines visible on dashboard. Reminders sent before due date.' },
    ],
    benefits: [
      'Reports built in minutes — not hours — because the data is already in the platform',
      'No missed fields or incorrect thresholds — AUSTRAC validation runs before submission',
      'Deadline tracking means reports are never submitted late',
      'Full audit trail of who prepared, reviewed, and submitted every report',
      'Bulk IFTI submission for high-volume remittance operations',
    ],
    industryExamples: [
      { industry: 'Digital Currency Exchange', example: 'Daily TTR obligations handled automatically — threshold transactions detected and reports prepared without manual intervention.' },
      { industry: 'Remittance Provider', example: 'Bulk IFTI submission for high-volume international transfers. 200+ IFTIs submitted in a single batch without manual data entry.' },
      { industry: 'MLRO — Any Sector', example: 'SMR prepared directly from investigation case — all transaction detail and investigation notes pre-populated. Submitted in minutes, not hours.' },
    ],
    outcome: 'Submit every AUSTRAC report accurately and on time — without manual data entry or deadline anxiety.',
    useCases: [
      'DCEs with daily TTR obligations',
      'Remittance providers managing high-volume IFTI submissions',
      'Compliance officers preparing SMRs under time pressure',
    ],
  },
  {
    slug: 'reporting-groups',
    title: 'Reporting Groups',
    tagline: 'One view of compliance across your entire group',
    color: 'from-teal-500 to-cyan-600',
    problem: "Large groups struggle to maintain consistent compliance standards across multiple entities. Each entity has its own compliance team, its own processes, and its own blind spots. Group-level oversight means endless status calls and spreadsheets that are out of date the moment they are sent.",
    painPoints: [
      'Group CCO has no real-time view of compliance health across entities',
      'Duplicate effort — each entity builds its own AML Program from scratch',
      'Reporting group obligations not understood — consolidated reporting done manually',
    ],
    whyMatters: "AUSTRAC regulates Reporting Groups as a specific entity type — with obligations around consolidated compliance oversight, shared AML Programs, and group-level reporting. Getting Reporting Group compliance right requires more than a holding company spreadsheet.",
    stats: [
      { stat: '1 view', label: 'Of compliance status across all entities in your group' },
      { stat: 'Shared', label: 'AML Program across the group — one update, all entities aligned' },
      { stat: 'Consolidated', label: 'AUSTRAC reporting — group-level obligations met' },
    ],
    solution: "Verigo's Reporting Group module gives group compliance teams a consolidated view of every entity's compliance status. Shared AML Programs, centralised customer records, and consolidated AUSTRAC reporting mean group compliance is managed as one — not as a collection of individual efforts.",
    workflow: [
      { title: 'Group configured', desc: 'Group structure set up — entities, relationships, and reporting hierarchy.' },
      { title: 'Shared program deployed', desc: 'Group AML Program applied across all entities with entity-specific customisations.' },
      { title: 'Centralised customer records', desc: 'Shared customer master records — one CDD record, multiple entities.' },
      { title: 'Entity monitoring', desc: 'Transaction monitoring at entity level — alerts escalated to group MLRO.' },
      { title: 'Consolidated reporting', desc: 'Group-level AUSTRAC reporting across all entities from one submission.' },
      { title: 'Group dashboard', desc: 'Group CCO views compliance status across all entities in real time.' },
    ],
    benefits: [
      'Group CCO sees a live view of compliance health across every entity — no status calls required',
      'Shared AML Program means all entities are aligned — one update propagates across the group',
      'Consolidated AUSTRAC reporting meets group obligations without duplicate submissions',
      'Customer shared across entities — CDD done once, applied group-wide',
      'Compliance gaps at entity level surface to group level automatically',
    ],
    industryExamples: [
      { industry: 'Financial Services Group', example: 'Group CCO monitors compliance status across 8 AUSTRAC-registered entities from a single dashboard.' },
      { industry: 'Multi-brand DCE', example: 'Two crypto exchange brands under one group — shared customer master records, group-level AML Program, consolidated TTR submissions.' },
      { industry: 'Law Firm Network', example: 'National law firm with branches across states — group AML Program with branch-specific customisations. Branch compliance reported to group MLRO.' },
    ],
    outcome: 'One view. One program. One reporting obligation. Group compliance without the complexity.',
    useCases: [
      'Financial services groups with multiple AUSTRAC registrations',
      'Multi-brand DCE operations',
      'Law firm networks with shared AML obligations',
    ],
  },
  {
    slug: 'workflow-automation',
    title: 'Workflow Automation',
    tagline: 'Free your team from compliance administration',
    color: 'from-indigo-500 to-blue-700',
    problem: "Compliance teams are bottlenecked by repetitive administrative work — sending KYC renewal reminders, assigning reviews, escalating overdue cases, chasing document uploads. This work is necessary but low-value. Every hour spent on it is an hour not spent on complex judgement calls that actually require a human.",
    painPoints: [
      'Manual KYC renewal reminders — sent by email, often missed',
      'Escalation rules exist in policy documents but are never consistently applied',
      'Compliance team capacity consumed by coordination that could be automated',
    ],
    whyMatters: "The scale of compliance work required by Australian AML law — ongoing monitoring, periodic reviews, alert triage, report generation — exceeds what any small team can handle manually. Automation is not optional for compliance teams that want to keep up without doubling headcount.",
    stats: [
      { stat: 'No-code', label: 'Build automation rules without engineering support' },
      { stat: 'Event-driven', label: 'Automations trigger instantly when conditions are met' },
      { stat: '80%', label: 'Reduction in manual coordination for teams using automation' },
    ],
    solution: "Verigo's no-code workflow builder lets compliance teams automate triggers, approvals, escalations, and notifications without writing a single line of code. Build once, run forever — and your compliance obligations are met consistently, even during busy periods.",
    workflow: [
      { title: 'Define trigger', desc: 'Select the event — risk score change, document expiry, deadline approaching.' },
      { title: 'Set conditions', desc: 'Apply filters — only for high-risk customers, only for specific transaction types.' },
      { title: 'Configure action', desc: 'Choose what happens — assign task, send reminder, escalate case, generate report.' },
      { title: 'Test and activate', desc: 'Test automation against live data before switching on.' },
      { title: 'Monitor performance', desc: 'Dashboard shows automation activity — triggered, completed, failed.' },
    ],
    benefits: [
      'KYC renewals happen automatically — no manual tracking of expiry dates',
      'Escalation rules applied consistently — no case treated differently because of who reviewed it',
      'Compliance team capacity freed for complex decisions that require human judgement',
      'New compliance obligations handled with a new automation rule — not new headcount',
      "Automation activity logged — every triggered action is documented and auditable",
    ],
    industryExamples: [
      { industry: 'Compliance Manager — Any Sector', example: 'KYC renewal reminders sent automatically 30 days before expiry — no manual tracking. Overdue renewals escalated to MLRO automatically.' },
      { industry: 'MLRO — High-volume DCE', example: 'Risk score breach triggers automatic EDD assignment — no manual triage of which customers need enhanced review.' },
      { industry: 'Remittance Operations Team', example: 'Weekly IFTI report generated and sent for MLRO approval automatically — compliance deadline never missed.' },
    ],
    outcome: "Free your compliance team from administration. Automate the routine — focus on the decisions that actually need you.",
    useCases: [
      'Automating periodic KYC renewal reminders',
      'Triggering enhanced due diligence on risk threshold breach',
      'Scheduling and distributing weekly compliance reports',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// METADATA & STATIC PARAMS
// ─────────────────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ industry: string }> }) {
  const { industry: slug } = await params
  const ind = getIndustry(slug)
  if (ind) {
    return {
      title: `AML Compliance for ${ind.label} | Verigo`,
      description: `${ind.label} AML/CTF compliance made easy. ${ind.description} AUSTRAC-ready, Australian data hosting.`,
    }
  }
  const cap = capabilitiesData.find(c => c.slug === slug) ?? libCapabilities.find(c => c.slug === slug)
  if (cap) {
    return {
      title: `${cap.title} | Verigo AML Platform`,
      description: cap.tagline,
    }
  }
  return {}
}

export async function generateStaticParams() {
  const industrySlugs = industries.map(i => ({ industry: i.id }))
  const inlineCapSlugs = capabilitiesData.map(c => ({ industry: c.slug }))
  const libCapSlugs = libCapabilities.map(c => ({ industry: c.slug }))
  const allCaps = [...inlineCapSlugs, ...libCapSlugs]
  const dedupedCaps = allCaps.filter((v, i, a) => a.findIndex(x => x.industry === v.industry) === i)
  return [...industrySlugs, ...dedupedCaps]
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE ROUTER
// ─────────────────────────────────────────────────────────────────────────────

export default async function IndustryOrCapabilityPage({ params }: { params: Promise<{ industry: string }> }) {
  const { industry: slug } = await params

  const inlineCap = capabilitiesData.find(c => c.slug === slug)
  if (inlineCap) return <CapabilityPage cap={inlineCap} />

  const libCap = libCapabilities.find(c => c.slug === slug)
  if (libCap) {
    const mapped: Capability = {
      slug: libCap.slug,
      title: libCap.title,
      tagline: libCap.tagline,
      color: 'from-blue-500 to-blue-600',
      problem: libCap.problem,
      painPoints: [],
      whyMatters: libCap.problem,
      stats: [],
      solution: libCap.solution,
      workflow: [],
      benefits: libCap.benefits,
      industryExamples: libCap.useCases.map(u => ({ industry: '', example: u.description })),
      outcome: libCap.outcome,
      useCases: libCap.useCases.map(u => u.description),
    }
    return <CapabilityPage cap={mapped} />
  }

  const ind = getIndustry(slug)
  if (ind) return <IndustryPage ind={ind} />

  notFound()
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPABILITY PAGE — 7-section outcome-first structure
// ─────────────────────────────────────────────────────────────────────────────

function CapabilityPage({ cap }: { cap: Capability }) {
  const Icon = capabilityIconMap[cap.slug] ?? Shield

  return (
    <div className="bg-white text-slate-900">

      {/* HERO */}
      <section className={`bg-gradient-to-br ${cap.color} pt-32 pb-16 px-4 sm:px-6 lg:px-8`}>
        <div className="max-w-5xl mx-auto">
          <Link href="/solutions" className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white mb-8 transition-colors">
            ← All solutions
          </Link>
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 bg-white/15 rounded-2xl flex items-center justify-center flex-shrink-0 ring-1 ring-white/20">
              <Icon className="w-8 h-8 text-white" />
            </div>
            <div>
              <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20 mb-3 block w-fit">
                Platform Capability
              </span>
              <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-3">{cap.title}</h1>
              <p className="text-xl text-white/80 max-w-2xl">{cap.tagline}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">

        {/* SECTION 1 — PROBLEM */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-red-500">The Problem</h2>
          </div>
          <p className="text-xl text-slate-700 leading-relaxed mb-8 max-w-3xl">{cap.problem}</p>
          {cap.painPoints.length > 0 && (
            <div className="grid sm:grid-cols-3 gap-4">
              {cap.painPoints.map((p, i) => (
                <div key={i} className="rounded-2xl bg-red-50 ring-1 ring-red-100 p-5">
                  <div className="w-2 h-2 rounded-full bg-red-400 mb-3" />
                  <p className="text-sm text-slate-700 leading-relaxed">{p}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 2 — WHY IT MATTERS */}
        <section className="bg-slate-900 rounded-3xl p-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-blue-300" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-300">Why It Matters</h2>
          </div>
          <p className="text-white text-lg leading-relaxed mb-8 max-w-3xl">{cap.whyMatters}</p>
          {cap.stats.length > 0 && (
            <div className="grid sm:grid-cols-3 gap-5">
              {cap.stats.map(s => (
                <div key={s.stat} className="bg-white/5 rounded-2xl p-5 ring-1 ring-white/10 text-center">
                  <div className="text-3xl font-black text-white mb-2">{s.stat}</div>
                  <div className="text-slate-400 text-sm">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 3 — HOW VERIGO SOLVES IT */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">How Verigo Solves It</h2>
          </div>
          <p className="text-xl text-slate-700 leading-relaxed max-w-3xl">{cap.solution}</p>
        </section>

        {/* SECTION 4 — WORKFLOW */}
        {cap.workflow.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-4 h-4 text-indigo-600" />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600">How It Works</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cap.workflow.map((step, i) => (
                <div key={i} className="pub-card flex gap-4">
                  <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0">
                    {i + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm mb-1">{step.title}</h3>
                    <p className="text-slate-500 text-xs leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 5 — KEY BENEFITS */}
        <section className={`bg-gradient-to-br ${cap.color} rounded-3xl p-10`}>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/80">Key Benefits</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {cap.benefits.map((b, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/10 rounded-2xl p-4 ring-1 ring-white/15">
                <CheckCircle className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                <p className="text-white text-sm leading-relaxed">{b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 6 — INDUSTRY EXAMPLES */}
        {cap.industryExamples.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-emerald-600" />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-600">Industry Examples</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-5">
              {cap.industryExamples.map((ex, i) => (
                <div key={i} className="pub-card flex flex-col gap-3">
                  {ex.industry && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 w-fit">
                      {ex.industry}
                    </span>
                  )}
                  <p className="text-slate-600 text-sm leading-relaxed">{ex.example}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 7 — CTA */}
        <section className="bg-slate-900 rounded-3xl p-10 text-center">
          <div className={`w-14 h-14 bg-gradient-to-br ${cap.color} rounded-2xl flex items-center justify-center mx-auto mb-5`}>
            <Icon className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-3xl font-black text-white mb-3">Try {cap.title} free for 7 days</h2>
          <p className="text-slate-400 max-w-lg mx-auto mb-8">{cap.outcome}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/live-demo" className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-8 py-4 text-base font-semibold text-white ring-1 ring-white/15 hover:bg-white/10 transition-colors">
              Book Demo
            </Link>
          </div>
        </section>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// INDUSTRY PAGE — 9-section structure
// ─────────────────────────────────────────────────────────────────────────────

function IndustryPage({ ind }: { ind: NonNullable<ReturnType<typeof getIndustry>> }) {
  const IndIcon = industryIconMap[ind.id] ?? Shield
  const regimeBadge = ind.regime === 'current'
    ? { label: 'Active obligations now', cls: 'bg-green-50 text-green-700 ring-green-700/10' }
    : { label: 'Tranche 2 — obligations from 2026', cls: 'bg-amber-50 text-amber-700 ring-amber-700/10' }

  const planColor: Record<string, string> = {
    Essential: 'bg-slate-900 text-white',
    Professional: 'bg-blue-600 text-white',
    Enterprise: 'bg-indigo-600 text-white',
  }

  return (
    <div className="bg-white text-slate-900">

      {/* HERO */}
      <section className={`bg-gradient-to-br ${ind.color} pt-32 pb-16 px-4 sm:px-6 lg:px-8`}>
        <div className="max-w-5xl mx-auto">
          <Link href="/solutions" className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white mb-8 transition-colors">
            ← All solutions
          </Link>
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 bg-white/15 rounded-2xl flex items-center justify-center flex-shrink-0 ring-1 ring-white/20"><IndIcon className="w-8 h-8 text-white" /></div>
            <div>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset mb-3 block w-fit ${regimeBadge.cls}`}>
                {regimeBadge.label}
              </span>
              <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-3">{ind.label}</h1>
              <p className="text-xl text-white/80 max-w-2xl">{ind.description}</p>
              <p className="text-xs text-white/50 mt-2">{ind.austracRef}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">

        {/* 1 — AML OBLIGATIONS */}
        <section className="bg-slate-900 rounded-3xl p-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-blue-300" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-300">AML/CTF Obligations</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-8">
            {ind.obligations.map((o, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/5 rounded-xl px-4 py-3 ring-1 ring-white/10">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-slate-300 text-sm leading-relaxed">{o}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-slate-500 mr-2 self-center">Required reports:</span>
            {ind.reportingRequirements.types.map(t => (
              <span key={t} className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">{t}</span>
            ))}
          </div>
          <p className="text-slate-400 text-sm mt-3 leading-relaxed">{ind.reportingRequirements.details}</p>
        </section>

        {/* 2 — TYPICAL CUSTOMER RISKS */}
        {ind.customerRisks.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-red-500" />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-red-500">Typical Customer Risk Profiles</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {ind.customerRisks.map((r, i) => (
                <div key={i} className="pub-card flex flex-col gap-2">
                  <div className="w-6 h-6 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-red-600 font-bold text-xs">{i + 1}</span>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">{r}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3 — COMPLIANCE PACK + faded how verigo helps + faded workflow */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Database className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">Recommended Compliance Pack</h2>
          </div>

          {/* Pack card */}
          <div className="bg-blue-50 ring-1 ring-blue-200 rounded-2xl p-7 flex flex-col sm:flex-row gap-6 items-start mb-8">
            <div className={`w-14 h-14 bg-gradient-to-br ${ind.color} rounded-2xl flex items-center justify-center flex-shrink-0`}><IndIcon className="w-7 h-7 text-white" /></div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 text-lg mb-1">{ind.packName}</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Pre-configured for {ind.label} — KYC rules, risk thresholds, AUSTRAC report templates, CDD workflows, and monitoring rules aligned to your obligations. Ready from day one.
              </p>
              <Link href={`/packs/${ind.id}`} className="pub-btn-secondary inline-flex">View pack details</Link>
            </div>
          </div>

          {/* What's included */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">What&apos;s included</p>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">System default — customisable</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {ind.howVerigoHelps.map((h, i) => (
                <div key={i} className="flex items-start gap-2 px-4 py-3 bg-slate-50 rounded-xl ring-1 ring-slate-100">
                  <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-700 text-xs leading-relaxed">{h}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Example workflow */}
          {ind.exampleWorkflow.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Example workflow</p>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">Default — you can modify steps</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ind.exampleWorkflow.map((step, i) => (
                  <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-xl px-4 py-3 ring-1 ring-slate-100">
                    <span className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-[10px] flex-shrink-0 mt-0.5">{i + 1}</span>
                    <div>
                      <p className="text-slate-800 text-xs font-semibold mb-0.5">{step.title}</p>
                      <p className="text-slate-500 text-xs leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 8 — PRICING RECOMMENDATION */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-600">Pricing Recommendation</h2>
          </div>
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className={`${planColor[ind.pricingRec.plan] ?? 'bg-slate-900 text-white'} rounded-2xl px-6 py-4 flex-shrink-0 text-center min-w-[120px]`}>
              <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">Recommended</p>
              <p className="text-2xl font-black">{ind.pricingRec.plan}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-5 flex-1 ring-1 ring-slate-200">
              <p className="text-slate-700 text-sm leading-relaxed mb-4">{ind.pricingRec.reason}</p>
              <Link href="/pricing" className="text-blue-600 text-sm font-semibold hover:underline flex items-center gap-1">
                View full pricing <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* 9 — BOOK DEMO */}
        <section className="bg-slate-900 rounded-3xl p-10 text-center">
          <div className={`w-14 h-14 bg-gradient-to-br ${ind.color} rounded-2xl flex items-center justify-center mx-auto mb-5`}><IndIcon className="w-7 h-7 text-white" /></div>
          <h2 className="text-3xl font-black text-white mb-3">
            Ready to get compliant as a {ind.shortLabel}?
          </h2>
          <p className="text-slate-400 max-w-lg mx-auto mb-8">
            Your {ind.packName} is configured on day one. 7-day free trial — no credit card, no consultants, no configuration sprints.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/live-demo" className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-8 py-4 text-base font-semibold text-white ring-1 ring-white/15 hover:bg-white/10 transition-colors">
              Book a Demo
            </Link>
          </div>
        </section>

      </div>
    </div>
  )
}
