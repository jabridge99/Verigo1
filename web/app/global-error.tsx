'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body className="min-h-screen bg-[#060d1a] text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-slate-400 text-sm">
            An unexpected error occurred. Our team has been notified.
          </p>
        </div>
      </body>
    </html>
  )
}
