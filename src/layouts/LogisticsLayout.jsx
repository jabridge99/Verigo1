import React from 'react'
import { Home, Package, Users, Map, Camera } from 'lucide-react'
import PortalLayout from './PortalLayout'

const NAV = [
  { label: 'Operations',      to: '/logistics',             icon: Home,    end: true },
  { divider: 'Field Operations' },
  { label: 'Job Engine',      to: '/logistics/jobs',        icon: Package },
  { label: 'Route Optimizer', to: '/logistics/routes',      icon: Map },
  { label: 'Pickup Proof',    to: '/logistics/proof',       icon: Camera },
  { divider: 'Network' },
  { label: 'Contractors',     to: '/logistics/contractors', icon: Users },
]

export default function LogisticsLayout() {
  return (
    <PortalLayout
      title="Recovery Logistics"
      accent="amber"
      navItems={NAV}
      userName="Ops Manager"
      userInitials="OM"
      userRole="Recovery Logistics Network"
    />
  )
}
