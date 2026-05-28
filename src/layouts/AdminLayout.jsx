import React from 'react'
import { Home, TrendingUp, Building2, CreditCard, MapPin, Activity, Scale, Shield, Warehouse, DollarSign, Landmark, CheckCircle, RefreshCw, Layers } from 'lucide-react'
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
  { label: 'Payout Approvals',    to: '/admin/payout-approvals',   icon: CheckCircle },
  { label: 'Reconciliation',      to: '/admin/reconciliation',      icon: RefreshCw },
  { label: 'Settlement Batching', to: '/admin/settlement',         icon: Layers },
  { divider: 'Network' },
  { label: 'Station Network',     to: '/admin/stations',            icon: MapPin },
  { label: 'Commodity Pricing',   to: '/admin/pricing',             icon: TrendingUp },
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
