export type WorkflowStep = { title: string; desc: string }
export type PricingRec = { plan: string; reason: string }

export type Industry = {
  id: string
  slug: string
  label: string
  shortLabel: string
  regime: 'current' | 'expanded'
  icon: string
  description: string
  overview: string
  obligations: string[]
  keyRisks: string[]
  risks: string[]
  cddRequirements: string[]
  monitoringRequirements: string[]
  reportingRequirements: {
    types: string[]
    details: string
  }
  howVerigoHelps: string[]
  austracRef: string
  packName: string
  color: string
  // Phase 3 additions
  customerRisks: string[]
  exampleWorkflow: WorkflowStep[]
  pricingRec: PricingRec
}

export const industries: Industry[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // DIGITAL CURRENCY EXCHANGE
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'digital-currency-exchange',
    slug: 'digital-currency-exchange',
    label: 'Virtual Asset Service Provider (VASP) / DCE',
    shortLabel: 'VASP / DCE',
    regime: 'current',
    icon: '₿',
    description: 'VASPs or Digital Currency Exchanges (DCEs) must register with AUSTRAC and implement full AML/CTF programs under the AML/CTF Act 2006.',
    overview: "You're running a crypto exchange or virtual asset business in one of the most scrutinised sectors under Australian AML law. AUSTRAC watches VASPs and DCEs closely — and for good reason. The pseudonymous nature of blockchain transactions means your platform can be used to move money without a trace unless you have the right controls in place. The good news: with the right compliance program, you can onboard customers fast, trade compliantly, and never miss an AUSTRAC deadline.",
    obligations: [
      'Register with AUSTRAC before providing any digital currency exchange services',
      'Conduct an ML/TF Risk Assessment and implement a unified AML/CTF program based on it',
      'Conduct KYC on all customers before providing any designated service',
      'Lodge IFTI reports for international transfers of $1,000 AUD equivalent or more',
      'Lodge SMR reports within 3 business days of forming a suspicion',
      'Lodge TTR reports within 10 business days of a cash transaction of $10,000 AUD or more',
    ],
    keyRisks: [
      'Sanctions evasion via pseudonymous blockchain transactions',
      'Rapid cross-border fund movement complicating tracing',
      'Mixing and tumbling services obscuring transaction trails',
      'Privacy coins and anonymity-enhancing technologies',
    ],
    risks: [
      'Sanctions evasion via pseudonymous blockchain transactions',
      'Rapid cross-border fund movement complicating tracing',
      'Mixing and tumbling services obscuring transaction trails',
      'Privacy coins and anonymity-enhancing technologies',
    ],
    cddRequirements: [
      'Photo identification document with real-time biometric verification',
      'Source of funds declaration with supporting documentation for high-value customers',
      'Source of wealth verification for customers transacting above risk thresholds',
      'Residential address verification via utility bill or bank statement',
    ],
    monitoringRequirements: [
      'Real-time monitoring of all cryptocurrency deposit and withdrawal patterns',
      'Detection of structuring behaviour and smurfing patterns below reporting thresholds',
      'Wallet address screening against blockchain analytics databases for high-risk addresses',
    ],
    reportingRequirements: {
      types: ['SMR', 'IFTI', 'TTR'],
      details: 'DCEs must lodge SMRs within 3 business days of forming a suspicion, IFTIs within 10 business days of the transfer instruction, and TTRs within 10 business days of a threshold cash transaction.',
    },
    howVerigoHelps: [
      'Biometric KYC with document verification — customers onboarded in under 2 minutes',
      'Real-time sanctions and PEP screening against OFAC, UN, EU, DFAT, and UK HMT lists',
      'Pre-built crypto transaction monitoring rules including structuring detection and velocity checks',
      'IFTI, TTR, and SMR report templates pre-populated from transaction data with AUSTRAC validation',
      'Immutable audit trail for every customer interaction and compliance decision',
    ],
    austracRef: 'AML/CTF Act 2006 — Virtual Asset Service Providers (VASPs) / Digital Currency Exchange Providers (DCEs)',
    packName: 'Crypto Pack',
    color: 'from-orange-500 to-amber-500',
    customerRisks: [
      "High-volume retail traders — frequent, large-amount traders are higher risk by volume alone. One undetected structuring pattern across 500 daily transactions is far harder to catch manually than across 5.",
      "Customers from high-risk jurisdictions — wallets linked to sanctioned countries carry heightened risk regardless of individual profile.",
      "Anonymous wallet activity — customers moving funds through privacy coins or untraced wallets require enhanced scrutiny by default.",
      "Immediate large trades after account opening — a common pattern in smurfing, account takeover, and layering schemes.",
    ],
    exampleWorkflow: [
      { title: 'Customer signs up', desc: 'Completes digital onboarding — name, DOB, address, photo ID uploaded from phone.' },
      { title: 'KYC runs automatically', desc: 'Document verified, biometric liveness check, sanctions and PEP screening — all in the background.' },
      { title: 'Risk score assigned', desc: 'Customer assigned Low, Medium, or High risk. High-risk accounts flagged for MLRO review before access.' },
      { title: 'Trading begins', desc: 'Every transaction monitored against pre-built crypto AML rules — structuring, velocity, high-risk wallets.' },
      { title: 'Alert raised', desc: 'Suspicious pattern detected. Case created automatically. Assigned to analyst.' },
      { title: 'Report filed', desc: 'MLRO reviews, SMR or IFTI prepared from case data, submitted to AUSTRAC on time.' },
    ],
    pricingRec: {
      plan: 'Professional',
      reason: 'DCEs typically have high transaction volumes requiring full transaction monitoring and automated IFTI/TTR/SMR generation. The Professional plan includes all monitoring rules, case management, and bulk report submission.',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REMITTANCE PROVIDER
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'remittance-provider',
    slug: 'remittance-provider',
    label: 'Remittance Provider',
    shortLabel: 'Remittance',
    regime: 'current',
    icon: '🌏',
    description: 'Remittance providers transfer value on behalf of customers internationally and face IFTI reporting obligations.',
    overview: "You move money across borders for people — often to families, small businesses, and communities in developing countries. That's a vital service. But the remittance sector is also one of AUSTRAC's highest priorities. Every international transfer above $1,000 requires an IFTI report. Every suspicious pattern — structuring, nominee senders, high-risk corridors — needs to be caught and reported. The compliance burden is real, but with the right tools it doesn't have to stop you operating at volume.",
    obligations: [
      'Register with AUSTRAC as a remittance network provider or independent remittance dealer',
      'Implement and maintain a full AML/CTF program',
      'Conduct KYC on both senders and beneficiaries for all transactions',
      'Lodge IFTI IN and IFTI OUT reports for international transfers of $1,000 AUD or more',
      'Lodge SMRs within 3 business days of forming a suspicion',
      'Lodge TTR reports for threshold cash transactions',
    ],
    keyRisks: [
      'Layering proceeds through multiple transfer corridors and jurisdictions',
      'Structuring transfers below reporting thresholds to avoid detection',
      'Use of nominees and third parties to disguise the true sender',
      'Connections to hawala and informal value transfer networks',
    ],
    risks: [
      'Layering proceeds through multiple transfer corridors and jurisdictions',
      'Structuring transfers below reporting thresholds to avoid detection',
      'Use of nominees and third parties to disguise the true sender',
      'Connections to hawala and informal value transfer networks',
    ],
    customerRisks: [
      "Frequent senders to high-risk corridors — customers regularly sending to countries with weak AML regimes or active sanctions exposure are inherently higher risk.",
      "Third-party senders — a customer who regularly sends on behalf of others (rather than for themselves) is a nominee risk flag that triggers enhanced CDD.",
      "Cash-only customers — customers who always pay in cash and have no verifiable financial footprint are harder to profile and carry higher layering risk.",
      "Multiple transfers just under the $1,000 IFTI threshold — classic structuring behaviour that indicates deliberate threshold management.",
    ],
    cddRequirements: [
      'Full KYC on senders including photo ID and address verification',
      'Beneficiary identification including name, account details, and destination country',
      'Purpose of transfer documentation for transactions above defined risk thresholds',
      'Enhanced due diligence for transfers to high-risk jurisdictions or PEP-connected beneficiaries',
    ],
    monitoringRequirements: [
      'Monitoring of transfer frequency, amounts, and destination country risk for individual customers',
      'Detection of structuring patterns — multiple transfers made to stay below IFTI thresholds',
      'Corridor-level risk monitoring to identify unusual volume patterns to high-risk destinations',
    ],
    reportingRequirements: {
      types: ['IFTI', 'SMR', 'TTR'],
      details: 'Remittance providers must lodge IFTI IN reports within 10 business days of receiving an international transfer instruction and IFTI OUT reports within 10 business days of sending. SMRs must be lodged within 3 business days of forming a suspicion.',
    },
    howVerigoHelps: [
      'Automated KYC for both sender and beneficiary with pre-populated IFTI report fields',
      'Real-time sanctions screening for senders, beneficiaries, and destination jurisdictions',
      'Pre-built remittance monitoring rules including corridor risk scoring and structuring detection',
      'Bulk IFTI IN and IFTI OUT submission for high-volume operations — 200+ IFTIs in a single batch',
      'Agent network oversight tools for remittance network providers with sub-agent compliance tracking',
    ],
    austracRef: 'AML/CTF Act 2006 — Remittance Network Providers',
    packName: 'Remittance Pack',
    color: 'from-blue-500 to-cyan-500',
    exampleWorkflow: [
      { title: 'Sender walks in', desc: 'New customer identified — digital intake form captures name, DOB, photo ID.' },
      { title: 'Identity verified', desc: 'Automated KYC check. Sanctions and PEP screening runs in real time.' },
      { title: 'Transfer details recorded', desc: 'Amount, destination country, beneficiary details captured and stored.' },
      { title: 'IFTI threshold checked', desc: "Transfer at or above $1,000 AUD — IFTI report auto-created and pre-filled from transaction data." },
      { title: 'Monitoring runs', desc: "Transaction added to customer's monitoring profile. Structuring patterns checked against prior transfers." },
      { title: 'IFTI submitted', desc: 'MLRO reviews and approves. Batch submission to AUSTRAC before 10-day deadline.' },
    ],
    pricingRec: {
      plan: 'Professional',
      reason: 'High-volume remittance operations need bulk IFTI submission, automated structuring detection, and corridor risk monitoring. The Professional plan covers all of this plus case management for SMR preparation.',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FOREIGN EXCHANGE
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'foreign-exchange',
    slug: 'foreign-exchange',
    label: 'Foreign Exchange Provider',
    shortLabel: 'FX',
    regime: 'current',
    icon: '💱',
    description: 'FX businesses exchange currency and must identify customers, monitor transactions and report as required.',
    overview: "Whether you're running a CBD currency exchange counter or an online FX platform, your obligations under the AML/CTF Act 2006 are significant. Every cash transaction at or above $10,000 triggers a TTR. Every suspicious customer pattern — bulk cash, structuring, PEP customers — needs to be monitored and potentially reported. FX businesses sit at a natural intersection of cash and cross-border flows, making them a persistent focus for AUSTRAC supervision.",
    obligations: [
      'Register with AUSTRAC as a currency exchange provider',
      'Conduct an ML/TF Risk Assessment and implement a unified AML/CTF program based on it',
      'Conduct KYC on all customers at the point of onboarding',
      'Lodge TTR reports within 10 business days of a cash transaction at or above $10,000 AUD',
      'Lodge IFTI reports where the FX transaction involves an international payment instruction',
      'Lodge SMR reports within 3 business days of forming a suspicion',
    ],
    keyRisks: [
      'Currency structuring — breaking large exchanges into smaller transactions to stay under TTR thresholds',
      'Trade-based money laundering through over- or under-invoiced currency conversions',
      'Bulk cash deposits connected to criminal proceeds requiring conversion',
      'PEPs and high-risk customers seeking to convert large amounts without scrutiny',
    ],
    risks: [
      'Currency structuring — breaking large exchanges into smaller transactions to stay under TTR thresholds',
      'Trade-based money laundering through over- or under-invoicing of currency conversions',
      'Bulk cash deposits connected to criminal proceeds requiring conversion',
      'High-risk customers or PEPs seeking to convert large amounts of foreign currency',
    ],
    customerRisks: [
      "Bulk cash depositors — customers who regularly deposit large amounts of physical cash to fund FX conversions are a major ML red flag. The source of cash must be documented and plausible.",
      "Unusual currency pair requests — customers repeatedly requesting conversions to currencies from high-risk jurisdictions, particularly in cash, warrant enhanced scrutiny.",
      "PEP customers — politicians, senior public officials, and their families who convert significant funds through your business require enhanced due diligence regardless of apparent legitimacy.",
      "One-time large conversion customers with no prior relationship — customers who appear once, convert a large amount of cash, and have no verifiable financial history require documented justification.",
    ],
    cddRequirements: [
      'Photo identification document verification for all customers',
      'Address verification for customers transacting above defined thresholds',
      'Source of funds documentation for large or unusual conversion requests',
      'Enhanced due diligence for PEPs, high-risk jurisdiction customers, and large-transaction customers',
    ],
    monitoringRequirements: [
      'Transaction monitoring for structuring patterns below the $10,000 TTR threshold',
      'Cross-border payment monitoring for transactions with an international element',
      'Customer-level velocity monitoring for unusual conversion frequency or volume',
    ],
    reportingRequirements: {
      types: ['TTR', 'IFTI', 'SMR'],
      details: 'FX providers must lodge TTR reports within 10 business days of a cash transaction at or above $10,000 AUD. IFTI reports are required for international payment instructions above the threshold. SMRs must be lodged within 3 business days.',
    },
    howVerigoHelps: [
      'Automated customer onboarding with KYC and risk scoring tailored to FX transaction thresholds',
      'Pre-built FX monitoring rules including TTR threshold alerts and structuring detection',
      'TTR and IFTI report templates pre-populated from transaction records with AUSTRAC validation',
      'Real-time PEP and sanctions screening at onboarding and for ongoing periodic review',
      'Full audit trail for every FX transaction, customer decision, and regulatory report',
    ],
    austracRef: 'AML/CTF Act 2006 — Currency Exchange Providers',
    packName: 'FX Pack',
    color: 'from-green-500 to-emerald-500',
    exampleWorkflow: [
      { title: 'Customer approaches counter', desc: 'Staff identifies the transaction type and amount. KYC triggered for cash transactions above threshold.' },
      { title: 'Identity collected', desc: 'Customer provides photo ID. Automated KYC check and sanctions screening runs in seconds.' },
      { title: 'Risk assessed', desc: 'Customer risk score generated. PEP flag or high-risk jurisdiction triggers EDD prompt.' },
      { title: 'Transaction recorded', desc: 'Amount, currency pair, and customer details captured in Verigo. TTR threshold checked automatically.' },
      { title: 'TTR auto-generated', desc: '$10,000+ cash transaction? TTR pre-populated and queued for MLRO review.' },
      { title: 'Submitted on time', desc: 'MLRO approves TTR. Submitted to AUSTRAC within the 10-day deadline. Confirmation stored.' },
    ],
    pricingRec: {
      plan: 'Essential',
      reason: 'Most FX operators need solid KYC, TTR generation, and basic monitoring. The Essential plan covers your core obligations. Upgrade to Professional if you handle high transaction volumes or international payment instructions requiring IFTI reporting.',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PAYMENT SERVICE PROVIDER
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'payment-service-provider',
    slug: 'payment-service-provider',
    label: 'Payment Service Provider',
    shortLabel: 'PSP',
    regime: 'current',
    icon: '💳',
    description: 'PSPs facilitate payment flows and are reporting entities under the AML/CTF Act with broad monitoring obligations.',
    overview: "You process payments between merchants and their customers — which means you sit in the middle of transactions you didn't initiate and can't always control. That creates a unique compliance challenge. AUSTRAC expects you to verify the merchants you onboard, monitor for suspicious payment patterns across your entire network, and file reports when something doesn't look right. Volume is not an excuse — 100% of transactions need to be covered.",
    obligations: [
      'Register with AUSTRAC and maintain a full AML/CTF program',
      'Conduct KYB due diligence on merchants at onboarding and on an ongoing basis',
      'Perform KYC on end-users engaging in reportable transactions',
      'Lodge SMR reports for suspicious transactions or merchant behaviour within 3 business days',
      'Lodge IFTI reports for international transfer instructions above the threshold',
      'Maintain sanctions screening across all merchants and high-value users',
    ],
    keyRisks: [
      'Merchant fraud — use of the PSP to process transactions linked to criminal activity',
      'Card-not-present abuse for online transactions enabling identity fraud',
      'Velocity pattern abuse — rapid small transactions designed to avoid detection',
      'Cross-border payment risk where merchant counterparties are in high-risk jurisdictions',
    ],
    risks: [
      'Merchant fraud — use of the PSP to process transactions linked to criminal activity',
      'Card-not-present abuse for online transactions enabling identity fraud',
      'Velocity pattern abuse — rapid small transactions designed to avoid detection',
      'Cross-border payment risk where merchant counterparties are in high-risk jurisdictions',
    ],
    customerRisks: [
      "High-refund merchants — merchants with abnormally high refund rates may be processing fraudulent transactions and reversing them to avoid detection. A major risk pattern in PSP environments.",
      "New merchants with immediate high volumes — a merchant who generates unusual transaction volume in the first week of onboarding without any prior history warrants immediate enhanced monitoring.",
      "Merchants in high-risk categories — gambling, adult content, nutraceuticals, and digital goods are historically over-represented in PSP fraud and laundering cases.",
      "Cross-border merchants — merchants who receive funds locally but settle to offshore accounts, especially in high-risk jurisdictions, carry elevated ML exposure.",
    ],
    cddRequirements: [
      'Business verification (KYB) for all merchants including beneficial ownership identification',
      'Individual KYC for merchants who are sole traders or principals of small businesses',
      'PEP and sanctions screening at merchant onboarding and ongoing periodic review',
      'Enhanced due diligence for high-risk merchant categories or abnormal transaction volumes',
    ],
    monitoringRequirements: [
      'Transaction-level monitoring for velocity patterns, unusual amounts, and high-risk merchant activity',
      'Merchant-level monitoring for changes in transaction profile indicating potential misuse',
      'IFTI monitoring for cross-border payment instructions above the reporting threshold',
    ],
    reportingRequirements: {
      types: ['SMR', 'IFTI', 'TTR'],
      details: 'PSPs must lodge SMRs within 3 business days of forming a suspicion about a transaction or customer. IFTI reports are required for international transfer instructions above the threshold. TTRs apply to cash transactions at or above $10,000 AUD.',
    },
    howVerigoHelps: [
      'KYB workflows for merchant onboarding — business verification and beneficial ownership mapped automatically',
      'Automated PEP and sanctions screening for merchants at onboarding and on periodic renewal',
      'Pre-built PSP transaction monitoring rules including velocity, cross-border, and refund pattern detection',
      'Case management linking transaction alerts to investigation and SMR preparation',
      'Full audit trail for every merchant decision, transaction alert, and AUSTRAC submission',
    ],
    austracRef: 'AML/CTF Act 2006 — Payment Providers',
    packName: 'PSP Pack',
    color: 'from-purple-500 to-violet-500',
    exampleWorkflow: [
      { title: 'Merchant applies', desc: 'Merchant submits application. KYB triggered — ABN verified, directors identified, UBOs mapped.' },
      { title: 'Beneficial owners verified', desc: 'All directors and 25%+ shareholders put through KYC. Sanctions and PEP screening runs.' },
      { title: 'Merchant risk rated', desc: 'Risk score assigned based on business type, jurisdiction, and ownership structure. High-risk routed to EDD.' },
      { title: 'Platform access granted', desc: 'Merchant onboarded. Transaction monitoring rules activated for their account from day one.' },
      { title: 'Anomaly detected', desc: 'Velocity pattern alert raised. Case created automatically and assigned to compliance analyst.' },
      { title: 'Case resolved', desc: 'Analyst investigates, documents findings. SMR filed if suspicious. Case closed with full audit trail.' },
    ],
    pricingRec: {
      plan: 'Enterprise',
      reason: "PSPs operate at scale across large merchant networks, often requiring multi-entity oversight, custom API integrations, AML data connectors (Chainalysis, Greeid), and dedicated compliance support. Enterprise is the right fit.",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REAL ESTATE
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'real-estate',
    slug: 'real-estate',
    label: 'Real Estate Professional',
    shortLabel: 'Real Estate',
    regime: 'expanded',
    icon: '🏠',
    description: 'From 2026, real estate agents buying/selling on behalf of clients become reporting entities under the AML/CTF reforms.',
    overview: "From 1 July 2026, if you buy or sell real property on behalf of clients, you are a reporting entity under Australian law. This is the biggest change to your business in decades. You'll need an AML/CTF program, you'll need to check your clients' identities, verify where their money is coming from, and report anything suspicious to AUSTRAC. The Australian property market has been identified internationally as a high-risk sector for money laundering — and the law is now catching up.",
    obligations: [
      'Enrol with AUSTRAC before providing any designated real estate services',
      'Implement a written AML/CTF program tailored to your business',
      'Conduct CDD on both buyers and sellers at the commencement of the relationship',
      'Verify the source of funds to be used in the property transaction',
      'Identify beneficial owners of any corporate or trust purchaser',
      'Lodge SMR reports within 3 business days of forming a suspicion',
      'Maintain all CDD records for a minimum of 7 years',
    ],
    keyRisks: [
      'Property purchased with criminal proceeds through all-cash transactions bypassing financial institutions',
      'Offshore buyers using complex company and trust structures to obscure beneficial ownership',
      'PEPs and their associates purchasing high-value property using nominee structures',
      'Over-valued transactions used to move funds between parties under the guise of a legitimate sale',
    ],
    risks: [
      'Property used to launder proceeds of serious crime through all-cash or over-valued purchases',
      'Offshore buyers using complex company and trust structures to obscure true ownership',
      'All-cash transactions bypassing standard financial institution due diligence',
      'PEPs and their associates purchasing high-value property using nominee structures',
    ],
    customerRisks: [
      "All-cash buyers — purchasers paying entirely in cash without a mortgage raise immediate ML risk flags. The source of funds must be documented and verifiable before you can proceed.",
      "Foreign buyers with no Australian financial footprint — offshore purchasers, particularly from high-risk jurisdictions, who have no verifiable financial history in Australia require enhanced scrutiny.",
      "Corporate and trust purchasers — when a company or trust is buying, the true beneficial owner must be identified. Complex offshore structures used to buy Australian property are a well-known laundering method.",
      "Purchasers seeking rapid settlement — unusual urgency around settlement timing, combined with unclear fund sources, is a recognised red flag in property transactions.",
    ],
    cddRequirements: [
      'Identity verification of both the buyer and seller with photo ID and address confirmation',
      'Source of funds documentation from the buyer prior to or at settlement',
      'Ultimate beneficial owner identification for any corporate or trust purchaser',
      'PEP and sanctions screening of all parties to the transaction',
    ],
    monitoringRequirements: [
      'Client-level monitoring across multiple transactions to identify property-based laundering patterns',
      'Source of funds verification review at key stages of the property transaction lifecycle',
      'Post-transaction review for indicators identified after settlement that may require SMR filing',
    ],
    reportingRequirements: {
      types: ['SMR'],
      details: 'Real estate professionals must lodge SMR reports with AUSTRAC within 3 business days of forming a suspicion about a transaction, client, or property transaction. You must not disclose to the client that an SMR has been filed.',
    },
    howVerigoHelps: [
      'Guided CDD workflows for both buyer and seller — identity verification and document collection in minutes',
      'Beneficial ownership mapping tool for corporate and trust purchasers with UBO identification',
      'Source of funds verification with document upload and review capability',
      'PEP and sanctions screening integrated into the buyer and seller onboarding workflow',
      'SMR preparation and case management for investigating suspicious transactions',
    ],
    austracRef: 'AML/CTF Amendment Act 2024 — Tranche 2 Reform',
    packName: 'Real Estate Pack',
    color: 'from-rose-500 to-pink-500',
    exampleWorkflow: [
      { title: 'Listing accepted — buyer found', desc: 'New transaction triggers a CDD check. Buyer and seller intake forms sent automatically.' },
      { title: 'Identity verified', desc: 'Both parties complete digital ID verification. Documents uploaded and stored securely.' },
      { title: 'Buyer risk assessed', desc: "Buyer profiled — cash purchase? Foreign buyer? Corporate structure? Risk score assigned and EDD triggered if required." },
      { title: 'Source of funds documented', desc: 'Buyer provides bank statements or financial records confirming the legitimate origin of purchase funds.' },
      { title: 'Beneficial owners identified', desc: "If a company or trust is buying, VeriGo maps the ownership structure to identify the real people in control." },
      { title: 'Transaction proceeds or is escalated', desc: 'Clean transactions proceed. Red flags escalate to SMR preparation. Full audit trail retained for 7 years.' },
    ],
    pricingRec: {
      plan: 'Essential',
      reason: 'Most real estate professionals need solid CDD, source of funds documentation, and SMR capability. The Essential plan covers these core obligations from day one. Scale to Professional if your volume or transaction complexity grows.',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CONVEYANCER
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'conveyancer',
    slug: 'conveyancer',
    label: 'Conveyancer',
    shortLabel: 'Conveyancer',
    regime: 'expanded',
    icon: '📋',
    description: 'Conveyancers handling property settlements will be captured under Tranche 2 reforms effective 2026.',
    overview: "You sit at the sharp end of every property transaction — the point where money actually changes hands. From 1 July 2026, that makes you a reporting entity under Australian AML law. Settlement is the stage where large sums move between parties, and it's the stage that criminals most want to exploit. Your obligation is to verify your clients, check where settlement funds are coming from, and report anything that doesn't add up to AUSTRAC.",
    obligations: [
      'Enrol with AUSTRAC and implement a full AML/CTF program',
      'Conduct CDD on clients at the commencement of every conveyancing matter',
      'Verify the source of funds to be used at property settlement',
      'Conduct ongoing monitoring throughout the matter lifecycle',
      'Lodge SMR reports within 3 business days of forming a suspicion',
      'Retain all CDD and transaction documentation for 7 years',
    ],
    keyRisks: [
      'Settlement fraud — substitution of legitimate funds at the last stage of the transaction',
      'Third-party payments where settlement funds come from an undisclosed or unexpected source',
      'Identity fraud — fraudulent documents used to impersonate buyers or sellers at settlement',
      'Large cash contributions to settlement proceeds that cannot be traced to legitimate sources',
    ],
    risks: [
      'Settlement fraud involving substitution of legitimate funds at the last stage of the transaction',
      'Third-party payments where funds at settlement come from an undisclosed source',
      'Identity fraud — use of fraudulent identity documents to impersonate buyers or sellers',
      'Large cash contributions to settlement proceeds that cannot be traced to legitimate sources',
    ],
    customerRisks: [
      "Purchasers using third-party funds — when the settlement funds come from someone other than the registered buyer, that is a red flag that requires documented explanation and enhanced scrutiny.",
      "Clients who are difficult to identify — customers who are reluctant to provide identity documents, or provide documents that are inconsistent or hard to verify, are a higher-risk profile.",
      "Unusually urgent settlement timelines — a client pushing hard for accelerated settlement without clear commercial reason may be trying to limit your ability to conduct proper due diligence.",
      "Clients acting as nominees — someone instructing you on behalf of another person who is not identified or verified is a classic front structure and should trigger immediate EDD.",
    ],
    cddRequirements: [
      'Identity verification of all clients using government-issued photo identification',
      'Source of funds verification for the settlement amount with supporting bank or financial records',
      'Beneficial ownership identification where the client is acting on behalf of a company or trust',
      'PEP and sanctions screening of all parties at matter commencement',
    ],
    monitoringRequirements: [
      'Monitoring across the matter lifecycle for changes in settlement amounts or payment sources',
      'Review of source of funds documentation prior to settlement for completeness and plausibility',
      'Post-settlement review for indicators that may require retrospective SMR filing',
    ],
    reportingRequirements: {
      types: ['SMR'],
      details: 'Conveyancers must lodge SMR reports within 3 business days of forming a suspicion about a client, transaction, or settlement amount. You are prohibited from tipping off the client that an SMR has been filed.',
    },
    howVerigoHelps: [
      'Client onboarding with integrated KYC and document collection — matter opened, identity verified',
      'Source of funds verification module with document upload, review, and documented approval',
      'PEP and sanctions screening at matter commencement and on periodic review',
      'Case management for investigating red flags and documenting SMR decisions',
      'Pre-built AML/CTF program template for conveyancers aligned to Tranche 2 obligations',
    ],
    austracRef: 'AML/CTF Amendment Act 2024 — Tranche 2 Reform',
    packName: 'Conveyancer Pack',
    color: 'from-amber-500 to-orange-500',
    exampleWorkflow: [
      { title: 'Matter opened', desc: "New client engaged for a property settlement. VeriGo's digital intake form sent to client immediately." },
      { title: 'Identity verified', desc: 'Client completes digital ID check from their phone. Document and biometric verified automatically.' },
      { title: 'Source of funds requested', desc: 'Client prompted to provide bank records or financial documentation confirming where settlement funds originate.' },
      { title: 'Risk assessment', desc: "Client risk score calculated. Third-party funds? Cash contribution? Corporate structure? Escalates to EDD if required." },
      { title: 'Sanctions and PEP screening', desc: 'All parties screened — buyer, seller, and any associated beneficial owners.' },
      { title: 'Settlement or SMR', desc: 'Clean matters proceed to settlement. Red flags escalate — MLRO prepares SMR if required. Records retained for 7 years.' },
    ],
    pricingRec: {
      plan: 'Essential',
      reason: 'Conveyancers need solid CDD, source of funds workflows, and SMR capability. The Essential plan covers all Tranche 2 obligations for individual conveyancers or small practices.',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LAW FIRM
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'law-firm',
    slug: 'law-firm',
    label: 'Law Firm',
    shortLabel: 'Legal',
    regime: 'expanded',
    icon: '⚖️',
    description: 'Law firms providing certain designated services — property, company formation, trust services — become reporting entities under Tranche 2.',
    overview: "From 1 July 2026, law firms providing designated services are reporting entities under Australian AML law. This includes property transactions, company and trust formation, managing client funds, and other specified legal work. This is not a minor administrative update — it fundamentally changes how you onboard clients and manage trust accounts. The obligation applies at the matter level. Before you open a new matter involving a designated service, you need to know who you're acting for.",
    obligations: [
      'Enrol with AUSTRAC and implement a full AML/CTF program for designated legal services',
      'Conduct client due diligence at the commencement of every matter involving a designated service',
      'Verify the beneficial ownership and control of corporate or trust clients',
      'Monitor client trust account transactions for suspicious patterns',
      'Lodge SMR reports within 3 business days of forming a suspicion',
      'Train all staff providing designated services in AML/CTF obligations',
    ],
    keyRisks: [
      'Shell company and trust formation used to layer and conceal beneficial ownership',
      "Client trust account misuse to layer criminal proceeds through the firm's accounts",
      'Legal professional privilege creating compliance tension around information disclosure',
      'Property transactions used as the vehicle for large-scale laundering of criminal proceeds',
    ],
    risks: [
      'Shell company and complex trust formation used to layer and conceal beneficial ownership',
      "Client trust account misuse to layer criminal proceeds through the firm's accounts",
      'Legal professional privilege creating compliance tension around information disclosure',
      'Property transactions used as the vehicle for large-scale money laundering',
    ],
    customerRisks: [
      "Clients seeking rapid corporate structure creation — a client who wants a company or trust formed quickly, with minimal questions asked about ownership, is a recognised red flag for ML structuring.",
      "Clients with complex offshore ownership — instructions from clients whose ultimate beneficial owners are in high-risk jurisdictions, or who use multiple offshore vehicles, require enhanced scrutiny.",
      "High-value property transactions with cash components — any matter where the client is contributing a significant amount of cash to a property purchase requires documented source of funds verification.",
      "Trust account deposits from unexpected sources — a trust account receipt from a third party not connected to the matter, or for an amount inconsistent with the transaction value, is a serious red flag.",
    ],
    cddRequirements: [
      'Full identity verification of clients and their authorised representatives at matter inception',
      'Beneficial ownership and control structure verification for all corporate and trust clients',
      'Source of funds verification for client monies received and held in trust',
      'PEP and sanctions screening of all clients at onboarding and on periodic renewal',
    ],
    monitoringRequirements: [
      'Client trust account monitoring for unusual patterns, large deposits, or unexplained receipts',
      'Matter-level monitoring for changes in the nature or value of the transaction',
      'Ongoing periodic review of client risk ratings and CDD records across the matter lifecycle',
    ],
    reportingRequirements: {
      types: ['SMR'],
      details: 'Law firms must lodge SMR reports within 3 business days of forming a suspicion in connection with a designated service. Legal professional privilege applies narrowly and does not provide a blanket exemption from SMR obligations.',
    },
    howVerigoHelps: [
      'Matter-based CDD workflows — client intake, identity verification, and risk assessment at matter open',
      'Beneficial ownership mapping for complex corporate and trust structures with UBO identification',
      'Client trust account monitoring with configurable rules for unusual transaction detection',
      'SMR preparation and case management tools for MLRO review and regulatory reporting',
      'AML/CTF program template for law firms with matter risk assessment and staff training tracking',
    ],
    austracRef: 'AML/CTF Amendment Act 2024 — Designated Non-Financial Businesses',
    packName: 'Legal Pack',
    color: 'from-slate-500 to-slate-600',
    exampleWorkflow: [
      { title: 'New matter opened', desc: 'Matter involves a designated service? CDD check triggered automatically. Client intake form sent.' },
      { title: 'Client identity verified', desc: 'Individual clients complete biometric KYC. Corporate clients go through KYB with UBO mapping.' },
      { title: 'Beneficial ownership confirmed', desc: 'All directors and UBOs identified and verified. Sanctions and PEP screening applied.' },
      { title: 'Trust account monitored', desc: 'Client funds received into trust. Amount and source checked against expected transaction value.' },
      { title: 'Risk reviewed at key milestones', desc: 'Matter risk reviewed at key stages — unusual changes in scope, value, or parties trigger a re-check.' },
      { title: 'SMR or clean closeout', desc: 'Suspicious activity? MLRO prepares SMR. Matter closed cleanly? Records retained for 7 years.' },
    ],
    pricingRec: {
      plan: 'Professional',
      reason: 'Law firms handling corporate clients, trust accounts, and complex property matters need full beneficial ownership mapping, trust account monitoring, and MLRO case management workflows.',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ACCOUNTING FIRM
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'accounting-firm',
    slug: 'accounting-firm',
    label: 'Accounting Firm',
    shortLabel: 'Accounting',
    regime: 'expanded',
    icon: '📊',
    description: 'Accounting firms providing certain services will be required to implement AML/CTF programs from 2026.',
    overview: "Accountants have been at the centre of financial crime debates for years — and from 1 July 2026, the law catches up. If your firm provides company or trust formation, acts as a nominee director, manages client funds, or provides tax services connected to asset structures, you are a reporting entity. Your clients trust you with some of their most sensitive financial information. The AML framework asks you to consider whether that trust is being misused.",
    obligations: [
      'Enrol with AUSTRAC and implement a full AML/CTF program for designated accounting services',
      'Conduct client due diligence on all clients receiving designated services',
      'Identify the beneficial ownership of corporate and trust clients',
      'Lodge SMR reports within 3 business days of forming a suspicion',
      'Maintain all CDD and transaction records for 7 years',
      'Conduct ongoing periodic review of client risk ratings and CDD documentation',
    ],
    keyRisks: [
      'Tax evasion facilitation through offshore structuring and opaque ownership arrangements',
      'Shell company administration enabling clients to conceal assets and beneficial ownership',
      'Nominee director and shareholder arrangements used to distance individuals from entities',
      'Client fund management creating exposure to layering through accounting trust accounts',
    ],
    risks: [
      'Tax evasion facilitation through offshore structuring and opaque ownership arrangements',
      'Shell company administration enabling clients to conceal assets and beneficial ownership',
      'Nominee director and shareholder arrangements used to distance individuals from entities',
      'Client fund management creating exposure to layering through accounting trust accounts',
    ],
    customerRisks: [
      "Clients with offshore company structures — clients who own or operate businesses through offshore vehicles, particularly in low-tax or high-secrecy jurisdictions, warrant careful beneficial ownership analysis.",
      "Clients with unusually complex structures for their apparent business activity — a small business with multiple holding companies, trusts, and offshore entities is a mismatch that requires explanation.",
      "Clients seeking nominee arrangements — a request for you or your staff to act as a nominee director or shareholder is a significant ML risk flag that requires careful EDD.",
      "Clients whose financial activity is inconsistent with their stated business — a client whose declared income is inconsistent with asset purchases or fund flows through their accounts should be reviewed.",
    ],
    cddRequirements: [
      'Identity verification of all clients and their authorised representatives',
      'Beneficial ownership identification for all corporate and trust clients receiving designated services',
      'Source of funds or wealth verification for clients seeking to move or invest significant funds',
      'PEP and sanctions screening at onboarding and ongoing periodic review',
    ],
    monitoringRequirements: [
      'Client-level monitoring for changes in the nature of services that may indicate elevated risk',
      'Review of corporate and trust structures at periodic intervals for changes in beneficial ownership',
      'Monitoring for indicators of tax evasion facilitation or offshore structuring for illicit purposes',
    ],
    reportingRequirements: {
      types: ['SMR'],
      details: 'Accounting firms must lodge SMR reports within 3 business days of forming a suspicion in connection with a designated service. Client confidentiality does not override your SMR obligation — the AML/CTF Act carve-out takes precedence.',
    },
    howVerigoHelps: [
      'Client onboarding with identity verification and risk-based CDD for accounting designated services',
      'Beneficial ownership mapping for complex corporate structures and multi-layered trusts',
      'Ongoing periodic review scheduler to keep client CDD current and risk ratings reviewed',
      'SMR case management and preparation tools for MLRO review before AUSTRAC lodgement',
      'AML/CTF program template for accounting firms with designated service identification and training log',
    ],
    austracRef: 'AML/CTF Amendment Act 2024 — Designated Non-Financial Businesses',
    packName: 'Accountant Pack',
    color: 'from-indigo-500 to-blue-600',
    exampleWorkflow: [
      { title: 'Client engagement letter signed', desc: 'Engagement involves a designated service? CDD workflow triggered. Client intake form sent immediately.' },
      { title: 'Individual clients identified', desc: 'Photo ID verification for individuals. Biometric check for high-risk or high-value clients.' },
      { title: 'Corporate structure mapped', desc: 'Company or trust client? VeriGo maps ownership to identify all directors, shareholders, and UBOs.' },
      { title: 'UBOs verified and screened', desc: 'All beneficial owners put through KYC, sanctions, and PEP screening.' },
      { title: 'Ongoing monitoring', desc: 'Annual review reminders sent. Changes in ownership or risk profile flagged automatically.' },
      { title: 'Suspicion identified — SMR prepared', desc: "Unusual client instruction or financial pattern identified. MLRO reviews. SMR filed if required." },
    ],
    pricingRec: {
      plan: 'Professional',
      reason: 'Accounting firms with corporate and trust clients need full beneficial ownership mapping, periodic review scheduling, and MLRO case management. Professional covers all of this plus ongoing monitoring capabilities.',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PRECIOUS METALS
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'precious-metals',
    slug: 'precious-metals',
    label: 'Precious Metal Dealer',
    shortLabel: 'Precious Metals',
    regime: 'expanded',
    icon: '🥇',
    description: 'Dealers in gold, silver, platinum and other precious metals are captured under Tranche 2 reforms.',
    overview: "Gold and precious metals have historically been used to convert cash into portable, high-value assets outside the financial system. From 1 July 2026, that changes for Australian dealers. If you buy or sell physical gold, silver, platinum, or gemstones, you're a reporting entity. The obligation kicks in for cash transactions at or above $10,000. But the risk picture is broader — structuring below that threshold, conflict mineral sourcing, and anonymous bulk buyers all need to be on your radar.",
    obligations: [
      'Enrol with AUSTRAC and implement a full AML/CTF program',
      'Conduct CDD on customers making cash transactions at or above $10,000 AUD',
      'Lodge TTR reports within 10 business days of a cash transaction at or above $10,000 AUD',
      'Lodge SMR reports within 3 business days of forming a suspicion',
      'Maintain all CDD and transaction records',
      'Conduct a risk assessment and implement proportionate controls',
    ],
    keyRisks: [
      'Anonymous cash purchases enabling currency to be converted to portable, high-value assets without scrutiny',
      'Bulk physical precious metal transfers used to move value across borders outside the financial system',
      'Refinery diversion schemes where stolen or illicitly sourced metals enter the legitimate market',
      'Purchases sourced from high-risk countries or suppliers connected to conflict minerals',
    ],
    risks: [
      'Anonymous cash purchases of high-value physical assets enabling currency to be converted without scrutiny',
      'Bulk physical precious metal transfers used to move value across borders outside the financial system',
      'Refinery diversion schemes where stolen or illicitly sourced precious metals enter the legitimate market',
      'Purchases sourced from high-risk countries or suppliers connected to conflict minerals',
    ],
    customerRisks: [
      "Cash buyers near or just below the $10,000 threshold — a customer who regularly buys $9,500 in gold is displaying classic structuring behaviour. The pattern matters, not just the individual transaction.",
      "First-time buyers making large purchases — a customer with no prior relationship who arrives wanting to buy a large quantity of gold, particularly in cash, is a high-risk profile.",
      "Buyers from high-risk jurisdictions with no verifiable local address — foreign nationals purchasing significant quantities of precious metals without an Australian financial footprint require EDD.",
      "Sellers with unverifiable provenance — customers wanting to sell gold or silver who cannot document where it came from may be selling proceeds of theft or illicit sourcing.",
    ],
    cddRequirements: [
      'Identity verification with photo ID for all customers making cash transactions at or above $10,000 AUD',
      'Source of funds verification for high-value cash purchases with documentation of legitimate origin',
      'PEP and sanctions screening for customers making purchases above defined risk thresholds',
      'Enhanced due diligence for customers purchasing in unusual quantities, frequencies, or with unusual payment methods',
    ],
    monitoringRequirements: [
      'Transaction monitoring for structuring — multiple purchases below $10,000 to avoid TTR obligations',
      'Customer-level monitoring for frequency and pattern of precious metal purchases and sales',
      'Supplier due diligence monitoring against conflict mineral and sanctions databases',
    ],
    reportingRequirements: {
      types: ['TTR', 'SMR'],
      details: 'Precious metal dealers must lodge TTR reports within 10 business days of a cash transaction at or above $10,000 AUD. SMR reports must be lodged within 3 business days of forming a suspicion about a transaction or customer.',
    },
    howVerigoHelps: [
      'Customer onboarding and KYC workflows calibrated for precious metal transaction thresholds',
      'TTR report templates pre-populated from transaction records with AUSTRAC validation',
      'Structuring detection alerts for customers making multiple transactions below TTR thresholds',
      'PEP and sanctions screening integrated into the point-of-sale customer identification workflow',
      'AML/CTF program template for precious metal dealers with transaction risk assessment and training log',
    ],
    austracRef: 'AML/CTF Amendment Act 2024 — Designated Non-Financial Businesses',
    packName: 'Precious Metals Pack',
    color: 'from-yellow-500 to-amber-400',
    exampleWorkflow: [
      { title: 'Customer approaches for purchase', desc: 'Sale above $10,000 in cash? KYC triggered at the point of sale. Digital ID check sent to customer.' },
      { title: 'Identity verified', desc: 'Photo ID captured and verified. Sanctions screening runs automatically.' },
      { title: 'Source of funds documented', desc: 'Customer provides documentation of where the cash originated. Stored securely against the transaction.' },
      { title: 'TTR generated', desc: 'Cash transaction at or above $10,000? TTR auto-populated from transaction data. Queued for review.' },
      { title: 'Structuring check', desc: "Customer's transaction history reviewed. Pattern of purchases just below $10,000? Alert raised for MLRO review." },
      { title: 'TTR submitted or SMR filed', desc: 'TTR submitted to AUSTRAC within 10 days. Suspicious pattern? SMR prepared and filed within 3 days.' },
    ],
    pricingRec: {
      plan: 'Essential',
      reason: 'Precious metal dealers primarily need TTR generation, KYC at point of sale, and structuring detection. The Essential plan covers these core obligations. Upgrade to Professional for higher-volume operations or multi-location dealers.',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REPORTING GROUP
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'reporting-group',
    slug: 'reporting-group',
    label: 'Reporting Group',
    shortLabel: 'Reporting Group',
    regime: 'current',
    icon: '🏢',
    description: 'Multi-entity compliance groups can establish a reporting group to consolidate compliance operations and share customer data.',
    overview: "If you operate multiple AUSTRAC-regulated businesses — two crypto exchanges, a remittance business and an FX operation, a financial services group with several licensed entities — a Reporting Group structure can reduce duplication and give you consolidated compliance oversight. Under AUSTRAC authorisation, your group can operate a single AML/CTF program, share customer records across entities, and file reports under a group arrangement. The compliance complexity of managing multiple separate programs goes away.",
    obligations: [
      'Apply to AUSTRAC for authorisation to operate as a reporting group',
      'Maintain a group-wide AML/CTF program covering all member entities',
      'Conduct a consolidated risk assessment addressing risks across all group entities',
      'Ensure each member entity maintains its own AUSTRAC enrolment',
      'Share customer identification and transaction records across entities as permitted',
      'Lodge consolidated or entity-level AUSTRAC reports as required by group structure',
    ],
    keyRisks: [
      'Inconsistent compliance standards across entities creating regulatory exposure for the whole group',
      'Customer information sharing without adequate data governance and access controls',
      'Entity-level gaps hidden by a group-level view that masks individual weaknesses',
      'Group-wide policies that do not account for the different obligation profiles of each entity',
    ],
    risks: [
      'Inconsistent compliance standards across group entities creating regulatory exposure for the group',
      'Customer information sharing without adequate data governance and access controls',
      'Entity-level compliance gaps hidden by a group-level view that masks individual weaknesses',
      'Group-wide policies that fail to account for the different obligation profiles of individual entities',
    ],
    customerRisks: [
      "Customers active across multiple group entities — a customer who interacts with multiple regulated businesses in your group requires a consolidated view of their activity across all entities to detect group-level patterns.",
      "High-value customers with inconsistent profiles across entities — a customer who presents as low-risk at one entity but high-risk at another is a group-level risk pattern that requires coordinated investigation.",
      "Customers onboarded by one entity whose CDD record has lapsed — shared customer records are only useful if the underlying CDD remains current. Expired KYC shared across entities is a shared liability.",
      "New entities joining the group with legacy customer portfolios — customers brought in from an acquired business may not have been onboarded to the group's CDD standards. Remediation is required.",
    ],
    cddRequirements: [
      'Group-level shared customer master records — CDD conducted once to satisfy multiple entities',
      'Entity-specific CDD overlays where individual entity obligations require additional verification',
      'Consolidated beneficial ownership records across all group entities',
      'Group-wide PEP and sanctions screening with results shared across all member entities',
    ],
    monitoringRequirements: [
      'Consolidated transaction monitoring across all entities to identify group-level patterns',
      'Entity-level monitoring overlays for specific risk profiles of individual businesses',
      'Group-level dashboard providing real-time compliance status across all entities',
    ],
    reportingRequirements: {
      types: ['SMR', 'IFTI', 'TTR'],
      details: 'Reporting group entities may lodge reports individually or under group-level arrangements depending on AUSTRAC authorisation. Each entity remains individually responsible for lodging required reports on time.',
    },
    howVerigoHelps: [
      'Multi-entity group dashboard — consolidated compliance status across all member entities in one view',
      'Shared customer master records — CDD done once, relied upon across the group',
      'Group-level AML/CTF program management with entity-specific compliance overlays',
      'Consolidated AUSTRAC reporting with the ability to prepare and lodge reports per entity',
      'Group-wide audit trail and access controls ensuring appropriate data governance',
    ],
    austracRef: 'AML/CTF Act 2006 — Reporting Groups',
    packName: 'Reporting Group Pack',
    color: 'from-teal-500 to-cyan-600',
    exampleWorkflow: [
      { title: 'Group structure configured', desc: 'All member entities set up. Group hierarchy, shared program, and reporting relationships established.' },
      { title: 'Shared AML Program deployed', desc: 'Group-level AML/CTF program applied across all entities. Entity-specific customisations applied where needed.' },
      { title: 'Customer onboarded once', desc: 'New customer onboarded at any entity. CDD record shared across the group — no duplication.' },
      { title: 'Group-level monitoring', desc: 'Transactions at all entities monitored. Cross-entity patterns visible to the group MLRO.' },
      { title: 'Entity-level alerts escalated', desc: 'Alert at any entity creates a case. High-risk cases escalated to group MLRO for consolidated review.' },
      { title: 'Consolidated reporting', desc: 'Group CCO views compliance status across all entities. Reports prepared and submitted per entity or group arrangement.' },
    ],
    pricingRec: {
      plan: 'Enterprise',
      reason: 'Reporting Groups require multi-entity configuration, shared customer records, group-level monitoring, and consolidated reporting. Enterprise includes all of this plus a dedicated account manager and custom SLA.',
    },
  },
]

export const getIndustry = (id: string) => industries.find(i => i.id === id)
