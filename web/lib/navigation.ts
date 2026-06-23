// Central route metadata used by the Sidebar and Breadcrumbs components.
// Each entry maps a path prefix to a human label and the workflow group it belongs to.

export type NavGroup = {
  label: string
  items: { label: string; href: string }[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Organisation Setup',
    items: [
      { label: 'Setup & Compliance Program', href: '/onboarding-setup' },
      { label: 'Industry & Pack Configuration', href: '/industry' },
      { label: 'AML Program & Risk Appetite', href: '/aml-program' },
    ],
  },
  {
    label: 'Customer Lifecycle',
    items: [
      { label: 'Customers', href: '/customers' },
      { label: 'KYC / KYB Pipeline', href: '/onboarding' },
      { label: 'Enhanced Due Diligence', href: '/ecdd' },
      { label: 'Documents', href: '/documents' },
    ],
  },
  {
    label: 'Transaction Lifecycle',
    items: [
      { label: 'Transaction Monitoring', href: '/monitoring' },
      { label: 'Alerts', href: '/notifications' },
      { label: 'Cases', href: '/mlro' },
    ],
  },
  {
    label: 'Compliance Lifecycle',
    items: [
      { label: 'Reporting Queue', href: '/reporting' },
      { label: 'Retention & Archival', href: '/retention' },
      { label: 'Compliance Analytics', href: '/analytics' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { label: 'Compliance Calendar', href: '/governance/calendar' },
      { label: 'Risk Matrix', href: '/governance/risk-matrix' },
      { label: 'Policies', href: '/governance/policies' },
      { label: 'Controls', href: '/governance/controls' },
      { label: 'Training Suite', href: '/governance/training' },
      { label: 'Audit Logs', href: '/audit' },
      { label: 'API Integrations', href: '/api-integrations' },
    ],
  },
  {
    label: 'Automation',
    items: [
      { label: 'Rule Builder', href: '/rule-builder' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Users', href: '/users' },
      { label: 'API & Webhooks', href: '/api-keys' },
      { label: 'Billing', href: '/billing' },
      { label: 'Branding', href: '/branding' },
    ],
  },
]

// Flat label map for breadcrumb segment resolution, including detail-view sub-segments.
export const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  customers: 'Customers',
  onboarding: 'Onboarding',
  'onboarding-setup': 'Onboarding Setup',
  'onboarding-packs': 'Onboarding Packs',
  monitoring: 'Monitoring',
  reporting: 'Reporting',
  ecdd: 'ECDD',
  mlro: 'MLRO Dashboard',
  'aml-program': 'AML Program',
  documents: 'Documents',
  audit: 'Audit Trail',
  ifti: 'IFTI',
  packs: 'Industry Packs',
  users: 'Users',
  industry: 'Industry Management',
  'api-keys': 'API Keys',
  'api-integrations': 'API Integrations',
  billing: 'Billing',
  branding: 'Branding',
  company: 'Organisation Profile',
  notifications: 'Notifications',
  analytics: 'Analytics',
  retention: 'Retention',
  connectors: 'Data Connectors',
  governance: 'Governance',
  calendar: 'Compliance Calendar',
  policies: 'Policies',
  controls: 'Controls',
  'risk-matrix': 'Risk Matrix',
  training: 'Training Suite',
  kyc: 'KYC Review',
  kyb: 'KYB Review',
  screening: 'Screening',
  transactions: 'Transactions',
  cases: 'Cases',
  reports: 'Reports',
  'audit-history': 'Audit History',
  notes: 'Notes',
  tasks: 'Tasks',
  timeline: 'Timeline',
  new: 'New',
  'rule-builder': 'Rule Builder',
}

// Paths that should never render the app chrome (sidebar/breadcrumbs) — marketing/public/auth pages.
export const PUBLIC_PREFIXES = [
  '/', '/login', '/pricing', '/solutions', '/industries', '/live-demo', '/start-trial',
  '/company', '/faq', '/learn', '/resources', '/contact', '/privacy', '/terms', '/security',
  '/trust-centre', '/verify', '/offline',
]

export function isAppRoute(pathname: string): boolean {
  if (pathname === '/') return false
  return !PUBLIC_PREFIXES.some(p => p !== '/' && (pathname === p || pathname.startsWith(p + '/')))
}
