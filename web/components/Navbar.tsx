'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, Shield } from 'lucide-react'

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Solutions', href: '/solutions' },
  { label: 'Rule Builder', href: '/rule-builder' },
  { label: 'Onboarding', href: '/onboarding' },
  { label: 'Monitoring', href: '/monitoring' },
  { label: 'Live Demo', href: '/live-demo' },
  { label: 'API & Integrations', href: '/api-integrations' },
  { label: 'Pricing', href: '/pricing' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-navy-900/90 backdrop-blur-xl">
      <div className="container-xl flex items-center justify-between h-16 px-4 mx-auto">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-white">Trust<span className="text-brand-400"> Verify</span><span className="text-gold-400"> Go</span></span>
        </Link>
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map(l => <Link key={l.href} href={l.href} className="text-sm text-white/70 hover:text-white transition-colors">{l.label}</Link>)}
        </div>
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm text-white/70 hover:text-white transition-colors">Login</Link>
          <Link href="/start-trial" className="btn-gold text-sm py-2 px-4">Start Free Trial</Link>
        </div>
        <button onClick={() => setOpen(!open)} className="md:hidden p-2 text-white/70">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-white/10 bg-navy-800 px-4 py-4 space-y-3">
          {navLinks.map(l => <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block text-white/80 hover:text-white py-1 text-sm">{l.label}</Link>)}
          <div className="flex gap-3 pt-2">
            <Link href="/login" onClick={() => setOpen(false)} className="btn-secondary text-sm py-2 px-4">Login</Link>
            <Link href="/start-trial" onClick={() => setOpen(false)} className="btn-gold text-sm py-2 px-4">Free Trial</Link>
          </div>
        </div>
      )}
    </nav>
  )
}
