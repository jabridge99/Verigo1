'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Search, X } from 'lucide-react'
import { NAV_GROUPS, TOP_LINK } from '@/lib/navigation'

const STORAGE_KEY = 'verigo:sidebar-collapsed'

export default function Sidebar() {
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [hydrated, setHydrated] = useState(false)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const groupHasActive = (items: { href: string }[]) => items.some(i => isActive(i.href))

  // Seed collapse state from each group's defaultOpen, then restore any
  // user override from a previous session.
  useEffect(() => {
    const seeded: Record<string, boolean> = {}
    NAV_GROUPS.forEach(g => { seeded[g.label] = !g.defaultOpen })
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      setCollapsedGroups({ ...seeded, ...stored })
    } catch {
      setCollapsedGroups(seeded)
    }
    setHydrated(true)
  }, [])

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const next = { ...prev, [label]: !prev[label] }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const normalizedQuery = query.trim().toLowerCase()
  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) return NAV_GROUPS
    return NAV_GROUPS
      .map(group => ({
        ...group,
        items: group.items.filter(i => i.label.toLowerCase().includes(normalizedQuery)),
      }))
      .filter(group => group.items.length > 0)
  }, [normalizedQuery])

  if (!hydrated) return <aside className="hidden lg:block fixed left-0 top-16 bottom-0 w-64 border-r border-white/5 bg-navy-900/95 z-40" />

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-16 bottom-0 w-64 border-r border-white/5 bg-navy-900/95 backdrop-blur-xl z-40">
      <div className="px-3 pt-4 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search modules..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-7 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-brand-400/50"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-1 px-3 space-y-1">
        <Link
          href={TOP_LINK.href}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-2 ${
            isActive(TOP_LINK.href)
              ? 'bg-brand-600/15 text-brand-400'
              : 'text-white/70 hover:text-white hover:bg-white/5'
          }`}
        >
          <TOP_LINK.icon className="w-4 h-4" />
          {TOP_LINK.label}
        </Link>

        {filteredGroups.length === 0 && (
          <p className="px-3 py-4 text-sm text-white/40">No modules match "{query}".</p>
        )}

        {filteredGroups.map(group => {
          const active = groupHasActive(group.items)
          const collapsed = normalizedQuery ? false : (collapsedGroups[group.label] ?? !group.defaultOpen) && !active
          const GroupIcon = group.icon
          return (
            <div key={group.label} className="mb-1">
              <button
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                  active ? 'text-brand-400' : 'text-white/40 hover:text-white/70'
                }`}
              >
                <span className="flex items-center gap-2">
                  <GroupIcon className="w-3.5 h-3.5" />
                  {group.label}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
              </button>
              {!collapsed && (
                <div className="mt-0.5 space-y-0.5">
                  {group.items.map(item => {
                    const itemActive = isActive(item.href)
                    const ItemIcon = item.icon
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-2.5 px-3 py-2 ml-2 rounded-lg text-sm transition-colors border-l-2 ${
                          itemActive
                            ? 'bg-brand-600/15 text-brand-400 border-brand-400 font-medium'
                            : 'text-white/60 hover:text-white hover:bg-white/5 border-transparent'
                        }`}
                      >
                        <ItemIcon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
