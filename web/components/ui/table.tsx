import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Shared data-table shell, extracted from the `<table className="w-full
 * text-sm">` / `<thead className="bg-navy-800 border-b border-navy-700">`
 * / `<tr className="border-b border-navy-800 hover:bg-navy-800/40
 * cursor-pointer transition-colors">` pattern duplicated byte-for-byte
 * across ~11 page files. See STRUCTURE_REVIEW.md section C2 for the
 * backlog item this is part of (same item as `badge.tsx`).
 *
 * Surveyed, not guessed: this is the dominant shell shared by the
 * surveyed candidates (ecdd, monitoring-rules, mlro, monitoring,
 * decision-support, reporting, rule-builder, governance/policies,
 * governance/controls, governance/calendar, governance/training). At
 * least 3 other distinct table shells exist elsewhere (`users.tsx`'s
 * `white/`-opacity variant, `security.tsx`/`retention.tsx`'s
 * `text-gray-500` + hex-border variant, and the public marketing pages'
 * light-mode tables) — deliberately out of scope here, not migrated.
 */

const Table = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <table ref={ref} className={cn('w-full text-sm', className)} {...props} />
  )
)
Table.displayName = 'Table'

const TableHead = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('bg-navy-800 border-b border-navy-700', className)} {...props} />
  )
)
TableHead.displayName = 'TableHead'

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={className} {...props} />
)
TableBody.displayName = 'TableBody'

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** The hover/cursor-pointer treatment every surveyed clickable row uses. Set false for a non-clickable row. */
  interactive?: boolean
}

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, interactive = true, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b border-navy-800 transition-colors',
        interactive && 'hover:bg-navy-800/40 cursor-pointer',
        className
      )}
      {...props}
    />
  )
)
TableRow.displayName = 'TableRow'

const TableHeaderCell = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th ref={ref} className={cn('text-left px-4 py-3 text-slate-400 font-medium', className)} {...props} />
  )
)
TableHeaderCell.displayName = 'TableHeaderCell'

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <td ref={ref} className={cn('px-4 py-3', className)} {...props} />
)
TableCell.displayName = 'TableCell'

/** The `colSpan`-wide "No records found" / "Loading…" placeholder row every surveyed table used. */
function TableEmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-12 text-slate-500">
        {children}
      </td>
    </tr>
  )
}

export { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, TableEmptyRow }
