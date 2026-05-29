import React from 'react'
import {
  Home, Package, Megaphone, BarChart2, UserCheck, Settings, HelpCircle,
} from 'lucide-react'
import PortalLayout from './PortalLayout'

const NAV = [
  { label: 'Dashboard',    to: '/merchant',            icon: Home,       end: true },
  { divider: 'Catalogue' },
  { label: 'Products & Vouchers', to: '/merchant/products',  icon: Package },
  { label: 'Campaigns',   to: '/merchant/campaigns',  icon: Megaphone },
  { divider: 'Insights' },
  { label: 'Analytics',   to: '/merchant/analytics',  icon: BarChart2 },
  { divider: 'Account' },
  { label: 'Profile & Verification', to: '/merchant/onboarding', icon: UserCheck },
]

export default function MerchantLayout() {
  return (
    <PortalLayout
      title="Merchant Portal"
      accent="eco"
      navItems={NAV}
      userName="The Green Cycle"
      userInitials="GC"
      userRole="Verified Green Merchant"
    />
  )
}
