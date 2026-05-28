import React, { useState } from 'react'
import { CheckCircle, Upload, Shield, Package, Leaf, ArrowRight } from 'lucide-react'
import { MERCHANTS, PLATFORM_FEE_PCT } from '../../data/marketplace'

const MERCHANT = MERCHANTS[0]

const STEPS = [
  { id: 'business',  label: 'Business Details',            icon: Shield },
  { id: 'creds',     label: 'Sustainability Credentials',  icon: Leaf },
  { id: 'agreement', label: 'Platform Agreement',          icon: CheckCircle },
  { id: 'listing',   label: 'First Listing',               icon: Package },
]

const CERT_OPTIONS = [
  'BCorp Certified', 'ISO 14001', 'ISO 50001', 'Responsible Recycling R2',
  '1% for the Planet', 'Rainforest Alliance', 'Carbon Neutral Certified',
  'Clean Energy Council', 'ACO Certified Organic', 'Fashion Revolution Verified',
  'Textile Exchange', 'Zero Waste Australia',
]

const CATEGORY_OPTIONS = ['electronics', 'lifestyle', 'food', 'transport', 'home']

export default function Onboarding() {
  const [step, setStep] = useState(3)  // show completed state for demo merchant
  const [complete, setComplete] = useState(true)
  const [form, setForm] = useState({
    business_name: MERCHANT.name,
    abn: '83 142 667 013',
    category: MERCHANT.category,
    location: MERCHANT.location,
    website: 'thegreencycle.com.au',
    description: MERCHANT.description,
    certs: MERCHANT.certifications,
    bcorp: false,
    sustainability_statement: '',
    agreed_fees: true,
    agreed_terms: true,
    agreed_eco: true,
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleCert = cert => set('certs', form.certs.includes(cert) ? form.certs.filter(c => c !== cert) : [...form.certs, cert])

  if (complete) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Profile & Verification</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your merchant account and sustainability credentials</p>
        </div>

        {/* Verified banner */}
        <div className="bg-eco-600 rounded-2xl px-5 py-5 flex items-center gap-4">
          <CheckCircle className="w-10 h-10 text-white flex-shrink-0" />
          <div>
            <p className="font-bold text-white text-lg">Verified Green Merchant</p>
            <p className="text-eco-100 text-sm mt-0.5">Your account is fully verified. All listings are live on the EcoBin Rewards Marketplace.</p>
          </div>
        </div>

        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 ${MERCHANT.logo_color} rounded-2xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0`}>
              {MERCHANT.initials}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{MERCHANT.name}</h2>
              <p className="text-sm text-slate-500">{MERCHANT.tagline}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-slate-400">{MERCHANT.location}</span>
                <span className="text-slate-300">·</span>
                <span className="text-[11px] text-slate-400">Joined {MERCHANT.joined}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              { label: 'Sustainability Score', value: `${MERCHANT.sustainability_score}/100`, color: 'text-eco-700' },
              { label: 'Active Listings',      value: MERCHANT.active_listings, color: 'text-slate-700' },
              { label: 'Total Redemptions',    value: MERCHANT.total_redemptions.toLocaleString(), color: 'text-violet-700' },
              { label: 'Platform Fee',         value: `${MERCHANT.platform_fee_pct}%`, color: 'text-amber-700' },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 rounded-xl p-3">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Certifications</p>
            <div className="flex flex-wrap gap-2">
              {MERCHANT.certifications.map(c => (
                <span key={c} className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 bg-eco-50 text-eco-700 border border-eco-100 rounded-full">
                  <CheckCircle className="w-3 h-3" /> {c}
                </span>
              ))}
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed">{MERCHANT.description}</p>
        </div>

        {/* Platform agreement summary */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-bold text-slate-900 mb-3">Platform Agreement</h3>
          <div className="space-y-2">
            {[
              { check: true, text: `${PLATFORM_FEE_PCT}% platform fee on all points redemptions — deducted from your payout` },
              { check: true, text: 'All listings reviewed by EcoBin for sustainability compliance' },
              { check: true, text: 'Sustainability claims must be verifiable and supported by certification' },
              { check: true, text: 'Merchant agrees to honour all redeemed vouchers and products' },
              { check: true, text: 'EcoBin Eco Rewards Marketplace terms of service v2.4' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-eco-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Merchant Onboarding</h1>
        <p className="text-sm text-slate-500 mt-0.5">Complete these 4 steps to go live on the EcoBin Rewards Marketplace</p>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const done = i < step
          const current = i === step
          return (
            <React.Fragment key={s.id}>
              <div className={`flex flex-col items-center gap-1 flex-1 ${i > step ? 'opacity-40' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  done ? 'bg-eco-500 border-eco-500' : current ? 'border-eco-500 bg-white' : 'border-slate-200 bg-white'
                }`}>
                  {done ? <CheckCircle className="w-4 h-4 text-white" /> : <Icon className={`w-4 h-4 ${current ? 'text-eco-600' : 'text-slate-400'}`} />}
                </div>
                <p className={`text-[9px] font-semibold text-center leading-tight ${current ? 'text-eco-600' : done ? 'text-eco-500' : 'text-slate-400'}`}>{s.label}</p>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 max-w-8 ${i < step ? 'bg-eco-500' : 'bg-slate-200'}`} />}
            </React.Fragment>
          )
        })}
      </div>

      {/* Step 1: Business Details */}
      {step === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-slate-900">Business Details</h2>
          {[
            { key: 'business_name', label: 'Business / trading name *', placeholder: 'The Green Cycle' },
            { key: 'abn',           label: 'Australian Business Number (ABN) *', placeholder: '12 345 678 901' },
            { key: 'location',      label: 'Primary location', placeholder: 'Sydney NSW' },
            { key: 'website',       label: 'Website', placeholder: 'yourstore.com.au' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-semibold text-slate-600 block mb-1">{label}</label>
              <input value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400" />
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map(c => (
                <button key={c} onClick={() => set('category', c)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize border transition-colors ${
                    form.category === c ? 'bg-eco-50 border-eco-400 text-eco-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Business description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400 resize-none"
              placeholder="Describe your sustainability mission and what you offer." />
          </div>
        </div>
      )}

      {/* Step 2: Sustainability Credentials */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-slate-900">Sustainability Credentials</h2>
          <p className="text-xs text-slate-500">Select all certifications that apply. EcoBin will verify these before approval.</p>
          <div className="grid grid-cols-2 gap-2">
            {CERT_OPTIONS.map(cert => (
              <button key={cert} onClick={() => toggleCert(cert)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold text-left transition-colors ${
                  form.certs.includes(cert)
                    ? 'bg-eco-50 border-eco-400 text-eco-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}>
                {form.certs.includes(cert) && <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                <span className="truncate">{cert}</span>
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Sustainability statement (required)</label>
            <textarea value={form.sustainability_statement} onChange={e => set('sustainability_statement', e.target.value)} rows={4}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-400 resize-none"
              placeholder="Describe your sustainability practices, environmental commitments, and measurable impact…" />
          </div>
          <div className="bg-slate-50 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <Upload className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-slate-600">Upload certification documents</p>
              <p className="text-[10px] text-slate-400 mt-0.5">PDF or image. EcoBin team will review within 2 business days. (Simulated in demo)</p>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Agreement */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-slate-900">Platform Agreement</h2>
          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-xs text-slate-600">
            <p className="font-bold text-slate-800 text-sm mb-3">EcoBin Rewards Marketplace — Merchant Terms</p>
            <p><strong>Platform fee:</strong> {PLATFORM_FEE_PCT}% of the AUD equivalent of all points redeemed against your listings. Deducted from weekly settlements.</p>
            <p><strong>Listing review:</strong> All new listings reviewed for sustainability accuracy within 2 business days.</p>
            <p><strong>Sustainability compliance:</strong> All claims must be accurate and supported by documentation. False claims result in immediate suspension.</p>
            <p><strong>Fulfilment:</strong> You are responsible for honouring all redeemed vouchers, products and experiences within the stated terms.</p>
            <p><strong>Settlement:</strong> Weekly bank transfer (T+2) or Airwallex same-day. Minimum settlement: $50.</p>
          </div>
          {[
            { key: 'agreed_fees',  label: `I agree to the ${PLATFORM_FEE_PCT}% platform fee on all redemptions` },
            { key: 'agreed_terms', label: 'I have read and agree to the EcoBin Merchant Terms of Service' },
            { key: 'agreed_eco',   label: 'I confirm all sustainability claims are accurate and will be maintained' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form[key]} onChange={e => set(key, e.target.checked)} className="mt-0.5 accent-eco-600" />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)}
            className="flex-1 py-3 text-sm font-semibold bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">
            Back
          </button>
        )}
        <button
          onClick={() => step < 3 ? setStep(s => s + 1) : setComplete(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-eco-600 text-white text-sm font-bold rounded-xl hover:bg-eco-700 transition-colors"
          disabled={step === 2 && !(form.agreed_fees && form.agreed_terms && form.agreed_eco)}
        >
          {step === 3 ? 'Go Live →' : 'Continue'} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
