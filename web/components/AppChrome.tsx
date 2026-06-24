'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getStoredUser } from '@/lib/auth'
import { isAppRoute } from '@/lib/navigation'
import Sidebar from '@/components/Sidebar'
import Breadcrumbs from '@/components/Breadcrumbs'
import ComplianceJourney from '@/components/ComplianceJourney'
import GlobalQuickActions from '@/components/GlobalQuickActions'

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    setAuthed(!!getStoredUser())
  }, [pathname])

  const showAppChrome = authed && isAppRoute(pathname)

  if (!showAppChrome) {
    return <main className="pt-16">{children}</main>
  }

  return (
    <div className="pt-16">
      <Sidebar />
      <GlobalQuickActions />
      <div className="lg:pl-64">
        <Breadcrumbs />
        <ComplianceJourney />
        <main>{children}</main>
      </div>
    </div>
  )
}
