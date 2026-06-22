'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { NAV_GROUPS } from '@/lib/navigation'

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const groupHasActive = (items: { href: string }[]) => items.some(i => isActive(i.href))

  const toggleGroup = (label: string) =>
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }))

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-16 bottom-0 w-64 border-r border-white/5 bg-navy-900/95 backdrop-blur-xl overflow-y-auto z-40">
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_GROUPS.map(group => {
          const active = groupHasActive(group.items)
          const collapsed = collapsedGroups[group.label] ?? false
          return (
            <div key={group.label} className="mb-1">
              <button
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                  active ? 'text-brand-400' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {group.label}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
              </button>
              {!collapsed && (
                <div className="mt-0.5 space-y-0.5">
                  {group.items.map(item => {
                    const itemActive = isActive(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block px-3 py-2 ml-2 rounded-lg text-sm transition-colors border-l-2 ${
                          itemActive
                            ? 'bg-brand-600/15 text-brand-400 border-brand-400 font-medium'
                            : 'text-white/60 hover:text-white hover:bg-white/5 border-transparent'
                        }`}
                      >
                        {item.label}
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
