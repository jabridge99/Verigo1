import React from 'react'
import { Leaf } from 'lucide-react'

const LINKS = {
  Product: [
    'How It Works',
    'Find a Station',
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
  Company: ['About EcoBin', 'Careers', 'Press', 'Contact'],
}

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <a href="#" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-eco-700 rounded-lg flex items-center justify-center">
                <Leaf className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-white text-lg tracking-tight">EcoBin</span>
            </a>
            <p className="text-sm leading-relaxed">
              Australia's smart recycling network. Deposit materials, recover value, build a circular economy.
            </p>
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
          <p>© {new Date().getFullYear()} EcoBin Pty Ltd. All rights reserved.</p>
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
