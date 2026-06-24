'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronRight, ArrowLeft, Home } from 'lucide-react'
import { ROUTE_LABELS } from '@/lib/navigation'

function labelFor(segment: string): string {
  if (ROUTE_LABELS[segment]) return ROUTE_LABELS[segment]
  // UUID/id-like segments — show a generic "Details" crumb instead of the raw id
  if (/^[0-9a-f-]{8,}$/i.test(segment) || /^\d+$/.test(segment)) return 'Details'
  return segment
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default function Breadcrumbs() {
  const pathname = usePathname()
  const router = useRouter()
  const segments = pathname.split('/').filter(Boolean)

  const crumbs = segments.map((seg, idx) => ({
    label: labelFor(seg),
    href: '/' + segments.slice(0, idx + 1).join('/'),
  }))

  return (
    <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-3 border-b border-white/5 bg-navy-900/60">
      <button
        onClick={() => router.back()}
        aria-label="Go back"
        className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors flex-shrink-0"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
      <span className="w-px h-4 bg-white/10 flex-shrink-0" />
      <nav className="flex items-center gap-1.5 text-sm min-w-0 overflow-x-auto whitespace-nowrap">
        <Link href="/dashboard" className="text-white/50 hover:text-white transition-colors flex items-center gap-1">
          <Home className="w-3.5 h-3.5" />
        </Link>
        {crumbs.map((c, idx) => (
          <span key={c.href} className="flex items-center gap-1.5">
            <ChevronRight className="w-3.5 h-3.5 text-white/30" />
            {idx === crumbs.length - 1 ? (
              <span className="text-white font-medium">{c.label}</span>
            ) : (
              <Link href={c.href} className="text-white/50 hover:text-white transition-colors">
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
    </div>
  )
}
