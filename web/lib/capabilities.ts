export type UseCase = {
  title: string
  description: string
}

export type Capability = {
  id: string
  slug: string
  title: string
  icon: string
  tagline: string
  problem: string
  solution: string
  benefits: string[]
  outcome: string
  useCases: UseCase[]
  relatedIndustries: string[]
}

export const capabilities: Capability[] = [
  {
    id: 'customer-onboarding',
    slug: 'customer-onboarding',
    title: 'Customer Onboarding',
    icon: 'UserCheck',
    tagline: 'Digital onboarding with compliance built in from the start',
    problem: 'Manual customer onboarding is slow, inconsistent, and creates compliance gaps. Paper-based and ad hoc processes result in missing fields, incomplete documentation, and poor audit trails that expose the business to regulatory risk during AUSTRAC inspections.',
    solution: 'VeriGo provides guided digital onboarding flows with embedded KYC checks, automated document collection, and real-time risk scoring. Every customer journey follows the same consistent, auditable process — aligned to your industry\'s specific compliance obligations from day one.',
    benefits: [
      'Guided step-by-step digital onboarding flows configured for your industry',
      'Automated document collection with expiry tracking and re-verification alerts',
      'Embedded real-time KYC checks at the point of onboarding',
      'Automated risk scoring based on customer profile, industry, and jurisdiction',
      'Customer portal access for self-service document submission',
      'Complete onboarding audit trail for every customer interaction',
    ],
    outcome: 'Cut onboarding time from days to minutes while meeting every AUSTRAC customer due diligence requirement. No manual steps, no compliance gaps.',
    useCases: [
      {
        title: 'DCE retail customer onboarding',
        description: 'Digital currency exchanges use VeriGo to onboard high volumes of retail customers with automated biometric KYC, sanctions screening, and risk scoring — all before the first transaction.',
      },
      {
        title: 'Remittance sender/receiver capture',
        description: 'Remittance providers collect and verify sender and beneficiary information through guided digital flows, ensuring IFTI reporting fields are pre-populated accurately.',
      },
      {
        title: 'Law firm client intake (Tranche 2)',
        description: 'Law firms preparing for Tranche 2 use VeriGo to integrate CDD into the matter inception process, capturing identity, purpose of relationship, and risk flags at the client intake stage.',
      },
      {
        title: 'Real estate buyer due diligence',
        description: 'Real estate professionals use VeriGo to collect buyer identity, source of funds documentation, and beneficial ownership information in a structured, auditable workflow.',
      },
    ],
    relatedIndustries: ['digital-currency-exchange', 'remittance-provider', 'law-firm', 'real-estate', 'conveyancer'],
  },
  {
    id: 'kyc-identity-verification',
    slug: 'kyc-identity-verification',
    title: 'KYC / Identity Verification',
    icon: 'ScanFace',
    tagline: 'Know exactly who your customers are — every time',
    problem: 'Manually verifying customer identities across multiple data sources is time-consuming, inconsistent, and prone to human error. Missed verifications create regulatory breaches and allow sanctioned individuals or high-risk customers to slip through.',
    solution: 'VeriGo integrates with leading identity verification providers to automate document verification, facial recognition, and database cross-checks. Every customer is verified against the same rigorous process, with results recorded in a tamper-proof audit log.',
    benefits: [
      'Document verification including driver\'s licence, passport, and government ID',
      'Real-time facial recognition and liveness detection to prevent identity fraud',
      'Integration with GreenID (Equifax), Sumsub, Trulioo, and other identity providers',
      'Automated risk-based CDD — standard, enhanced, or simplified based on customer risk',
      'Ongoing periodic re-verification with automated renewal alerts',
      'Complete KYC audit trail with timestamps, results, and decision records',
    ],
    outcome: 'Achieve 100% consistent identity verification for every customer. Eliminate manual KYC bottlenecks and meet every AUSTRAC CDD requirement with a defensible audit trail.',
    useCases: [
      {
        title: 'High-volume retail KYC',
        description: 'Digital currency exchanges and PSPs use VeriGo KYC to verify thousands of retail customers with automated document checks and biometrics, reducing onboarding time to under 3 minutes.',
      },
      {
        title: 'Enhanced due diligence for high-risk customers',
        description: 'When risk scoring identifies a high-risk customer, VeriGo automatically escalates to enhanced due diligence — requesting additional documents, source of funds, and MLRO sign-off.',
      },
      {
        title: 'Periodic re-verification',
        description: 'VeriGo tracks KYC expiry dates and automatically triggers re-verification workflows when customer identity documents approach expiry, ensuring ongoing CDD compliance.',
      },
      {
        title: 'Tranche 2 client identity capture',
        description: 'Law firms, accountants, and real estate professionals preparing for Tranche 2 use VeriGo KYC to build defensible client identity records integrated into their matter management processes.',
      },
    ],
    relatedIndustries: ['digital-currency-exchange', 'remittance-provider', 'foreign-exchange', 'payment-service-provider', 'real-estate', 'law-firm', 'accounting-firm'],
  },
  {
    id: 'kyb-business-verification',
    slug: 'kyb-business-verification',
    title: 'KYB / Business Verification',
    icon: 'Building2',
    tagline: 'Verify business customers and map beneficial ownership with confidence',
    problem: 'Verifying business customers and mapping beneficial ownership structures is complex, time-consuming, and often done inconsistently. Corporate structures are routinely used to conceal the true owners of funds, and failure to identify ultimate beneficial owners is one of the most common AML compliance failures identified by AUSTRAC.',
    solution: 'VeriGo automates business verification through integration with company registries and data providers, mapping multi-layered corporate structures to identify ultimate beneficial owners. Every UBO is automatically subjected to KYC, PEP screening, and sanctions checks.',
    benefits: [
      'Automated Australian business verification via ASIC and CreditorWatch integration',
      'Multi-layered corporate structure mapping with unlimited ownership depth',
      'Automatic UBO identification at configurable ownership thresholds (typically 25%)',
      'Individual KYC triggered for every identified beneficial owner',
      'Trust structure documentation and beneficiary identification',
      'Ongoing monitoring for changes in corporate ownership and directorship',
    ],
    outcome: 'Build a complete, accurate picture of every business customer — including who ultimately owns and controls them. Satisfy beneficial ownership requirements with defensible documentation.',
    useCases: [
      {
        title: 'PSP merchant verification',
        description: 'Payment service providers use VeriGo KYB to verify merchants at onboarding, confirming business legitimacy, ownership structure, and running UBOs through sanctions and PEP checks.',
      },
      {
        title: 'Corporate property purchaser due diligence',
        description: 'Real estate professionals use VeriGo KYB to identify the beneficial owners behind corporate and trust property purchasers, satisfying their Tranche 2 CDD obligations.',
      },
      {
        title: 'Accounting firm corporate client onboarding',
        description: 'Accounting firms use VeriGo KYB to verify corporate clients seeking company formation or tax services, ensuring they understand the true beneficial ownership before providing designated services.',
      },
      {
        title: 'DCE business account onboarding',
        description: 'Digital currency exchanges with business account offerings use VeriGo KYB to apply the same rigorous beneficial ownership standards to institutional customers as they do to retail customers.',
      },
    ],
    relatedIndustries: ['payment-service-provider', 'real-estate', 'law-firm', 'accounting-firm', 'digital-currency-exchange', 'reporting-group'],
  },
  {
    id: 'sanctions-screening',
    slug: 'sanctions-screening',
    title: 'Sanctions Screening',
    icon: 'ShieldAlert',
    tagline: 'Screen every customer and transaction against global sanctions lists — automatically',
    problem: 'Sanctions compliance requires screening customers against dozens of global watchlists including OFAC, UN, EU, DFAT, and UK HMT. Manual screening is inconsistent, slow, and creates unacceptable risk of processing transactions for sanctioned individuals or entities.',
    solution: 'VeriGo provides automated real-time sanctions screening at customer onboarding and on an ongoing basis. Every customer is screened against a consolidated global sanctions database, with instant alerts for any potential matches requiring compliance review.',
    benefits: [
      'Real-time screening against OFAC, UN Security Council, EU, DFAT (Australia), and UK HMT lists',
      'Automated screening at onboarding, periodic review, and on-demand',
      'Fuzzy matching algorithms to catch name variations and transliterations',
      'Consolidated match review workflow for compliance officers',
      'Automatic re-screening when sanctions lists are updated',
      'Full audit trail of all screening events and match decisions',
    ],
    outcome: 'Catch 100% of sanctions matches before they become your customer or counterparty. Meet your obligations under Australian sanctions laws and AUSTRAC requirements simultaneously.',
    useCases: [
      {
        title: 'DCE customer screening',
        description: 'Digital currency exchanges run every new customer and beneficial owner through automated sanctions screening at account opening, before any transactions are permitted.',
      },
      {
        title: 'Remittance beneficiary screening',
        description: 'Remittance providers screen both senders and beneficiaries in real time before processing international transfers, ensuring no funds are transferred to sanctioned individuals.',
      },
      {
        title: 'Real-time transaction screening',
        description: 'Payment service providers screen merchant counterparties and high-value transaction parties in real time to prevent processing payments connected to sanctioned entities.',
      },
      {
        title: 'Periodic portfolio re-screening',
        description: 'When OFAC or other sanctions authorities update their lists, VeriGo automatically re-screens the entire customer portfolio and alerts compliance teams to any new potential matches.',
      },
    ],
    relatedIndustries: ['digital-currency-exchange', 'remittance-provider', 'foreign-exchange', 'payment-service-provider', 'real-estate', 'law-firm'],
  },
  {
    id: 'pep-screening',
    slug: 'pep-screening',
    title: 'PEP Screening',
    icon: 'UserX',
    tagline: 'Identify politically exposed persons and apply enhanced due diligence automatically',
    problem: 'Politically exposed persons (PEPs) represent an elevated risk of bribery, corruption, and money laundering. Identifying PEPs and their close associates manually is unreliable — global political databases are vast, and relationships between PEPs and account holders are not always disclosed.',
    solution: 'VeriGo integrates with global PEP databases to automatically identify customers, beneficial owners, and counterparties who are PEPs or closely associated with PEPs. Confirmed PEP matches automatically trigger enhanced due diligence workflows requiring MLRO review and sign-off.',
    benefits: [
      'Screening against global PEP databases covering domestic, foreign, and international organisation PEPs',
      'Identification of close associates, family members, and related parties of PEPs',
      'Automatic enhanced due diligence trigger for confirmed PEP matches',
      'MLRO review and approval workflow for PEP relationships',
      'Ongoing monitoring of PEP status with re-screening on database updates',
      'Full audit trail of PEP identification decisions and enhanced due diligence records',
    ],
    outcome: 'Identify every PEP in your customer base. Apply consistent enhanced due diligence without manual research or missed relationships.',
    useCases: [
      {
        title: 'FX provider PEP identification',
        description: 'Foreign exchange providers use VeriGo PEP screening to identify customers who are government officials or their associates, automatically triggering enhanced source of funds checks.',
      },
      {
        title: 'Real estate PEP buyer detection',
        description: 'Real estate professionals use VeriGo to screen property buyers and their beneficial owners for PEP status, applying enhanced due diligence before facilitating high-value property transactions.',
      },
      {
        title: 'Ongoing PEP monitoring',
        description: 'When a customer later becomes a PEP due to appointment to a public office, VeriGo\'s ongoing screening detects the status change and triggers an enhanced due diligence review.',
      },
      {
        title: 'Law firm client PEP screening',
        description: 'Law firms use VeriGo to screen clients receiving designated services for PEP status, applying proportionate enhanced due diligence for all matters involving PEP-connected clients.',
      },
    ],
    relatedIndustries: ['digital-currency-exchange', 'remittance-provider', 'foreign-exchange', 'real-estate', 'law-firm', 'accounting-firm'],
  },
  {
    id: 'adverse-media',
    slug: 'adverse-media',
    title: 'Adverse Media Monitoring',
    icon: 'Newspaper',
    tagline: 'Surface negative news about your customers before it becomes your problem',
    problem: 'Negative media about customers — arrests, regulatory actions, investigations, fraud allegations — is a critical AML risk signal that standard database checks cannot capture. Manually monitoring news sources for thousands of customers is not feasible, and important signals are regularly missed.',
    solution: 'VeriGo provides automated adverse media monitoring, scanning global news sources for mentions of your customers, beneficial owners, and key counterparties. Matches are surfaced through the compliance workflow for review, categorised by severity, and linked to the relevant customer record.',
    benefits: [
      'Automated adverse media screening at customer onboarding and on an ongoing basis',
      'Coverage of global news sources including Australian regulatory and court proceedings',
      'Categories including financial crime, regulatory action, fraud, corruption, and criminal activity',
      'Severity scoring to prioritise high-impact adverse media findings',
      'Integration with customer risk profiles — adverse media automatically elevates risk rating',
      'Compliance officer review workflow with decision documentation',
    ],
    outcome: 'Surface adverse media about your customers systematically and early. Adjust risk ratings, trigger enhanced due diligence, or exit relationships before regulatory or reputational damage occurs.',
    useCases: [
      {
        title: 'Post-onboarding adverse media check',
        description: 'After completing initial KYC, VeriGo automatically runs an adverse media check, surfacing any relevant negative news before the customer relationship commences.',
      },
      {
        title: 'Ongoing monitoring for existing customers',
        description: 'VeriGo continuously monitors news sources for customers in the portfolio, alerting compliance teams when new adverse media emerges that may warrant review or re-assessment.',
      },
      {
        title: 'High-risk customer enhanced monitoring',
        description: 'For customers with elevated risk ratings, VeriGo applies more frequent adverse media monitoring cadences, ensuring material developments are caught promptly.',
      },
      {
        title: 'Regulatory action detection',
        description: 'VeriGo surfaces regulatory actions, court orders, and AUSTRAC enforcement actions involving customers or their associated entities, triggering immediate compliance review.',
      },
    ],
    relatedIndustries: ['digital-currency-exchange', 'remittance-provider', 'payment-service-provider', 'law-firm', 'accounting-firm'],
  },
  {
    id: 'transaction-monitoring',
    slug: 'transaction-monitoring',
    title: 'Transaction Monitoring',
    icon: 'Activity',
    tagline: 'Automated AML surveillance across every transaction, around the clock',
    problem: 'Suspicious activity hides within the volume of legitimate transactions that compliance teams cannot manually review. Without automated monitoring, structuring, layering, and unusual patterns go undetected until it is too late — leaving the business exposed to regulatory action and financial crime facilitation.',
    solution: 'VeriGo\'s transaction monitoring engine applies configurable rule-based monitoring to every transaction in real time. Pre-built AML rules detect structuring, velocity patterns, high-risk jurisdiction flows, and other indicators of suspicious activity. Alerts are automatically routed to the case management system for investigation.',
    benefits: [
      'Pre-built AML monitoring rules calibrated for your industry and transaction types',
      'Configurable risk thresholds and detection parameters for your specific business',
      'Real-time alert generation for transactions matching AML risk indicators',
      'Structuring detection — pattern recognition across multiple transactions below thresholds',
      'Velocity monitoring — unusual frequency, amount, or counterparty patterns',
      'High-risk jurisdiction flags with automatic enhanced review triggers',
    ],
    outcome: 'Monitor 100% of transaction volume with zero manual review. Detect suspicious patterns early, generate alerts that meet AUSTRAC expectations, and build a defensible monitoring record.',
    useCases: [
      {
        title: 'DCE cryptocurrency transaction monitoring',
        description: 'Digital currency exchanges use VeriGo to monitor all crypto deposits, withdrawals, and on-chain flows for structuring, wallet address risks, and unusual patterns indicative of money laundering.',
      },
      {
        title: 'Remittance corridor monitoring',
        description: 'Remittance providers monitor transfer volumes, amounts, and corridors at both the customer and aggregate level to detect unusual patterns that may indicate structuring or suspicious activity.',
      },
      {
        title: 'PSP merchant transaction surveillance',
        description: 'Payment service providers apply merchant-level monitoring to detect unusual transaction patterns, high-risk merchant category spending, and velocity anomalies that may indicate fraud or laundering.',
      },
      {
        title: 'FX structuring detection',
        description: 'Foreign exchange providers use VeriGo\'s structuring detection rules to identify customers making multiple currency conversions below the $10,000 TTR threshold that together indicate deliberate evasion.',
      },
    ],
    relatedIndustries: ['digital-currency-exchange', 'remittance-provider', 'foreign-exchange', 'payment-service-provider', 'law-firm', 'reporting-group'],
  },
  {
    id: 'case-management',
    slug: 'case-management',
    title: 'Case Management',
    icon: 'FolderOpen',
    tagline: 'From alert to resolution — no case falls through the cracks',
    problem: 'Transaction monitoring alerts and compliance concerns without structured investigation workflows lead to missed investigations, unresolved cases, and no audit trail to demonstrate to regulators that alerts were properly considered. Ad hoc processes fail under regulatory scrutiny.',
    solution: 'VeriGo automatically creates investigation cases from monitoring alerts and compliance triggers. Cases are assigned to analysts, tracked through structured resolution stages, subject to four-eyes approval, and fully documented. The MLRO review queue ensures high-risk cases receive appropriate sign-off before closure or SMR lodgement.',
    benefits: [
      'Automatic case creation from transaction monitoring alerts and compliance triggers',
      'Analyst assignment and workload management across the compliance team',
      'Structured investigation stages with required documentation at each step',
      'Four-eyes approval for high-risk cases and potential SMR decisions',
      'MLRO review queue with structured sign-off and decision recording',
      'Direct SMR preparation from investigated cases with pre-populated report fields',
    ],
    outcome: 'Zero cases fall through the cracks. Every alert is investigated, documented, and resolved with a complete audit trail that satisfies AUSTRAC and internal governance requirements.',
    useCases: [
      {
        title: 'MLRO suspicious matter investigation',
        description: 'When transaction monitoring generates a suspicious activity alert, VeriGo creates a case, assigns it to an analyst, and routes the completed investigation to the MLRO for SMR determination.',
      },
      {
        title: 'High-volume alert management',
        description: 'Compliance teams managing large alert volumes use VeriGo\'s case management queue to prioritise, assign, and track investigations systematically, avoiding alert fatigue and missed cases.',
      },
      {
        title: 'Enhanced due diligence case tracking',
        description: 'When a customer triggers enhanced due diligence, VeriGo creates a case to track the outstanding requirements, document responses, and record the final risk determination and MLRO approval.',
      },
      {
        title: 'SMR preparation workflow',
        description: 'Cases that result in an SMR determination use VeriGo\'s report preparation workflow, pre-populating the AUSTRAC SMR template from case facts and routing through MLRO sign-off before submission.',
      },
    ],
    relatedIndustries: ['digital-currency-exchange', 'remittance-provider', 'foreign-exchange', 'payment-service-provider', 'law-firm', 'reporting-group'],
  },
  {
    id: 'regulatory-reporting',
    slug: 'regulatory-reporting',
    title: 'Regulatory Reporting',
    icon: 'FileText',
    tagline: 'AUSTRAC-ready reports generated automatically — no manual work required',
    problem: 'Building AUSTRAC-compliant reports manually from raw transaction data is slow, error-prone, and stressful. SMR, IFTI, and TTR reports each have specific field requirements, data formats, and submission deadlines. Manual errors or late submissions attract regulatory scrutiny.',
    solution: 'VeriGo pre-populates SMR, IFTI IN, IFTI OUT, and TTR report templates directly from transaction data and case management records. Built-in AUSTRAC validation checks each field before submission. The reporting audit trail records every draft, review, sign-off, and submission event.',
    benefits: [
      'SMR report templates with all AUSTRAC-required fields pre-populated from case data',
      'IFTI IN and IFTI OUT templates pre-populated from remittance and FX transaction records',
      'TTR templates generated automatically from threshold cash transaction data',
      'Built-in AUSTRAC field validation before submission — catch errors before lodgement',
      'Report review and approval workflow with MLRO sign-off required before submission',
      'Complete submission audit trail including draft history, approvals, and submission confirmation',
    ],
    outcome: 'Submit accurate AUSTRAC reports on time, every time. Eliminate manual errors, meet every deadline, and maintain a complete submission record for regulatory inspection.',
    useCases: [
      {
        title: 'DCE daily TTR lodgement',
        description: 'Digital currency exchanges with daily cash or cash-equivalent transactions above $10,000 use VeriGo to generate TTRs automatically from transaction data and batch submit within AUSTRAC deadlines.',
      },
      {
        title: 'Remittance IFTI reporting',
        description: 'Remittance providers use VeriGo to generate IFTI IN and IFTI OUT reports for all international transfers above the threshold, pre-populated from captured sender and beneficiary data.',
      },
      {
        title: 'SMR preparation and lodgement',
        description: 'Compliance officers preparing suspicious matter reports use VeriGo\'s SMR workflow to draft, review, obtain MLRO sign-off, and submit reports to AUSTRAC within the 3-business-day deadline.',
      },
      {
        title: 'Precious metals dealer TTR compliance',
        description: 'Precious metal dealers use VeriGo to capture cash transaction data at the point of sale and generate TTR reports automatically, ensuring no threshold transaction is missed or reported late.',
      },
    ],
    relatedIndustries: ['digital-currency-exchange', 'remittance-provider', 'foreign-exchange', 'payment-service-provider', 'precious-metals', 'reporting-group'],
  },
  {
    id: 'reporting-groups',
    slug: 'reporting-groups',
    title: 'Reporting Groups',
    icon: 'Network',
    tagline: 'Group-level compliance without the complexity of managing multiple separate systems',
    problem: 'Large financial services groups with multiple regulated entities struggle to maintain consistent compliance standards across the group. Duplicated customer records, fragmented monitoring, siloed reporting, and no single view of group-wide compliance status make it difficult to identify risks before regulators do.',
    solution: 'VeriGo\'s Reporting Groups feature provides a group-level compliance dashboard with consolidated customer records, shared screening results, entity-level compliance status, and centralised policy management — enabling the group to operate as a single compliance organism while maintaining entity-level regulatory accountability.',
    benefits: [
      'Group-level compliance dashboard with real-time status across all member entities',
      'Shared customer master records — CDD conducted once, relied upon across all group entities',
      'Consolidated AUSTRAC reporting capability with entity-level report attribution',
      'Per-entity compliance status indicators for board and senior management reporting',
      'Centralised AML/CTF policy management with entity-specific implementation overlays',
      'Group-wide audit trail with granular entity-level drill-down',
    ],
    outcome: 'One unified view of compliance across every entity in your group. Identify gaps before regulators do, eliminate duplication, and maintain consistent standards at scale.',
    useCases: [
      {
        title: 'Diversified financial services group',
        description: 'A group operating a DCE, remittance service, and FX business uses VeriGo\'s Reporting Groups to manage all three entities under a single platform with shared customer records and consolidated oversight.',
      },
      {
        title: 'Multi-brand DCE operations',
        description: 'A technology company operating multiple cryptocurrency exchange brands under a group structure uses VeriGo to maintain compliance across all brands while sharing customer data permissibly.',
      },
      {
        title: 'Law firm network compliance',
        description: 'A national law firm with multiple offices uses VeriGo\'s group structure to manage Tranche 2 obligations consistently across all offices under a centralised compliance team.',
      },
      {
        title: 'Board-level compliance reporting',
        description: 'Group compliance officers use VeriGo\'s consolidated dashboard to prepare board-level compliance reports showing status across all entities, open cases, report submission rates, and outstanding obligations.',
      },
    ],
    relatedIndustries: ['reporting-group', 'digital-currency-exchange', 'remittance-provider', 'payment-service-provider'],
  },
  {
    id: 'workflow-automation',
    slug: 'workflow-automation',
    title: 'Workflow Automation',
    icon: 'Zap',
    tagline: 'Automate the compliance work that should not require a human every time',
    problem: 'Compliance teams are bottlenecked by repetitive administrative tasks — assigning cases, sending review reminders, escalating alerts, scheduling periodic re-verifications — that pull focus away from high-value judgement work. Manual coordination creates delays, inconsistency, and human error.',
    solution: 'VeriGo\'s no-code workflow automation lets compliance teams build triggers, approvals, escalations, and notifications without writing code. Pre-built automation templates for common compliance workflows can be deployed immediately and customised to match your internal processes.',
    benefits: [
      'No-code workflow builder with drag-and-drop trigger and action configuration',
      'Event-triggered automations — onboarding completion, alert generation, risk threshold breach',
      'Automated periodic review reminders sent to customers and internal team members',
      'Escalation rule automation — route cases to MLRO when defined criteria are met',
      'Scheduled report generation and distribution to compliance stakeholders',
      'Integration webhooks for connecting VeriGo to third-party systems and CRMs',
    ],
    outcome: 'Free your compliance team from administrative coordination. Focus human judgement on the decisions that genuinely require it — everything else runs automatically.',
    useCases: [
      {
        title: 'Automated KYC renewal reminders',
        description: 'VeriGo automatically sends renewal reminder emails to customers when their KYC documentation approaches expiry, collects updated documents, and notifies the compliance team when renewal is complete.',
      },
      {
        title: 'Risk threshold escalation',
        description: 'When a customer\'s risk score exceeds a defined threshold — due to a PEP match, adverse media, or transaction pattern — VeriGo automatically escalates to enhanced due diligence and assigns to a senior analyst.',
      },
      {
        title: 'Scheduled compliance reporting',
        description: 'VeriGo generates and distributes weekly compliance status reports to the compliance team and monthly board-level summaries to senior management — automatically, without manual preparation.',
      },
      {
        title: 'New customer PEP/sanctions auto-screening',
        description: 'When a new customer completes onboarding, VeriGo automatically triggers sanctions and PEP screening, routes the results to the compliance queue, and only approves the account after a clean result.',
      },
    ],
    relatedIndustries: ['digital-currency-exchange', 'remittance-provider', 'payment-service-provider', 'law-firm', 'reporting-group'],
  },
]

export const getCapability = (slug: string) => capabilities.find(c => c.slug === slug)
