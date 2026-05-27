import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Leaf, Menu, X, ChevronDown } from 'lucide-react'

const NAV_LINKS = [
  { label: 'How It Works',            href: '#how-it-works' },
  { label: 'Eco Rewards Marketplace', href: '#eco-rewards' },
  { label: 'Household Circle',        href: '#household' },
  { label: 'Operator Program',        href: '#operator' },
]

const PORTALS = [
  { label: 'Consumer Portal',   desc: 'Book pickups, track rewards',    to: '/consumer',  dot: 'bg-eco-500' },
  { label: 'Operator Portal',   desc: 'Station & logistics management', to: '/operator',  dot: 'bg-indigo-500' },
  { label: 'Logistics Portal',  desc: 'Driver & route management',      to: '/logistics', dot: 'bg-amber-500' },
  { label: 'Admin Portal',      desc: 'Platform administration',        to: '/admin',     dot: 'bg-violet-500' },
]

export default function Navbar() {
  const [scrolled,    setScrolled]    = useState(false)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [portalOpen,  setPortalOpen]  = useState(false)
  const portalRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onClickOutside = e => {
      if (portalRef.current && !portalRef.current.contains(e.target)) {
        setPortalOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-sm shadow-sm border-b border-slate-100'
          : 'bg-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-eco-700 rounded-lg flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-xl text-slate-900 tracking-tight">CirclLoop</span>
        </a>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-7">
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 hover:text-eco-700 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden lg:flex items-center gap-3">
          {/* Portals dropdown */}
          <div className="relative" ref={portalRef}>
            <button
              onClick={() => setPortalOpen(v => !v)}
              className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-eco-700 transition-colors"
            >
              Sign In <ChevronDown className={`w-3.5 h-3.5 transition-transform ${portalOpen ? 'rotate-180' : ''}`} />
            </button>
            {portalOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50">
                <div className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                  Select Portal
                </div>
                {PORTALS.map(p => (
                  <Link
                    key={p.to}
                    to={p.to}
                    onClick={() => setPortalOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.dot}`} />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{p.label}</div>
                      <div className="text-xs text-slate-400">{p.desc}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <a
            href="#deposit"
            className="inline-flex items-center gap-1.5 bg-eco-700 hover:bg-eco-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            Deposit &amp; Recover Value
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="lg:hidden p-2 -mr-1 text-slate-600"
          onClick={() => setMobileOpen(v => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-b border-slate-100 px-4 pt-2 pb-5 space-y-1">
          {NAV_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block py-2.5 text-sm font-medium text-slate-700 hover:text-eco-700 transition-colors"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-3 border-t border-slate-100 space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-1 mb-2">
              Portals
            </p>
            {PORTALS.map(p => (
              <Link
                key={p.to}
                to={p.to}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 py-2 text-sm font-medium text-slate-700 hover:text-eco-700 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full ${p.dot}`} />
                {p.label}
              </Link>
            ))}
          </div>
          <a
            href="#deposit"
            onClick={() => setMobileOpen(false)}
            className="block mt-3 bg-eco-700 hover:bg-eco-800 text-white text-sm font-semibold px-4 py-3 rounded-lg text-center transition-colors"
          >
            Deposit &amp; Recover Value
          </a>
        </div>
      )}
    </header>
  )
}
