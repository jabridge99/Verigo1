import React from 'react'
import { Home, MapPin, Calendar, Gift, Users } from 'lucide-react'
import PortalLayout from './PortalLayout'

const NAV = [
  { label: 'Dashboard',        to: '/consumer',         icon: Home,     end: true },
  { label: 'Find a Bin',       to: '/consumer/find',    icon: MapPin },
  { label: 'Book Pickup',      to: '/consumer/book',    icon: Calendar },
  { label: 'Eco Rewards',      to: '/consumer/rewards', icon: Gift },
  { label: 'Household Circle', to: '/consumer/circle',  icon: Users },
]

export default function ConsumerLayout() {
  return (
    <PortalLayout
      title="Consumer Portal"
      accent="eco"
      navItems={NAV}
      userName="Sarah M."
      userInitials="SM"
      userRole="Household Member"
    />
  )
}
