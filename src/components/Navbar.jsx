import React, { useState, useEffect } from 'react'
import { Leaf, Menu, X } from 'lucide-react'

const NAV_LINKS = [
  { label: 'How It Works',            href: '#how-it-works' },
  { label: 'Eco Rewards Marketplace', href: '#eco-rewards' },
  { label: 'Household Circle',        href: '#household' },
  { label: 'Operator Program',        href: '#operator' },
]

export default function Navbar() {
  const [scrolled, setScrolled]     = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
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
        <a href="#" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-eco-700 rounded-lg flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-xl text-slate-900 tracking-tight">EcoBin</span>
        </a>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-8">
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

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center gap-3">
          <a
            href="#find-station"
            className="text-sm font-medium text-slate-600 hover:text-eco-700 transition-colors"
          >
            Find Station
          </a>
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
          onClick={() => setMobileOpen(prev => !prev)}
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
