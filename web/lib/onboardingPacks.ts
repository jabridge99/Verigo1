export type OnboardingPack = {
  industryId: string
  label: string
  regime: 'current' | 'expanded'
  icon: string
  overview: { intro: string; paragraphs: string[]; keyFacts: { label: string; value: string }[] }
  amlObligations: { intro: string; obligations: { title: string; description: string }[] }
  cdd: { intro: string; requirements: { category: string; items: string[] }[] }
  edd: { intro: string; triggers: string[]; requirements: { category: string; items: string[] }[] }
  monitoring: { intro: string; controls: { name: string; description: string; ruleType: string }[] }
  reporting: { intro: string; reports: { type: string; fullName: string; deadline: string; threshold: string; description: string; keyFields: string[] }[] }
  riskAssessment: { intro: string; ratingMatrix: { factor: string; lowRisk: string; mediumRisk: string; highRisk: string }[]; methodology: string }
  amlProgram: { intro: string; components: { name: string; description: string; keyElements: string[] }[] }
  verigoChecklist: { intro: string; phases: { phase: string; timeframe: string; items: { task: string; detail: string; critical: boolean }[] }[] }
  goLive: { intro: string; criteria: { category: string; checks: { item: string; description: string }[] }[] }
}

export const onboardingPacks: OnboardingPack[] = [
  {
    industryId: 'digital-currency-exchange',
    label: 'Digital Currency Exchange',
    regime: 'current',
    icon: '₿',
    overview: {
      intro: 'Digital Currency Exchange (DCE) providers occupy the highest-risk tier of Australia\'s AML/CTF regime. AUSTRAC has consistently identified the cryptocurrency sector as a priority enforcement area, with DCEs subject to mandatory registration, full program obligations, and all three AUSTRAC report types.',
      paragraphs: [
        'A DCE is any person or business that exchanges digital currency (such as Bitcoin, Ethereum, or stablecoins) for money, or money for digital currency, as a business. This includes both centralised exchange platforms and peer-to-peer exchange facilitators operating in Australia or serving Australian customers.',
        'The pseudonymous nature of blockchain transactions, the speed of cross-border transfers, and the availability of privacy-enhancing technologies create a unique risk environment. DCEs are attractive to money launderers because cryptocurrency can be rapidly converted to fiat, transferred offshore, or layered through multiple wallet addresses before being extracted from the financial system.',
        'AUSTRAC data has shown that DCEs are frequently exploited for placement and layering of proceeds from drug trafficking, fraud, and other serious crimes. Regulatory scrutiny is high: AUSTRAC has taken enforcement action against several DCEs for failing to register, failing to implement adequate programs, and failing to lodge required reports. The civil penalty regime allows fines of up to $222 million for serious and systemic non-compliance.',
        'Under the AML/CTF Act 2006, DCEs must register with AUSTRAC before commencing operations and maintain that registration for as long as they provide DCE services. The registration obligation applies to both primary DCE services and ancillary digital currency services such as custody and wallet management where exchange is part of the service offering.',
      ],
      keyFacts: [
        { label: 'Legislation', value: 'AML/CTF Act 2006, AML/CTF Rules 2007' },
        { label: 'Regulator', value: 'AUSTRAC' },
        { label: 'Regime', value: 'Current — obligations active now' },
        { label: 'Registration required', value: 'Yes — mandatory before commencing DCE services' },
        { label: 'Report types', value: 'SMR, IFTI, TTR' },
        { label: 'Maximum penalty', value: 'Up to $222 million (serious and systemic)' },
        { label: 'Record keeping', value: '7 years from date of transaction or report' },
      ],
    },
    amlObligations: {
      intro: 'DCEs are subject to the full suite of AML/CTF obligations under the Act. These obligations are non-delegable and apply from the moment a DCE service is first provided to a customer.',
      obligations: [
        { title: 'AUSTRAC Registration', description: 'DCEs must register with AUSTRAC before providing any DCE service. Operating without registration is a criminal offence. Registration must be renewed annually and updated whenever there is a material change to the business. AUSTRAC may refuse or cancel registration where the DCE or its officers do not meet fit and proper person requirements.' },
        { title: 'AML/CTF Program — Part A', description: 'Every DCE must adopt, implement, and maintain a Part A AML/CTF program. Part A sets out the DCE\'s risk assessment, policies, procedures, controls, and governance arrangements. It must be reviewed at least annually or whenever there is a material change in the DCE\'s risk profile, products, or customer base.' },
        { title: 'AML/CTF Program — Part B', description: 'Part B of the AML/CTF program sets out the DCE\'s Know Your Customer (KYC) procedures. It must specify how the DCE will identify and verify the identity of customers, including the documents and data sources used, the procedures for collecting and verifying information, and how identity records are maintained.' },
        { title: 'Customer Identification and Verification', description: 'DCEs must identify and verify all customers before providing any DCE service. Verification must be completed before the customer transacts. Anonymous accounts and unverified wallets are not permitted for reportable services. The standard of verification must be risk-based, with higher-risk customers subject to more rigorous checks.' },
        { title: 'Ongoing Customer Due Diligence', description: 'DCEs must conduct ongoing CDD including periodic review of customer risk ratings, re-verification of identity where it has expired or changed, and updating customer records to reflect changes in circumstances. The frequency of periodic review must be determined by the customer\'s risk rating.' },
        { title: 'Transaction Monitoring', description: 'DCEs must implement transaction monitoring systems capable of detecting unusual or suspicious patterns. Rules must be calibrated to the specific risk profile of DCE services including velocity, structuring, high-risk wallet indicators, and cross-border transfer patterns.' },
        { title: 'AUSTRAC Reporting', description: 'DCEs must lodge SMRs, IFTIs, and TTRs as required. Failure to lodge required reports is a strict liability offence. DCEs must also submit Annual Compliance Reports (ACR) to AUSTRAC and respond to any AUSTRAC information requests within the prescribed timeframes.' },
        { title: 'Record Keeping', description: 'All customer identification records, transaction records, CDD documents, and AUSTRAC reports must be retained for a minimum of 7 years. Records must be stored securely and be producible to AUSTRAC within a reasonable timeframe upon request.' },
      ],
    },
    cdd: {
      intro: 'Standard Customer Due Diligence (CDD) applies to all DCE customers before any service is provided. The CDD procedures set out in Part B of the AML/CTF Program must be followed for every new customer relationship.',
      requirements: [
        {
          category: 'Individual Identity Verification',
          items: [
            'Full legal name as it appears on government-issued identification',
            'Date of birth',
            'Residential address — current and verified',
            'Government-issued photo identification document (passport, driver\'s licence, or equivalent)',
            'Biometric liveness check to confirm the customer is physically present and matches the document',
            'Document authenticity verification (machine-readable zone, chip read, or equivalent)',
          ],
        },
        {
          category: 'Business / Entity Verification (KYB)',
          items: [
            'Full legal name of the entity and any trading names',
            'ABN / ACN (or foreign equivalent) verified against ASIC or equivalent register',
            'Registered business address',
            'Nature of business and principal activities',
            'Identification and verification of all beneficial owners holding 25% or more',
            'Verification of authorised signatories and their authority to act',
            'Corporate structure chart where the ownership chain is complex',
          ],
        },
        {
          category: 'Wallet and Blockchain Information',
          items: [
            'Customer-declared wallet addresses associated with their account',
            'Screening of declared wallet addresses against blockchain analytics databases',
            'Self-hosted wallet verification for customers withdrawing to non-custodial addresses',
            'Confirmation of ownership of external wallet addresses via signed message or micro-transfer',
          ],
        },
        {
          category: 'Customer Risk Assessment',
          items: [
            'Initial customer risk rating assigned at onboarding based on identity, occupation, jurisdiction, and transaction profile',
            'PEP screening of all individuals — domestic and foreign PEPs',
            'Sanctions screening against OFAC SDN, UN Consolidated, EU, DFAT, and UK HMT lists',
            'Adverse media search for all high-risk customers',
            'Source of funds declaration for customers intending to transact above defined thresholds',
          ],
        },
      ],
    },
    edd: {
      intro: 'Enhanced Due Diligence (EDD) must be applied to any customer or transaction that presents a higher risk of money laundering or terrorism financing. EDD goes beyond standard verification to obtain a deeper understanding of the customer\'s background, purpose, and the source of their funds.',
      triggers: [
        'Customer is identified as a Politically Exposed Person (PEP) or close associate of a PEP',
        'Customer is a national or resident of a high-risk or sanctioned jurisdiction (FATF grey list, OFAC-designated countries)',
        'Transaction volumes or patterns are inconsistent with the customer\'s stated occupation or source of funds',
        'Customer requests to use privacy coins (Monero, Zcash) or mixing/tumbling services',
        'Blockchain analytics flag the customer\'s wallet address as associated with illicit activity',
        'Customer provides inconsistent or implausible explanations for the source of funds',
        'Significant change in customer transaction behaviour without explanation',
        'Customer is a corporate entity with complex or opaque ownership structures',
        'Anonymous or pseudonymous customer profiles that cannot be adequately verified through standard procedures',
      ],
      requirements: [
        {
          category: 'Source of Funds',
          items: [
            'Written declaration of the source of funds to be used for cryptocurrency purchases',
            'Supporting documentation: recent bank statements, payslips, tax returns, investment account statements, or business financial statements',
            'Verification that the declared source of funds is plausible and consistent with the customer\'s known profile',
            'For business customers: audited financial statements or accountant-certified income evidence',
          ],
        },
        {
          category: 'Source of Wealth (for high-risk / high-value customers)',
          items: [
            'Written declaration of the overall accumulated wealth of the customer',
            'Evidence of how wealth was accumulated: employment history, business ownership, inheritance documentation, or investment records',
            'Verification that the stated source of wealth is consistent with the customer\'s background',
          ],
        },
        {
          category: 'PEP-Specific Requirements',
          items: [
            'Identification of the specific PEP role or connection',
            'MLRO or senior management approval before establishing or continuing the relationship',
            'Enhanced monitoring of all subsequent transactions',
            'Annual review of the PEP relationship with updated EDD documentation',
          ],
        },
        {
          category: 'Ongoing EDD Obligations',
          items: [
            'More frequent periodic review than standard customers — at minimum every 6 months for high-risk',
            'Transaction-level review for each high-value or unusual transaction',
            'Documented rationale for continuing the relationship where concerns exist',
            'Escalation to MLRO for any unresolved EDD concerns',
          ],
        },
      ],
    },
    monitoring: {
      intro: 'Transaction monitoring for DCEs must cover the full lifecycle of cryptocurrency activity — deposits, withdrawals, exchanges, and cross-border transfers. Rules must be calibrated to the specific risk typologies observed in the DCE sector.',
      controls: [
        { name: 'IFTI Threshold Alert', description: 'Automatically flag any international cryptocurrency transfer instruction equivalent to $10,000 AUD or more for IFTI report preparation. Must capture both IFTI-IN (receiving international transfer instructions) and IFTI-OUT (sending international transfer instructions).', ruleType: 'Threshold' },
        { name: 'TTR Cash Threshold Alert', description: 'Flag any cash deposit or withdrawal associated with a DCE transaction at or above $10,000 AUD for TTR preparation. Applies where the DCE accepts cash as a payment method for cryptocurrency purchases.', ruleType: 'Threshold' },
        { name: 'Structuring Detection', description: 'Detect patterns where a customer makes multiple transactions over a short period that individually fall below the $10,000 IFTI or TTR threshold but collectively exceed it. Trigger review where three or more transactions of similar size occur within a 5-day window.', ruleType: 'Pattern' },
        { name: 'Velocity Monitoring', description: 'Alert when a customer\'s transaction velocity (number or value of transactions per day/week/month) significantly exceeds their historical baseline or their declared transaction intent at onboarding.', ruleType: 'Velocity' },
        { name: 'High-Risk Wallet Screening', description: 'Screen all customer wallet addresses and transaction counterparties against blockchain analytics databases for known illicit addresses, darknet market associations, ransomware wallets, and sanctioned addresses.', ruleType: 'Screening' },
        { name: 'Privacy Coin Transaction Alert', description: 'Flag all transactions involving privacy coins (Monero, Zcash, Dash) or interaction with coin mixing or tumbling services for manual review and potential SMR consideration.', ruleType: 'Product Risk' },
        { name: 'Rapid In-Out Pattern', description: 'Detect customers who deposit funds and withdraw to a different wallet address or currency within a very short timeframe (e.g. less than 24 hours), which is a common layering indicator in cryptocurrency exchanges.', ruleType: 'Pattern' },
        { name: 'High-Risk Jurisdiction Transfer', description: 'Flag all transfers to or from cryptocurrency addresses or exchanges associated with high-risk jurisdictions on the FATF grey or black list, or DFAT-sanctioned countries.', ruleType: 'Jurisdiction' },
      ],
    },
    reporting: {
      intro: 'DCEs have obligations to lodge three types of AUSTRAC reports: Suspicious Matter Reports (SMRs), International Funds Transfer Instructions (IFTIs), and Threshold Transaction Reports (TTRs). Each has distinct triggers, deadlines, and field requirements.',
      reports: [
        {
          type: 'SMR',
          fullName: 'Suspicious Matter Report',
          deadline: '3 business days after forming a suspicion',
          threshold: 'No dollar threshold — suspicion-based',
          description: 'An SMR must be lodged when the DCE forms a suspicion that a transaction or activity is connected to money laundering, terrorism financing, serious crime, or tax evasion. The obligation to lodge arises when suspicion is formed — not when it is proven. Tipping off the customer is prohibited.',
          keyFields: ['Customer identifying information', 'Account details', 'Transaction details including wallet addresses', 'Nature and basis of the suspicion', 'Actions taken by the reporting entity', 'Whether the transaction was completed or refused'],
        },
        {
          type: 'IFTI',
          fullName: 'International Funds Transfer Instruction',
          deadline: '10 business days after the transfer instruction',
          threshold: '$10,000 AUD equivalent or more',
          description: 'IFTIs must be lodged for all international cryptocurrency transfer instructions at or above $10,000 AUD equivalent. Both incoming (IFTI-IN) and outgoing (IFTI-OUT) instructions must be reported. The report captures the full chain of entities involved in the transfer instruction.',
          keyFields: ['Ordering entity and account details', 'Beneficiary entity and account details', 'Transfer amount in AUD equivalent', 'Currency and exchange rate', 'Wallet addresses involved', 'Date of instruction and settlement'],
        },
        {
          type: 'TTR',
          fullName: 'Threshold Transaction Report',
          deadline: '10 business days after the transaction',
          threshold: '$10,000 AUD or more in physical cash',
          description: 'TTRs are required where a DCE accepts cash as a payment method and a customer pays $10,000 AUD or more in physical currency for a cryptocurrency purchase. This includes situations where multiple cash payments aggregate to $10,000 or more in a single transaction.',
          keyFields: ['Customer identifying information', 'Cash amount received', 'Date and location of transaction', 'Currency denomination', 'Type of transaction (purchase of cryptocurrency)', 'Teller or staff member details'],
        },
      ],
    },
    riskAssessment: {
      intro: 'The DCE risk assessment must identify the inherent risks of providing DCE services, assess the effectiveness of existing controls, and determine the residual risk. It must be documented, approved by senior management or the board, and reviewed at least annually.',
      ratingMatrix: [
        { factor: 'Customer Type', lowRisk: 'Verified Australian residents with stable employment and consistent transaction history', mediumRisk: 'Self-employed, business owners, or customers with variable income and moderate transaction volumes', highRisk: 'PEPs, customers from high-risk jurisdictions, anonymous or pseudonymous individuals, customers in high-cash industries' },
        { factor: 'Transaction Value', lowRisk: 'Under $1,000 AUD per transaction, low monthly cumulative', mediumRisk: '$1,000–$10,000 AUD per transaction or $5,000–$50,000 monthly cumulative', highRisk: 'Over $10,000 AUD per transaction or over $50,000 monthly cumulative' },
        { factor: 'Jurisdiction', lowRisk: 'Australia, UK, USA, EU member states, Canada, New Zealand, Singapore', mediumRisk: 'Jurisdictions with moderate FATF compliance ratings or limited AML/CTF frameworks', highRisk: 'FATF grey list jurisdictions, DFAT-sanctioned countries, countries with known terrorism financing connections' },
        { factor: 'Currency / Asset Type', lowRisk: 'Bitcoin, Ethereum, major fiat-backed stablecoins on transparent blockchains', mediumRisk: 'Less common cryptocurrencies with lower liquidity but transparent ledgers', highRisk: 'Privacy coins (Monero, Zcash), tokens with obfuscated transaction histories, assets from unknown origin' },
        { factor: 'Distribution Channel', lowRisk: 'Direct digital onboarding with full biometric KYC, self-onboarded through verified app', mediumRisk: 'Customers onboarded through third-party platforms or introducing brokers', highRisk: 'Customers onboarded through agents without direct DCE verification, non-face-to-face without adequate alternative verification' },
      ],
      methodology: 'The risk assessment must apply a two-dimensional matrix scoring inherent risk (before controls) and control effectiveness. Residual risk is calculated as inherent risk minus control effectiveness. High residual risk requires immediate remediation. The assessment must cover all products, services, customers, and geographies of the DCE and must be reviewed following any material change, AUSTRAC guidance update, or industry typology publication.',
    },
    amlProgram: {
      intro: 'The AML/CTF Program for a DCE must comply with Part 7 of the AML/CTF Act 2006 and the AML/CTF Rules. It must be in writing, approved by the board or equivalent governing body, and implemented across all DCE operations.',
      components: [
        { name: 'Part A — Risk Assessment and Controls', description: 'Sets out the DCE\'s assessment of its ML/TF risk, the controls designed to manage that risk, and the governance framework for ongoing oversight. Must address customer risk, product risk, geographic risk, and distribution channel risk.', keyElements: ['ML/TF risk assessment methodology', 'Board and MLRO governance structure', 'Staff training obligations and records', 'Independent compliance audit requirements', 'Annual program review process'] },
        { name: 'Part B — Customer Identification Procedures', description: 'Specifies the KYC procedures applied to each customer type. Must distinguish between standard CDD and enhanced CDD and specify the triggers for EDD.', keyElements: ['Individual KYC procedures with acceptable documents', 'Business KYC (KYB) procedures', 'Beneficial ownership identification requirements', 'Re-verification triggers and procedures', 'Record keeping requirements for KYC documents'] },
        { name: 'Transaction Monitoring Program', description: 'Documents all transaction monitoring rules, thresholds, and escalation procedures. Must specify the system used, the rules configured, and the process for reviewing and acting on alerts.', keyElements: ['Monitoring rule inventory and rationale', 'Alert triage and escalation workflow', 'MLRO review and SMR consideration process', 'Rule review and tuning schedule'] },
        { name: 'AUSTRAC Reporting Procedures', description: 'Step-by-step procedures for identifying reportable transactions, preparing reports, obtaining MLRO sign-off, and lodging with AUSTRAC within required timeframes.', keyElements: ['SMR identification and preparation workflow', 'IFTI calculation and lodgement procedure', 'TTR identification and preparation procedure', 'Tipping off prohibition compliance'] },
        { name: 'Staff Training Program', description: 'Annual mandatory training for all staff with AML/CTF responsibilities. Must cover the Act, the DCE\'s specific obligations, how to identify red flags, and how to escalate concerns to the MLRO.', keyElements: ['Training content and curriculum', 'Completion tracking and records', 'Induction training for new staff', 'Role-specific training for compliance staff and MLRO'] },
      ],
    },
    verigoChecklist: {
      intro: 'This checklist covers the configuration steps required to have Verigo operational and compliant for a DCE. Complete each phase in order — do not advance to production until all critical items in the prior phase are complete.',
      phases: [
        {
          phase: 'Phase 1 — Account Setup',
          timeframe: 'Day 1–2',
          items: [
            { task: 'Create Verigo organisation account', detail: 'Register your DCE entity in Verigo. Set the industry type to Digital Currency Exchange to activate the DCE compliance pack.', critical: true },
            { task: 'Add MLRO and compliance officer user accounts', detail: 'Create user accounts for your MLRO and any other compliance staff. Assign MLRO role to the designated officer.', critical: true },
            { task: 'Configure business entity details', detail: 'Enter your AUSTRAC registration number, ABN, registered business name, and principal place of business.', critical: true },
            { task: 'Set AML/CTF program effective date', detail: 'Enter the date your AML/CTF program was adopted and approved.', critical: false },
          ],
        },
        {
          phase: 'Phase 2 — KYC and Onboarding Configuration',
          timeframe: 'Day 2–5',
          items: [
            { task: 'Configure individual KYC workflow', detail: 'Enable biometric liveness check, document OCR, and government database verification. Set document types accepted (passport, driver\'s licence).', critical: true },
            { task: 'Configure business KYB workflow', detail: 'Enable ASIC/ABR lookup, beneficial ownership collection form, and director identity verification.', critical: true },
            { task: 'Set CDD thresholds', detail: 'Configure the dollar thresholds at which enhanced information (source of funds, source of wealth) is automatically requested.', critical: true },
            { task: 'Enable PEP and sanctions screening', detail: 'Activate screening against OFAC, UN, EU, DFAT, and UK HMT lists. Set screening to run at onboarding and at periodic intervals.', critical: true },
            { task: 'Configure wallet address screening', detail: 'Connect blockchain analytics provider. Set wallet screening to run on all customer-declared and transaction-observed addresses.', critical: true },
          ],
        },
        {
          phase: 'Phase 3 — Transaction Monitoring Rules',
          timeframe: 'Day 5–10',
          items: [
            { task: 'Enable IFTI threshold rule', detail: 'Set alert threshold at $10,000 AUD equivalent for international transfer instructions. Configure for both IFTI-IN and IFTI-OUT.', critical: true },
            { task: 'Enable TTR threshold rule', detail: 'Set cash transaction alert at $10,000 AUD. Applicable only if DCE accepts cash.', critical: true },
            { task: 'Enable structuring detection rule', detail: 'Configure pattern rule for multiple transactions below $10,000 within a 5-day window.', critical: true },
            { task: 'Enable velocity rules', detail: 'Set baseline transaction velocity for each risk tier and alert on deviations.', critical: false },
            { task: 'Enable high-risk wallet alert', detail: 'Configure automatic alert on any transaction involving wallet addresses flagged by blockchain analytics.', critical: true },
            { task: 'Enable privacy coin alert', detail: 'Flag all transactions involving Monero, Zcash, or known mixing services.', critical: true },
          ],
        },
        {
          phase: 'Phase 4 — Reporting Configuration',
          timeframe: 'Day 10–14',
          items: [
            { task: 'Configure AUSTRAC reporting credentials', detail: 'Enter your AUSTRAC reporting entity number and connect to the AUSTRAC reporting portal.', critical: true },
            { task: 'Test SMR preparation workflow', detail: 'Create a test SMR from a simulated alert. Verify that all AUSTRAC-required fields are present and the MLRO sign-off step is functional.', critical: true },
            { task: 'Test IFTI preparation and lodgement', detail: 'Verify that IFTI-IN and IFTI-OUT report templates are correctly populated from transaction data. Test lodgement to AUSTRAC sandbox.', critical: true },
            { task: 'Set up report due-date reminders', detail: 'Configure automated reminders for pending SMRs (day 2 of 3) and IFTIs/TTRs (day 8 of 10).', critical: false },
          ],
        },
        {
          phase: 'Phase 5 — Go-Live',
          timeframe: 'Day 14',
          items: [
            { task: 'Conduct end-to-end test with real customer', detail: 'Onboard a test customer through the full KYC flow. Verify screening results are recorded.', critical: true },
            { task: 'MLRO sign-off on program configuration', detail: 'Obtain MLRO written confirmation that the Verigo configuration matches the written AML/CTF program.', critical: true },
            { task: 'Archive configuration baseline', detail: 'Export and store the current Verigo configuration as evidence of your program at go-live.', critical: false },
          ],
        },
      ],
    },
    goLive: {
      intro: 'Complete this assessment before going live. Every Critical item must be confirmed as complete. Non-critical items should be resolved within 30 days of go-live.',
      criteria: [
        {
          category: 'Legal and Registration',
          checks: [
            { item: 'AUSTRAC registration active', description: 'DCE is registered with AUSTRAC and registration is current. Registration number is recorded in Verigo.' },
            { item: 'AML/CTF Program approved', description: 'Written AML/CTF Program (Part A and Part B) has been approved by the board or equivalent governing body.' },
            { item: 'MLRO appointed', description: 'A qualified MLRO has been appointed, their appointment is documented, and their Verigo account has MLRO role permissions.' },
          ],
        },
        {
          category: 'Customer Due Diligence',
          checks: [
            { item: 'KYC workflow configured and tested', description: 'Individual and business KYC workflows are configured, tested with real documents, and producing accurate results.' },
            { item: 'PEP and sanctions screening active', description: 'Screening is running against all required lists (OFAC, UN, EU, DFAT, UK HMT) and results are being recorded.' },
            { item: 'Wallet screening connected', description: 'Blockchain analytics integration is active and screening all customer wallet addresses.' },
          ],
        },
        {
          category: 'Transaction Monitoring',
          checks: [
            { item: 'All mandatory rules active', description: 'IFTI, TTR, structuring, and high-risk wallet rules are enabled and generating test alerts correctly.' },
            { item: 'Alert triage workflow configured', description: 'Alerts route to the compliance team and MLRO sign-off is required before closure or SMR lodgement.' },
          ],
        },
        {
          category: 'AUSTRAC Reporting',
          checks: [
            { item: 'AUSTRAC portal connection tested', description: 'Test report lodgement to AUSTRAC sandbox has been completed successfully.' },
            { item: 'SMR workflow end-to-end tested', description: 'Full SMR workflow from alert to lodgement has been tested including MLRO sign-off.' },
            { item: 'IFTI and TTR templates validated', description: 'All report templates are correctly populated from transaction data and pass AUSTRAC field validation.' },
          ],
        },
        {
          category: 'Record Keeping',
          checks: [
            { item: 'Document retention policy configured', description: 'Verigo is set to retain all records for a minimum of 7 years with access controls protecting record integrity.' },
            { item: 'Audit trail enabled', description: 'All user actions, compliance decisions, and system events are being recorded in the immutable audit log.' },
          ],
        },
      ],
    },
  },
  {
    industryId: 'remittance-provider',
    label: 'Remittance Provider',
    regime: 'current',
    icon: '🌏',
    overview: {
      intro: 'Remittance providers are among the most heavily regulated businesses under Australia\'s AML/CTF framework. The international transfer of value creates substantial exposure to layering, terrorism financing corridor risk, and the use of informal value transfer networks that operate in parallel with the licensed remittance sector.',
      paragraphs: [
        'A remittance provider is any person or business that moves value on behalf of customers from Australia to overseas (or vice versa), whether through bank transfers, mobile wallets, cryptocurrency, agent networks, or informal channels. Remittance Network Providers (RNPs) operate agent networks and must ensure that all agents are compliant with the Act. Independent Remittance Dealers (IRDs) operate as standalone businesses.',
        'Australia\'s remittance sector is a globally significant market, particularly for corridors to the Pacific, Southeast Asia, South Asia, and the Middle East. AUSTRAC has identified these corridors as high-risk due to the prevalence of informal value transfer, the use of cash-based agents, and the difficulty of verifying beneficiaries in some destination countries.',
        'The dual obligation to identify both the sender and the beneficiary distinguishes remittance compliance from most other financial services sectors. IFTI reports must capture the full chain of entities involved in the transfer, including all intermediaries. For remittance network providers, the IFTI obligation extends to each transfer processed by agents on behalf of the network.',
        'AUSTRAC\'s enforcement history in the remittance sector includes significant civil penalties for failure to maintain adequate agent oversight programs, failure to lodge IFTIs, and failure to conduct adequate CDD on high-risk customers. The sector is subject to ongoing targeted reviews by AUSTRAC.',
      ],
      keyFacts: [
        { label: 'Legislation', value: 'AML/CTF Act 2006, AML/CTF Rules 2007' },
        { label: 'Regulator', value: 'AUSTRAC' },
        { label: 'Regime', value: 'Current — obligations active now' },
        { label: 'Registration required', value: 'Yes — mandatory registration before commencing operations' },
        { label: 'Report types', value: 'IFTI-IN, IFTI-OUT, SMR, TTR' },
        { label: 'Key threshold', value: '$10,000 AUD for IFTI reporting' },
        { label: 'Record keeping', value: '7 years' },
      ],
    },
    amlObligations: {
      intro: 'Remittance providers must comply with the full range of AML/CTF Act obligations. RNPs have additional obligations relating to agent oversight that do not apply to IRDs.',
      obligations: [
        { title: 'AUSTRAC Registration', description: 'Remittance providers must register with AUSTRAC as either a Remittance Network Provider (RNP) or an Independent Remittance Dealer (IRD) before commencing operations. RNPs must also register their agent network and ensure each agent is listed on the AUSTRAC register.' },
        { title: 'AML/CTF Program', description: 'A full Part A and Part B AML/CTF program is mandatory. For RNPs, the program must specifically address the risks posed by the agent network and include an agent oversight program. The program must be reviewed annually and updated for any material changes.' },
        { title: 'Customer Identification — Sender', description: 'The sender\'s identity must be verified before the transfer is completed. At minimum this requires full name, date of birth, and address verification. For transfers above risk thresholds, enhanced verification including photo ID is required.' },
        { title: 'Beneficiary Identification', description: 'The beneficiary must be identified at the time of the transfer instruction. This includes full name, destination country, and where applicable, account or mobile wallet details. For high-risk corridors or transfers above thresholds, additional beneficiary verification may be required.' },
        { title: 'IFTI Reporting', description: 'IFTIs must be lodged for all international transfer instructions at or above $10,000 AUD, whether the instruction is to send funds overseas (IFTI-OUT) or to receive funds from overseas (IFTI-IN). Reports must be lodged within 10 business days of the transfer instruction.' },
        { title: 'Agent Oversight (RNPs only)', description: 'RNPs must maintain a current register of all agents, ensure each agent is trained in AML/CTF obligations, conduct regular oversight audits of agent compliance, and have procedures for suspending or terminating non-compliant agents.' },
        { title: 'Sanctions and PEP Screening', description: 'All senders, beneficiaries, and agents must be screened against sanctions lists and PEP databases. For agents operating in high-risk jurisdictions, enhanced screening and oversight is required.' },
      ],
    },
    cdd: {
      intro: 'CDD for remittance providers applies to both the sender and the beneficiary. The level of verification required varies based on the transfer amount, destination corridor, and customer risk profile.',
      requirements: [
        {
          category: 'Sender Identification',
          items: [
            'Full legal name matching photo identification',
            'Date of birth',
            'Current residential address — verified by document or database',
            'Photo identification document for transfers above $1,000 AUD or where risk indicators are present',
            'Contact details including mobile number and email address',
            'Occupation or source of income for transfers above defined risk thresholds',
          ],
        },
        {
          category: 'Beneficiary Identification',
          items: [
            'Full legal name of the beneficiary',
            'Country and city of beneficiary\'s residence or location',
            'Bank account number, mobile wallet ID, or other payment destination identifier',
            'Relationship between sender and beneficiary (family, business, personal)',
            'Purpose of transfer',
          ],
        },
        {
          category: 'Business Sender KYB',
          items: [
            'Registered business name and ABN or foreign equivalent',
            'Registered business address and country of incorporation',
            'Nature of business and primary trading activities',
            'Identification and verification of beneficial owners and authorised signatories',
            'Purpose of the remittance and expected transaction profile',
          ],
        },
        {
          category: 'Risk Assessment',
          items: [
            'Corridor risk rating applied based on destination country risk profile',
            'Customer risk rating based on identity, occupation, and transaction history',
            'PEP and sanctions screening for both sender and beneficiary',
            'Source of funds for transfers above $5,000 AUD or where the corridor is high-risk',
          ],
        },
      ],
    },
    edd: {
      intro: 'EDD applies where the standard CDD process reveals elevated risk factors or where the transfer involves characteristics associated with money laundering or terrorism financing typologies.',
      triggers: [
        'Transfer to a FATF grey list or DFAT-sanctioned country',
        'Sender or beneficiary is a PEP or connected to a PEP',
        'Transfer amount exceeds $10,000 AUD or is inconsistent with the customer\'s declared income',
        'Multiple transfers to the same beneficiary in a short period suggesting structuring',
        'Sender is a business operating in a high-risk industry (gambling, adult entertainment, cannabis)',
        'Transfer destination is to a jurisdiction known for hawala or informal value transfer activity',
        'Beneficiary cannot be adequately identified from the information provided',
        'Sender provides implausible or inconsistent explanations for the purpose of the transfer',
      ],
      requirements: [
        {
          category: 'Enhanced Sender Verification',
          items: [
            'Full biometric identity verification with liveness check',
            'Source of funds documentation — bank statements or payslips for the prior 3 months',
            'Written declaration of the purpose of the transfer',
            'Employment verification or business financial statements for business senders',
          ],
        },
        {
          category: 'Enhanced Beneficiary Verification',
          items: [
            'Copy of beneficiary\'s government-issued identification where obtainable',
            'Confirmation of relationship between sender and beneficiary',
            'Verification that the beneficiary\'s account details are legitimate and not associated with fraud or crime',
          ],
        },
        {
          category: 'High-Risk Corridor Measures',
          items: [
            'MLRO review before processing transfers to FATF-listed jurisdictions',
            'Documentary evidence of legitimate business or personal purpose',
            'Enhanced post-transfer monitoring for patterns across the corridor',
          ],
        },
      ],
    },
    monitoring: {
      intro: 'Monitoring for remittance providers must cover both sender and corridor-level risk, and must be capable of detecting structuring, layering through multiple agents, and transfers to high-risk beneficiaries.',
      controls: [
        { name: 'IFTI Threshold Alert', description: 'Flag all transfer instructions at or above $10,000 AUD for IFTI preparation. Apply to both outgoing (IFTI-OUT) and incoming (IFTI-IN) transfer instructions.', ruleType: 'Threshold' },
        { name: 'Structuring Detection', description: 'Detect multiple transfers below $10,000 AUD from the same sender to the same or different beneficiaries within a 5-day window that aggregate above the IFTI threshold.', ruleType: 'Pattern' },
        { name: 'Corridor Risk Monitoring', description: 'Apply elevated monitoring to transfers to high-risk corridors (FATF grey list countries). Trigger MLRO review for any transfer above $5,000 AUD to a high-risk corridor.', ruleType: 'Jurisdiction' },
        { name: 'Velocity Monitoring', description: 'Alert on sender-level velocity where the number or value of transfers in a rolling 30-day period significantly exceeds the customer\'s historical or declared transaction profile.', ruleType: 'Velocity' },
        { name: 'Beneficiary Concentration', description: 'Alert where multiple senders are transferring to the same beneficiary account or mobile wallet in a short period, which may indicate smurfing or use of a money mule.', ruleType: 'Network' },
        { name: 'Third-Party Payment Detection', description: 'Flag transactions where the funding source (bank account or payment instrument) does not match the identity of the sender, indicating use of a third party\'s account.', ruleType: 'Payment' },
        { name: 'Agent Anomaly Detection (RNPs)', description: 'Monitor agent-level transaction volumes for deviations from expected patterns. Alert where an agent\'s IFTI lodgement rate, transaction volume, or customer profile deviates materially from the agent network average.', ruleType: 'Network' },
      ],
    },
    reporting: {
      intro: 'Remittance providers primarily lodge IFTI reports. SMRs are required for suspicious activity and TTRs for cash transactions at or above $10,000 AUD.',
      reports: [
        {
          type: 'IFTI-OUT',
          fullName: 'International Funds Transfer Instruction — Outgoing',
          deadline: '10 business days after the transfer instruction',
          threshold: '$10,000 AUD or more',
          description: 'An IFTI-OUT must be lodged whenever the remittance provider sends an international transfer instruction on behalf of a customer for $10,000 AUD or more. The report must capture all ordering and beneficiary information including intermediary institutions.',
          keyFields: ['Ordering customer full name, address, and account', 'Beneficiary full name, account, and country', 'Transfer amount in AUD', 'Destination country', 'Payment method', 'Date of instruction'],
        },
        {
          type: 'IFTI-IN',
          fullName: 'International Funds Transfer Instruction — Incoming',
          deadline: '10 business days after receiving the transfer instruction',
          threshold: '$10,000 AUD or more',
          description: 'An IFTI-IN must be lodged when the remittance provider receives an international transfer instruction to pay a beneficiary in Australia for $10,000 AUD or more.',
          keyFields: ['Ordering entity and country of origin', 'Beneficiary name and address in Australia', 'Amount received in AUD', 'Payment method used', 'Date funds received'],
        },
        {
          type: 'SMR',
          fullName: 'Suspicious Matter Report',
          deadline: '3 business days after forming a suspicion',
          threshold: 'No dollar threshold',
          description: 'SMRs must be lodged for any transaction, customer, or activity that gives rise to a suspicion of money laundering, terrorism financing, or serious crime. The obligation arises on forming a suspicion — not on proof.',
          keyFields: ['Customer details', 'Transaction details', 'Nature of suspicion', 'Actions taken', 'Whether transaction was completed'],
        },
        {
          type: 'TTR',
          fullName: 'Threshold Transaction Report',
          deadline: '10 business days',
          threshold: '$10,000 AUD in cash',
          description: 'TTRs apply where the remittance provider accepts cash payments of $10,000 AUD or more for a transfer. This is less common in digital remittance models but applies to cash-accepting agent locations.',
          keyFields: ['Customer identity', 'Cash amount', 'Transaction date and location', 'Agent details (if applicable)'],
        },
      ],
    },
    riskAssessment: {
      intro: 'The remittance risk assessment must specifically address corridor risk, agent network risk (for RNPs), and the ML/TF typologies most prevalent in the remittance sector.',
      ratingMatrix: [
        { factor: 'Destination Corridor', lowRisk: 'Australia, UK, EU, USA, Canada, NZ, Singapore', mediumRisk: 'South and Southeast Asia with moderate FATF compliance', highRisk: 'FATF grey list countries, Middle East conflict zones, jurisdictions with known hawala activity' },
        { factor: 'Transfer Amount', lowRisk: 'Under $2,000 AUD per transfer', mediumRisk: '$2,000–$10,000 AUD per transfer', highRisk: 'Over $10,000 AUD or aggregate structuring patterns above this threshold' },
        { factor: 'Customer Type', lowRisk: 'Verified individual with documented employment and consistent transfer history', mediumRisk: 'Self-employed or variable income customer, or new customer without established history', highRisk: 'PEP, customer from high-risk jurisdiction, or customer with prior suspicious activity' },
        { factor: 'Payment Method', lowRisk: 'Bank transfer from verified Australian bank account', mediumRisk: 'Debit card or mobile payment from verified customer', highRisk: 'Cash payment, third-party payment, or cryptocurrency' },
        { factor: 'Agent Type (RNPs)', lowRisk: 'Directly supervised agent with established compliance record', mediumRisk: 'Independent agent with moderate oversight history', highRisk: 'New agent, agent operating in high-risk area, or agent with prior compliance issues' },
      ],
      methodology: 'The remittance risk assessment must be updated whenever a new corridor is added, an agent is onboarded, or AUSTRAC issues updated corridor risk guidance. The assessment must specifically address whether the business has adequate controls for the highest-volume corridors and whether agent oversight is proportionate to agent risk.',
    },
    amlProgram: {
      intro: 'The AML/CTF Program for a remittance provider must address both direct service delivery and, for RNPs, the agent network. Agent oversight is a critical component that receives particular attention in AUSTRAC examinations.',
      components: [
        { name: 'Part A — Risk and Governance', description: 'Documents the ML/TF risk assessment, control framework, and governance arrangements. For RNPs, must include the agent oversight program as a distinct section.', keyElements: ['ML/TF risk assessment for all corridors', 'Agent risk assessment and oversight framework', 'MLRO role and responsibilities', 'Board oversight and annual review process'] },
        { name: 'Part B — KYC Procedures', description: 'Sets out the CDD procedures for senders and beneficiaries by transfer type and risk tier. Must address both individual and business customers.', keyElements: ['Sender CDD procedures by transaction tier', 'Beneficiary identification requirements', 'EDD triggers and procedures', 'Re-verification schedule'] },
        { name: 'Agent Oversight Program (RNPs)', description: 'A specific program component addressing the obligations of the RNP to oversee its agent network. Agents must be trained, supervised, and audited.', keyElements: ['Agent onboarding due diligence', 'Agent training requirements and records', 'Agent audit schedule and methodology', 'Suspension and termination procedures'] },
        { name: 'Corridor Risk Procedures', description: 'Documents the specific controls applied to high-risk corridors including pre-approval requirements, enhanced customer verification, and escalation to the MLRO.', keyElements: ['Corridor risk classification', 'High-risk corridor approval process', 'Enhanced monitoring for restricted corridors'] },
      ],
    },
    verigoChecklist: {
      intro: 'Configure Verigo for your remittance operations following this checklist. RNPs should ensure the agent management module is configured before onboarding agents.',
      phases: [
        {
          phase: 'Phase 1 — Account and Entity Setup',
          timeframe: 'Day 1–2',
          items: [
            { task: 'Create Verigo account and select Remittance Provider industry', detail: 'Industry selection activates the remittance-specific compliance pack including IFTI-IN and IFTI-OUT report templates.', critical: true },
            { task: 'Configure entity type (RNP or IRD)', detail: 'Select Remittance Network Provider or Independent Remittance Dealer to activate the appropriate program modules.', critical: true },
            { task: 'Enter AUSTRAC registration details', detail: 'Enter registration number, registration type, and registration expiry date.', critical: true },
          ],
        },
        {
          phase: 'Phase 2 — Corridor and Customer Configuration',
          timeframe: 'Day 2–7',
          items: [
            { task: 'Configure active corridors', detail: 'Add all destination countries to the corridor registry. Apply risk ratings (low/medium/high) to each corridor based on your risk assessment.', critical: true },
            { task: 'Set transaction tier thresholds', detail: 'Configure the CDD level triggered at each transfer amount (e.g. $0–$1,000: name+DOB; $1,000–$5,000: add address; $5,000+: add ID document).', critical: true },
            { task: 'Enable PEP and sanctions screening', detail: 'Activate screening for both senders and beneficiaries. Set screening frequency for repeat customers.', critical: true },
            { task: 'Configure agent accounts (RNPs)', detail: 'Create agent sub-accounts for each registered agent. Assign appropriate permissions and link to the agent\'s physical location.', critical: true },
          ],
        },
        {
          phase: 'Phase 3 — Monitoring and Reporting',
          timeframe: 'Day 7–12',
          items: [
            { task: 'Enable IFTI-OUT and IFTI-IN threshold rules', detail: 'Set $10,000 AUD threshold. Confirm report templates auto-populate from transaction records.', critical: true },
            { task: 'Enable structuring and velocity rules', detail: 'Configure rolling window structuring detection across all senders.', critical: true },
            { task: 'Enable corridor risk monitoring', detail: 'Set elevated monitoring parameters for high-risk corridors.', critical: false },
            { task: 'Test IFTI report lodgement', detail: 'Run end-to-end IFTI-OUT and IFTI-IN test reports to AUSTRAC sandbox.', critical: true },
          ],
        },
      ],
    },
    goLive: {
      intro: 'Confirm all items before processing your first live transfer.',
      criteria: [
        {
          category: 'Registration and Program',
          checks: [
            { item: 'AUSTRAC registration current', description: 'Registration is active, registered entity details match Verigo configuration.' },
            { item: 'AML/CTF Program adopted', description: 'Part A and Part B program approved by governing body and effective.' },
            { item: 'Agent register current (RNPs)', description: 'All agents are registered with AUSTRAC and listed in Verigo.' },
          ],
        },
        {
          category: 'CDD and Screening',
          checks: [
            { item: 'Sender and beneficiary CDD configured', description: 'Appropriate CDD level is triggered at each transaction tier.' },
            { item: 'PEP and sanctions screening active', description: 'Screening is running for all senders and beneficiaries.' },
            { item: 'High-risk corridor controls active', description: 'All corridors are risk-rated and high-risk corridor controls are enforced.' },
          ],
        },
        {
          category: 'Reporting',
          checks: [
            { item: 'IFTI templates validated', description: 'IFTI-IN and IFTI-OUT reports generate correctly from transaction data.' },
            { item: 'AUSTRAC lodgement tested', description: 'Test lodgement to AUSTRAC sandbox completed successfully.' },
            { item: 'Report deadline reminders configured', description: 'Automated reminders set for day 8 of the 10-day IFTI deadline.' },
          ],
        },
      ],
    },
  },
  {
    industryId: 'foreign-exchange',
    label: 'Foreign Exchange Provider',
    regime: 'current',
    icon: '💱',
    overview: {
      intro: 'Foreign exchange providers that convert one currency into another as a business are reporting entities under the AML/CTF Act 2006. FX businesses face specific risks from trade-based money laundering, bulk cash conversion, and the exploitation of retail FX channels to place criminal proceeds into the financial system.',
      paragraphs: [
        'A foreign exchange provider (also called a currency exchange or bureau de change) exchanges one national currency for another. This includes retail foreign exchange counters at airports and shopping centres, wholesale FX businesses, and online FX platforms. Where a business provides both FX services and remittance services, separate registration categories may apply.',
        'AUSTRAC has identified the retail FX sector as a moderate-to-high risk sector, particularly for cash-based currency exchanges. Retail FX businesses that accept large amounts of cash for currency conversion are at risk of being used to place criminal proceeds derived from drug trafficking, fraud, and other crimes that generate significant cash.',
        'The Threshold Transaction Report (TTR) obligation is the primary reporting mechanism for cash-accepting FX providers. TTRs are required for any cash transaction at or above $10,000 AUD, including where the customer exchanges multiple denominations of foreign currency totalling $10,000 or more. The International Funds Transfer Instruction (IFTI) obligation applies where the FX transaction involves sending or receiving an international transfer instruction.',
        'AUSTRAC conducts regular targeted reviews of the FX sector and publishes typology reports specific to FX-related money laundering. FX providers should consult AUSTRAC\'s published guidance on currency exchange red flags, structuring indicators, and ML/TF risk in the sector when designing their transaction monitoring programs.',
      ],
      keyFacts: [
        { label: 'Legislation', value: 'AML/CTF Act 2006, AML/CTF Rules 2007' },
        { label: 'Regulator', value: 'AUSTRAC' },
        { label: 'Registration required', value: 'Yes — mandatory AUSTRAC registration' },
        { label: 'Report types', value: 'TTR, IFTI, SMR' },
        { label: 'TTR threshold', value: '$10,000 AUD in cash' },
        { label: 'Key risk', value: 'Cash currency structuring and trade-based money laundering' },
        { label: 'Record keeping', value: '7 years' },
      ],
    },
    amlObligations: {
      intro: 'FX providers must register with AUSTRAC and implement a full AML/CTF program before providing any currency exchange services.',
      obligations: [
        { title: 'AUSTRAC Registration', description: 'Registration is required before providing FX services. The registration must specify the types of currency exchange services provided. Annual renewal is required and material changes must be notified to AUSTRAC within 14 days.' },
        { title: 'AML/CTF Program', description: 'A written Part A and Part B program must be adopted, implemented, and maintained. The program must specifically address the risk of cash-based currency structuring and the methods used to detect and report suspicious cash transactions.' },
        { title: 'Customer Identification', description: 'FX providers must identify customers for all transactions above defined risk thresholds and for all customers regardless of amount where risk indicators are present. The Act permits FX providers to apply a simplified CDD process for low-risk, low-value transactions.' },
        { title: 'TTR Reporting', description: 'TTRs must be lodged for all cash currency exchange transactions at or above $10,000 AUD. This includes situations where a customer exchanges multiple foreign currency notes in a single transaction that totals $10,000 AUD or more.' },
        { title: 'IFTI Reporting', description: 'Where an FX provider facilitates an international transfer as part of the currency exchange (e.g. sending AUD equivalent to an overseas account), IFTI reporting obligations apply at the $10,000 AUD threshold.' },
        { title: 'SMR Reporting', description: 'SMRs must be lodged for any suspicious transaction or customer behaviour regardless of amount. Common triggers in the FX sector include structuring, use of third parties, and customers who appear to be exchanging large amounts of cash that may be proceeds of crime.' },
        { title: 'Staff Training', description: 'All staff involved in currency exchange transactions must be trained annually in AML/CTF obligations, how to identify red flags in FX transactions, and how to escalate concerns without tipping off the customer.' },
      ],
    },
    cdd: {
      intro: 'CDD requirements for FX providers are calibrated to the size and nature of the transaction. Cash-based transactions carry the highest risk and require the most stringent verification.',
      requirements: [
        {
          category: 'Low-Value Transactions (under $1,000 AUD)',
          items: [
            'Name of customer (may be provided verbally for very low-value transactions)',
            'Transaction record including amount, currencies, and exchange rate',
            'Staff observation note for any unusual characteristics',
          ],
        },
        {
          category: 'Standard CDD ($ 1,000–$9,999 AUD)',
          items: [
            'Full legal name',
            'Date of birth',
            'Residential address',
            'PEP and sanctions screening for transactions above $5,000 AUD',
            'Purpose of transaction if unusual or high-risk',
          ],
        },
        {
          category: 'Enhanced CDD ($10,000 AUD and above)',
          items: [
            'Full legal name as per government-issued photo identification',
            'Date of birth verified against identity document',
            'Residential address verified by document',
            'Source of funds declaration with supporting documentation',
            'Purpose of currency conversion',
            'PEP and sanctions screening mandatory',
            'TTR report lodgement required',
          ],
        },
        {
          category: 'Business Customer KYB',
          items: [
            'Registered business name and ABN',
            'Nature of business and primary trading activities',
            'Identity verification of authorised representative',
            'Beneficial ownership details for transactions above $10,000 AUD',
            'Business financials or trade documentation for large-volume customers',
          ],
        },
      ],
    },
    edd: {
      intro: 'EDD applies in the FX context when the transaction amount, cash payment method, or customer characteristics indicate elevated ML/TF risk.',
      triggers: [
        'Customer requests to exchange an unusually large amount of cash in a single visit',
        'Customer has made multiple prior exchanges that individually fell below the $10,000 TTR threshold',
        'Customer is a PEP or is accompanied by a known PEP',
        'Customer\'s stated purpose for the exchange is implausible or inconsistent with their apparent profile',
        'Customer is exchanging currency associated with a high-risk country or sanctioned jurisdiction',
        'Customer pays with currency that is in poor condition, bundled unusually, or sourced from mixed denominations suggesting accumulation',
        'Customer requests exchange into a large number of foreign notes in small denominations',
        'Customer appears nervous, provides inconsistent information, or is accompanied by an unidentified third party',
      ],
      requirements: [
        {
          category: 'Source of Funds',
          items: [
            'Written statutory declaration of the source of funds',
            'Supporting financial documentation: bank withdrawal receipts, business receipts, or investment records',
            'Verification that the stated source is plausible given the customer\'s background',
          ],
        },
        {
          category: 'Identity',
          items: [
            'Biometric verification or photo capture with photo ID for transactions above $10,000 AUD',
            'Address verification by independent document (utility bill or bank statement)',
            'MLRO notification for transactions where EDD triggers are present',
          ],
        },
        {
          category: 'Transaction Hold',
          items: [
            'Where EDD triggers are present and cannot be resolved, the transaction must be refused',
            'A suspicious matter report must be lodged if suspicion is formed during the EDD process',
            'Documentation of the customer interaction and the reason for the decision to proceed or refuse',
          ],
        },
      ],
    },
    monitoring: {
      intro: 'FX transaction monitoring must focus on the specific typologies relevant to currency exchange — structuring, bulk cash, and trade-based money laundering indicators.',
      controls: [
        { name: 'TTR Cash Threshold Rule', description: 'Flag all cash transactions at or above $10,000 AUD for TTR preparation and mandatory CDD. Alert must be triggered before the transaction is completed.', ruleType: 'Threshold' },
        { name: 'Structuring Detection', description: 'Detect multiple cash exchange transactions below $10,000 AUD from the same customer within a rolling 5-day window that aggregate above the TTR threshold.', ruleType: 'Pattern' },
        { name: 'Currency Denomination Pattern', description: 'Alert on transactions where the customer presents unusually large numbers of small-denomination foreign currency notes, which is a common indicator of cash accumulation from illegal sources.', ruleType: 'Pattern' },
        { name: 'High-Risk Currency Alert', description: 'Flag exchange of currencies associated with high-risk jurisdictions or countries subject to DFAT sanctions.', ruleType: 'Jurisdiction' },
        { name: 'IFTI Threshold Rule', description: 'Where the FX transaction involves an international transfer, apply the $10,000 AUD IFTI threshold and trigger report preparation.', ruleType: 'Threshold' },
        { name: 'Velocity Monitoring', description: 'Alert on customers who exchange currency multiple times per week or whose cumulative monthly exchange volume significantly exceeds their stated purpose (e.g. "travel money" customer exchanging large amounts monthly).', ruleType: 'Velocity' },
        { name: 'Third-Party Transaction Flag', description: 'Flag transactions where the person conducting the exchange is not the named customer or presents identification that does not match the stated beneficiary.', ruleType: 'Identity' },
      ],
    },
    reporting: {
      intro: 'FX providers primarily lodge TTRs for cash transactions and SMRs for suspicious activity. IFTI obligations apply where international transfers are part of the FX service.',
      reports: [
        {
          type: 'TTR',
          fullName: 'Threshold Transaction Report',
          deadline: '10 business days after the transaction',
          threshold: '$10,000 AUD or more in physical cash',
          description: 'A TTR must be lodged for every cash currency exchange transaction at or above $10,000 AUD. The threshold applies to the AUD equivalent value of foreign currency received, not just AUD exchanged. Multiple transactions on the same day or in close succession that together reach $10,000 may require a single TTR.',
          keyFields: ['Customer full name, DOB, and address', 'Type of identification provided', 'Currencies exchanged and amounts', 'Exchange rate applied', 'AUD equivalent value', 'Date, time, and location of transaction'],
        },
        {
          type: 'SMR',
          fullName: 'Suspicious Matter Report',
          deadline: '3 business days after forming a suspicion',
          threshold: 'No dollar threshold',
          description: 'SMRs must be lodged whenever the FX provider forms a suspicion about a customer or transaction. Common FX triggers include structuring behaviour, implausible explanations for large cash exchanges, and customers presenting currency in conditions inconsistent with normal use.',
          keyFields: ['Customer identifying information', 'Transaction details', 'Basis of suspicion', 'Actions taken', 'Whether the transaction proceeded'],
        },
        {
          type: 'IFTI',
          fullName: 'International Funds Transfer Instruction',
          deadline: '10 business days',
          threshold: '$10,000 AUD or more',
          description: 'Where the FX provider also facilitates international transfers, IFTI reports are required for transfer instructions at or above $10,000 AUD. This includes where a customer exchanges AUD for foreign currency and the provider also sends those funds to an overseas account.',
          keyFields: ['Sender and beneficiary details', 'Transfer amount and currencies', 'Destination country and institution', 'Date of instruction'],
        },
      ],
    },
    riskAssessment: {
      intro: 'The FX risk assessment must address both the product risk of currency exchange and the customer risk profile. For businesses with retail locations, the physical environment and staff training quality are key control factors.',
      ratingMatrix: [
        { factor: 'Transaction Method', lowRisk: 'Electronic bank transfer or card payment', mediumRisk: 'Mixed payment including partial cash', highRisk: 'All-cash transaction, particularly in large-denomination notes' },
        { factor: 'Currency Being Exchanged', lowRisk: 'Major currencies (USD, EUR, GBP, JPY, CNY) in normal conditions', mediumRisk: 'Currencies of moderate-risk countries', highRisk: 'Currencies of FATF grey list or sanctioned countries, or currency in unusual physical condition' },
        { factor: 'Customer Frequency', lowRisk: 'Occasional customer with consistent purpose (travel, business)', mediumRisk: 'Regular customer with variable purpose or changing currency pairs', highRisk: 'Very frequent customer, customer who visits multiple branches, or customer with no clear legitimate purpose' },
        { factor: 'Transaction Size', lowRisk: 'Under $2,000 AUD equivalent', mediumRisk: '$2,000–$9,999 AUD equivalent', highRisk: '$10,000 AUD or more, or multiple transactions approaching this threshold' },
      ],
      methodology: 'The risk assessment must be reviewed following any material change in the FX business model, the introduction of new currencies or services, or following AUSTRAC guidance updates. Retail locations with high cash volume must be specifically addressed with enhanced controls proportionate to the cash-handling risk.',
    },
    amlProgram: {
      intro: 'The FX AML/CTF Program must specifically address the cash-handling risks unique to currency exchange and ensure that all staff at customer-facing locations are trained and equipped to identify suspicious behaviour.',
      components: [
        { name: 'Part A — Risk and Controls', description: 'Sets out the ML/TF risk assessment for the FX business, including cash-specific risk, and the controls designed to manage those risks.', keyElements: ['Cash transaction risk assessment', 'Structuring detection controls', 'Staff training program for customer-facing roles', 'Branch and location risk assessment'] },
        { name: 'Part B — Customer Identification Procedures', description: 'Specifies the CDD process for each transaction tier, including the documents required and the screening to be conducted.', keyElements: ['CDD tiers by transaction amount', 'EDD triggers and procedures', 'Source of funds collection process', 'Record keeping for CDD documents'] },
        { name: 'Cash Handling Procedures', description: 'Specific procedures for staff handling cash transactions including observation protocols, customer interaction guidance, and escalation procedures for suspected structuring.', keyElements: ['Large cash transaction protocols', 'Structuring recognition guide for staff', 'Customer refusal procedures', 'Incident documentation requirements'] },
      ],
    },
    verigoChecklist: {
      intro: 'Use this checklist to configure Verigo for your FX operations.',
      phases: [
        {
          phase: 'Phase 1 — Setup',
          timeframe: 'Day 1–3',
          items: [
            { task: 'Select Foreign Exchange Provider industry pack', detail: 'Activates TTR templates and FX-specific monitoring rules.', critical: true },
            { task: 'Configure transaction tiers and CDD requirements', detail: 'Set CDD level triggered at each AUD equivalent amount.', critical: true },
            { task: 'Enable PEP and sanctions screening', detail: 'Set to trigger at $5,000 AUD and above.', critical: true },
          ],
        },
        {
          phase: 'Phase 2 — Monitoring and Reporting',
          timeframe: 'Day 3–7',
          items: [
            { task: 'Enable TTR threshold alert at $10,000 AUD', detail: 'Confirm alert blocks transaction completion until CDD is collected.', critical: true },
            { task: 'Enable structuring detection rule', detail: 'Configure 5-day rolling window for same-customer transactions.', critical: true },
            { task: 'Test TTR report template', detail: 'Verify TTR is correctly populated from transaction data.', critical: true },
            { task: 'Configure AUSTRAC lodgement credentials', detail: 'Enter AUSTRAC reporting entity number.', critical: true },
          ],
        },
      ],
    },
    goLive: {
      intro: 'Complete before processing any cash currency exchange above $1,000 AUD.',
      criteria: [
        {
          category: 'Registration and Program',
          checks: [
            { item: 'AUSTRAC registration active', description: 'FX business is registered as a currency exchange provider.' },
            { item: 'AML/CTF Program approved', description: 'Written program with cash-specific controls has been adopted.' },
            { item: 'Staff trained', description: 'All customer-facing staff have completed AML/CTF induction training.' },
          ],
        },
        {
          category: 'Transaction Controls',
          checks: [
            { item: 'TTR threshold rule active', description: '$10,000 AUD cash threshold triggers CDD collection before transaction completes.' },
            { item: 'Structuring detection enabled', description: 'Multi-transaction structuring pattern detection is running.' },
            { item: 'TTR report template validated', description: 'TTR generates correctly from transaction data with all AUSTRAC fields.' },
          ],
        },
      ],
    },
  },
  {
    industryId: 'payment-service-provider',
    label: 'Payment Service Provider',
    regime: 'current',
    icon: '💳',
    overview: {
      intro: 'Payment service providers (PSPs) that facilitate payment flows between parties are reporting entities under the AML/CTF Act 2006. PSPs face unique compliance challenges because they operate as intermediaries, often without direct relationships with the ultimate sender or recipient of funds, requiring both merchant-level and end-user-level compliance controls.',
      paragraphs: [
        'A payment service provider is a business that facilitates the movement of money between buyers and sellers, often via electronic means including card networks, direct debit, real-time payments, or alternative payment rails. PSPs include payment gateways, payment facilitators (PayFacs), acquiring banks, and digital wallet providers that provide payment services as a primary or ancillary function.',
        'The PSP sector is exposed to several distinct ML/TF typologies. Merchant fraud involves criminals setting up fraudulent businesses to process payments connected to criminal activity. Velocity abuse involves using the PSP\'s infrastructure to rapidly move funds through multiple accounts. Cross-border payment risk arises where the PSP processes transactions involving high-risk jurisdictions or merchants operating outside their stated business purpose.',
        'PSPs that operate payment facilitator models — where sub-merchants are onboarded and managed through the PSP\'s master merchant account — have additional obligations to conduct due diligence on sub-merchants equivalent to customer due diligence. AUSTRAC has issued specific guidance on the payment facilitation model and the obligations of PayFacs.',
        'Australia\'s New Payments Platform (NPP) and OSKO infrastructure have increased the speed of domestic payment flows, which has also accelerated the pace at which criminal proceeds can be moved. PSPs operating on real-time payment rails must ensure their monitoring capabilities can operate at the speed of the payment system.',
      ],
      keyFacts: [
        { label: 'Legislation', value: 'AML/CTF Act 2006, AML/CTF Rules 2007' },
        { label: 'Regulator', value: 'AUSTRAC' },
        { label: 'Registration required', value: 'Yes — mandatory before providing payment services' },
        { label: 'Report types', value: 'SMR, IFTI, TTR' },
        { label: 'Key obligation', value: 'Merchant due diligence and ongoing transaction monitoring' },
        { label: 'High-risk focus', value: 'Velocity abuse, card-not-present fraud, cross-border payments' },
        { label: 'Record keeping', value: '7 years' },
      ],
    },
    amlObligations: {
      intro: 'PSPs must register with AUSTRAC and implement a comprehensive AML/CTF program that addresses both merchant and end-user risk.',
      obligations: [
        { title: 'AUSTRAC Registration', description: 'PSPs must register with AUSTRAC before providing payment services. The registration must describe the types of payment services provided. PayFacs must ensure their sub-merchant arrangements are disclosed in their AUSTRAC registration.' },
        { title: 'Merchant Due Diligence (KYB)', description: 'PSPs must conduct KYB on all merchants at onboarding and on an ongoing basis. This includes verifying the legal existence of the merchant, identifying beneficial owners, and confirming the merchant\'s stated business activities are consistent with the transactions processed.' },
        { title: 'End-User KYC', description: 'Where the PSP has a direct relationship with end-users (e.g. digital wallet providers), KYC must be conducted on those users at account opening and for reportable transactions.' },
        { title: 'Ongoing Transaction Monitoring', description: 'Real-time or near-real-time transaction monitoring is required to detect suspicious patterns including velocity abuse, structuring, cross-border payment anomalies, and merchant risk indicators.' },
        { title: 'IFTI Reporting', description: 'Where the PSP processes international payment instructions at or above $10,000 AUD, IFTI reports must be lodged within 10 business days.' },
        { title: 'SMR Reporting', description: 'SMRs must be lodged for any suspicious transaction, merchant behaviour, or end-user activity. PSPs must have clear procedures for identifying which team is responsible for SMR preparation where the PSP processes transactions on behalf of a merchant.' },
        { title: 'Sub-Merchant Oversight (PayFacs)', description: 'PayFacs must maintain a current register of sub-merchants, conduct CDD on each sub-merchant before onboarding, and monitor sub-merchant transaction behaviour for signs of fraud or AML/CTF red flags.' },
      ],
    },
    cdd: {
      intro: 'CDD for PSPs operates at two levels: merchant-level (KYB) and end-user-level (KYC). Both levels must be conducted before the relevant party begins transacting through the PSP.',
      requirements: [
        {
          category: 'Merchant KYB — Standard',
          items: [
            'Registered business name and ABN / ACN',
            'Registered business address and trading address',
            'Nature of business and product or service category (MCC code)',
            'Expected transaction volumes and average transaction value',
            'Verification of legal existence via ASIC register or equivalent',
            'Identification and verification of the merchant\'s principals and beneficial owners (25%+ threshold)',
          ],
        },
        {
          category: 'Merchant KYB — Enhanced (high-risk merchants)',
          items: [
            'Full beneficial ownership map to natural person level',
            'Director identity verification with photo ID',
            'Business bank account verification (micro-deposit or instant verification)',
            'Business financial statements for merchants above volume thresholds',
            'Site inspection or equivalent verification of physical business operations',
          ],
        },
        {
          category: 'End-User KYC (digital wallet / direct user PSPs)',
          items: [
            'Full legal name',
            'Date of birth',
            'Residential address',
            'Photo ID verification for accounts above defined transaction thresholds',
            'Linked bank account verification',
            'PEP and sanctions screening at onboarding and periodic review',
          ],
        },
        {
          category: 'Ongoing Merchant Monitoring',
          items: [
            'Annual merchant re-verification or upon material change in business',
            'Monitoring of merchant transaction volumes against the expected profile established at onboarding',
            'Immediate re-KYB where a significant change in transaction behaviour is detected',
            'Sanctions screening of merchant principals on periodic basis',
          ],
        },
      ],
    },
    edd: {
      intro: 'EDD is triggered for merchants or users presenting elevated risk characteristics, including those in high-risk merchant categories, those with anomalous transaction patterns, or those where identity verification raises concerns.',
      triggers: [
        'Merchant operates in a high-risk category (gambling, adult content, cryptocurrency, nutraceuticals)',
        'Merchant transaction volumes significantly exceed the profile declared at onboarding',
        'Merchant chargebacks or disputes are at abnormally high levels',
        'End-user is a PEP or is connected to a PEP',
        'Transaction involves a cross-border payment to a high-risk jurisdiction',
        'Merchant or user is on or associated with an entity on a sanctions list',
        'Multiple users sharing the same device ID, IP address, or bank account suggesting mule network',
        'Merchant\'s declared business activity is inconsistent with the actual goods or services being sold',
      ],
      requirements: [
        {
          category: 'Merchant EDD',
          items: [
            'Full beneficial ownership verification to natural person level including UBO identity documents',
            'Business financial statements for the prior 12 months',
            'Bank reference or banking relationship confirmation',
            'Site visit or virtual business verification',
            'Senior management approval before onboarding high-risk merchant',
          ],
        },
        {
          category: 'End-User EDD',
          items: [
            'Full biometric identity verification',
            'Source of funds documentation for transactions above defined thresholds',
            'Explanation of business purpose or personal purpose for large or unusual payments',
            'MLRO review before enabling account for high-value transactions',
          ],
        },
      ],
    },
    monitoring: {
      intro: 'PSP monitoring must operate at transaction speed and cover both merchant-level and user-level risk indicators. High-volume PSPs must invest in automated monitoring capabilities capable of processing large transaction volumes in real time.',
      controls: [
        { name: 'IFTI Threshold Alert', description: 'Flag all international payment instructions at or above $10,000 AUD for IFTI preparation and MLRO review.', ruleType: 'Threshold' },
        { name: 'Merchant Velocity Rule', description: 'Alert when a merchant\'s transaction volume or value in a rolling 24-hour or 7-day period significantly exceeds their declared or historical baseline.', ruleType: 'Velocity' },
        { name: 'User Velocity Rule', description: 'Alert on end-user accounts where transaction frequency or value significantly deviates from the user\'s historical behaviour or account profile.', ruleType: 'Velocity' },
        { name: 'Cross-Border Payment Flag', description: 'Flag all cross-border payment instructions to high-risk jurisdictions for compliance review and potential IFTI preparation.', ruleType: 'Jurisdiction' },
        { name: 'Chargeback Concentration Alert', description: 'Alert where a merchant\'s chargeback rate exceeds industry thresholds, which is a strong indicator of fraud or customer complaints about suspicious charges.', ruleType: 'Fraud' },
        { name: 'Shared Identity Detection', description: 'Alert on clusters of user accounts sharing the same device fingerprint, IP address, or linked bank account, which is a strong indicator of mule networks or identity fraud.', ruleType: 'Network' },
        { name: 'Unusual Transaction Time', description: 'Flag high-value transactions processed at unusual times (e.g. overnight, on public holidays) that deviate significantly from the merchant\'s or user\'s typical transaction window.', ruleType: 'Pattern' },
        { name: 'Rapid Deposit-Withdrawal', description: 'Detect accounts or merchants that receive funds and immediately initiate outgoing transfers to different accounts, indicating potential pass-through layering.', ruleType: 'Pattern' },
      ],
    },
    reporting: {
      intro: 'PSPs lodge SMRs for suspicious activity, IFTIs for cross-border payment instructions, and TTRs for cash transactions where applicable.',
      reports: [
        {
          type: 'SMR',
          fullName: 'Suspicious Matter Report',
          deadline: '3 business days after forming a suspicion',
          threshold: 'No dollar threshold',
          description: 'SMRs are the primary reporting mechanism for PSPs. They must be lodged for suspicious merchant behaviour, suspicious end-user activity, suspected fraud or mule network activity, and any other activity that gives rise to a suspicion of ML/TF.',
          keyFields: ['Merchant or user identifying information', 'Transaction details', 'Pattern or behaviour giving rise to suspicion', 'Actions taken (account suspended, transaction declined)', 'Whether the transaction was completed'],
        },
        {
          type: 'IFTI',
          fullName: 'International Funds Transfer Instruction',
          deadline: '10 business days',
          threshold: '$10,000 AUD or more',
          description: 'IFTIs are required for international payment instructions at or above $10,000 AUD. For PSPs with high cross-border volumes, this may require bulk IFTI lodgement capabilities.',
          keyFields: ['Ordering customer and account', 'Beneficiary and account', 'Payment amount in AUD', 'Destination country', 'Date of instruction'],
        },
      ],
    },
    riskAssessment: {
      intro: 'The PSP risk assessment must address merchant risk, end-user risk, and the PSP\'s specific payment infrastructure risks including card-not-present exposure and cross-border payment corridors.',
      ratingMatrix: [
        { factor: 'Merchant Category', lowRisk: 'Established retailers, utilities, professional services, healthcare', mediumRisk: 'Online-only merchants, subscription services, digital goods', highRisk: 'Gambling, cryptocurrency, adult content, multi-level marketing, unregulated lending' },
        { factor: 'Transaction Type', lowRisk: 'Card-present domestic transactions under $500 AUD', mediumRisk: 'Card-not-present domestic transactions or card-present cross-border', highRisk: 'Cross-border transactions to high-risk jurisdictions, cryptocurrency purchases, high-value single transactions' },
        { factor: 'Merchant Size', lowRisk: 'Established business with verifiable trading history above 2 years', mediumRisk: 'Business under 12 months trading with moderate volume', highRisk: 'Newly incorporated entity with no trading history or high-volume merchant with unexplained growth' },
        { factor: 'End-User Profile', lowRisk: 'Verified Australian resident with consistent transaction history', mediumRisk: 'User with variable income or irregular transaction patterns', highRisk: 'PEP, high-risk jurisdiction user, or user with multiple linked accounts' },
      ],
      methodology: 'The PSP must conduct a merchant risk assessment at onboarding and review it annually. End-user risk assessments must be maintained dynamically based on transaction behaviour monitoring. The overall PSP risk assessment must be reviewed annually and following any significant change in payment volume, product offering, or merchant composition.',
    },
    amlProgram: {
      intro: 'The PSP AML/CTF Program must address the distinct obligations for merchant due diligence, end-user KYC, and transaction monitoring at scale.',
      components: [
        { name: 'Part A — Risk and Governance', description: 'Documents the ML/TF risk assessment across merchants, end-users, and payment products. Includes board oversight, MLRO role, and compliance audit schedule.', keyElements: ['Merchant risk assessment methodology', 'End-user risk framework', 'Cross-border payment risk assessment', 'MLRO governance and escalation'] },
        { name: 'Part B — KYB and KYC Procedures', description: 'Sets out merchant onboarding KYB procedures by risk tier and end-user KYC procedures where applicable.', keyElements: ['Merchant KYB procedure by risk tier', 'PayFac sub-merchant onboarding procedure', 'End-user KYC procedure', 'EDD triggers and approval process'] },
        { name: 'Transaction Monitoring Program', description: 'Documents the monitoring rules, systems, and escalation process. Must be capable of operating at the speed of the PSP\'s payment infrastructure.', keyElements: ['Rule inventory and rationale', 'Real-time vs batch monitoring approach', 'Alert triage SLAs', 'SMR preparation workflow'] },
      ],
    },
    verigoChecklist: {
      intro: 'Configure Verigo for PSP operations, covering both merchant and end-user compliance.',
      phases: [
        {
          phase: 'Phase 1 — Setup and Configuration',
          timeframe: 'Day 1–5',
          items: [
            { task: 'Select Payment Service Provider industry pack', detail: 'Activates merchant KYB workflows and PSP-specific monitoring rules.', critical: true },
            { task: 'Configure merchant risk tiers', detail: 'Define high-risk merchant categories and set EDD triggers for each tier.', critical: true },
            { task: 'Configure end-user KYC (if applicable)', detail: 'Enable end-user KYC for digital wallet or direct user products.', critical: true },
            { task: 'Enable PEP and sanctions screening', detail: 'Configure for both merchants/principals and end-users.', critical: true },
          ],
        },
        {
          phase: 'Phase 2 — Monitoring',
          timeframe: 'Day 5–10',
          items: [
            { task: 'Enable merchant velocity rules', detail: 'Set baseline velocity thresholds for each merchant category.', critical: true },
            { task: 'Enable IFTI threshold rule', detail: 'Configure for cross-border payment instructions at $10,000 AUD.', critical: true },
            { task: 'Enable shared identity detection', detail: 'Configure device fingerprint and IP clustering rules.', critical: false },
            { task: 'Test SMR workflow', detail: 'Create test alert and verify MLRO sign-off workflow.', critical: true },
          ],
        },
      ],
    },
    goLive: {
      intro: 'Confirm all items before onboarding your first live merchant.',
      criteria: [
        {
          category: 'Registration and Program',
          checks: [
            { item: 'AUSTRAC registration active', description: 'PSP is registered with AUSTRAC as a payment service provider.' },
            { item: 'AML/CTF Program adopted', description: 'Written program covering merchant and end-user risk is approved.' },
          ],
        },
        {
          category: 'Merchant Onboarding',
          checks: [
            { item: 'KYB workflow configured', description: 'Merchant onboarding workflow completes required KYB checks before activation.' },
            { item: 'High-risk merchant EDD controls active', description: 'EDD is triggered automatically for high-risk merchant categories.' },
          ],
        },
        {
          category: 'Monitoring and Reporting',
          checks: [
            { item: 'Velocity rules active', description: 'Merchant and user velocity monitoring is running.' },
            { item: 'IFTI reporting configured', description: 'IFTI threshold rule and report template are configured and tested.' },
            { item: 'SMR workflow tested', description: 'End-to-end SMR workflow from alert to lodgement is confirmed.' },
          ],
        },
      ],
    },
  },
  {
    industryId: 'real_estate',
    label: 'Real Estate Professional',
    regime: 'expanded',
    icon: '🏠',
    overview: {
      intro: 'Real estate professionals who buy or sell real property on behalf of clients will become reporting entities under the AML/CTF Amendment Act 2024 from 1 July 2026. Australia\'s property market has been repeatedly identified as a major vehicle for money laundering, with an estimated billions of dollars in illicit funds laundered through real estate annually.',
      paragraphs: [
        'The AML/CTF Amendment Act 2024 expands Australia\'s AML/CTF regime to capture "Tranche 2" designated non-financial businesses and professions (DNFBPs), including real estate agents and principals who buy or sell real property on behalf of a client. The obligation is triggered when the agent acts on behalf of a client in a real property transaction — it does not apply to agents who merely introduce buyers and sellers without acting on their behalf.',
        'The Australian property market has consistently been assessed as high-risk for money laundering by AUSTRAC, the Financial Action Task Force (FATF), and the Asia/Pacific Group on Money Laundering (APG). All-cash property transactions, offshore buyer structures using complex trusts and companies, and inflated purchase prices are well-documented methods for laundering proceeds of crime through real estate.',
        'Real estate agents must be enrolled with AUSTRAC (the enrollment system replaces registration for Tranche 2 entities) before providing designated services from 1 July 2026. An AML/CTF program must be in place from that date. AUSTRAC has indicated it will take a risk-based, proportionate approach to enforcement for the initial period but expects genuine compliance efforts to be in place from the effective date.',
        'The real estate sector is diverse — from small single-office agencies to large national networks. AUSTRAC recognises this diversity and allows for proportionate program design. However, the core obligations — CDD on buyers and sellers, source of funds verification, SMR reporting, and record keeping — apply to all real estate agents providing designated services regardless of size.',
      ],
      keyFacts: [
        { label: 'Legislation', value: 'AML/CTF Amendment Act 2024 (Tranche 2)' },
        { label: 'Effective date', value: '1 July 2026' },
        { label: 'Regulator', value: 'AUSTRAC' },
        { label: 'Enrollment required', value: 'Yes — before providing designated services from July 2026' },
        { label: 'Report types', value: 'SMR (primary), no IFTI or TTR obligation for property agents' },
        { label: 'Record keeping', value: '7 years from the end of the business relationship or transaction' },
        { label: 'Penalty regime', value: 'Civil penalties up to $222 million for serious and systemic non-compliance' },
      ],
    },
    amlObligations: {
      intro: 'Real estate professionals must prepare now. The obligations commence 1 July 2026 and there is no grace period for fundamental obligations like enrollment and program adoption.',
      obligations: [
        { title: 'AUSTRAC Enrollment', description: 'Real estate agents must enrol with AUSTRAC before providing any designated service (buying or selling property on behalf of a client) from 1 July 2026. Enrollment replaces registration for Tranche 2 entities and must be kept current with any changes to business details.' },
        { title: 'AML/CTF Program', description: 'A written AML/CTF program must be adopted and implemented from the effective date. The program must be tailored to the specific risks of the real estate business, including property type, geographic market, customer base, and transaction values. Annual review is required.' },
        { title: 'Customer Due Diligence — Buyer', description: 'CDD must be conducted on buyers at the commencement of the business relationship (when the agent is engaged to act on the buyer\'s behalf). This includes identity verification, beneficial ownership identification where the buyer is a company or trust, and PEP and sanctions screening.' },
        { title: 'Customer Due Diligence — Seller', description: 'CDD must also be conducted on the seller. While seller risk is generally lower than buyer risk, the agent must still verify the seller\'s identity and screen for PEP and sanctions matches.' },
        { title: 'Source of Funds Verification', description: 'For buyers, the agent must take steps to verify the source of funds to be used in the property transaction. This does not require the agent to audit the buyer\'s finances, but it does require a reasonable inquiry and documentation of the buyer\'s explanation for the source of funds.' },
        { title: 'Beneficial Ownership Identification', description: 'Where the buyer is a company, trust, or other non-individual entity, the agent must identify the ultimate beneficial owner (the natural person who ultimately owns or controls the entity). This is a key control against the use of shell companies to launder funds through real estate.' },
        { title: 'SMR Reporting', description: 'Real estate agents must lodge an SMR with AUSTRAC within 3 business days of forming a suspicion about a transaction, client, or property transaction. The obligation not to tip off the client is absolute — disclosing the existence of an SMR to the client is a criminal offence.' },
        { title: 'Record Keeping', description: 'All CDD records, source of funds documentation, and transaction records must be kept for 7 years. Records must be readily accessible to AUSTRAC upon request.' },
      ],
    },
    cdd: {
      intro: 'CDD for real estate agents applies to both the buyer and the seller, but the depth of due diligence required is greater for buyers given the higher risk associated with the source of purchase funds.',
      requirements: [
        {
          category: 'Buyer Individual Identification',
          items: [
            'Full legal name as per government-issued identification',
            'Date of birth',
            'Residential address — current and verified',
            'Photo identification document (passport, driver\'s licence)',
            'Contact details (mobile, email)',
            'Relationship to the property (purchaser for self, purchaser on behalf of company/trust)',
          ],
        },
        {
          category: 'Buyer Entity Identification (Company or Trust)',
          items: [
            'Full legal name of the entity and any trading names',
            'ACN or ABN verified against ASIC register',
            'Registered address',
            'Nature and purpose of the entity',
            'All beneficial owners holding 25% or more of the entity — verified to natural person',
            'Trustee identification and verification for trust purchasers',
            'Copy of trust deed or company constitution where available',
          ],
        },
        {
          category: 'Seller Identification',
          items: [
            'Full legal name as per government-issued identification',
            'Date of birth',
            'Residential address',
            'Photo identification document',
            'For entity sellers: registered name, ACN/ABN, and authorised representative details',
          ],
        },
        {
          category: 'Source of Funds',
          items: [
            'Written declaration of the source of funds to be used for the property purchase',
            'Supporting documentation: recent bank statements showing funds available, mortgage pre-approval letter, evidence of asset sale proceeds, or inheritance documentation',
            'For business purchasers: confirmation that funds are from legitimate business income',
            'Inquiry notes documenting the agent\'s assessment of the plausibility of the declared source',
          ],
        },
        {
          category: 'Screening',
          items: [
            'PEP screening of all individual buyers and beneficial owners',
            'Sanctions screening against DFAT, OFAC, UN, and EU lists',
            'Adverse media search for high-risk or high-profile buyers',
          ],
        },
      ],
    },
    edd: {
      intro: 'EDD must be applied where the property transaction presents elevated ML/TF risk indicators. The most common triggers in real estate are all-cash purchases, complex ownership structures, and foreign buyers from high-risk jurisdictions.',
      triggers: [
        'Buyer proposes to purchase with 100% cash (no mortgage or external financing)',
        'Purchase price is significantly above or below market value without clear explanation',
        'Buyer is a foreign national from a high-risk or DFAT-sanctioned jurisdiction',
        'Buyer or a beneficial owner of the purchasing entity is identified as a PEP or PEP associate',
        'The purchasing entity has a complex or opaque beneficial ownership structure',
        'Buyer insists on purchasing in a name other than their own without clear legal explanation',
        'Buyer proposes to settle very quickly (within days) without the usual due diligence period',
        'Buyer is not attending the property or communicating through a third-party intermediary',
        'Buyer\'s declared source of funds is inconsistent with their apparent financial position',
        'The property is being purchased in a jurisdiction or suburb known for high-cash or investment-property money laundering',
      ],
      requirements: [
        {
          category: 'Enhanced Identity Verification',
          items: [
            'Biometric identity verification with liveness check for buyers who are not personally attending inspections',
            'Independent verification of declared identity documents against government databases where available',
            'Video call or in-person verification for high-risk buyers who cannot be verified through standard digital channels',
          ],
        },
        {
          category: 'Enhanced Source of Funds',
          items: [
            'Bank statements for the prior 6 months showing the accumulation of funds for the purchase',
            'Tax return or income evidence for the prior 2 years',
            'Evidence of the sale of prior assets where funds are stated to come from an asset disposal',
            'For inherited funds: probate documents or letters of administration',
            'For business funds: most recent audited accounts or accountant\'s letter confirming funds derive from legitimate business income',
          ],
        },
        {
          category: 'MLRO Escalation',
          items: [
            'All transactions triggering EDD must be referred to the MLRO or senior compliance officer before proceeding',
            'MLRO must document their assessment and the decision to proceed or decline the client relationship',
            'Where the MLRO cannot resolve the EDD concerns, the agent must decline to act and consider whether an SMR is required',
          ],
        },
      ],
    },
    monitoring: {
      intro: 'Ongoing monitoring for real estate agents is primarily at the client-matter level rather than transaction-level. Monitoring focuses on changes in the transaction profile and post-settlement review.',
      controls: [
        { name: 'Matter Lifecycle Review', description: 'Review the CDD and source of funds documentation at each key stage of the property transaction: listing/engagement, offer and acceptance, cooling-off period, and approaching settlement. Flag any changes in buyer details, funding structure, or settlement arrangements.', ruleType: 'Lifecycle' },
        { name: 'Settlement Amount Change Alert', description: 'Alert where the final settlement amount differs materially from the contract price without a documented explanation (e.g. deposit forfeitures, price adjustments, or inclusions).', ruleType: 'Transaction' },
        { name: 'Third-Party Payment Flag', description: 'Flag where settlement funds are expected to come from a third party\'s account rather than the buyer\'s verified account. This is a strong indicator of layering through a property transaction.', ruleType: 'Payment' },
        { name: 'Post-Settlement Review', description: 'Conduct a post-settlement review of the transaction to identify any indicators that were not apparent during the transaction lifecycle and that may require a retrospective SMR.', ruleType: 'Review' },
        { name: 'Client Portfolio Monitoring', description: 'For clients who transact multiple times through the agency, monitor across transactions for patterns such as rapid buy-sell cycles, unexplained price inflation, or changing beneficial ownership between transactions.', ruleType: 'Pattern' },
      ],
    },
    reporting: {
      intro: 'Real estate professionals have a single primary reporting obligation: the Suspicious Matter Report. There is no IFTI or TTR obligation for property agents under the current reform design.',
      reports: [
        {
          type: 'SMR',
          fullName: 'Suspicious Matter Report',
          deadline: '3 business days after forming a suspicion',
          threshold: 'No dollar threshold — suspicion-based',
          description: 'An SMR must be lodged whenever the agent forms a suspicion that a property transaction or client is connected to money laundering, terrorism financing, or serious crime. Common triggers include all-cash purchases without documented legitimate source, buyers from sanctioned countries, and complex opaque ownership structures used to purchase high-value property.',
          keyFields: ['Client identifying information', 'Property address and estimated value', 'Nature of the business relationship (buyer or seller agent)', 'Transaction details including proposed settlement method', 'Nature and basis of the suspicion', 'Actions taken by the agent (e.g. requested additional information, declined to act)', 'Whether the transaction proceeded to settlement'],
        },
      ],
    },
    riskAssessment: {
      intro: 'The real estate risk assessment must address the specific risks of the agency\'s market, client base, and property types. High-end residential and commercial investment properties carry the greatest ML/TF risk.',
      ratingMatrix: [
        { factor: 'Property Type', lowRisk: 'Standard residential under $750,000 AUD in established suburbs', mediumRisk: 'Investment property or medium-density residential above $750,000 AUD', highRisk: 'High-value residential above $2 million, commercial property, rural acreage, or luxury development' },
        { factor: 'Payment Method', lowRisk: 'Fully financed purchase via regulated Australian lender', mediumRisk: 'Partial cash component (under 20% of purchase price)', highRisk: 'All-cash purchase with no mortgage financing, third-party payment, or offshore funding' },
        { factor: 'Buyer Type', lowRisk: 'Verified Australian resident owner-occupier with documented source of funds', mediumRisk: 'Australian investor or trust purchasing as investment, adequately identified', highRisk: 'Foreign buyer, complex corporate/trust structure, PEP or PEP associate, or buyer from high-risk jurisdiction' },
        { factor: 'Transaction Characteristics', lowRisk: 'Normal market transaction at arms-length with full inspection and standard settlement period', mediumRisk: 'Off-market or distressed sale, rapid settlement, or price negotiated significantly below listing', highRisk: 'Same-day or very rapid settlement, purchase at significant premium or discount, buyer has not inspected the property' },
      ],
      methodology: 'The real estate agency\'s risk assessment must be completed before the effective date of 1 July 2026. It must address the agency\'s specific geographic market, typical transaction values, proportion of foreign or investment buyers, and any prior incidents or red flags observed. The assessment must be reviewed annually and updated when the agency expands into new markets or product types.',
    },
    amlProgram: {
      intro: 'The AML/CTF Program for a real estate agency must be proportionate to the size and complexity of the business but must address all mandatory elements of the Act.',
      components: [
        { name: 'Part A — Risk and Governance', description: 'Sets out the agency\'s ML/TF risk assessment, control framework, and governance. For small agencies, the principal or director may serve as the AML compliance officer.', keyElements: ['ML/TF risk assessment for the agency\'s market', 'Compliance officer or MLRO appointment', 'Staff training obligations', 'Annual review process'] },
        { name: 'Part B — KYC Procedures', description: 'Specifies the CDD procedures for buyers and sellers including acceptable identity documents, source of funds requirements, and beneficial ownership identification.', keyElements: ['Buyer CDD procedure', 'Seller CDD procedure', 'Entity and trust identification procedure', 'EDD triggers and escalation'] },
        { name: 'Source of Funds Procedure', description: 'A specific procedure for collecting, reviewing, and documenting buyer source of funds information. This is the highest-value control for real estate ML/TF prevention.', keyElements: ['Source of funds declaration form', 'Supporting document requirements by transaction value', 'Plausibility assessment guidelines', 'Escalation to MLRO where concerns exist'] },
        { name: 'SMR Procedure', description: 'A step-by-step procedure for identifying suspicious transactions, escalating to the compliance officer, preparing the SMR, and lodging with AUSTRAC within 3 business days.', keyElements: ['Red flag identification guide for agents', 'Escalation to compliance officer', 'SMR preparation and MLRO sign-off', 'Tipping-off prohibition reminder'] },
        { name: 'Staff Training Program', description: 'Annual training for all agents and support staff on AML/CTF obligations, real estate red flags, and reporting procedures.', keyElements: ['Training curriculum and delivery method', 'Completion tracking', 'New staff induction training', 'Refresher training on AUSTRAC guidance updates'] },
      ],
    },
    verigoChecklist: {
      intro: 'Use this checklist to configure Verigo for your real estate agency ahead of the 1 July 2026 effective date. Complete Phase 1 and 2 by June 2026 to ensure you are operational on day one.',
      phases: [
        {
          phase: 'Phase 1 — Setup (by May 2026)',
          timeframe: 'May 2026',
          items: [
            { task: 'Create Verigo account and select Real Estate Professional industry pack', detail: 'Activates the Tranche 2 real estate compliance pack including source of funds workflows and SMR templates.', critical: true },
            { task: 'Enter agency details and AUSTRAC enrollment number', detail: 'Once enrolled with AUSTRAC from July 2026, enter your enrollment number. Before enrollment, enter your ABN and registered business details.', critical: true },
            { task: 'Appoint AML compliance officer in Verigo', detail: 'Assign the MLRO or compliance officer role to the responsible person in your agency.', critical: true },
          ],
        },
        {
          phase: 'Phase 2 — CDD Configuration (by June 2026)',
          timeframe: 'June 2026',
          items: [
            { task: 'Configure buyer KYC workflow', detail: 'Set up individual and entity buyer identification workflows including source of funds collection.', critical: true },
            { task: 'Configure seller KYC workflow', detail: 'Set up seller identification workflow.', critical: true },
            { task: 'Enable PEP and sanctions screening', detail: 'Configure screening for all buyers and sellers at matter commencement.', critical: true },
            { task: 'Configure EDD triggers', detail: 'Set EDD triggers for all-cash purchases, foreign buyers, and complex entity structures.', critical: true },
          ],
        },
        {
          phase: 'Phase 3 — Monitoring and Reporting (by July 2026)',
          timeframe: 'July 2026',
          items: [
            { task: 'Configure matter lifecycle monitoring', detail: 'Set up review checkpoints at each stage of the property transaction.', critical: false },
            { task: 'Test SMR workflow', detail: 'Create a test SMR and confirm MLRO sign-off and AUSTRAC lodgement workflow.', critical: true },
            { task: 'Complete staff AML training', detail: 'All agents and support staff have completed Verigo\'s AML induction training.', critical: true },
          ],
        },
      ],
    },
    goLive: {
      intro: 'Complete before 1 July 2026 — the date designated services obligations commence.',
      criteria: [
        {
          category: 'Legal and Enrollment',
          checks: [
            { item: 'AUSTRAC enrollment completed', description: 'Agency is enrolled with AUSTRAC before providing designated services from 1 July 2026.' },
            { item: 'AML/CTF Program adopted', description: 'Written program is approved by principal and effective from 1 July 2026.' },
            { item: 'AML compliance officer appointed', description: 'Responsible person is documented and has MLRO role in Verigo.' },
          ],
        },
        {
          category: 'CDD and Screening',
          checks: [
            { item: 'Buyer and seller CDD workflows configured', description: 'Both individual and entity KYC workflows are tested and functional.' },
            { item: 'Source of funds collection active', description: 'Source of funds declaration and document collection is triggered for all buyers.' },
            { item: 'PEP and sanctions screening active', description: 'Screening is configured for all buyers, sellers, and beneficial owners.' },
          ],
        },
        {
          category: 'Reporting',
          checks: [
            { item: 'SMR workflow configured and tested', description: 'End-to-end SMR workflow including MLRO sign-off and AUSTRAC lodgement is confirmed.' },
            { item: 'Staff training complete', description: 'All agents have completed AML induction training with completion records saved.' },
          ],
        },
      ],
    },
  },
  {
    industryId: 'conveyancers',
    label: 'Conveyancer',
    regime: 'expanded',
    icon: '📋',
    overview: {
      intro: 'Conveyancers who facilitate property settlements will become reporting entities under the AML/CTF Amendment Act 2024 from 1 July 2026. The settlement stage of a property transaction is uniquely vulnerable to money laundering because large sums of money change hands in a short period, often through trust accounts, creating opportunities for placement and layering of criminal proceeds.',
      paragraphs: [
        'Conveyancers handle the legal and administrative aspects of transferring property from seller to buyer. They manage settlement funds, coordinate between parties and lenders, and ensure that all legal requirements for the transfer are met. This central role in the movement of property settlement funds makes conveyancers a key target for the AML/CTF Tranche 2 reforms.',
        'The most significant ML/TF risk for conveyancers is third-party payment risk — where settlement funds arrive from a source other than the named buyer. This may indicate that the funds are connected to crime and are being channelled through the property transaction via a legitimate-looking purchaser. Conveyancers must verify not just who the buyer is, but where the settlement funds are actually coming from.',
        'Conveyancers are licensed at the state and territory level in Australia. The AUSTRAC enrollment obligation is separate from and in addition to the state licensing requirement. Conveyancers should notify their professional body or state regulator of their AUSTRAC enrollment to ensure there are no conflicts between their state licensing obligations and their AML/CTF program requirements.',
        'AUSTRAC has published guidance specifically for legal and conveyancing professionals ahead of the 2026 effective date. Conveyancers should review AUSTRAC\'s Tranche 2 guidance documents and the AML/CTF Rules as they apply to conveyancing designated services when designing their programs.',
      ],
      keyFacts: [
        { label: 'Legislation', value: 'AML/CTF Amendment Act 2024 (Tranche 2)' },
        { label: 'Effective date', value: '1 July 2026' },
        { label: 'Regulator', value: 'AUSTRAC (plus state licensing regulator)' },
        { label: 'Enrollment required', value: 'Yes — mandatory before providing conveyancing designated services' },
        { label: 'Report types', value: 'SMR' },
        { label: 'Key risk', value: 'Third-party settlement payments and settlement fraud' },
        { label: 'Record keeping', value: '7 years' },
      ],
    },
    amlObligations: {
      intro: 'Conveyancers must enrol with AUSTRAC and have an AML/CTF program in place before providing designated conveyancing services from 1 July 2026.',
      obligations: [
        { title: 'AUSTRAC Enrollment', description: 'Conveyancers must enrol with AUSTRAC before the effective date. The enrollment must specify the conveyancing firm\'s details, principal, and the designated services provided. Enrollment must be kept current.' },
        { title: 'AML/CTF Program', description: 'A written AML/CTF program must be in place from the effective date. The program must address the specific risks of conveyancing services including settlement fund risk, trust account management, and client identity verification.' },
        { title: 'Client Due Diligence', description: 'CDD must be conducted on all clients at the commencement of a conveyancing matter. This includes buyers and sellers. CDD must be completed before settlement funds are received or disbursed.' },
        { title: 'Source of Funds Verification', description: 'Conveyancers must take reasonable steps to verify the source of settlement funds. This includes requesting and reviewing bank statements or other financial evidence from the buyer, and ensuring settlement funds arrive from the buyer\'s verified account.' },
        { title: 'Beneficial Ownership', description: 'Where a buyer is an entity (company or trust), the conveyancer must identify and verify the ultimate beneficial owner before settling the transaction.' },
        { title: 'SMR Reporting', description: 'SMRs must be lodged within 3 business days of forming a suspicion about a client, transaction, or settlement. Tipping off the client is prohibited. Conveyancers must have procedures for managing matters where an SMR has been lodged.' },
        { title: 'Trust Account Monitoring', description: 'Conveyancers who hold settlement funds in trust must monitor their trust account for unusual patterns including unexpected large deposits, funds from unverified third parties, or instructions to redirect settlement funds to a different account at the last minute.' },
        { title: 'Record Keeping', description: 'All CDD records, source of funds documentation, trust account records, and compliance decisions must be kept for 7 years from the completion of the matter.' },
      ],
    },
    cdd: {
      intro: 'CDD for conveyancers applies to every matter — not just high-value transactions. The CDD procedure must be completed before settlement proceeds are received or disbursed.',
      requirements: [
        {
          category: 'Buyer Identification',
          items: [
            'Full legal name as per government-issued identification',
            'Date of birth',
            'Residential address verified by document',
            'Government-issued photo identification document',
            'Contact details (phone, email, address for correspondence)',
          ],
        },
        {
          category: 'Seller Identification',
          items: [
            'Full legal name as per identification',
            'Date of birth',
            'Residential or registered address',
            'Photo identification for individual sellers',
            'For entity sellers: registered name, ACN/ABN, and authorised representative',
          ],
        },
        {
          category: 'Entity Client Identification',
          items: [
            'Full legal name of the entity, ACN, and registered address',
            'Nature and purpose of the entity',
            'All beneficial owners with 25%+ interest — verified to natural person level',
            'Trust deed for trust clients identifying trustee(s) and beneficiaries',
            'Authorised representative identification and authority documentation',
          ],
        },
        {
          category: 'Settlement Funds Verification',
          items: [
            'Confirmation of the source of settlement funds in writing from the buyer',
            'Supporting financial records: mortgage approval letter, bank statements showing funds available, evidence of prior property sale proceeds',
            'Confirmation that settlement funds will be received from the buyer\'s own account (not a third party)',
            'For all-cash purchases: enhanced source of funds documentation (see EDD)',
          ],
        },
      ],
    },
    edd: {
      intro: 'EDD must be applied to conveyancing matters where the transaction presents elevated ML/TF risk indicators, particularly where the source of settlement funds cannot be readily verified.',
      triggers: [
        'All-cash purchase with no mortgage or lender involvement',
        'Settlement funds expected to arrive from a third-party account not matching the buyer\'s identity',
        'Buyer requests last-minute change to settlement account destination',
        'Buyer or beneficial owner is a PEP or sanctioned individual',
        'Buyer is a foreign national from a high-risk or sanctioned jurisdiction',
        'Purchasing entity has complex, opaque, or offshore ownership structure',
        'Purchase price is significantly above or below comparable market value',
        'Client is uncontactable or communicates only through a third party intermediary',
        'Client provides inconsistent information across different stages of the conveyancing process',
      ],
      requirements: [
        {
          category: 'Enhanced Source of Funds',
          items: [
            'Bank statements for the prior 6 months demonstrating accumulation of funds',
            'For mortgage plus cash: breakdown of funds by source with supporting evidence for each component',
            'For business-sourced funds: latest business financial statements or accountant certification',
            'For inherited funds: copy of probate grant or letters of administration',
          ],
        },
        {
          category: 'Enhanced Identity',
          items: [
            'Biometric identity verification for clients who cannot attend in person',
            'Independent verification of identity documents against government databases',
            'Additional identity documents where primary document raises concerns',
          ],
        },
        {
          category: 'Trust Account Controls',
          items: [
            'Pre-settlement confirmation that funds will arrive from buyer\'s verified bank account',
            'MLRO or principal approval before settling an all-cash or high-risk transaction',
            'Written documentation of the EDD process and the decision to proceed',
          ],
        },
      ],
    },
    monitoring: {
      intro: 'Conveyancer monitoring focuses on the matter lifecycle — detecting changes in the transaction that may indicate fraud or ML/TF risk, particularly in the critical pre-settlement period.',
      controls: [
        { name: 'Settlement Account Change Alert', description: 'Flag any instruction from a buyer, seller, or lender to change the nominated settlement account after the matter has commenced. Last-minute account changes are one of the most common indicators of settlement fraud and potential layering.', ruleType: 'Fraud Alert' },
        { name: 'Third-Party Funds Detection', description: 'Flag where settlement funds arrive from a bank account not matching the buyer\'s verified identity or not covered by a mortgage or lender instruction.', ruleType: 'Payment' },
        { name: 'Pre-Settlement Source of Funds Review', description: 'Mandatory review of source of funds documentation at least 5 business days before settlement. Flag matters where documentation is incomplete or where the declared source is inconsistent with the available evidence.', ruleType: 'Review' },
        { name: 'Trust Account Deposit Pattern', description: 'Monitor the conveyancer\'s trust account for unexpected large deposits, deposits from unknown sources, or instructions to hold funds for longer than the normal settlement period without clear explanation.', ruleType: 'Trust Account' },
        { name: 'Post-Settlement Review', description: 'Conduct a post-settlement matter review to identify any indicators that emerged after settlement that may require an SMR to be lodged retrospectively.', ruleType: 'Review' },
      ],
    },
    reporting: {
      intro: 'Conveyancers have a single primary reporting obligation — the SMR. Reports must be lodged within 3 business days of forming a suspicion.',
      reports: [
        {
          type: 'SMR',
          fullName: 'Suspicious Matter Report',
          deadline: '3 business days after forming a suspicion',
          threshold: 'No dollar threshold',
          description: 'An SMR must be lodged for any conveyancing matter where the conveyancer forms a suspicion about the client, the source of settlement funds, or the transaction. The suspicion threshold is relatively low — if the conveyancer forms a genuine suspicion, they must report regardless of whether they believe a crime has actually occurred. Tipping off the client that an SMR has been lodged is a criminal offence.',
          keyFields: ['Client full name, DOB, and address', 'Property address and estimated value', 'Settlement amount and payment method', 'Nature of the designated service (buyer or seller conveyancing)', 'Basis of the suspicion with specific facts', 'Actions taken by the conveyancer', 'Whether settlement was completed'],
        },
      ],
    },
    riskAssessment: {
      intro: 'The conveyancer risk assessment must address the specific risks of the conveyancing practice including client base, typical transaction values, property types, and trust account management.',
      ratingMatrix: [
        { factor: 'Transaction Value', lowRisk: 'Standard residential settlement under $750,000 AUD with mortgage financing', mediumRisk: 'Investment property or higher-value residential between $750,000 and $2 million', highRisk: 'High-value residential or commercial above $2 million, all-cash or offshore-funded purchases' },
        { factor: 'Settlement Funding Source', lowRisk: 'Mortgage from regulated Australian lender covering 80%+ of purchase price', mediumRisk: 'Mixed funding including significant cash component (20-49% of purchase price)', highRisk: 'All-cash purchase, third-party funded, or offshore funding source' },
        { factor: 'Client Type', lowRisk: 'Verified Australian resident individual purchaser with consistent profile', mediumRisk: 'Australian corporate or trust purchaser with identifiable ownership', highRisk: 'Foreign purchaser, complex offshore structure, PEP or PEP associate, or client whose identity cannot be adequately verified' },
        { factor: 'Matter Complexity', lowRisk: 'Standard residential conveyancing with normal settlement timeline', mediumRisk: 'Complex multi-party settlement or off-the-plan purchase', highRisk: 'Very rapid settlement, frequent settlement date changes, or client instructions that deviate from normal conveyancing practice' },
      ],
      methodology: 'The risk assessment must be reviewed annually and when the conveyancing practice expands into new market segments or property types. High-value and all-cash settlement matters must be individually risk-assessed at the time of engagement.',
    },
    amlProgram: {
      intro: 'The conveyancer AML/CTF Program must address the unique risks of the settlement process and the trust account obligations that are specific to conveyancing.',
      components: [
        { name: 'Part A — Risk and Controls', description: 'Documents the conveyancing practice\'s ML/TF risk assessment, control framework, and governance arrangements.', keyElements: ['ML/TF risk assessment for the practice', 'AML compliance officer or MLRO appointment', 'Staff training on conveyancing-specific red flags', 'Annual review schedule'] },
        { name: 'Part B — Client CDD Procedures', description: 'Specifies the CDD process for buyers and sellers, including the source of funds procedure.', keyElements: ['Individual CDD procedure', 'Entity and trust CDD procedure', 'Source of funds collection and review', 'EDD triggers and approval process'] },
        { name: 'Trust Account AML Procedure', description: 'Specific procedures for managing settlement funds in trust consistent with AML/CTF obligations.', keyElements: ['Funds acceptance policy (no third-party funds without approval)', 'Pre-settlement account verification', 'Settlement account change procedure', 'Post-settlement trust account review'] },
        { name: 'SMR Procedure', description: 'Step-by-step procedure for identifying, escalating, and lodging SMRs.', keyElements: ['Red flag identification guide for conveyancers', 'Escalation to compliance officer', 'SMR preparation and lodgement', 'Matter management where SMR has been lodged'] },
      ],
    },
    verigoChecklist: {
      intro: 'Configure Verigo for your conveyancing practice ahead of 1 July 2026.',
      phases: [
        {
          phase: 'Phase 1 — Setup (by May 2026)',
          timeframe: 'May 2026',
          items: [
            { task: 'Create Verigo account with Conveyancer industry pack', detail: 'Activates conveyancer-specific CDD workflows and SMR templates.', critical: true },
            { task: 'Appoint AML compliance officer', detail: 'Assign MLRO role to the principal conveyancer or designated compliance person.', critical: true },
          ],
        },
        {
          phase: 'Phase 2 — CDD and Source of Funds (June 2026)',
          timeframe: 'June 2026',
          items: [
            { task: 'Configure client CDD workflow', detail: 'Set up buyer and seller identification workflows for individual and entity clients.', critical: true },
            { task: 'Configure source of funds collection', detail: 'Enable source of funds declaration and document collection for all buyer matters.', critical: true },
            { task: 'Enable PEP and sanctions screening', detail: 'Configure screening for all clients at matter commencement.', critical: true },
            { task: 'Configure EDD triggers', detail: 'Set EDD triggers for all-cash purchases, foreign buyers, and complex entities.', critical: true },
          ],
        },
        {
          phase: 'Phase 3 — Monitoring and Reporting (July 2026)',
          timeframe: 'July 2026',
          items: [
            { task: 'Configure settlement account change alert', detail: 'Set up alert for last-minute settlement account changes.', critical: true },
            { task: 'Test SMR workflow', detail: 'Run end-to-end SMR test including MLRO sign-off and AUSTRAC lodgement.', critical: true },
            { task: 'Complete staff training', detail: 'All conveyancers and support staff complete AML induction training.', critical: true },
          ],
        },
      ],
    },
    goLive: {
      intro: 'Complete before 1 July 2026.',
      criteria: [
        {
          category: 'Enrollment and Program',
          checks: [
            { item: 'AUSTRAC enrollment completed', description: 'Conveyancing practice is enrolled with AUSTRAC from 1 July 2026.' },
            { item: 'AML/CTF Program adopted', description: 'Written program is approved and includes trust account AML procedures.' },
            { item: 'AML compliance officer appointed', description: 'Documented appointment with MLRO role in Verigo.' },
          ],
        },
        {
          category: 'CDD and Screening',
          checks: [
            { item: 'Client CDD configured and tested', description: 'Buyer and seller workflows function correctly.' },
            { item: 'Source of funds collection active', description: 'Document collection is triggered for all buyer matters.' },
            { item: 'Screening active', description: 'PEP and sanctions screening configured for all clients.' },
          ],
        },
        {
          category: 'Reporting',
          checks: [
            { item: 'SMR workflow tested', description: 'End-to-end SMR from alert to AUSTRAC lodgement is confirmed.' },
            { item: 'Settlement account alert configured', description: 'Last-minute account change detection is active.' },
          ],
        },
      ],
    },
  },
  {
    industryId: 'legal_professionals',
    label: 'Law Firm',
    regime: 'expanded',
    icon: '⚖️',
    overview: {
      intro: 'Law firms providing designated legal services will become reporting entities under the AML/CTF Amendment Act 2024 from 1 July 2026. The legal profession has long been identified internationally as a high-risk conduit for money laundering, with lawyers\' trust accounts, professional privilege, and ability to form complex legal structures all presenting significant exposure.',
      paragraphs: [
        'Not all legal services trigger AML/CTF obligations — only "designated services" as defined in the AML/CTF Amendment Act 2024. These include: buying or selling real property on behalf of a client; managing money or other assets on behalf of a client; organising contributions for the creation, operation, or management of companies; buying or selling business entities; and acting as or arranging for a person to act as a director, nominee shareholder, or trustee. Law firms must identify which of their practice areas involve designated services and apply their AML/CTF program accordingly.',
        'The legal profession\'s exposure to ML/TF risk is well-documented. FATF\'s 2023 mutual evaluation of Australia specifically called out the legal sector as an area requiring significant improvement in AML/CTF controls. The use of lawyer trust accounts to layer funds, the formation of shell companies and trusts to obscure beneficial ownership, and the purchase of high-value property through complex legal structures are all typologies that have been documented in AUSTRAC financial intelligence.',
        'A significant complexity for law firms is the intersection of AML/CTF obligations with legal professional privilege (LPP). LPP protects confidential communications made for the dominant purpose of giving or receiving legal advice. AUSTRAC has confirmed that LPP does not exempt lawyers from AML/CTF obligations in all circumstances, but the precise boundary between LPP-protected information and AML/CTF-reportable information is a matter of ongoing legal interpretation. Law firms should seek specialist AML legal advice on how LPP applies to their specific practice.',
        'Large law firms with multiple practice areas must identify which practice groups are providing designated services and ensure that their AML/CTF program covers those practices specifically. Smaller firms providing property, business, and trust-related services will likely find that most of their transactional practice is covered by the designated service definitions.',
      ],
      keyFacts: [
        { label: 'Legislation', value: 'AML/CTF Amendment Act 2024 (Tranche 2)' },
        { label: 'Effective date', value: '1 July 2026' },
        { label: 'Regulator', value: 'AUSTRAC (plus state/territory law society)' },
        { label: 'Enrollment required', value: 'Yes — mandatory for designated legal services' },
        { label: 'Report types', value: 'SMR' },
        { label: 'Key risk', value: 'Trust account misuse, shell company formation, property transactions' },
        { label: 'Privilege note', value: 'LPP does not exempt lawyers from AML/CTF obligations in all circumstances' },
      ],
    },
    amlObligations: {
      intro: 'Law firms providing designated legal services must enrol with AUSTRAC and have an AML/CTF program in place by 1 July 2026.',
      obligations: [
        { title: 'AUSTRAC Enrollment', description: 'Law firms must enrol with AUSTRAC before providing designated legal services from 1 July 2026. The enrollment must identify the designated services provided and the firm\'s principal AML compliance officer (typically the MLRO or a designated partner).' },
        { title: 'AML/CTF Program', description: 'A written AML/CTF program must be adopted for designated services. The program must address the specific risks of the firm\'s designated practice areas and include policies for trust account management, beneficial ownership identification, and SMR lodgement.' },
        { title: 'Client Due Diligence', description: 'CDD must be conducted on all clients engaging designated legal services at the commencement of the matter. For corporate and trust clients, full beneficial ownership identification is required.' },
        { title: 'Source of Funds for Client Monies', description: 'Where the firm receives money on behalf of a client into its trust account for a designated service, it must take reasonable steps to verify the source of those funds.' },
        { title: 'Beneficial Ownership Identification', description: 'For corporate and trust clients, the firm must identify and verify the ultimate beneficial owner to the natural person level. This applies to all matters involving designated services where the client is not a natural person.' },
        { title: 'Trust Account Monitoring', description: 'The firm must monitor its trust account for unusual patterns. This includes unexpected large deposits, receipt of funds from unknown third parties, and instructions to hold or disburse funds in ways inconsistent with the matter type.' },
        { title: 'SMR Reporting', description: 'SMRs must be lodged within 3 business days of forming a suspicion. Tipping off the client is a criminal offence. The LPP exemption applies narrowly and does not prevent the firm from lodging an SMR in most circumstances.' },
        { title: 'Staff Training', description: 'All lawyers and paralegals involved in designated services must receive AML/CTF training annually. The training must cover the designated service definitions, CDD requirements, red flags, and the SMR lodgement process.' },
      ],
    },
    cdd: {
      intro: 'CDD applies to all clients engaging designated legal services. The depth of due diligence required is proportionate to the risk profile of the client and the designated service.',
      requirements: [
        {
          category: 'Individual Client Identification',
          items: [
            'Full legal name as per photo identification',
            'Date of birth',
            'Residential address',
            'Government-issued photo identification (passport, driver\'s licence)',
            'Contact details and preferred communication method',
            'Nature and purpose of the matter',
          ],
        },
        {
          category: 'Corporate Client Identification',
          items: [
            'Registered company name and ACN',
            'Registered address and principal place of business',
            'Nature of business',
            'All directors (identified and verified)',
            'All beneficial owners with 25%+ ownership — verified to natural person',
            'Corporate structure diagram for complex multi-entity structures',
          ],
        },
        {
          category: 'Trust Client Identification',
          items: [
            'Trust name and trust deed date',
            'Trustee identification (individual or corporate trustee)',
            'Beneficiaries — identified by class or individually as appropriate',
            'Settlor identification',
            'Purpose and nature of the trust',
          ],
        },
        {
          category: 'Trust Account Funds',
          items: [
            'Written instruction from client for all trust account receipts and disbursements',
            'Confirmation of the source of funds received into trust',
            'Verification that disbursements are consistent with the matter type and client instructions',
            'Reconciliation of trust account ledger at matter completion',
          ],
        },
      ],
    },
    edd: {
      intro: 'EDD is required for any client or matter presenting elevated ML/TF risk. Given the nature of designated legal services, EDD triggers will commonly arise in property transactions, company formation, and trust management.',
      triggers: [
        'Client is a PEP or has connections to a PEP',
        'Client is from or connected to a high-risk or sanctioned jurisdiction',
        'Matter involves an all-cash property transaction or large unexplained transfer to trust account',
        'Corporate structure is complex, offshore, or layered in a way that obscures ultimate beneficial ownership',
        'Client instructs the firm to take actions that are inconsistent with the stated purpose of the matter',
        'Client requests unusual trust account arrangements (e.g. hold funds for extended period without clear purpose)',
        'Identity documentation raises concerns — documents appear inconsistent, have been altered, or cannot be verified',
        'Client is unable or unwilling to identify the source of funds held in trust',
        'Multiple matters involving the same client and complex structures with no clear legitimate commercial purpose',
      ],
      requirements: [
        {
          category: 'Enhanced Client Verification',
          items: [
            'Independent verification of identity documents against government register',
            'Physical meeting or video verification where in-person attendance is not possible',
            'Verification of beneficial ownership through independent database searches (ASIC, land titles)',
          ],
        },
        {
          category: 'Enhanced Source of Funds',
          items: [
            'Written source of funds declaration from the client',
            'Supporting financial records (bank statements, tax returns, business accounts)',
            'Independent verification of stated source where feasible',
          ],
        },
        {
          category: 'Partner and MLRO Approval',
          items: [
            'Partner or senior practitioner review and approval before accepting EDD-triggering matter',
            'MLRO consultation for all matters where EDD reveals unresolved concerns',
            'Documented rationale for accepting or declining the matter',
          ],
        },
      ],
    },
    monitoring: {
      intro: 'Monitoring for law firms operates at the matter level — each designated service matter must be monitored throughout its lifecycle for changes in client risk profile or transaction characteristics.',
      controls: [
        { name: 'Trust Account Receipt Alert', description: 'Flag all receipts into the firm\'s trust account that are not from the client\'s verified bank account, exceed the anticipated matter amount, or arrive from an unexpected third party.', ruleType: 'Trust Account' },
        { name: 'Beneficial Ownership Change Detection', description: 'Alert where a corporate or trust client\'s ownership structure changes materially during the course of a matter, particularly where new beneficial owners are identified who were not present at CDD.', ruleType: 'Client' },
        { name: 'Matter Lifecycle Review', description: 'Mandatory review of CDD and transaction documentation at key matter milestones (engagement, major transactions, settlement/completion). Flag matters where documentation is incomplete or where risk has escalated.', ruleType: 'Lifecycle' },
        { name: 'Cross-Matter Pattern Detection', description: 'Identify patterns across multiple matters involving the same client, same beneficial owner, or similar transaction structures that may indicate systematic use of legal services for ML/TF purposes.', ruleType: 'Pattern' },
        { name: 'Unusual Disbursement Alert', description: 'Flag trust account disbursements that are made to a third party not identified in the matter documentation, made urgently at the client\'s insistence, or are inconsistent with the stated purpose of the matter.', ruleType: 'Trust Account' },
      ],
    },
    reporting: {
      intro: 'Law firms lodge SMRs for suspicious activity in connection with designated legal services. The LPP exemption applies narrowly — seek specialist advice if uncertain.',
      reports: [
        {
          type: 'SMR',
          fullName: 'Suspicious Matter Report',
          deadline: '3 business days after forming a suspicion',
          threshold: 'No dollar threshold',
          description: 'An SMR must be lodged for any designated service matter where the firm forms a suspicion of ML/TF. The obligation arises on forming a suspicion — not on proof. The firm must consult its MLRO before lodging. The tipping-off prohibition applies absolutely — do not inform the client that an SMR has been or will be lodged.',
          keyFields: ['Client identifying information', 'Matter type and designated service description', 'Transaction amounts and trust account details if relevant', 'Nature and basis of the suspicion', 'Actions taken by the firm', 'LPP assessment if applicable', 'Whether the matter was completed or declined'],
        },
      ],
    },
    riskAssessment: {
      intro: 'The law firm risk assessment must identify which practice areas provide designated services, the ML/TF risks of each, and the controls in place.',
      ratingMatrix: [
        { factor: 'Practice Area', lowRisk: 'Litigation, employment, family law without significant asset transfers', mediumRisk: 'Commercial contracts, corporate advisory without entity formation', highRisk: 'Property, trusts and estates, corporate restructuring, entity formation, large trust account management' },
        { factor: 'Client Origin', lowRisk: 'Established Australian businesses or individuals with known history', mediumRisk: 'New corporate clients or clients with complex Australian structures', highRisk: 'Foreign clients, offshore entities, PEPs, clients from high-risk jurisdictions' },
        { factor: 'Transaction Value', lowRisk: 'Standard transactions under $250,000 with verified funding', mediumRisk: '$250,000–$2 million with documented legitimate source', highRisk: 'Over $2 million, all-cash, or offshore-funded transactions' },
        { factor: 'Structure Complexity', lowRisk: 'Simple individual or single-entity client with transparent ownership', mediumRisk: 'Corporate client with straightforward domestic ownership', highRisk: 'Multi-layered offshore structures, trusts with complex or opaque beneficial ownership, nominee arrangements' },
      ],
      methodology: 'Each practice area providing designated services must have its own risk assessment section. The firm-level assessment must aggregate practice area risks and assess the adequacy of firm-wide controls. The MLRO must review and approve the risk assessment annually.',
    },
    amlProgram: {
      intro: 'The law firm AML/CTF Program must be tailored to designated legal services and must reflect the specific risks of the firm\'s practice areas.',
      components: [
        { name: 'Designated Services Identification', description: 'A clear identification of which practice areas and matter types constitute designated services under the Act, with guidance for practitioners on when obligations are triggered.', keyElements: ['Designated service definitions applied to firm practice areas', 'Practice area risk matrix', 'Guidance for lawyers on recognising designated service matters'] },
        { name: 'Part A — Risk and Governance', description: 'Risk assessment and governance framework including MLRO appointment, board oversight, and compliance audit.', keyElements: ['ML/TF risk assessment by practice area', 'MLRO role and authority', 'Partner accountability for AML/CTF obligations', 'Annual review and independent audit'] },
        { name: 'Part B — Client CDD Procedures', description: 'CDD procedures for each client type across all designated service matters.', keyElements: ['Individual, corporate, and trust CDD procedures', 'Trust account funds verification', 'EDD triggers and partner approval process', 'Record keeping requirements'] },
        { name: 'Trust Account AML Controls', description: 'Specific controls for managing client monies in trust consistent with AML/CTF obligations.', keyElements: ['Funds acceptance policy', 'Third-party funds procedure', 'Trust account reconciliation', 'Unusual disbursement escalation'] },
        { name: 'LPP Guidance and SMR Procedure', description: 'Guidance for lawyers on how LPP intersects with AML/CTF reporting obligations, and the SMR lodgement procedure.', keyElements: ['LPP assessment guide', 'MLRO consultation process', 'SMR preparation and lodgement', 'Matter management post-SMR lodgement'] },
      ],
    },
    verigoChecklist: {
      intro: 'Configure Verigo for your law firm\'s designated service practices ahead of 1 July 2026.',
      phases: [
        {
          phase: 'Phase 1 — Setup (by May 2026)',
          timeframe: 'May 2026',
          items: [
            { task: 'Create Verigo account with Law Firm industry pack', detail: 'Activates designated services CDD workflows and SMR templates.', critical: true },
            { task: 'Configure practice areas and designated service flags', detail: 'Tag which practice areas provide designated services to ensure obligations are triggered on matter opening.', critical: true },
            { task: 'Appoint MLRO in Verigo', detail: 'Assign MLRO role to the designated partner or compliance officer.', critical: true },
          ],
        },
        {
          phase: 'Phase 2 — CDD Configuration (June 2026)',
          timeframe: 'June 2026',
          items: [
            { task: 'Configure client CDD workflows by entity type', detail: 'Set up individual, corporate, and trust CDD workflows with appropriate document requirements.', critical: true },
            { task: 'Configure trust account monitoring', detail: 'Enable receipt alerts and unusual disbursement flags for the trust account.', critical: true },
            { task: 'Enable PEP and sanctions screening', detail: 'Configure screening for all clients at matter commencement on designated service matters.', critical: true },
          ],
        },
        {
          phase: 'Phase 3 — Training and Go-Live (July 2026)',
          timeframe: 'July 2026',
          items: [
            { task: 'Complete AML training for all lawyers in designated practice areas', detail: 'Training must cover designated service definitions, CDD, and SMR obligations.', critical: true },
            { task: 'Test SMR workflow', detail: 'Run end-to-end SMR test including MLRO sign-off.', critical: true },
            { task: 'MLRO sign-off on program configuration', detail: 'MLRO confirms Verigo configuration matches the written AML/CTF program.', critical: true },
          ],
        },
      ],
    },
    goLive: {
      intro: 'Complete before 1 July 2026.',
      criteria: [
        {
          category: 'Enrollment and Program',
          checks: [
            { item: 'AUSTRAC enrollment completed', description: 'Law firm is enrolled with AUSTRAC for designated legal services.' },
            { item: 'AML/CTF Program adopted', description: 'Written program covering all designated practice areas is approved by the MLRO and firm management.' },
            { item: 'MLRO appointed', description: 'Qualified MLRO is appointed with documented authority.' },
          ],
        },
        {
          category: 'CDD and Trust Account',
          checks: [
            { item: 'CDD workflows configured for all client types', description: 'Individual, corporate, and trust CDD workflows are tested and functional.' },
            { item: 'Trust account monitoring active', description: 'Receipt alerts and disbursement flags are configured.' },
            { item: 'Screening active', description: 'PEP and sanctions screening is configured for all designated service matters.' },
          ],
        },
        {
          category: 'Reporting and Training',
          checks: [
            { item: 'SMR workflow tested', description: 'End-to-end SMR workflow is confirmed.' },
            { item: 'All designated service lawyers trained', description: 'Training records show completion for all relevant practitioners.' },
          ],
        },
      ],
    },
  },
  {
    industryId: 'accountants',
    label: 'Accounting Firm',
    regime: 'expanded',
    icon: '📊',
    overview: {
      intro: 'Accounting firms providing designated accounting services will become reporting entities under the AML/CTF Amendment Act 2024 from 1 July 2026. Accountants occupy a unique position in the financial crime ecosystem — they have access to detailed financial information, assist with company and trust formation, and in some cases manage client funds, all of which create significant ML/TF exposure.',
      paragraphs: [
        'The designated services for accounting firms include: forming companies or trusts on behalf of clients; acting as a nominee director or shareholder; providing a registered office or business address; managing client assets or money; and buying or selling business entities on behalf of a client. Tax return preparation and standard bookkeeping are generally not designated services, but accountants providing the services listed above must comply with the Act from 1 July 2026.',
        'The accounting profession faces ML/TF risk from multiple directions. On one side, clients may use accounting services to create the corporate structures — shell companies, family trusts, nominee arrangements — that are used to launder proceeds of crime. On the other side, accountants who manage client funds or hold client monies in trust are directly exposed to layering risk through those funds.',
        'FATF and AUSTRAC have identified accounting firms as a key vulnerability in Australia\'s AML/CTF framework, particularly for complex tax and offshore structuring arrangements that can be used to evade tax while simultaneously laundering funds. The accounting profession\'s AML/CTF obligations under Tranche 2 are therefore specifically designed to address these risks.',
        'Accounting firms should be aware that their professional conduct obligations (including client confidentiality) do not override AML/CTF reporting obligations. The professional accounting bodies (CPA Australia, Chartered Accountants ANZ, IPA) have acknowledged this and are providing guidance to members on how to manage the intersection of professional conduct and AML/CTF obligations.',
      ],
      keyFacts: [
        { label: 'Legislation', value: 'AML/CTF Amendment Act 2024 (Tranche 2)' },
        { label: 'Effective date', value: '1 July 2026' },
        { label: 'Regulator', value: 'AUSTRAC (plus CPA, CA ANZ, or IPA)' },
        { label: 'Enrollment required', value: 'Yes — mandatory for designated accounting services' },
        { label: 'Report types', value: 'SMR' },
        { label: 'Key risk', value: 'Company/trust formation, nominee services, client fund management' },
        { label: 'Record keeping', value: '7 years' },
      ],
    },
    amlObligations: {
      intro: 'Accounting firms providing designated services must enrol with AUSTRAC and have an AML/CTF program in place from 1 July 2026.',
      obligations: [
        { title: 'AUSTRAC Enrollment', description: 'Accounting firms must enrol with AUSTRAC before providing designated accounting services. The enrollment must specify which designated services the firm provides and identify the AML compliance officer.' },
        { title: 'AML/CTF Program', description: 'A written AML/CTF program must be adopted covering all designated service lines. The program must address company and trust formation risk, nominee service risk, and client fund management risk as relevant to the firm\'s practice.' },
        { title: 'Client Due Diligence', description: 'CDD must be conducted on all clients receiving designated services at the commencement of each engagement. For corporate and trust clients, full beneficial ownership identification to the natural person level is required.' },
        { title: 'Beneficial Ownership Identification', description: 'For all company and trust structures formed or managed on behalf of clients, the accountant must identify and verify the ultimate beneficial owner. This is a core obligation given the risk that accounting services are used to create structures that obscure beneficial ownership.' },
        { title: 'Nominee Service Compliance', description: 'Where the firm provides nominee director, shareholder, or trustee services, it must conduct full CDD on the beneficial owner and maintain records of all nominee arrangements. The firm must not provide nominee services to persons who cannot be adequately identified.' },
        { title: 'Client Funds Monitoring', description: 'Where the firm holds or manages client funds, it must monitor those funds for unusual patterns including large unexplained deposits, instructions to transfer funds in unusual ways, or requests to hold funds for extended periods without clear purpose.' },
        { title: 'SMR Reporting', description: 'SMRs must be lodged within 3 business days of forming a suspicion. Client confidentiality does not exempt the firm from this obligation. The professional accounting bodies have confirmed that AML/CTF reporting obligations override client confidentiality in this context.' },
        { title: 'Ongoing CDD Review', description: 'Client risk ratings and CDD records must be reviewed periodically. High-risk clients must be reviewed at least annually; standard-risk clients at least every 3 years. Review must capture changes in beneficial ownership, business activities, or risk profile.' },
      ],
    },
    cdd: {
      intro: 'CDD for accounting firms applies to all designated service engagements. The depth of CDD required is proportionate to the risk profile of the client and the designated service being provided.',
      requirements: [
        {
          category: 'Individual Client',
          items: [
            'Full legal name as per government-issued identification',
            'Date of birth',
            'Residential address',
            'Photo identification document',
            'Occupation or nature of business for income verification context',
            'Nature of the designated service requested',
          ],
        },
        {
          category: 'Corporate Client (existing company)',
          items: [
            'Registered company name and ACN',
            'Registered address and principal place of business',
            'Nature of business and industry sector',
            'All directors identified and verified',
            'Beneficial owners (25%+ ownership) verified to natural person',
            'Corporate structure diagram for multi-tier ownership',
          ],
        },
        {
          category: 'New Company Formation',
          items: [
            'Identity of the instructing party (the person requesting the company be formed)',
            'Identity of the beneficial owner who will ultimately own or control the company',
            'Purpose of the company and intended business activities',
            'Source of funds to be contributed as initial capital',
            'Whether the company will be used as a trustee — if so, trust CDD also required',
          ],
        },
        {
          category: 'Trust Client',
          items: [
            'Trust deed date and trust name',
            'Trustee identification and verification',
            'Beneficiaries — by class or individually for fixed trusts',
            'Settlor identification',
            'Purpose of the trust and nature of the designated service requested',
          ],
        },
        {
          category: 'Nominee Services',
          items: [
            'Full identity verification of the beneficial owner on whose behalf the nominee service is provided',
            'Written nominee agreement documenting the relationship',
            'Beneficial owner\'s signed acknowledgement of the nominee arrangement',
            'Annual confirmation that the beneficial owner\'s identity and circumstances have not materially changed',
          ],
        },
      ],
    },
    edd: {
      intro: 'EDD applies to accounting clients where the engagement involves elevated ML/TF risk factors, particularly complex structure formation, offshore involvement, or high-value fund management.',
      triggers: [
        'Client requests formation of complex multi-tier corporate or trust structures without clear commercial purpose',
        'Client is from or connected to a high-risk or sanctioned jurisdiction',
        'Client is a PEP or is related to a PEP',
        'Client requests nominee director, shareholder, or trustee services without providing clear identity of the ultimate beneficial owner',
        'Client funds managed by the firm arrive from an unverified or third-party source',
        'Client\'s stated purpose for the structure or service is vague or implausible',
        'Prior dealings with the client have raised unresolved concerns',
        'Client operates in a high-risk industry (gambling, cryptocurrency, adult entertainment)',
        'Structure involves offshore jurisdictions or secrecy havens',
      ],
      requirements: [
        {
          category: 'Enhanced Identity and Ownership',
          items: [
            'Independent verification of beneficial ownership through ASIC, land titles, or other authoritative sources',
            'Full corporate structure map to natural person level with verification at each tier',
            'Purpose of each entity in the structure with supporting commercial rationale',
          ],
        },
        {
          category: 'Enhanced Source of Funds',
          items: [
            'Written source of funds declaration for all funds managed or contributed by the firm',
            'Supporting financial documentation — tax returns, business accounts, investment records',
            'For offshore-sourced funds: documentation showing compliance with local tax and regulatory obligations',
          ],
        },
        {
          category: 'Partner/Principal Approval',
          items: [
            'Senior partner or principal review and sign-off before accepting EDD-triggering engagement',
            'MLRO consultation for all EDD matters with unresolved concerns',
            'Documented decision to accept or decline with rationale',
          ],
        },
      ],
    },
    monitoring: {
      intro: 'Accounting firm monitoring operates at the client-engagement level, with ongoing review of client structures, fund movements, and changes in beneficial ownership or business activities.',
      controls: [
        { name: 'Periodic CDD Review', description: 'Schedule mandatory CDD reviews for all designated service clients — annually for high-risk, every 3 years for standard-risk. Alert when reviews are due or overdue.', ruleType: 'Scheduled Review' },
        { name: 'Beneficial Ownership Change Alert', description: 'Flag where a client reports or the firm identifies a change in the beneficial ownership of a company or trust. Trigger updated CDD for the new beneficial owner.', ruleType: 'Client Change' },
        { name: 'Client Fund Receipt Alert', description: 'Flag large or unusual receipts into client funds managed by the firm, particularly where the source of funds cannot be confirmed from the client\'s known profile.', ruleType: 'Funds' },
        { name: 'New Structure Alert', description: 'Flag new company or trust formation requests that involve offshore elements, nominee arrangements, or complex layered ownership structures.', ruleType: 'Structure' },
        { name: 'Nominee Service Review', description: 'Annual review of all active nominee arrangements to confirm that the beneficial owner\'s identity is current and that the arrangement continues to have a legitimate commercial purpose.', ruleType: 'Scheduled Review' },
      ],
    },
    reporting: {
      intro: 'Accounting firms lodge SMRs for suspicious activity in connection with designated accounting services.',
      reports: [
        {
          type: 'SMR',
          fullName: 'Suspicious Matter Report',
          deadline: '3 business days after forming a suspicion',
          threshold: 'No dollar threshold',
          description: 'SMRs must be lodged for any designated service engagement where the firm forms a suspicion of ML/TF. Common accounting-sector triggers include unexplained complex structures, nominee arrangements obscuring ultimate ownership, and client fund movements inconsistent with the declared purpose of the engagement. Client confidentiality does not override this obligation.',
          keyFields: ['Client identifying information', 'Nature of the designated service', 'Description of the structure or fund arrangement', 'Basis of the suspicion', 'Actions taken (e.g. declined to form company, placed funds on hold)', 'MLRO approval details', 'Whether the engagement proceeded'],
        },
      ],
    },
    riskAssessment: {
      intro: 'The accounting firm risk assessment must address each designated service line separately and aggregate these into an overall firm-level assessment.',
      ratingMatrix: [
        { factor: 'Service Type', lowRisk: 'Tax returns, standard bookkeeping, payroll administration', mediumRisk: 'Business advisory, SMSF administration, simple company or trust formation', highRisk: 'Complex multi-tier structure formation, nominee services, offshore entity management, client fund management' },
        { factor: 'Client Origin', lowRisk: 'Established Australian SMEs or individuals with verifiable income and clean history', mediumRisk: 'New business clients or individuals requiring complex structuring', highRisk: 'Clients from high-risk jurisdictions, PEPs, clients with prior tax compliance issues or unexplained wealth' },
        { factor: 'Transaction Value', lowRisk: 'Engagements with no significant funds under management', mediumRisk: 'Funds under management between $100,000 and $1 million', highRisk: 'Funds under management above $1 million or large initial capital contributions to new structures' },
        { factor: 'Structure Complexity', lowRisk: 'Simple individual or standard Pty Ltd structure', mediumRisk: 'Family trust with discrete beneficiaries and single-tier ownership', highRisk: 'Multi-tier trust or corporate structures, offshore elements, nominee arrangements, or structures whose commercial purpose is not clearly apparent' },
      ],
      methodology: 'The risk assessment must be completed before the effective date. It must be reviewed annually and following any material expansion of designated service lines. The MLRO must approve the assessment.',
    },
    amlProgram: {
      intro: 'The accounting firm AML/CTF Program must cover all designated service lines with specific procedures for each service type.',
      components: [
        { name: 'Designated Services Map', description: 'A clear identification of which service lines constitute designated services, with guidance for practitioners on how to recognise and flag designated service engagements.', keyElements: ['Designated service definitions applied to firm services', 'Engagement intake checklist', 'Guidance on mixed engagements (where only part of the engagement is a designated service)'] },
        { name: 'Part A — Risk and Governance', description: 'Risk assessment and governance including MLRO appointment, partner accountability, and compliance audit.', keyElements: ['ML/TF risk assessment by service line', 'MLRO role and authority', 'Principal/partner AML accountability', 'Annual program review'] },
        { name: 'Part B — Client CDD Procedures', description: 'CDD procedures for each client type across all designated service engagements.', keyElements: ['Individual, corporate, trust, and nominee CDD procedures', 'EDD triggers and partner approval', 'Record keeping requirements'] },
        { name: 'Nominee Services Policy', description: 'A specific policy governing the provision of nominee director, shareholder, and trustee services, including the enhanced CDD requirements and the conditions under which nominee services may be provided.', keyElements: ['Conditions for providing nominee services', 'Beneficial owner identification requirements', 'Nominee agreement documentation', 'Annual review of active nominee arrangements'] },
        { name: 'SMR Procedure', description: 'Step-by-step SMR identification, MLRO consultation, and lodgement procedure.', keyElements: ['Red flag identification for accounting practitioners', 'MLRO escalation process', 'SMR preparation and lodgement', 'Engagement management post-SMR'] },
      ],
    },
    verigoChecklist: {
      intro: 'Configure Verigo for your accounting firm ahead of 1 July 2026.',
      phases: [
        {
          phase: 'Phase 1 — Setup (by May 2026)',
          timeframe: 'May 2026',
          items: [
            { task: 'Create Verigo account with Accounting Firm industry pack', detail: 'Activates designated services CDD workflows for accounting-specific risk.', critical: true },
            { task: 'Map designated service lines in Verigo', detail: 'Tag each service type to ensure CDD is triggered on the correct engagements.', critical: true },
            { task: 'Appoint MLRO', detail: 'Assign MLRO role to the designated partner or principal.', critical: true },
          ],
        },
        {
          phase: 'Phase 2 — CDD Configuration (June 2026)',
          timeframe: 'June 2026',
          items: [
            { task: 'Configure CDD workflows for each client type', detail: 'Individual, corporate, trust, and nominee client CDD workflows.', critical: true },
            { task: 'Configure nominee service controls', detail: 'Enable enhanced CDD and annual review for all nominee arrangements.', critical: true },
            { task: 'Enable PEP and sanctions screening', detail: 'Configure screening for all clients receiving designated services.', critical: true },
            { task: 'Configure periodic CDD review schedule', detail: 'Set high-risk clients to annual review, standard-risk to 3-year review.', critical: false },
          ],
        },
        {
          phase: 'Phase 3 — Go-Live (July 2026)',
          timeframe: 'July 2026',
          items: [
            { task: 'Test SMR workflow', detail: 'Confirm MLRO sign-off step and AUSTRAC lodgement.', critical: true },
            { task: 'Complete AML training for all relevant staff', detail: 'Training completion records saved in Verigo.', critical: true },
          ],
        },
      ],
    },
    goLive: {
      intro: 'Complete before 1 July 2026.',
      criteria: [
        {
          category: 'Enrollment and Program',
          checks: [
            { item: 'AUSTRAC enrollment completed', description: 'Firm is enrolled for designated accounting services.' },
            { item: 'AML/CTF Program adopted', description: 'Written program covering all designated service lines is approved.' },
            { item: 'MLRO appointed', description: 'Qualified compliance officer is documented and has MLRO role in Verigo.' },
          ],
        },
        {
          category: 'CDD and Monitoring',
          checks: [
            { item: 'All CDD workflows configured', description: 'Individual, corporate, trust, and nominee CDD workflows tested.' },
            { item: 'Nominee service controls active', description: 'Enhanced CDD and annual review configured for nominee services.' },
            { item: 'Periodic review schedule set', description: 'CDD review reminders configured for all client tiers.' },
          ],
        },
        {
          category: 'Reporting and Training',
          checks: [
            { item: 'SMR workflow tested and confirmed', description: 'End-to-end SMR process confirmed.' },
            { item: 'All relevant staff trained', description: 'Training completion records are on file.' },
          ],
        },
      ],
    },
  },
  {
    industryId: 'precious_metals',
    label: 'Precious Metal Dealer',
    regime: 'expanded',
    icon: '🥇',
    overview: {
      intro: 'Dealers in precious metals, stones, and jewellery will become reporting entities under the AML/CTF Amendment Act 2024 from 1 July 2026. Physical precious metals have historically been used as a vehicle for converting and moving criminal proceeds because they are portable, high-value, internationally fungible, and until now largely outside the formal AML/CTF reporting framework in Australia.',
      paragraphs: [
        'The precious metals sector includes businesses that buy, sell, or exchange gold, silver, platinum, palladium, and other precious metals, as well as dealers in precious stones and high-value jewellery. The designated service is defined as buying or selling precious metals or stones where the transaction value is above the applicable threshold. The TTR threshold of $10,000 AUD in cash applies to this sector.',
        'The ML/TF risks in the precious metals sector are well-documented internationally. Cash-for-gold operations and pawn-style precious metal dealers are particularly high-risk because they accept large amounts of cash from members of the public without historically requiring identity verification. This makes them attractive to criminals seeking to convert criminal proceeds (often cash from drug sales) into an asset that can be easily transported, sold, or exported without leaving an obvious financial trail.',
        'Larger precious metal dealers, refineries, and bullion banks face different but equally significant risks. These include the diversion of conflict minerals into the legitimate supply chain, the use of precious metal trading to create false invoice trails for trade-based money laundering, and the purchase of high-value bullion by individuals or entities connected to sanctions evasion schemes.',
        'AUSTRAC has worked with the precious metals industry to develop practical guidance on AML/CTF compliance for the sector ahead of the 1 July 2026 effective date. Dealers should consult AUSTRAC\'s Tranche 2 guidance specifically developed for the precious metals sector as part of their program design process.',
      ],
      keyFacts: [
        { label: 'Legislation', value: 'AML/CTF Amendment Act 2024 (Tranche 2)' },
        { label: 'Effective date', value: '1 July 2026' },
        { label: 'Regulator', value: 'AUSTRAC' },
        { label: 'Enrollment required', value: 'Yes — mandatory before providing designated services' },
        { label: 'Report types', value: 'TTR (cash transactions), SMR (suspicious activity)' },
        { label: 'TTR threshold', value: '$10,000 AUD in physical cash' },
        { label: 'Key risk', value: 'Cash-for-gold laundering, conflict minerals, sanctions evasion via bullion' },
      ],
    },
    amlObligations: {
      intro: 'Precious metal dealers must enrol with AUSTRAC and have an AML/CTF program in place from 1 July 2026. The TTR obligation applies to all cash transactions at or above $10,000 AUD.',
      obligations: [
        { title: 'AUSTRAC Enrollment', description: 'Precious metal dealers must enrol with AUSTRAC before providing designated services. The enrollment must specify the type of precious metals dealing (retail, wholesale, refinery, jewellery) and the business\'s principal place of operation.' },
        { title: 'AML/CTF Program', description: 'A written AML/CTF program must be adopted addressing the specific risks of the dealing business. The program must specifically address cash transaction risk, structuring detection, and the physical nature of the assets traded.' },
        { title: 'Customer Identification for Cash Transactions', description: 'Full CDD must be conducted on any customer making a cash transaction at or above $10,000 AUD. This includes customers paying cash to purchase metals and customers selling metals for cash.' },
        { title: 'TTR Reporting', description: 'TTRs must be lodged for all cash transactions at or above $10,000 AUD within 10 business days. This obligation applies to both purchases and sales where the payment is made in physical cash.' },
        { title: 'SMR Reporting', description: 'SMRs must be lodged for any suspicious transaction or customer behaviour regardless of the transaction value. Common triggers include structuring, customers sourcing metals from unusual or unverifiable origins, and customers from sanctioned jurisdictions.' },
        { title: 'Supplier Due Diligence', description: 'Dealers who purchase precious metals from members of the public or from supply chains must conduct supplier due diligence to reduce the risk of receiving conflict minerals or metals derived from criminal activity.' },
        { title: 'Sanctions Screening', description: 'All customers and suppliers above defined thresholds must be screened against sanctions lists. This is particularly important for bullion and precious stone dealers who may have international counterparties.' },
        { title: 'Record Keeping', description: 'All CDD records, transaction records, and AUSTRAC reports must be maintained for 7 years from the date of the transaction or report.' },
      ],
    },
    cdd: {
      intro: 'CDD for precious metal dealers is primarily triggered by cash transaction thresholds. Non-cash transactions may require CDD at lower thresholds where risk indicators are present.',
      requirements: [
        {
          category: 'Cash Transaction CDD ($10,000 AUD+)',
          items: [
            'Full legal name as per government-issued photo identification',
            'Date of birth',
            'Residential address verified by document',
            'Photo identification document (passport, driver\'s licence)',
            'Contact details (phone, email)',
            'Description of the metals being purchased or sold',
            'Stated source of the cash funds (for purchases)',
            'Stated origin of the metals (for sales to the dealer)',
          ],
        },
        {
          category: 'High-Value Non-Cash CDD (above defined threshold)',
          items: [
            'Full legal name and date of birth',
            'Residential or business address',
            'Identity verification document',
            'Business name and ABN for corporate purchasers',
            'Purpose of the transaction for unusually large purchases',
          ],
        },
        {
          category: 'Business Buyer/Seller KYB',
          items: [
            'Registered business name and ABN',
            'Nature of business and primary trading activities',
            'Identity verification of authorised representative',
            'Beneficial owners for high-value transactions or business accounts',
            'Business financial reference for large-volume customers',
          ],
        },
        {
          category: 'Supplier CDD',
          items: [
            'Identity of individuals selling metals to the dealer',
            'Origin and provenance of the metals (particularly for gold and diamonds)',
            'Documentation of legitimate ownership or sourcing for high-value lots',
            'Screening against conflict mineral registers and sanctions lists for international suppliers',
          ],
        },
      ],
    },
    edd: {
      intro: 'EDD is required for customers and transactions presenting elevated ML/TF risk indicators in the precious metals sector.',
      triggers: [
        'Customer proposes to pay with cash at or near the $10,000 TTR threshold',
        'Customer has made multiple prior cash transactions below $10,000 from the same business (structuring)',
        'Customer is selling large volumes of metals that appear inconsistent with their stated occupation or circumstances',
        'Metals being sold appear to have been tampered with or had hallmarks or serial numbers removed',
        'Customer is from a high-risk or sanctioned jurisdiction',
        'Customer is a PEP or is related to a known criminal enterprise',
        'Customer refuses to provide identification or provides implausible explanations for their circumstances',
        'Metals originate from a supply chain that cannot be traced to a legitimate mine, refinery, or prior owner',
      ],
      requirements: [
        {
          category: 'Enhanced Identity',
          items: [
            'Multiple forms of identification for cash transactions above $10,000 AUD',
            'Independent verification of identity documents via government database where available',
            'Photograph of the customer at the point of transaction (where legally permitted and operationally feasible)',
          ],
        },
        {
          category: 'Metal Provenance',
          items: [
            'Documentation of the origin of metals being sold to the dealer',
            'Certificate of ownership, purchase receipt, or refinery documentation',
            'For jewellery: assessment of whether hallmarks and markings are consistent with declared origin',
          ],
        },
        {
          category: 'Cash Source',
          items: [
            'Written declaration of the source of cash funds for purchases above $10,000 AUD',
            'Supporting financial records where the stated source can be documented',
            'Refusal to complete the transaction if the source of funds cannot be adequately explained',
          ],
        },
      ],
    },
    monitoring: {
      intro: 'Monitoring for precious metal dealers focuses on cash transaction thresholds, structuring patterns, and supplier due diligence.',
      controls: [
        { name: 'TTR Threshold Alert', description: 'Flag all cash transactions at or above $10,000 AUD for TTR preparation and mandatory CDD. Must be triggered before the transaction is completed.', ruleType: 'Threshold' },
        { name: 'Structuring Detection', description: 'Alert on customers who make multiple cash transactions below $10,000 AUD in a rolling 5-business-day window that aggregate above the TTR threshold.', ruleType: 'Pattern' },
        { name: 'Frequent Seller Alert', description: 'Flag customers who sell metals to the dealer with unusual frequency or in volumes inconsistent with their stated occupation or known circumstances.', ruleType: 'Velocity' },
        { name: 'Sanctions and PEP Screening', description: 'Screen all customers making transactions above defined thresholds against DFAT, OFAC, UN, and EU sanctions lists and PEP databases.', ruleType: 'Screening' },
        { name: 'Supplier Origin Review', description: 'Review the documented origin of metals purchased from suppliers on a periodic basis. Flag any supplier whose metals cannot be traced to a documented legitimate source.', ruleType: 'Supply Chain' },
        { name: 'Cash Denomination Pattern', description: 'Alert on transactions where the customer presents unusually large numbers of small-denomination notes, which is a common indicator of criminal cash accumulation.', ruleType: 'Cash' },
      ],
    },
    reporting: {
      intro: 'Precious metal dealers lodge TTRs for cash transactions at or above $10,000 AUD and SMRs for suspicious activity.',
      reports: [
        {
          type: 'TTR',
          fullName: 'Threshold Transaction Report',
          deadline: '10 business days after the transaction',
          threshold: '$10,000 AUD or more in physical cash',
          description: 'TTRs are required for all cash purchases or sales of precious metals where the value is $10,000 AUD or more. The report must capture full customer identification details and the specific metals transacted. Both buying and selling transactions are reportable where payment is in cash.',
          keyFields: ['Customer full name, DOB, and address', 'Identification document type and number', 'Cash amount in AUD', 'Type and description of metals transacted', 'Transaction date and business location', 'Staff member handling the transaction'],
        },
        {
          type: 'SMR',
          fullName: 'Suspicious Matter Report',
          deadline: '3 business days after forming a suspicion',
          threshold: 'No dollar threshold',
          description: 'SMRs must be lodged for any suspicious customer or transaction regardless of value. Common triggers include structuring, metals from suspicious origin, customers matching known ML/TF typologies in the precious metals sector, and customers connected to sanctioned entities.',
          keyFields: ['Customer identifying information', 'Transaction details including metal type and value', 'Nature and basis of the suspicion', 'Actions taken (transaction declined, cash refused)', 'Whether the transaction proceeded'],
        },
      ],
    },
    riskAssessment: {
      intro: 'The precious metals dealer risk assessment must address the specific risks of the business type — retail, wholesale, refinery, or jewellery — and the cash-handling exposure of the specific operations.',
      ratingMatrix: [
        { factor: 'Business Type', lowRisk: 'Wholesale bullion trader with established institutional counterparties', mediumRisk: 'Retail jeweller with occasional large cash purchases', highRisk: 'Cash-for-gold or pawn-style dealer accepting metals from members of the public primarily in cash' },
        { factor: 'Payment Method', lowRisk: 'Electronic bank transfer or verified business account payment', mediumRisk: 'Mixed payment methods including occasional cash below $10,000 AUD', highRisk: 'Predominantly cash transactions, particularly for purchase amounts at or near the TTR threshold' },
        { factor: 'Metal Origin', lowRisk: 'Verified supply chain from licensed mine or refinery with full provenance documentation', mediumRisk: 'Second-hand metals from established commercial sellers with documented ownership history', highRisk: 'Metals sourced from members of the public without clear ownership history, conflict mineral risk regions, or with tampered or missing hallmarks' },
        { factor: 'Customer Type', lowRisk: 'Established commercial counterparties with verifiable business purpose and history', mediumRisk: 'Retail customers with moderate transaction values and consistent purchase history', highRisk: 'Anonymous cash customers, PEPs, customers from sanctioned countries, or customers with unusual selling patterns' },
      ],
      methodology: 'The risk assessment must be completed before July 2026 and reviewed annually. Businesses with high cash transaction volumes must specifically address structuring detection controls and the adequacy of their CDD procedures for walk-in cash customers.',
    },
    amlProgram: {
      intro: 'The precious metals dealer AML/CTF Program must specifically address cash transaction risk, structuring detection, and supplier due diligence.',
      components: [
        { name: 'Part A — Risk and Governance', description: 'Documents the dealer\'s ML/TF risk assessment, control framework, and governance including AML compliance officer appointment.', keyElements: ['Cash transaction risk assessment', 'Supplier provenance risk assessment', 'AML compliance officer or MLRO', 'Staff training program for counter and floor staff'] },
        { name: 'Part B — Customer CDD Procedures', description: 'Specifies the CDD process for each transaction tier, including the mandatory CDD for cash transactions at or above $10,000 AUD.', keyElements: ['Cash transaction CDD procedure', 'Non-cash transaction CDD thresholds', 'EDD triggers and procedure', 'Record keeping for transaction and identity documents'] },
        { name: 'TTR Reporting Procedure', description: 'Step-by-step procedure for identifying TTR-reportable transactions, collecting required information, and lodging with AUSTRAC within 10 business days.', keyElements: ['TTR trigger identification', 'CDD collection at point of sale', 'Report preparation and lodgement', 'Filing and record keeping'] },
        { name: 'Supplier Due Diligence Procedure', description: 'Procedures for verifying the origin of metals purchased from suppliers, with specific requirements for metals purchased from members of the public.', keyElements: ['Public seller identification requirements', 'Metal provenance documentation', 'Conflict mineral screening for international suppliers', 'Record keeping for purchase transactions'] },
        { name: 'Cash Handling and Structuring Controls', description: 'Specific controls for staff handling cash transactions including training on structuring recognition, refusal procedures, and escalation.', keyElements: ['Structuring recognition training for staff', 'Cash transaction refusal policy', 'SMR escalation for suspected structuring', 'Counter staff observation protocols'] },
      ],
    },
    verigoChecklist: {
      intro: 'Configure Verigo for your precious metals dealing operations ahead of 1 July 2026.',
      phases: [
        {
          phase: 'Phase 1 — Setup (by May 2026)',
          timeframe: 'May 2026',
          items: [
            { task: 'Create Verigo account with Precious Metal Dealer industry pack', detail: 'Activates TTR templates and precious metals specific monitoring rules.', critical: true },
            { task: 'Configure business locations', detail: 'Register all physical dealing locations where cash transactions are accepted.', critical: true },
            { task: 'Appoint AML compliance officer', detail: 'Assign MLRO role to the designated compliance person.', critical: true },
          ],
        },
        {
          phase: 'Phase 2 — Transaction Controls (June 2026)',
          timeframe: 'June 2026',
          items: [
            { task: 'Configure TTR threshold alert at $10,000 AUD', detail: 'Ensure the alert triggers before cash is accepted and blocks the transaction until CDD is collected.', critical: true },
            { task: 'Configure CDD workflow for cash transactions', detail: 'Set up identity collection form triggered by TTR alert.', critical: true },
            { task: 'Enable structuring detection rule', detail: 'Configure 5-day rolling window for same-customer cash transactions.', critical: true },
            { task: 'Enable PEP and sanctions screening', detail: 'Configure for customers above defined thresholds.', critical: true },
            { task: 'Configure supplier CDD workflow', detail: 'Set up provenance documentation collection for metals purchased from the public.', critical: true },
          ],
        },
        {
          phase: 'Phase 3 — Reporting and Training (July 2026)',
          timeframe: 'July 2026',
          items: [
            { task: 'Test TTR report template', detail: 'Confirm TTR is correctly populated from transaction records.', critical: true },
            { task: 'Test AUSTRAC lodgement', detail: 'Submit test TTR to AUSTRAC sandbox.', critical: true },
            { task: 'Complete staff AML training for counter and floor staff', detail: 'All customer-facing staff complete training on cash transaction obligations and structuring red flags.', critical: true },
          ],
        },
      ],
    },
    goLive: {
      intro: 'Complete before 1 July 2026.',
      criteria: [
        {
          category: 'Enrollment and Program',
          checks: [
            { item: 'AUSTRAC enrollment completed', description: 'Business is enrolled as a precious metals dealer.' },
            { item: 'AML/CTF Program adopted', description: 'Written program with cash controls is approved.' },
            { item: 'All locations registered', description: 'All physical dealing locations are registered in Verigo and with AUSTRAC.' },
          ],
        },
        {
          category: 'Transaction Controls',
          checks: [
            { item: 'TTR threshold rule active', description: '$10,000 AUD cash alert blocks transaction until CDD is complete.' },
            { item: 'Structuring detection enabled', description: 'Multi-transaction pattern detection is running.' },
            { item: 'Supplier CDD configured', description: 'Provenance documentation is collected for public metal purchases.' },
          ],
        },
        {
          category: 'Reporting and Training',
          checks: [
            { item: 'TTR template validated and lodgement tested', description: 'TTR is correctly generated and AUSTRAC sandbox test completed.' },
            { item: 'Counter staff trained', description: 'All customer-facing staff completed AML training.' },
          ],
        },
      ],
    },
  },
  {
    industryId: 'reporting_group',
    label: 'Reporting Group',
    regime: 'current',
    icon: '🏢',
    overview: {
      intro: 'A reporting group is a formal arrangement under the AML/CTF Act 2006 that enables two or more related reporting entities to operate under a single consolidated AML/CTF program. Reporting groups are typically established by diversified financial services organisations that operate multiple regulated businesses under a common parent, seeking to consolidate compliance infrastructure while maintaining individual entity accountability.',
      paragraphs: [
        'Under Part 7A of the AML/CTF Act 2006, AUSTRAC may authorise a group of related bodies corporate to operate as a reporting group. This allows the group to adopt a single group-wide AML/CTF program that covers all member entities, share customer identification information and compliance records across the group, and centralise key compliance functions such as the MLRO, transaction monitoring, and AUSTRAC reporting.',
        'The reporting group structure does not eliminate individual entity obligations — each member entity remains enrolled with AUSTRAC and is individually responsible for lodging required reports and maintaining its own records. What the group structure enables is the sharing of CDD information conducted by one entity to satisfy the obligations of other group entities, and the consolidation of governance and oversight into a group-wide program.',
        'Reporting groups are particularly common among banking and financial services conglomerates, digital asset platforms with multiple regulated entities, and remittance network providers that operate multiple licensed businesses under a common parent. The group structure allows these organisations to operate efficiently while maintaining compliance across all regulated entities.',
        'Establishing a reporting group requires a formal application to AUSTRAC. AUSTRAC will assess whether the proposed group structure meets the requirements of the Act and whether the proposed group-wide program is adequate to address the combined ML/TF risks of all member entities. The group must demonstrate that it has the governance capacity to operate and maintain a consolidated program effectively.',
      ],
      keyFacts: [
        { label: 'Legislation', value: 'AML/CTF Act 2006, Part 7A — Reporting Groups' },
        { label: 'Regulator', value: 'AUSTRAC' },
        { label: 'Authorisation required', value: 'Yes — AUSTRAC must authorise reporting group status' },
        { label: 'Report types', value: 'SMR, IFTI, TTR (per member entity obligations)' },
        { label: 'Key benefit', value: 'Shared CDD, consolidated program, centralised compliance oversight' },
        { label: 'Key risk', value: 'Entity-level compliance gaps masked by group-level view' },
        { label: 'Record keeping', value: '7 years per entity' },
      ],
    },
    amlObligations: {
      intro: 'Reporting groups have both group-level obligations (program, governance) and entity-level obligations (enrolment, reporting) that must both be maintained.',
      obligations: [
        { title: 'AUSTRAC Reporting Group Authorisation', description: 'The group must apply to AUSTRAC for authorisation to operate as a reporting group. The application must identify all member entities, the proposed group program, and the governance structure. AUSTRAC may impose conditions on the authorisation.' },
        { title: 'Group-Wide AML/CTF Program', description: 'The group must adopt and maintain a single AML/CTF program that addresses the ML/TF risks of all member entities. The program must be capable of covering all designated services provided by any member entity. Entity-specific overlays may be required where individual entities have unique obligations.' },
        { title: 'Individual Entity AUSTRAC Enrolment', description: 'Each member entity must maintain its own AUSTRAC enrolment regardless of the group structure. Individual enrolments must be current and reflect each entity\'s actual designated services.' },
        { title: 'Shared Customer Identification', description: 'The group may rely on CDD conducted by one member entity to satisfy the obligations of another member entity, subject to the requirements of the Act regarding how and when reliance may be placed. The group must have documented procedures for shared CDD reliance.' },
        { title: 'Consolidated Transaction Monitoring', description: 'The group must maintain transaction monitoring capabilities across all member entities. The monitoring program must be capable of detecting group-level patterns that may not be visible at the individual entity level.' },
        { title: 'Individual Entity Reporting', description: 'Each member entity remains individually responsible for lodging SMRs, IFTIs, and TTRs as required by its designated services. The group structure does not enable collective reporting unless specifically authorised by AUSTRAC.' },
        { title: 'Group Governance', description: 'The group must have a governance framework that ensures the group program is being implemented consistently across all member entities. This includes regular entity-level compliance reviews, consolidated reporting to the group board, and an independent audit of the group program at least annually.' },
        { title: 'Data Governance', description: 'The group must have documented data governance policies governing how customer information is shared across entities. Access to shared customer records must be restricted to entities that need access for legitimate compliance purposes.' },
      ],
    },
    cdd: {
      intro: 'The group CDD framework enables shared customer master records and reliance on CDD conducted by one entity for the purposes of another. Entity-specific CDD overlays address obligations that differ across the group.',
      requirements: [
        {
          category: 'Group Customer Master Record',
          items: [
            'Centralised customer identity record shared across all member entities',
            'Full legal name, date of birth, residential address, and photo identification for individual customers',
            'Registered name, ABN/ACN, and beneficial ownership for entity customers',
            'Customer risk rating — assessed at group level with entity-specific overlays where necessary',
            'PEP and sanctions screening results shared and current across all entities',
          ],
        },
        {
          category: 'CDD Reliance Between Entities',
          items: [
            'Documented procedure specifying when and how one entity may rely on CDD conducted by another',
            'The relying entity must be satisfied that the CDD was conducted to the standard required for its own obligations',
            'The CDD conducting entity must retain records for the period required by the Act',
            'Any limitations on reliance (e.g. CDD conducted for a lower-risk product cannot satisfy EDD requirements for a higher-risk product) must be documented',
          ],
        },
        {
          category: 'Entity-Specific CDD Overlays',
          items: [
            'Identification of obligations specific to individual entities that require additional CDD beyond the group baseline',
            'DCE member entities: wallet address screening and blockchain analytics',
            'Remittance member entities: beneficiary identification and IFTI-specific fields',
            'Documentation of the overlay requirements for each entity type within the group',
          ],
        },
        {
          category: 'Beneficial Ownership',
          items: [
            'Consolidated beneficial ownership records accessible to all member entities',
            'Single beneficial ownership verification satisfies the group obligation — no need to re-verify for each entity',
            'Annual review of beneficial ownership for all group-shared corporate and trust customers',
          ],
        },
      ],
    },
    edd: {
      intro: 'EDD for reporting groups operates at the group level — EDD conducted for one entity\'s purposes is shared and visible to all entities for whom the customer relationship is relevant.',
      triggers: [
        'Customer is identified as a PEP or PEP associate across any member entity',
        'Sanctions match identified at any group entity — triggers group-wide review',
        'Customer\'s transaction behaviour across all group entities collectively reveals a suspicious pattern not visible at the individual entity level',
        'Customer requests services from multiple group entities in a pattern suggesting structuring across entities',
        'Member entity\'s risk assessment elevates a customer to high-risk, triggering group-level EDD review',
        'Adverse media identification at any group entity triggers group-wide EDD review',
        'New group member entity onboarded with existing customers whose profiles have not been reviewed at the new entity\'s risk standard',
      ],
      requirements: [
        {
          category: 'Group-Level EDD',
          items: [
            'Group MLRO notification for any EDD trigger identified at any member entity',
            'Group-wide transaction analysis covering all entities for EDD customers',
            'Consolidated EDD documentation stored in the group customer master record',
            'Group senior management approval for EDD customer relationships where the risk is assessed as high',
          ],
        },
        {
          category: 'Cross-Entity Pattern Analysis',
          items: [
            'Analysis of customer activity across all group entities when EDD is triggered',
            'Identification of cross-entity patterns that may indicate group-wide ML/TF exposure',
            'Group MLRO review of all cross-entity patterns before closure or escalation to SMR',
          ],
        },
        {
          category: 'Entity-Level EDD Overlays',
          items: [
            'DCE entities: enhanced wallet screening and blockchain analytics at EDD tier',
            'Remittance entities: enhanced beneficiary verification and corridor analysis',
            'Documentation of entity-specific EDD requirements in each entity\'s program overlay',
          ],
        },
      ],
    },
    monitoring: {
      intro: 'Group-level monitoring provides a consolidated view of customer activity across all member entities, enabling detection of patterns that would not be visible at the entity level.',
      controls: [
        { name: 'Cross-Entity Transaction Aggregation', description: 'Aggregate all transactions for the same customer across all group entities to identify group-level patterns including structuring across entities, unusual total exposure, and velocity patterns that are not visible at the individual entity level.', ruleType: 'Group-Level' },
        { name: 'Group-Level IFTI Aggregation', description: 'For customers transacting across multiple remittance or payment entities in the group, aggregate IFTI-triggering transactions to ensure that cross-entity structuring is detected.', ruleType: 'Threshold' },
        { name: 'Entity Compliance Dashboard', description: 'Real-time dashboard showing compliance status for each member entity including outstanding alerts, overdue reports, and CDD completeness metrics.', ruleType: 'Governance' },
        { name: 'Shared Sanctions Alert', description: 'Group-wide sanctions alert that notifies all entities when a match is identified at any entity, triggering group-level review and entity-specific action.', ruleType: 'Screening' },
        { name: 'Entity-Level Monitoring Overlay', description: 'Each member entity maintains its own entity-specific monitoring rules appropriate to its designated services, in addition to the group-level rules.', ruleType: 'Entity' },
        { name: 'Group Audit Trail', description: 'Consolidated audit trail for all compliance actions across the group, with entity-level filtering for individual AUSTRAC examinations.', ruleType: 'Audit' },
      ],
    },
    reporting: {
      intro: 'Reporting obligations remain at the individual entity level unless the group has AUSTRAC authorisation for consolidated reporting. Each entity lodges its own reports based on its own designated service obligations.',
      reports: [
        {
          type: 'SMR',
          fullName: 'Suspicious Matter Report',
          deadline: '3 business days per entity after forming a suspicion',
          threshold: 'No dollar threshold',
          description: 'Each member entity must lodge SMRs for suspicious activity in connection with its own designated services. Where the suspicious activity spans multiple entities, the group MLRO should coordinate to ensure all relevant entities lodge SMRs as required. Group-level transaction analysis may be referenced in individual entity SMRs.',
          keyFields: ['Entity-specific customer and transaction details', 'Group-level context (cross-entity patterns)', 'Group MLRO coordination notes', 'Actions taken at entity and group level'],
        },
        {
          type: 'IFTI',
          fullName: 'International Funds Transfer Instruction',
          deadline: '10 business days per entity',
          threshold: '$10,000 AUD or more',
          description: 'Each remittance, payment, or DCE entity in the group must lodge IFTIs for its own transfer instructions. The group should have consolidated IFTI reporting capabilities to manage volume efficiently.',
          keyFields: ['Entity-specific transfer details', 'Customer group record reference', 'Cross-entity transaction context if relevant'],
        },
        {
          type: 'TTR',
          fullName: 'Threshold Transaction Report',
          deadline: '10 business days per entity',
          threshold: '$10,000 AUD in cash',
          description: 'Each entity with cash-handling operations must lodge TTRs for its own cash threshold transactions.',
          keyFields: ['Entity-specific transaction and customer details', 'Cash amount and denomination', 'Location and date'],
        },
      ],
    },
    riskAssessment: {
      intro: 'The group risk assessment must be conducted at two levels: a consolidated group assessment addressing the aggregate ML/TF exposure of all member entities, and individual entity assessments addressing the specific risks of each entity\'s designated services.',
      ratingMatrix: [
        { factor: 'Entity Type Mix', lowRisk: 'Group comprising lower-risk entities with consistent risk profiles (e.g. multiple payment entities)', mediumRisk: 'Group with a mix of higher and lower risk entities requiring differentiated controls', highRisk: 'Group including high-risk entities (DCE, remittance) alongside lower-risk entities — highest-risk entity sets the minimum group standard' },
        { factor: 'Geographic Exposure', lowRisk: 'Group operations limited to Australia and low-risk jurisdictions', mediumRisk: 'Group with some operations in moderate-risk jurisdictions', highRisk: 'Group with operations in or significant transaction flows to high-risk or sanctioned jurisdictions' },
        { factor: 'Customer Overlap', lowRisk: 'Limited customer sharing across entities — most customers use only one entity', mediumRisk: 'Moderate customer sharing with consistent risk profiles across entities', highRisk: 'High customer overlap with significant cross-entity transaction patterns — greater risk of group-level structuring' },
        { factor: 'Governance Maturity', lowRisk: 'Established group compliance function with experienced MLRO, regular entity audits, and responsive board oversight', mediumRisk: 'Developing compliance function with adequate resources and some entity-level oversight gaps', highRisk: 'Immature group compliance function, resource constraints, or significant entity-level compliance gaps identified in audit' },
      ],
      methodology: 'The group risk assessment must aggregate the individual entity risk assessments into a group-level view. The consolidated assessment must identify risks that are only visible at the group level (e.g. cross-entity structuring, group-level PEP exposure) and ensure the group program has adequate controls for those group-level risks. The assessment must be reviewed annually and following any addition or removal of a member entity.',
    },
    amlProgram: {
      intro: 'The group AML/CTF Program must be a cohesive document that sets minimum standards for all entities while providing flexibility for entity-specific overlays where individual entity obligations differ.',
      components: [
        { name: 'Group Program Foundation', description: 'The core group-level program documenting the group\'s ML/TF risk assessment, governance structure, minimum CDD standards, and shared compliance infrastructure.', keyElements: ['Group ML/TF risk assessment', 'Group MLRO role and authority', 'Minimum CDD standards applicable to all entities', 'Group governance and board oversight', 'Annual group program review and audit'] },
        { name: 'Entity Program Overlays', description: 'Individual overlays for each member entity documenting the entity-specific obligations that exceed the group baseline. Each entity\'s overlay is read in conjunction with the group program foundation.', keyElements: ['Entity-specific designated service obligations', 'Entity-specific monitoring rules', 'Entity-specific AUSTRAC reporting procedures', 'Entity-specific staff training requirements'] },
        { name: 'Shared CDD Framework', description: 'Documents the group\'s approach to shared customer master records, CDD reliance between entities, and the governance of cross-entity data access.', keyElements: ['Group customer master record specifications', 'CDD reliance procedure', 'Data governance and access controls', 'Cross-entity beneficial ownership records'] },
        { name: 'Group Transaction Monitoring', description: 'Documents the group-level monitoring capabilities and the interface between group-level monitoring and entity-level monitoring.', keyElements: ['Group-level rule inventory', 'Cross-entity aggregation methodology', 'Alert escalation to group MLRO', 'Interface with entity-level monitoring'] },
        { name: 'Group AUSTRAC Reporting Coordination', description: 'Procedures for coordinating AUSTRAC reporting across member entities, including processes for multi-entity SMRs and consolidated IFTI preparation for high-volume entities.', keyElements: ['Multi-entity SMR coordination procedure', 'IFTI volume management', 'Reporting deadline tracking across entities', 'Group AUSTRAC relationship management'] },
      ],
    },
    verigoChecklist: {
      intro: 'Configure Verigo for your reporting group, covering both the group-level setup and individual entity configuration.',
      phases: [
        {
          phase: 'Phase 1 — Group Account Setup',
          timeframe: 'Day 1–5',
          items: [
            { task: 'Create Verigo group account and select Reporting Group pack', detail: 'Activates the multi-entity group management module and consolidated monitoring capabilities.', critical: true },
            { task: 'Configure group entity hierarchy', detail: 'Add each member entity as a sub-account under the group account. Set the industry type for each entity to activate the appropriate compliance pack.', critical: true },
            { task: 'Appoint group MLRO', detail: 'Assign group MLRO role to the senior compliance officer with group-level oversight authority.', critical: true },
            { task: 'Configure entity-level MLROs', detail: 'Appoint MLRO or compliance officer for each member entity with appropriate entity-level permissions.', critical: true },
          ],
        },
        {
          phase: 'Phase 2 — Shared CDD Configuration',
          timeframe: 'Day 5–14',
          items: [
            { task: 'Configure group customer master record', detail: 'Set up shared customer database accessible to all member entities. Define data governance and access control rules.', critical: true },
            { task: 'Configure CDD reliance procedures', detail: 'Document and configure when entities may rely on CDD conducted by other group entities.', critical: true },
            { task: 'Enable group-wide PEP and sanctions screening', detail: 'Configure screening to apply at group level with results shared to all entities.', critical: true },
            { task: 'Configure entity-specific CDD overlays', detail: 'Set entity-specific CDD requirements for each entity type (e.g. wallet screening for DCE entities).', critical: true },
          ],
        },
        {
          phase: 'Phase 3 — Monitoring and Reporting',
          timeframe: 'Day 14–21',
          items: [
            { task: 'Enable cross-entity transaction aggregation', detail: 'Configure group-level monitoring to aggregate customer transactions across all entities.', critical: true },
            { task: 'Enable entity-level monitoring rules', detail: 'Activate entity-specific monitoring rules for each member entity type.', critical: true },
            { task: 'Configure consolidated AUSTRAC reporting', detail: 'Set up entity-level reporting workflows with group MLRO oversight and coordination.', critical: true },
            { task: 'Test group MLRO alert workflow', detail: 'Verify that group-level alerts route to the group MLRO and entity alerts route to the relevant entity MLRO.', critical: true },
          ],
        },
        {
          phase: 'Phase 4 — Governance and Go-Live',
          timeframe: 'Day 21–28',
          items: [
            { task: 'Configure entity compliance dashboard', detail: 'Set up consolidated dashboard showing compliance status across all entities.', critical: false },
            { task: 'AUSTRAC reporting group authorisation reference', detail: 'Enter AUSTRAC reporting group authorisation number once granted.', critical: true },
            { task: 'Group MLRO sign-off on configuration', detail: 'Group MLRO confirms Verigo configuration matches the group AML/CTF program.', critical: true },
          ],
        },
      ],
    },
    goLive: {
      intro: 'Confirm all items at both the group and individual entity level before going live.',
      criteria: [
        {
          category: 'Group and Entity Registration',
          checks: [
            { item: 'AUSTRAC reporting group authorisation obtained', description: 'Group has received AUSTRAC authorisation to operate as a reporting group.' },
            { item: 'All member entities individually enrolled with AUSTRAC', description: 'Each entity\'s AUSTRAC enrolment is current and reflects its designated services.' },
            { item: 'Group MLRO and entity MLROs appointed', description: 'All roles are documented with clear authority and accountability.' },
          ],
        },
        {
          category: 'Shared CDD and Monitoring',
          checks: [
            { item: 'Group customer master record operational', description: 'Shared customer database is live with appropriate access controls.' },
            { item: 'CDD reliance procedure documented and configured', description: 'Inter-entity CDD reliance is configured and tested.' },
            { item: 'Cross-entity monitoring active', description: 'Group-level transaction aggregation and monitoring is running.' },
            { item: 'Group-wide screening active', description: 'PEP and sanctions screening is configured at group level.' },
          ],
        },
        {
          category: 'Reporting',
          checks: [
            { item: 'All entity reporting workflows configured', description: 'SMR, IFTI, and TTR workflows are configured for each entity type.' },
            { item: 'Multi-entity SMR coordination procedure tested', description: 'Group MLRO coordination process for cross-entity SMRs is confirmed.' },
            { item: 'Entity compliance dashboard active', description: 'Consolidated compliance status view is operational.' },
          ],
        },
      ],
    },
  },
]

export const getOnboardingPack = (industryId: string) =>
  onboardingPacks.find(p => p.industryId === industryId)

