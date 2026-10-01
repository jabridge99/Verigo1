import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Shared status/role pill, extracted from the STATUS_COLOR/ROLE_COLOR
 * pattern duplicated across ~19 page files (each with its own local
 * color map and inline `<span className={clsx(...)}>`). See
 * STRUCTURE_REVIEW.md section C2 for the backlog item this closes the
 * first increment of.
 *
 * `tone` covers the real palette in use across those files (surveyed
 * before building this, not guessed) — add a new tone only if an actual
 * page needs a color genuinely outside this set, rather than one-off
 * hex/shade variations (several pre-existing pages used slightly
 * different shades for what was clearly the same semantic color; this
 * component intentionally normalises those during migration).
 */
export type BadgeTone =
  | 'neutral'
  | 'muted'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'teal'
  | 'purple'
  | 'orange'
  | 'sky'

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-500/20 text-slate-300',
  // The "archived"/"inactive" darker look several pages hand-rolled
  // with slightly different slate shades — normalised to one here.
  muted: 'bg-slate-600/20 text-slate-500',
  info: 'bg-brand-500/20 text-brand-300',
  success: 'bg-emerald-500/20 text-emerald-300',
  warning: 'bg-amber-500/20 text-amber-300',
  danger: 'bg-red-500/20 text-red-300',
  teal: 'bg-teal-500/20 text-teal-300',
  purple: 'bg-purple-500/20 text-purple-300',
  orange: 'bg-orange-500/20 text-orange-300',
  sky: 'bg-sky-500/20 text-sky-300',
}

const TONE_BORDER_CLASSES: Record<BadgeTone, string> = {
  neutral: 'border border-slate-500/30',
  muted: 'border border-slate-600/30',
  info: 'border border-brand-500/30',
  success: 'border border-emerald-500/30',
  warning: 'border border-amber-500/30',
  danger: 'border border-red-500/30',
  teal: 'border border-teal-500/30',
  purple: 'border border-purple-500/30',
  orange: 'border border-orange-500/30',
  sky: 'border border-sky-500/30',
}

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1.5 text-sm',
} as const

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  size?: keyof typeof SIZE_CLASSES
  /** Adds the `border border-{tone}-500/30` ring some pages use (industry, dashboard, users). */
  bordered?: boolean
  /** Prevents wrapping — needed by a few pages whose badge sits in a tight flex row. */
  nowrap?: boolean
  /** Most existing usage lowercases the raw status/role string and capitalizes via CSS; disable for labels that are already cased. */
  capitalize?: boolean
  icon?: React.ReactNode
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      tone = 'neutral',
      size = 'sm',
      bordered = false,
      nowrap = false,
      capitalize = true,
      icon,
      children,
      ...props
    },
    ref
  ) => (
    <span
      ref={ref}
      className={cn(
        'rounded-full font-medium',
        icon ? 'inline-flex items-center gap-1' : 'inline-block',
        SIZE_CLASSES[size],
        TONE_CLASSES[tone],
        bordered && TONE_BORDER_CLASSES[tone],
        nowrap && 'whitespace-nowrap',
        capitalize && 'capitalize',
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  )
)
Badge.displayName = 'Badge'

export { Badge }
