import React from 'react'
import { Link } from 'react-router-dom'
import { Leaf } from 'lucide-react'

const LINKS = {
  Platform: [
    'How It Works',
    'Find a Collection Zone',
    'Deposit & Recover Value',
    'Eco Rewards Marketplace',
  ],
  Community: [
    'Household Recycling Circle',
    'Impact Reports',
    'Referral Program',
    'Blog',
  ],
  Operators: [
    'Operator Partner Program',
    'SME Solutions',
    'Enterprise & Councils',
    'API & Integrations',
  ],
  Company: ['About CirclLoop', 'Careers', 'Press', 'Contact'],
}

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <a href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-eco-700 rounded-lg flex items-center justify-center">
                <Leaf className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-white text-lg tracking-tight">CirclLoop</span>
            </a>
            <p className="text-sm leading-relaxed">
              Australia's smart recovery ecosystem. Deposit materials, recover value, close the loop.
            </p>
            <div className="flex gap-2 mt-5">
              {[
                { label: 'Consumer', to: '/consumer',  dot: 'bg-eco-500' },
                { label: 'Operator', to: '/operator',  dot: 'bg-indigo-500' },
                { label: 'Admin',    to: '/admin',     dot: 'bg-violet-500' },
              ].map(p => (
                <Link
                  key={p.to}
                  to={p.to}
                  className="flex items-center gap-1.5 text-[11px] font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                  {p.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([heading, items]) => (
            <div key={heading}>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">
                {heading}
              </div>
              <ul className="space-y-2.5">
                {items.map(item => (
                  <li key={item}>
                    <a href="#" className="text-sm hover:text-white transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 mt-14 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p>© {new Date().getFullYear()} CirclLoop Pty Ltd. All rights reserved. Australia.</p>
          <div className="flex gap-6">
            {['Privacy Policy', 'Terms of Service', 'Accessibility'].map(l => (
              <a key={l} href="#" className="hover:text-white transition-colors">
                {l}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
