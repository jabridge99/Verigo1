'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Shield, Users, FileText, BarChart3,
  Building2, Scale, BookOpen, ChevronRight, LogOut,
  CheckCircle, Clock, ArrowUp, ArrowDown
} from 'lucide-react'
import clsx from 'clsx'
import { getStoredUser, clearUser } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const ROLE_COLOR: Record<string, string> = {
  admin:      'bg-red-500/20 text-red-300 border border-red-500/30',
  mlro:       'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  compliance: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
  analyst:    'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  viewer:     'bg-slate-500/20 text-slate-300 border border-slate-500/30',
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator', mlro: 'MLRO', compliance: 'Compliance Officer',
  analyst: 'AML Analyst', viewer: 'Read-Only Viewer',
}

interface DashboardModule {
  title: string
  desc: string
  href: string
  icon: React.ReactNode
  color: string
  roles: string[]
  badge?: string
}

const MODULES: DashboardModule[] = [
  { title: 'Customers', desc: 'Customer risk profiles, KYC status, and AML exposure overview.', href: '/customers', icon: <Users className="w-6 h-6" />, color: 'text-blue-400 bg-blue-900/20', roles: ['viewer', 'analyst', 'compliance', 'mlro', 'admin'] },
  { title: 'Onboarding', desc: 'Bulk import, applicant pipeline, onboarding link management.', href: '/onboarding', icon: <CheckCircle className="w-6 h-6" />, color: 'text-emerald-400 bg-emerald-900/20', roles: ['analyst', 'compliance', 'mlro', 'admin'] },
  { title: 'Transaction Monitoring', desc: 'AML alerts, velocity analysis, and suspicious transaction review.', href: '/monitoring', icon: <BarChart3 className="w-6 h-6" />, color: 'text-amber-400 bg-amber-900/20', roles: ['viewer', 'analyst', 'compliance', 'mlro', 'admin'] },
  { title: 'Reporting', desc: 'AUSTRAC TTR, IFTI, SMR report preparation and submission workflow.', href: '/reporting', icon: <FileText className="w-6 h-6" />, color: 'text-green-400 bg-green-900/20', roles: ['analyst', 'compliance', 'mlro', 'admin'] },
  { title: 'ECDD', desc: 'Enhanced Customer Due Diligence assessments and risk scoring.', href: '/ecdd', icon: <Shield className="w-6 h-6" />, color: 'text-brand-400 bg-brand-900/20', roles: ['analyst', 'compliance', 'mlro', 'admin'] },
  { title: 'AML/CTF Program', desc: 'Version history, QR verification, and export audit trail for your AML program.', href: '/aml-program', icon: <CheckCircle className="w-6 h-6" />, color: 'text-cyan-400 bg-cyan-900/20', roles: ['analyst', 'compliance', 'mlro', 'admin'] },
  { title: 'MLRO Dashboard', desc: 'Case management, obligation calendar, and compliance KPIs.', href: '/mlro', icon: <Scale className="w-6 h-6" />, color: 'text-purple-400 bg-purple-900/20', roles: ['compliance', 'mlro', 'admin'], badge: 'MLRO' },
  { title: 'Audit Trail', desc: 'Immutable compliance log — all actions, changes, and reviews.', href: '/audit', icon: <BookOpen className="w-6 h-6" />, color: 'text-slate-400 bg-slate-900/20', roles: ['analyst', 'compliance', 'mlro', 'admin'] },
  { title: 'Industry Management', desc: 'Multi-tenant configuration, compliance pack assignment, tenant status.', href: '/industry', icon: <Building2 className="w-6 h-6" />, color: 'text-rose-400 bg-rose-900/20', roles: ['admin'] },
]

const DEMO_STATS = {
  open_alerts: 7,
  pending_reports: 3,
  pending_kyc: 12,
  open_cases: 4,
  customers_total: 284,
  compliance_score: 94,
}

// Week-over-week deltas shown as trend indicators on each KPI card.
const DEMO_TRENDS: Record<string, number> = {
  open_alerts: 2, pending_reports: -1, pending_kyc: 4, open_cases: 0, customers_total: 18, compliance_score: 1,
}

// 7-day alert volume, used for the sparkline next to "Open Alerts".
const DEMO_ALERT_TREND = [3, 5, 4, 6, 5, 8, 7]

// Risk heat map: customer count by industry x risk level.
const DEMO_HEATMAP: { industry: string; low: number; medium: number; high: number; critical: number }[] = [
  { industry: 'VASP / Crypto', low: 12, medium: 18, high: 9, critical: 4 },
  { industry: 'Remittance', low: 28, medium: 14, high: 5, critical: 1 },
  { industry: 'Real Estate', low: 9, medium: 11, high: 7, critical: 2 },
  { industry: 'Legal / Accounting', low: 22, medium: 6, high: 2, critical: 0 },
]

const HEAT_COLOR = (count: number) => {
  if (count === 0) return 'bg-navy-800 text-white/20'
  if (count <= 5) return 'bg-emerald-500/20 text-emerald-300'
  if (count <= 12) return 'bg-amber-500/25 text-amber-300'
  if (count <= 20) return 'bg-orange-500/30 text-orange-300'
  return 'bg-red-500/35 text-red-300'
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [stats, setStats] = useState(DEMO_STATS)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) {
      router.replace('/login')
      return
    }
    setUser(stored)

    // Try to fetch live stats
    Promise.allSettled([
      fetch(`${API}/api/v1/alerts`, { credentials: 'include' }),
    ]).catch(() => {})
  }, [router])

  function logout() {
    clearUser()
    router.replace('/login')
  }

  if (!user) return null

  const visibleModules = MODULES.filter(m => m.roles.includes(user.role))

  return (
    <main className="min-h-screen bg-navy-950 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">Welcome back, {user.full_name.split(' ')[0]}</h1>
              <span className={clsx('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold', ROLE_COLOR[user.role])}>
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
            </div>
            <p className="text-sm text-white/40">{user.email}{user.industry_id ? ` · ${user.industry_id}` : ''}</p>
          </div>
          <button onClick={logout} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-800 border border-white/5 text-white/60 hover:text-white text-sm transition-colors">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>

        {/* KPI bar — every widget drills down into its filtered list, with week-over-week trend */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { key: 'open_alerts', label: 'Open Alerts', value: stats.open_alerts, color: 'text-red-400', urgent: stats.open_alerts > 5, href: '/monitoring?filter=open', goodDirection: 'down' as const },
            { key: 'pending_reports', label: 'Pending Reports', value: stats.pending_reports, color: 'text-amber-400', urgent: stats.pending_reports > 0, href: '/reporting?status=draft', goodDirection: 'down' as const },
            { key: 'pending_kyc', label: 'Pending KYC', value: stats.pending_kyc, color: 'text-blue-400', urgent: false, href: '/onboarding?status=pending', goodDirection: 'down' as const },
            { key: 'open_cases', label: 'Open Cases', value: stats.open_cases, color: 'text-purple-400', urgent: stats.open_cases > 3, href: '/mlro?status=open', goodDirection: 'down' as const },
            { key: 'customers_total', label: 'Customers', value: stats.customers_total, color: 'text-white', urgent: false, href: '/customers', goodDirection: 'up' as const },
            { key: 'compliance_score', label: 'Compliance Score', value: `${stats.compliance_score}%`, color: 'text-emerald-400', urgent: false, href: '/aml-program', goodDirection: 'up' as const },
          ].map(s => {
            const delta = DEMO_TRENDS[s.key] ?? 0
            const isGood = delta === 0 ? null : (s.goodDirection === 'up' ? delta > 0 : delta < 0)
            return (
              <Link key={s.label} href={s.href}
                className={clsx('bg-navy-800 border rounded-xl p-4 hover:border-brand-500/40 transition-colors', s.urgent ? 'border-red-500/30' : 'border-white/5')}>
                <div className="flex items-baseline justify-between gap-2">
                  <div className={clsx('text-2xl font-bold', s.color)}>{s.value}</div>
                  {delta !== 0 && (
                    <span className={clsx('flex items-center gap-0.5 text-[11px] font-semibold', isGood ? 'text-emerald-400' : 'text-red-400')}>
                      {delta > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      {Math.abs(delta)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/40 mt-1 leading-tight">{s.label}</div>
              </Link>
            )
          })}
        </div>

        {/* Trend + risk heat map */}
        <div className="grid lg:grid-cols-3 gap-4 mb-10">
          <Link href="/monitoring?filter=open" className="lg:col-span-1 bg-navy-800 border border-white/5 hover:border-brand-500/40 rounded-xl p-4 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Alert volume · 7 days</h3>
              <span className="text-xs text-red-400 font-semibold">+{DEMO_ALERT_TREND[DEMO_ALERT_TREND.length - 1] - DEMO_ALERT_TREND[0]} this week</span>
            </div>
            <div className="flex items-end gap-1.5 h-16">
              {DEMO_ALERT_TREND.map((v, i) => (
                <div key={i} className="flex-1 bg-red-500/30 rounded-t" style={{ height: `${(v / Math.max(...DEMO_ALERT_TREND)) * 100}%` }} />
              ))}
            </div>
          </Link>

          <div className="lg:col-span-2 bg-navy-800 border border-white/5 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Risk heat map — customers by industry</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/40">
                    <th className="text-left font-medium pb-2 pr-2">Industry</th>
                    <th className="font-medium pb-2 px-2">Low</th>
                    <th className="font-medium pb-2 px-2">Medium</th>
                    <th className="font-medium pb-2 px-2">High</th>
                    <th className="font-medium pb-2 px-2">Critical</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_HEATMAP.map(row => (
                    <tr key={row.industry}>
                      <td className="py-1 pr-2 text-white/70 whitespace-nowrap">{row.industry}</td>
                      {(['low', 'medium', 'high', 'critical'] as const).map(level => (
                        <td key={level} className="py-1 px-2">
                          <Link href={`/customers?risk=${level}`} className={clsx('block text-center rounded py-1.5 font-semibold hover:opacity-80 transition-opacity', HEAT_COLOR(row[level]))}>
                            {row[level]}
                          </Link>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Quick actions for MLRO/admin */}
        {(user.role === 'mlro' || user.role === 'admin') && (
          <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-300 mb-2">Compliance actions required</p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/reporting" className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs hover:bg-amber-500/30 transition-colors">
                    {stats.pending_reports} reports pending approval
                  </Link>
                  <Link href="/monitoring" className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs hover:bg-red-500/30 transition-colors">
                    {stats.open_alerts} open AML alerts
                  </Link>
                  <Link href="/mlro" className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 text-xs hover:bg-purple-500/30 transition-colors">
                    View MLRO dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Module grid */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">Your modules</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleModules.map(m => (
              <Link key={m.href} href={m.href}
                className="group bg-navy-800 border border-white/5 hover:border-brand-500/40 rounded-xl p-5 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center', m.color)}>
                    {m.icon}
                  </div>
                  <div className="flex items-center gap-2">
                    {m.badge && <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">{m.badge}</span>}
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-brand-400 transition-colors" />
                  </div>
                </div>
                <h3 className="font-semibold text-white mb-1">{m.title}</h3>
                <p className="text-xs text-white/50 leading-relaxed">{m.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* RBAC notice for limited roles */}
        {user.role === 'viewer' && (
          <div className="flex items-start gap-3 p-4 bg-navy-800 border border-white/5 rounded-xl">
            <Shield className="w-5 h-5 text-white/30 shrink-0 mt-0.5" />
            <p className="text-sm text-white/40">You have read-only access. Contact your administrator to request additional permissions.</p>
          </div>
        )}
      </div>
    </main>
  )
}
