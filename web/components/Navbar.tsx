'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Menu, X, ChevronDown, Shield, Bell, Coins, Globe, ArrowLeftRight, CreditCard, Home, FileCheck, Scale, Calculator, Gem, Network, Landmark, BookOpen, HelpCircle, Building2 } from 'lucide-react'
import { getStoredUser, clearUser } from '@/lib/auth'
import { useRouter, usePathname } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const solutionItems = [
  { label: 'Compliance Operations', href: '/solutions/compliance-operations', desc: 'End-to-end compliance workflow management' },
  { label: 'Customer Onboarding', href: '/solutions/customer-onboarding', desc: 'Streamlined digital customer onboarding' },
  { label: 'KYC & KYB', href: '/solutions/kyc-kyb', desc: 'Identity and business verification' },
  { label: 'Transaction Monitoring', href: '/solutions/transaction-monitoring', desc: 'Automated AML transaction surveillance' },
  { label: 'Case Management', href: '/solutions/case-management', desc: 'Alert-to-case investigation workflows' },
  { label: 'Regulatory Reporting', href: '/solutions/regulatory-reporting', desc: 'AUSTRAC-ready report generation' },
  { label: 'Reporting Groups', href: '/solutions/reporting-group', desc: 'Multi-entity group compliance' },
  { label: 'Workflow Automation', href: '/solutions/workflow-automation', desc: 'No-code compliance automation' },
]

const industryItems = [
  { label: 'VASPs / Digital Currency Exchanges', href: '/solutions/vasp', icon: Coins },
  { label: 'Remittance Service Providers', href: '/solutions/remittance', icon: Globe },
  { label: 'Bullion Dealers', href: '/solutions/bullion-dealers', icon: Gem },
  { label: 'Real Estate Agents', href: '/solutions/real-estate', icon: Home },
  { label: 'Conveyancers', href: '/solutions/conveyancers', icon: FileCheck },
  { label: 'Legal Professionals', href: '/solutions/legal-professionals', icon: Scale },
  { label: 'Accountants', href: '/solutions/accountants', icon: Calculator },
  { label: 'Precious Metals Dealers', href: '/solutions/precious-metals', icon: Gem },
  { label: 'Pubs, Clubs & Hotels', href: '/solutions/pubs-clubs', icon: Building2 },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [unread, setUnread] = useState(0)
  const router = useRouter()
  const pathname = usePathname()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const user = typeof window !== 'undefined' ? getStoredUser() : null
  const isPublicPage = !pathname.startsWith('/dashboard') && !pathname.startsWith('/customers') &&
    !pathname.startsWith('/onboarding') && !pathname.startsWith('/monitoring') &&
    !pathname.startsWith('/reporting') && !pathname.startsWith('/ecdd') &&
    !pathname.startsWith('/mlro') && !pathname.startsWith('/audit') &&
    !pathname.startsWith('/billing') && !pathname.startsWith('/branding') &&
    !pathname.startsWith('/users') && !pathname.startsWith('/analytics')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/v1/notifications/summary`, {
          credentials: "include",
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

  const toggleDropdown = (name: string) => {
    setActiveDropdown(prev => prev === name ? null : name)
  }

  const handleSignOut = () => {
    clearUser()
    router.push('/login')
  }

  const navBg = isPublicPage
    ? scrolled ? 'bg-white shadow-sm border-b border-slate-200' : 'bg-white/90 backdrop-blur-xl border-b border-slate-100'
    : 'bg-navy-900/95 backdrop-blur-xl border-b border-white/5'

  const linkClass = isPublicPage
    ? 'text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors'
    : 'text-sm text-white/70 hover:text-white transition-colors'

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${navBg}`} ref={dropdownRef}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield style={{ width: '18px', height: '18px' }} className="text-white" />
            </div>
            <span className={`font-bold text-lg ${isPublicPage ? 'text-slate-900' : 'text-white'}`}>
              Veri<span className="text-blue-600">go</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          {isPublicPage && !user ? (
            <div className="hidden lg:flex items-center gap-1">
              <Link href="/" className={`${linkClass} px-3 py-2 rounded-lg hover:bg-slate-50`}>Home</Link>

              {/* Solutions dropdown */}
              <div className="relative flex items-center">
                <Link href="/solutions" className={`${linkClass} px-3 py-2 rounded-lg hover:bg-slate-50`}>
                  Solutions
                </Link>
                <button
                  onClick={() => toggleDropdown('solutions')}
                  aria-label="Toggle solutions menu"
                  className="p-2 rounded-lg hover:bg-slate-50"
                >
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${activeDropdown === 'solutions' ? 'rotate-180' : ''}`} />
                </button>
                {activeDropdown === 'solutions' && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[560px] max-h-[70vh] overflow-y-auto bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 p-5 grid grid-cols-2 gap-1 z-50">
                    <div className="col-span-2 pb-2 mb-2 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Platform Capabilities</p>
                    </div>
                    {solutionItems.map(item => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setActiveDropdown(null)}
                        className="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                        <span className="text-xs text-slate-500">{item.desc}</span>
                      </Link>
                    ))}
                    <div className="col-span-2 pt-2 mt-2 border-t border-slate-100">
                      <Link href="/solutions" onClick={() => setActiveDropdown(null)} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                        View all capabilities →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Industries dropdown */}
              <div className="relative flex items-center">
                <Link href="/industries" className={`${linkClass} px-3 py-2 rounded-lg hover:bg-slate-50`}>
                  Industries
                </Link>
                <button
                  onClick={() => toggleDropdown('industries')}
                  aria-label="Toggle industries menu"
                  className="p-2 rounded-lg hover:bg-slate-50"
                >
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${activeDropdown === 'industries' ? 'rotate-180' : ''}`} />
                </button>
                {activeDropdown === 'industries' && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 max-h-[70vh] overflow-y-auto bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 p-3 z-50">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 pb-2 mb-1 border-b border-slate-100">Industries We Serve</p>
                    {industryItems.map(item => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setActiveDropdown(null)}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <item.icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-900">{item.label}</span>
                      </Link>
                    ))}
                    <div className="pt-2 mt-1 border-t border-slate-100">
                      <Link href="/industries" onClick={() => setActiveDropdown(null)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3">
                        View all industries →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <Link href="/company" className={`${linkClass} px-3 py-2 rounded-lg hover:bg-slate-50`}>Our Company</Link>
              <Link href="/pricing" className={`${linkClass} px-3 py-2 rounded-lg hover:bg-slate-50`}>Pricing</Link>
            </div>
          ) : isPublicPage && user ? (
            <div className="hidden lg:flex items-center gap-6">
              <Link href="/" className={linkClass}>Home</Link>
              <Link href="/pricing" className={linkClass}>Pricing</Link>
              <div className="relative">
                <button
                  onClick={() => toggleDropdown('resources')}
                  className={`flex items-center gap-1 ${linkClass} px-3 py-2 rounded-lg hover:bg-slate-50`}
                >
                  Resources <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'resources' ? 'rotate-180' : ''}`} />
                </button>
                {activeDropdown === 'resources' && (
                  <div className="absolute top-full right-0 mt-2 w-56 max-h-[70vh] overflow-y-auto bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 p-3 z-50">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 pb-2 mb-1 border-b border-slate-100">Subscriber Resources</p>
                    <Link href="/learn" onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                      <BookOpen className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-900">Learning Centre</span>
                    </Link>
                    <Link href="/faq" onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                      <HelpCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-900">FAQ</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-6">
              <Link href="/" className="text-sm text-white/70 hover:text-white transition-colors">Home</Link>
              <Link href="/solutions" className="text-sm text-white/70 hover:text-white transition-colors">Solutions</Link>
              <Link href="/pricing" className="text-sm text-white/70 hover:text-white transition-colors">Pricing</Link>
              <div className="relative">
                <button
                  onClick={() => toggleDropdown('resources')}
                  className="flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors"
                >
                  Resources <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeDropdown === 'resources' ? 'rotate-180' : ''}`} />
                </button>
                {activeDropdown === 'resources' && (
                  <div className="absolute top-full right-0 mt-2 w-56 max-h-[70vh] overflow-y-auto bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 p-3 z-50">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 pb-2 mb-1 border-b border-slate-100">Subscriber Resources</p>
                    <Link href="/learn" onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                      <BookOpen className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-900">Learning Centre</span>
                    </Link>
                    <Link href="/faq" onClick={() => setActiveDropdown(null)} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                      <HelpCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-900">FAQ</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Desktop Right CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <>
                <Link href="/notifications" className="relative p-2 text-slate-500 hover:text-slate-700 transition-colors">
                  <Bell className="w-5 h-5" />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Link>
                <ThemeToggle />
                <Link href="/dashboard" className="pub-btn-primary text-sm py-2 px-4">Dashboard</Link>
                <button onClick={handleSignOut} className="text-sm text-slate-500 hover:text-slate-700 transition-colors">Sign out</button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Sign in</Link>
                <Link href="/start-trial" className="pub-btn-primary text-sm py-2 px-4">Start Free Trial</Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`lg:hidden p-2 rounded-lg ${isPublicPage ? 'text-slate-600 hover:bg-slate-100' : 'text-white/70 hover:bg-white/10'}`}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className={`lg:hidden border-t ${isPublicPage ? 'bg-white border-slate-200' : 'bg-navy-800 border-white/10'} px-4 py-5 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto`}>
          <Link href="/" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">Home</Link>

          <div>
            <p className="px-3 pt-3 pb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Solutions</p>
            {solutionItems.map(item => (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50">{item.label}</Link>
            ))}
          </div>

          <div>
            <p className="px-3 pt-3 pb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Industries</p>
            {industryItems.map(item => (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50">
                <item.icon className="w-4 h-4 text-slate-500 flex-shrink-0" />{item.label}
              </Link>
            ))}
          </div>

          <Link href="/company" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">Our Company</Link>
          <Link href="/pricing" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">Pricing</Link>

          {user && (
            <div>
              <p className="px-3 pt-3 pb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Resources</p>
              <Link href="/learn" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50">
                <BookOpen className="w-4 h-4 text-slate-500 flex-shrink-0" /> Learning Centre
              </Link>
              <Link href="/faq" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50">
                <HelpCircle className="w-4 h-4 text-slate-500 flex-shrink-0" /> FAQ
              </Link>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-4 border-t border-slate-200 mt-4">
            {user ? (
              <>
                <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="pub-btn-primary justify-center">Dashboard</Link>
                <button onClick={handleSignOut} className="pub-btn-secondary justify-center">Sign out</button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)} className="pub-btn-secondary justify-center">Sign in</Link>
                <Link href="/start-trial" onClick={() => setMobileOpen(false)} className="pub-btn-primary justify-center">Start Free Trial</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
