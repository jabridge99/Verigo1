// Central route metadata used by the Sidebar and Breadcrumbs components.
// Each entry maps a path prefix to a human label and the workflow group it belongs to.

import type { LucideIcon } from 'lucide-react'
import {
  Building2, Users, ArrowLeftRight, ShieldCheck, BarChart2, Scale, Webhook, Settings,
  ClipboardList, Bell, Shield, FolderOpen, FileCheck, Coins, Zap, Sliders,
  CreditCard, Palette, Key, Archive, FileText, Calendar, BookOpen, ClipboardCheck,
  Award, FileBarChart, Network, UserCog,
} from 'lucide-react'

export type NavItem = { label: string; href: string; icon: LucideIcon }
export type NavGroup = {
  label: string
  icon: LucideIcon
  // Groups a user works in daily stay open by default; rarely-touched setup/admin
  // groups start collapsed to keep the sidebar scannable.
  defaultOpen: boolean
  items: NavItem[]
}

// Pinned above the groups — always one click away regardless of nav state.
export const TOP_LINK: NavItem = { label: 'Dashboard', href: '/dashboard', icon: Building2 }

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Customers',
    icon: Users,
    defaultOpen: true,
    items: [
      { label: 'Customers', href: '/customers', icon: Users },
      { label: 'KYC / KYB Pipeline', href: '/onboarding', icon: FileCheck },
      { label: 'Enhanced Due Diligence', href: '/ecdd', icon: ClipboardCheck },
      { label: 'Documents', href: '/documents', icon: FolderOpen },
    ],
  },
  {
    label: 'Transactions',
    icon: ArrowLeftRight,
    defaultOpen: true,
    items: [
      { label: 'Transaction Monitoring', href: '/monitoring', icon: ArrowLeftRight },
      { label: 'Alerts', href: '/notifications', icon: Bell },
      { label: 'Cases', href: '/mlro', icon: Shield },
      { label: 'Reporting Queue', href: '/reporting', icon: FileText },
    ],
  },
  {
    label: 'Risk & Governance',
    icon: ShieldCheck,
    defaultOpen: true,
    items: [
      { label: 'Risk Matrix', href: '/governance/risk-matrix', icon: Scale },
      { label: 'Policies', href: '/governance/policies', icon: BookOpen },
      { label: 'Controls', href: '/governance/controls', icon: ShieldCheck },
      { label: 'Independent Reviews', href: '/governance/independent-review', icon: ClipboardCheck },
      { label: 'Training Suite', href: '/governance/training', icon: Award },
      { label: 'Board Reports', href: '/governance/board-reports', icon: FileBarChart },
      { label: 'Examination Packs', href: '/governance/examination-packs', icon: Archive },
      { label: 'Compliance Calendar', href: '/governance/calendar', icon: Calendar },
      { label: 'Audit Logs', href: '/audit', icon: ClipboardList },
    ],
  },
  {
    label: 'Analytics',
    icon: BarChart2,
    defaultOpen: false,
    items: [
      { label: 'Executive Dashboard', href: '/analytics/executive', icon: BarChart2 },
      { label: 'Compliance Dashboard', href: '/analytics/compliance', icon: BarChart2 },
      { label: 'MLRO Analytics', href: '/analytics/mlro', icon: BarChart2 },
      { label: 'Operations Dashboard', href: '/analytics/operations', icon: BarChart2 },
      { label: 'Industry Benchmarking', href: '/analytics/benchmarking', icon: BarChart2 },
    ],
  },
  {
    label: 'Automation',
    icon: Zap,
    defaultOpen: false,
    items: [
      { label: 'Rule Builder', href: '/rule-builder', icon: Zap },
      { label: 'Decision Support', href: '/decision-support', icon: Network },
      { label: 'Retention & Archival', href: '/retention', icon: Archive },
    ],
  },
  {
    label: 'Setup',
    icon: Sliders,
    defaultOpen: false,
    items: [
      { label: 'Setup & Compliance Program', href: '/onboarding-setup', icon: Sliders },
      { label: 'Industry & Pack Configuration', href: '/industry', icon: Coins },
      { label: 'AML Program & Risk Appetite', href: '/aml-program', icon: ShieldCheck },
      { label: 'API Integrations', href: '/api-integrations', icon: Webhook },
    ],
  },
  {
    label: 'Admin',
    icon: UserCog,
    defaultOpen: false,
    items: [
      { label: 'Users', href: '/users', icon: UserCog },
      { label: 'API & Webhooks', href: '/api-keys', icon: Key },
      { label: 'Billing', href: '/billing', icon: CreditCard },
      { label: 'Branding', href: '/branding', icon: Palette },
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
  executive: 'Executive Dashboard',
  compliance: 'Compliance Dashboard',
  operations: 'Operations Dashboard',
  benchmarking: 'Industry Benchmarking',
  retention: 'Retention',
  connectors: 'Data Connectors',
  governance: 'Governance',
  calendar: 'Compliance Calendar',
  policies: 'Policies',
  controls: 'Controls',
  'risk-matrix': 'Risk Matrix',
  training: 'Training Suite',
  'independent-review': 'Independent Reviews',
  'board-reports': 'Board Reports',
  'examination-packs': 'Examination Packs',
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
  'decision-support': 'Decision Support',
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
