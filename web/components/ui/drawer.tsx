import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Shared right-side detail/edit drawer, extracted from the `<div
 * className="fixed inset-0 bg-black/60 z-50 flex justify-end"
 * onClick={onClose}><div className="w-full max-w-{size} bg-navy-800
 * border-l border-navy-700 h-full overflow-y-auto p-6 space-y-5"
 * onClick={e => e.stopPropagation()}>` pattern duplicated byte-for-byte
 * (modulo the `max-w-*` size) across 8 page files: ecdd, monitoring,
 * monitoring-rules, reporting, rule-builder, governance/calendar,
 * governance/controls, governance/policies. See STRUCTURE_REVIEW.md
 * section C2 for the backlog item this is part of (same item as
 * `badge.tsx`/`table.tsx`).
 *
 * `decision-support.tsx` has two drawers that are *almost* this shape
 * (z-40 not z-50, `bg-black/50` not `/60`, `bg-navy-900` not
 * `navy-800`, no `p-6`) — deliberately not forced into this component;
 * a real variant, not sloppiness, left for a later look rather than
 * guessed at here. A second, structurally different "centered dialog"
 * modal shape also exists across ~6 other files (`users`,
 * `api-integrations`, `documents`, `onboarding`, `aml-program`, and a
 * light-mode outlier in `governance/risk-matrix`) — out of scope for
 * this component entirely.
 */

export type DrawerSize = 'md' | 'lg' | 'xl' | '2xl' | '3xl'

const SIZE_CLASSES: Record<DrawerSize, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
}

export interface DrawerProps {
  onClose: () => void
  size?: DrawerSize
  className?: string
  children: React.ReactNode
}

function Drawer({ onClose, size = 'lg', className, children }: DrawerProps) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={onClose}>
      <div
        className={cn(
          'w-full bg-navy-800 border-l border-navy-700 h-full overflow-y-auto p-6 space-y-5',
          SIZE_CLASSES[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export { Drawer }
