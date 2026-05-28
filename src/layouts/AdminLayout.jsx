import React from 'react'
import {
  Home, TrendingUp, Building2, MapPin, Activity, Scale, Shield, Warehouse,
  DollarSign, Landmark, CheckCircle, RefreshCw, Layers, BarChart2,
  Database, Eye, Zap,
} from 'lucide-react'
import PortalLayout from './PortalLayout'

const NAV = [
  { label: 'Dashboard',           to: '/admin',                     icon: Home,        end: true },
  { divider: 'WOMS' },
  { label: 'Operations',          to: '/admin/woms',                icon: Activity },
  { label: 'Weighbridge',         to: '/admin/weighbridge',         icon: Scale },
  { label: 'Chain of Custody',    to: '/admin/custody',             icon: Shield },
  { label: 'Warehouse',           to: '/admin/warehouse',           icon: Warehouse },
  { label: 'Recycler Settlement', to: '/admin/recycler-settlement', icon: DollarSign },
  { divider: 'Finance' },
  { label: 'Treasury',            to: '/admin/treasury',            icon: Landmark },
  { label: 'Ledger',              to: '/admin/ledger',              icon: TrendingUp },
  { label: 'Payout Approvals',    to: '/admin/payout-approvals',    icon: CheckCircle },
  { label: 'Reconciliation',      to: '/admin/reconciliation',      icon: RefreshCw },
  { label: 'Settlement Batching', to: '/admin/settlement',          icon: Layers },
  { divider: 'Pricing Intelligence' },
  { label: 'Trader Dashboard',    to: '/admin/trader',              icon: BarChart2 },
  { label: 'Market Ingestion',    to: '/admin/market-ingestion',    icon: Database },
  { label: 'Scrap Pricing',       to: '/admin/scrap-pricing',       icon: Layers },
  { label: 'Competitor Intel',    to: '/admin/competitor-intel',    icon: Eye },
  { label: 'Sentiment Engine',    to: '/admin/sentiment',           icon: Activity },
  { label: 'Composition Engine',  to: '/admin/composition',         icon: BarChart2 },
  { label: 'Pricing Engine',      to: '/admin/pricing-engine',      icon: Zap },
  { divider: 'Network' },
  { label: 'Station Network',     to: '/admin/stations',            icon: MapPin },
  { label: 'Partners',            to: '/admin/partners',            icon: Building2 },
]

export default function AdminLayout() {
  return (
    <PortalLayout
      title="Admin Portal"
      accent="violet"
      navItems={NAV}
      userName="Platform Admin"
      userInitials="PA"
      userRole="System Administrator"
    />
  )
}
