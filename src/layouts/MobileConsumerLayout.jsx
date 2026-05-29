import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import {
  Leaf, Bell, Home, MapPin, QrCode, Wallet, MoreHorizontal,
  TrendingUp, List, Users, Gift, GitBranch, ShoppingBag,
  Star, Crown, Calendar, BellRing, Shield, HelpCircle, X,
} from 'lucide-react'

const MORE_NAV = [
  { label: 'Earnings',      to: '/consumer/earnings',      icon: TrendingUp },
  { label: 'Transactions',  to: '/consumer/transactions',  icon: List },
  { label: 'Circle',        to: '/consumer/circle',        icon: Users },
  { label: 'Eco Rewards',   to: '/consumer/rewards',       icon: Gift },
  { label: 'Referral',      to: '/consumer/referral',      icon: GitBranch },
  { label: 'Marketplace',   to: '/consumer/marketplace',   icon: ShoppingBag },
  { label: 'Group Rewards', to: '/consumer/group-rewards', icon: Star },
  { label: 'Member Offers', to: '/consumer/member-offers', icon: Crown },
  { label: 'Book Pickup',   to: '/consumer/book',          icon: Calendar },
  { label: 'Notifications', to: '/consumer/notifications', icon: BellRing },
  { label: 'KYC',           to: '/consumer/kyc',           icon: Shield },
  { label: 'Support',       to: '/consumer/support',       icon: HelpCircle },
]

export default function MobileConsumerLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()

  const handleMoreItemClick = (to) => {
    setDrawerOpen(false)
    navigate(to)
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-30 h-14 bg-white border-b border-slate-100 shadow-sm flex items-center justify-between px-4">
        {/* Logo / Brand */}
        <Link to="/consumer" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-eco-700 rounded-lg flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-slate-900 text-[15px] tracking-tight">CirclLoop</span>
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button className="relative p-2 text-slate-500 hover:text-slate-700 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-eco-500 rounded-full" />
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-slate-100">
            <div className="w-8 h-8 bg-eco-700 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              SM
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold text-slate-900 leading-tight">Sarah M.</div>
              <div className="text-[11px] text-slate-400">Silver · 1,420 pts</div>
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable main content */}
      <main className="flex-1 overflow-y-auto pt-14 pb-20">
        <Outlet />
      </main>

      {/* Fixed Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 h-16 bg-white border-t border-slate-100 shadow-[0_-1px_4px_rgba(0,0,0,0.06)] flex items-center">
        {/* Home */}
        <NavLink
          to="/consumer"
          end
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-colors ${
              isActive ? 'text-eco-700' : 'text-slate-400 hover:text-slate-600'
            }`
          }
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </NavLink>

        {/* Find */}
        <NavLink
          to="/consumer/find"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-colors ${
              isActive ? 'text-eco-700' : 'text-slate-400 hover:text-slate-600'
            }`
          }
        >
          <MapPin className="w-5 h-5" />
          <span className="text-[10px] font-medium">Find</span>
        </NavLink>

        {/* Scan — Center FAB */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <NavLink
            to="/consumer/scan"
            className="w-14 h-14 bg-eco-700 rounded-full flex items-center justify-center shadow-xl -mt-5 transition-opacity hover:opacity-90"
          >
            <QrCode className="w-6 h-6 text-white" />
          </NavLink>
        </div>

        {/* Wallet */}
        <NavLink
          to="/consumer/wallet"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-colors ${
              isActive ? 'text-eco-700' : 'text-slate-400 hover:text-slate-600'
            }`
          }
        >
          <Wallet className="w-5 h-5" />
          <span className="text-[10px] font-medium">Wallet</span>
        </NavLink>

        {/* More */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full text-slate-400 hover:text-slate-600 transition-colors"
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>

      {/* More Drawer Overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* More Drawer Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl pb-8 transition-transform duration-300 ease-out ${
          drawerOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Drag handle + header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
          <span className="text-sm font-semibold text-slate-700">More</span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grid of more items */}
        <div className="grid grid-cols-3 gap-1 px-4 pt-2">
          {MORE_NAV.map(({ label, to, icon: Icon }) => (
            <button
              key={to}
              onClick={() => handleMoreItemClick(to)}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl hover:bg-slate-50 active:bg-slate-100 transition-colors"
            >
              <div className="w-11 h-11 bg-eco-50 rounded-xl flex items-center justify-center">
                <Icon className="w-5 h-5 text-eco-700" />
              </div>
              <span className="text-[11px] font-medium text-slate-600 text-center leading-tight">
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
