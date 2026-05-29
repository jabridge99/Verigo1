import React from 'react'
import { Home, Building2, Truck, DollarSign, BarChart3, Briefcase } from 'lucide-react'
import PortalLayout from './PortalLayout'

const NAV = [
  { label: 'Dashboard',  to: '/operator',            icon: Home,      end: true },
  { label: 'Stations',   to: '/operator/stations',   icon: Building2 },
  { label: 'Logistics',  to: '/operator/logistics',  icon: Truck },
  { label: 'Pricing',    to: '/operator/pricing',    icon: DollarSign },
  { label: 'Earnings',   to: '/operator/earnings',   icon: BarChart3 },
  { label: 'Franchise',  to: '/operator/franchise',  icon: Briefcase },
]

export default function OperatorLayout() {
  return (
    <PortalLayout
      title="Operator Portal"
      accent="indigo"
      navItems={NAV}
      userName="GreenStation Ops"
      userInitials="GO"
      userRole="Operator Partner"
    />
  )
}
