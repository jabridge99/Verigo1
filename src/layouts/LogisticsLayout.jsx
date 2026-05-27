import React from 'react'
import { Home, Map, Package } from 'lucide-react'
import PortalLayout from './PortalLayout'

const NAV = [
  { label: 'Dashboard', to: '/logistics',        icon: Home,    end: true },
  { label: 'My Routes', to: '/logistics/routes', icon: Map },
  { label: 'Jobs',      to: '/logistics/jobs',   icon: Package },
]

export default function LogisticsLayout() {
  return (
    <PortalLayout
      title="Logistics Portal"
      accent="amber"
      navItems={NAV}
      userName="Mike Chen"
      userInitials="MC"
      userRole="Logistics Contractor"
    />
  )
}
