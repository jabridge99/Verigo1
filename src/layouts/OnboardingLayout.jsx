import React from 'react'
import { Outlet, Link } from 'react-router-dom'
import { Leaf } from 'lucide-react'

export default function OnboardingLayout() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-100 px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-eco-700 rounded-lg flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-lg text-slate-900 tracking-tight">CirclLoop</span>
        </Link>
        <Link to="/" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
          Back to home
        </Link>
      </header>
      <main className="flex-1 flex items-start justify-center py-10 px-4">
        <Outlet />
      </main>
    </div>
  )
}
