import React from 'react'
import {
  Home, MapPin, Calendar, QrCode, Wallet, TrendingUp,
  List, Gift, Users, GitBranch, Bell, Shield, HelpCircle,
} from 'lucide-react'
import PortalLayout from './PortalLayout'

const NAV = [
  { label: 'Dashboard',        to: '/consumer',              icon: Home,       end: true },
  { divider: 'Deposit' },
  { label: 'Find a Zone',      to: '/consumer/find',         icon: MapPin },
  { label: 'Book Pickup',      to: '/consumer/book',         icon: Calendar },
  { label: 'Scan QR',          to: '/consumer/scan',         icon: QrCode },
  { divider: 'My Account' },
  { label: 'Wallet',           to: '/consumer/wallet',       icon: Wallet },
  { label: 'Earnings',         to: '/consumer/earnings',     icon: TrendingUp },
  { label: 'Transactions',     to: '/consumer/transactions', icon: List },
  { divider: 'Community' },
  { label: 'Household Circle', to: '/consumer/circle',       icon: Users },
  { label: 'Eco Rewards',      to: '/consumer/rewards',      icon: Gift },
  { label: 'Referral',         to: '/consumer/referral',     icon: GitBranch },
  { divider: 'Account' },
  { label: 'Notifications',    to: '/consumer/notifications', icon: Bell },
  { label: 'KYC & Identity',   to: '/consumer/kyc',          icon: Shield },
  { label: 'Support',          to: '/consumer/support',      icon: HelpCircle },
]

export default function ConsumerLayout() {
  return (
    <PortalLayout
      title="Consumer Portal"
      accent="eco"
      navItems={NAV}
      userName="Sarah M."
      userInitials="SM"
      userRole="Silver Tier · 1,420 pts"
    />
  )
}
