import React from 'react'
import { Home, TrendingUp, Building2, CreditCard, MapPin } from 'lucide-react'
import PortalLayout from './PortalLayout'

const NAV = [
  { label: 'Dashboard',         to: '/admin',            icon: Home,      end: true },
  { label: 'Station Network',   to: '/admin/stations',   icon: MapPin },
  { label: 'Commodity Pricing', to: '/admin/pricing',    icon: TrendingUp },
  { label: 'Partners',          to: '/admin/partners',   icon: Building2 },
  { label: 'Settlement',        to: '/admin/settlement', icon: CreditCard },
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
