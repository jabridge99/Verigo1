'use client'
import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, ArrowRight, Shield, Phone } from 'lucide-react'
import { industries, CUSTOM_PACKAGE_INDUSTRIES, type IndustryId } from '@/lib/industries'

export default function StartTrialForm() {
  const [selectedIndustry, setSelectedIndustry] = useState('')
  const needsCustomPackage = CUSTOM_PACKAGE_INDUSTRIES.has(selectedIndustry as IndustryId)

  return (
    <div className="grid md:grid-cols-2 gap-16 items-start">
      {/* Left column */}
      <div>
        <span className="pub-label mb-6 block w-fit">7-Day Free Trial</span>
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-5">
          Start compliant<br />today.
        </h1>
        <p className="text-slate-600 leading-relaxed mb-8">
          Full access to all features. No credit card required. Your industry compliance pack is loaded and configured on day one.
        </p>
        <ul className="space-y-3 mb-10">
          {[
            'Industry compliance pack configured on day one',
            'Customer onboarding and KYC/KYB workflows ready',
            'IFTI, SMR, and TTR report templates pre-loaded',
            'Sanctions and PEP screening enabled immediately',
            'Onboarding support included with every trial',
          ].map(f => (
            <li key={f} className="flex items-start gap-3 text-sm text-slate-700">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> {f}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 bg-blue-50 rounded-2xl p-4">
          <Shield className="w-8 h-8 text-blue-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-slate-900 text-sm">Australian data hosting</p>
            <p className="text-slate-500 text-xs">All data stored in Australia. AES-256 encryption.</p>
          </div>
        </div>
      </div>

      {/* Right column — form */}
      <div className="pub-card">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Create your account</h2>
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">First name</label>
              <input type="text" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Jane" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Last name</label>
              <input type="text" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Smith" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Work email</label>
            <input type="email" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="jane@company.com.au" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Company name</label>
            <input type="text" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Acme Pty Ltd" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Industry</label>
            <select
              value={selectedIndustry}
              onChange={e => setSelectedIndustry(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Select your industry</option>
              {industries.map(i => (
                <option key={i.id} value={i.id}>
                  {i.label}{i.regime === 'expanded' ? ' (Tranche 2 — 2026)' : ''}
                </option>
              ))}
            </select>
          </div>

          {needsCustomPackage ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <p className="font-semibold text-amber-900 text-sm mb-1.5">This industry needs a custom package</p>
              <p className="text-amber-800 text-xs leading-relaxed mb-4">
                Businesses in this sector have AML/CTF obligations that require a tailored setup. Our team will configure your compliance pack, pricing, and onboarding directly — no self-serve trial is available for this industry.
              </p>
              <Link href="/contact" className="pub-btn-primary w-full justify-center py-2.5 text-sm">
                Contact us for a custom package <Phone className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <input type="password" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Minimum 12 characters" />
              </div>
              <button type="submit" className="pub-btn-primary w-full justify-center py-3">
                Create Account & Start Trial <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          <p className="text-slate-400 text-xs text-center">
            By creating an account you agree to our{' '}
            <Link href="#" className="underline hover:text-slate-600">Terms of Service</Link>{' '}
            and{' '}
            <Link href="#" className="underline hover:text-slate-600">Privacy Policy</Link>.
          </p>
        </form>
      </div>
    </div>
  )
}
