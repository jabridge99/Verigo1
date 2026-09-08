'use client'

import Link from 'next/link'
import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'

export default function Tranche2Banner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const deadline = new Date('2026-07-01')
  const now = new Date()
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const past = daysLeft <= 0

  if (past) return null

  return (
    <div className="relative z-50 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm font-semibold truncate">
            <span className="hidden sm:inline">Tranche 2 AML obligations kick in </span>
            <span className="font-black">1 July 2026</span>
            <span className="hidden sm:inline"> — {daysLeft} days left.</span>
            {' '}Law firms, accountants &amp; real estate agents must comply.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link
            href="/solutions/legal"
            className="hidden sm:inline-flex items-center rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1 text-xs font-bold transition-colors"
          >
            Am I affected?
          </Link>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="p-1 rounded hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
