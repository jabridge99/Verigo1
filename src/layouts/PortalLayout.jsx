import React, { useState } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import { Leaf, Bell, Menu, X, LogOut, Settings, HelpCircle } from 'lucide-react'

// Full class strings are written out explicitly so Tailwind includes them at build time.
const ACTIVE = {
  eco:    'bg-eco-700 text-white',
  indigo: 'bg-indigo-600 text-white',
  amber:  'bg-amber-600 text-white',
  violet: 'bg-violet-600 text-white',
}

export default function PortalLayout({
  title,
  accent = 'eco',
  navItems,
  userName = 'User',
  userInitials = 'U',
  userRole = '',
}) {
  const [open, setOpen] = useState(false)
  const activeClass = ACTIVE[accent] || ACTIVE.eco

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          bg-slate-900 text-slate-300 w-64 flex flex-col flex-shrink-0
          fixed inset-y-0 left-0 z-30 transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:static lg:translate-x-0
        `}
      >
        {/* Brand */}
        <Link
          to="/"
          className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10 flex-shrink-0"
        >
          <div className="w-7 h-7 bg-eco-700 rounded-lg flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-bold text-white text-[15px] tracking-tight leading-none">
              CirclLoop
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-0.5">
              {title}
            </div>
          </div>
        </Link>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? activeClass
                    : 'text-slate-400 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-white/10 space-y-0.5 flex-shrink-0">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
            <Settings className="w-4 h-4" /> Settings
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
            <HelpCircle className="w-4 h-4" /> Help &amp; Support
          </button>
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" /> Exit Portal
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-100 h-16 flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
          <button
            className="lg:hidden p-2 -ml-1 text-slate-500"
            onClick={() => setOpen(v => !v)}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="hidden lg:block" />

          <div className="flex items-center gap-3">
            <button className="relative p-2 text-slate-500 hover:text-slate-700 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-eco-500 rounded-full" />
            </button>
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-100">
              <div className="w-8 h-8 bg-eco-700 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {userInitials}
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-semibold text-slate-900 leading-tight">{userName}</div>
                {userRole && (
                  <div className="text-[11px] text-slate-400">{userRole}</div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
