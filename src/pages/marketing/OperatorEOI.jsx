import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, ArrowRight, Package, DollarSign, BarChart2, Users, Leaf, MapPin } from 'lucide-react'

const MODELS = [
  { id: 'hub',    label: 'Hub Operator',     desc: 'Fixed drop-off station in your premises. Ideal for businesses and community spaces.' },
  { id: 'mobile', label: 'Mobile Collection', desc: 'Vehicle-based doorstep collection. Best for logistics contractors and fleet operators.' },
  { id: 'council',label: 'Council Partnership', desc: 'Municipal-scale integration. For councils and waste management authorities.' },
]

const VOLUMES = ['< 500 kg/month', '500 kg – 2 t/month', '2 t – 10 t/month', '> 10 t/month', 'Not sure yet']

const BENEFITS = [
  { icon: DollarSign, title: 'Commodity-linked Revenue', desc: 'Earn based on live AUD/tonne market rates — not flat fees.' },
  { icon: BarChart2,  title: 'Real-time Analytics',      desc: 'Volume dashboards, settlement reports, and material breakdowns.' },
  { icon: Users,      title: 'Consumer Network',          desc: 'Tap into CirclLoop\'s consumer base with zero acquisition cost.' },
  { icon: Package,    title: 'Logistics Integration',     desc: 'Our network handles collection routing and centre delivery.' },
  { icon: MapPin,     title: 'Territory Coverage',        desc: 'Exclusive or non-exclusive zone allocation options available.' },
  { icon: Leaf,       title: 'Sustainability Credentials', desc: 'Verified impact metrics and branded recycling collateral included.' },
]

export default function OperatorEOI() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    orgName: '', contactName: '', email: '', phone: '', suburb: '',
    model: '', volume: '', notes: '',
  })
  const [submitted, setSubmitted] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = e => {
    e.preventDefault()
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center space-y-5">
          <div className="w-16 h-16 bg-eco-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-eco-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Expression Received</h2>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              Thanks, <strong>{form.contactName || 'there'}</strong>. Our partnerships team will review your application and be in touch within 3 business days.
            </p>
          </div>
          <div className="bg-eco-50 border border-eco-100 rounded-xl p-4 text-left text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-slate-500">Organisation</span><span className="font-semibold text-slate-900">{form.orgName || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Model</span><span className="font-semibold text-slate-900">{form.model || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Reference</span><span className="font-semibold text-slate-900">EOI-{Math.floor(Math.random() * 90000) + 10000}</span></div>
          </div>
          <button onClick={() => navigate('/')} className="w-full bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-7 h-7 bg-eco-700 rounded-lg flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-slate-900">CirclLoop</span>
        </div>
        <button onClick={() => navigate('/')} className="text-sm text-slate-500 hover:text-slate-700 transition-colors">← Back to home</button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12 space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-eco-50 text-eco-700 border border-eco-100 rounded-full px-4 py-1.5 text-sm font-semibold">
            <Package className="w-4 h-4" /> Operator Partner Program
          </div>
          <h1 className="text-4xl font-bold text-slate-900 leading-tight">
            Partner with CirclLoop.<br />Grow your recycling operation.
          </h1>
          <p className="text-slate-500 text-lg">
            Join Australia's fastest-growing commodity recovery network. Earn real revenue from real materials.
          </p>
        </div>

        {/* Benefits grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {BENEFITS.map(b => (
            <div key={b.title} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
              <div className="w-10 h-10 bg-eco-50 rounded-xl flex items-center justify-center">
                <b.icon className="w-5 h-5 text-eco-700" />
              </div>
              <div className="font-semibold text-slate-900">{b.title}</div>
              <div className="text-sm text-slate-500 leading-relaxed">{b.desc}</div>
            </div>
          ))}
        </div>

        {/* EOI Form */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Expression of Interest</h2>
          <p className="text-sm text-slate-500 mb-6">No commitment required. We'll reach out to discuss fit and next steps.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Organisation */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Organisation name</label>
                <input type="text" value={form.orgName} onChange={e => set('orgName', e.target.value)}
                  placeholder="Acme Recycling Pty Ltd"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500"
                  required />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Contact name</label>
                <input type="text" value={form.contactName} onChange={e => set('contactName', e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500"
                  required />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="jane@company.com.au"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500"
                  required />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Phone</label>
                <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="+61 2 XXXX XXXX"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500" />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Suburb / Region</label>
              <input type="text" value={form.suburb} onChange={e => set('suburb', e.target.value)}
                placeholder="e.g. Greater Sydney, Melbourne CBD, Regional QLD"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500" />
            </div>

            {/* Model */}
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">Preferred partnership model</label>
              <div className="space-y-2">
                {MODELS.map(m => (
                  <button key={m.id} type="button" onClick={() => set('model', m.label)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl border transition-colors ${
                      form.model === m.label ? 'border-eco-500 bg-eco-50' : 'border-slate-200 hover:border-slate-300'
                    }`}>
                    <div className={`text-sm font-semibold ${form.model === m.label ? 'text-eco-900' : 'text-slate-900'}`}>{m.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Volume */}
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">Expected monthly volume</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {VOLUMES.map(v => (
                  <button key={v} type="button" onClick={() => set('volume', v)}
                    className={`px-3 py-3 rounded-xl border text-xs font-semibold text-center transition-colors ${
                      form.volume === v ? 'border-eco-500 bg-eco-50 text-eco-900' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Additional notes <span className="text-slate-400 font-normal">(optional)</span></label>
              <textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Tell us about your current recycling setup, site details, or any specific requirements…"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500 resize-none" />
            </div>

            <button
              type="submit"
              disabled={!form.orgName || !form.contactName || !form.email}
              className="w-full bg-eco-700 hover:bg-eco-800 text-white font-semibold py-4 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              Submit Expression of Interest <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-slate-400 text-center">
              Your information is handled in accordance with our Privacy Policy. No commitment required.
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}
