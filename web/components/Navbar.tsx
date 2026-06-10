'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, Shield, Bell } from 'lucide-react'
import { getStoredUser, getToken, clearUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Solutions', href: '/solutions' },
  { label: 'Rule Builder', href: '/rule-builder' },
  { label: 'Customers', href: '/customers' },
  { label: 'Onboarding', href: '/onboarding' },
  { label: 'Monitoring', href: '/monitoring' },
  { label: 'Reporting', href: '/reporting' },
  { label: 'ECDD', href: '/ecdd' },
  { label: 'MLRO', href: '/mlro' },
  { label: 'Audit', href: '/audit' },
  { label: 'Live Demo', href: '/live-demo' },
  { label: 'API & Integrations', href: '/api-integrations' },
  { label: 'Pricing', href: '/pricing' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const router = useRouter()

  const user = typeof window !== 'undefined' ? getStoredUser() : null

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const token = getToken()
        const res = await fetch(`${API}/api/v1/notifications/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setUnread(data.unread_count ?? 0)
        }
      } catch {}
    }
    load()
    const iv = setInterval(load, 60000)
    return () => clearInterval(iv)
  }, [])

  const handleSignOut = () => {
    clearUser()
    router.push('/login')
  }

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
          {navLinks.map(l => (
            <Link key={l.href} href={l.href} className="text-sm text-white/70 hover:text-white transition-colors">
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link href="/notifications" className="relative p-2 text-white/70 hover:text-white transition-colors">
                <Bell className="w-5 h-5" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
              <Link href="/dashboard" className="text-sm text-white/70 hover:text-white transition-colors">
                Dashboard
              </Link>
              <button onClick={handleSignOut} className="text-sm text-white/70 hover:text-white transition-colors">
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-white/70 hover:text-white transition-colors">Login</Link>
              <Link href="/start-trial" className="btn-gold text-sm py-2 px-4">Start Free Trial</Link>
            </>
          )}
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden p-2 text-white/70">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/10 bg-navy-800 px-4 py-4 space-y-3">
          {navLinks.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="block text-white/80 hover:text-white py-1 text-sm">
              {l.label}
            </Link>
          ))}
          <div className="flex gap-3 pt-2">
            {user ? (
              <>
                <Link href="/notifications" onClick={() => setOpen(false)} className="btn-secondary text-sm py-2 px-4 relative">
                  <Bell className="w-4 h-4 inline mr-1" />Alerts{unread > 0 && ` (${unread})`}
                </Link>
                <button onClick={handleSignOut} className="btn-secondary text-sm py-2 px-4">Sign Out</button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="btn-secondary text-sm py-2 px-4">Login</Link>
                <Link href="/start-trial" onClick={() => setOpen(false)} className="btn-gold text-sm py-2 px-4">Free Trial</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
