'use client'
import Link from 'next/link'
import { CheckCircle, Users, Activity, FileText, ShieldCheck } from 'lucide-react'
import { useComplianceStats } from '@/lib/complianceStats'

export default function ComplianceJourney() {
  const stats = useComplianceStats()

  const stages = [
    { key: 'setup', label: 'Org Setup', icon: ShieldCheck, href: '/onboarding-setup', done: true },
    { key: 'onboarding', label: 'Customer Onboarding', icon: Users, href: '/onboarding?status=pending', count: stats.pending_kyc },
    { key: 'monitoring', label: 'Transaction Monitoring', icon: Activity, href: '/monitoring?filter=open', count: stats.open_alerts },
    { key: 'reporting', label: 'Reporting', icon: FileText, href: '/reporting?status=draft', count: stats.pending_reports },
    { key: 'governance', label: 'Governance', icon: CheckCircle, href: '/audit', done: true },
  ]

  return (
    <div className="flex items-center gap-2 px-4 sm:px-6 lg:px-8 py-2 border-b border-white/5 bg-navy-900/40 overflow-x-auto">
      {stages.map((s, i) => {
        const Icon = s.icon
        const attention = !s.done && (s.count ?? 0) > 0
        return (
          <div key={s.key} className="flex items-center gap-2 shrink-0">
            <Link
              href={s.href}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                attention
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                  : 'border-white/5 text-white/50 hover:text-white hover:border-white/15'
              }`}
            >
              <Icon className={s.done ? 'w-3.5 h-3.5 text-emerald-400' : 'w-3.5 h-3.5'} />
              {s.label}
              {!s.done && <span className="font-semibold">{s.count}</span>}
            </Link>
            {i < stages.length - 1 && <span className="text-white/15">→</span>}
          </div>
        )
      })}
    </div>
  )
}
