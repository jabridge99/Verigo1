import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, ArrowRight, Leaf, MapPin, Package, Wallet, Shield, ChevronRight } from 'lucide-react'

const STEPS = [
  { id: 'welcome',  label: 'Welcome' },
  { id: 'account',  label: 'Account' },
  { id: 'profile',  label: 'Profile' },
  { id: 'bin',      label: 'Bin Setup' },
  { id: 'kyc',      label: 'Verify' },
  { id: 'done',     label: 'All Done' },
]

const BIN_TYPES = ['240L Green/General Waste', '240L Yellow Recycling', '240L Red Organics', 'Multiple bins']
const PICKUP_FREQ = ['Weekly', 'Fortnightly', 'Monthly', 'On-demand']
const MATERIALS   = ['Aluminium cans', 'PET plastic', 'Glass bottles', 'Paperboard', 'Steel cans']

export default function Onboarding() {
  const navigate = useNavigate()
  const [step,     setStep]     = useState(0)
  const [form,     setForm]     = useState({
    email: '', password: '', firstName: '', lastName: '', phone: '', suburb: '',
    binType: '', pickupFreq: '', materials: [],
  })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const toggleMat = m => set('materials', form.materials.includes(m)
    ? form.materials.filter(x => x !== m)
    : [...form.materials, m]
  )
  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1))
  const back = () => setStep(s => Math.max(s - 1, 0))

  return (
    <div className="w-full max-w-lg">
      {/* Step indicator */}
      <div className="flex items-center gap-1.5 mb-8">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors flex-shrink-0 ${
              i < step ? 'bg-eco-700 text-white'
              : i === step ? 'bg-eco-700 text-white ring-4 ring-eco-100'
              : 'bg-slate-200 text-slate-400'
            }`}>
              {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 transition-colors ${i < step ? 'bg-eco-700' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center space-y-5">
            <div className="w-16 h-16 bg-eco-700 rounded-2xl flex items-center justify-center mx-auto">
              <Leaf className="w-8 h-8 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Welcome to CirclLoop</h1>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                Join thousands of households recovering real value from recyclables.<br />
                Set up takes under 3 minutes.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center py-2">
              {[
                { icon: MapPin,  text: 'Find your zone' },
                { icon: Package, text: 'Deposit materials' },
                { icon: Wallet,  text: 'Recover value' },
              ].map(f => (
                <div key={f.text} className="bg-slate-50 rounded-xl p-3 space-y-2">
                  <div className="w-9 h-9 bg-eco-100 rounded-xl flex items-center justify-center mx-auto">
                    <f.icon className="w-4 h-4 text-eco-700" />
                  </div>
                  <div className="text-xs font-medium text-slate-700">{f.text}</div>
                </div>
              ))}
            </div>
            <button onClick={next} className="w-full bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2">
              Get Started <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-slate-400">Already have an account? <a href="/consumer" className="text-eco-700 font-semibold hover:underline">Sign in</a></p>
          </div>
        )}

        {/* Step 1: Account */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Create your account</h2>
              <p className="text-sm text-slate-500 mt-0.5">Your login credentials.</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Email address</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="you@email.com"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Password</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500" />
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              By continuing you agree to CirclLoop's <span className="text-eco-700 font-semibold cursor-pointer">Terms of Service</span> and <span className="text-eco-700 font-semibold cursor-pointer">Privacy Policy</span>.
            </p>
            <div className="flex gap-3">
              <button onClick={back} className="flex-1 border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl text-sm hover:border-slate-300 transition-colors">Back</button>
              <button onClick={next} disabled={!form.email || !form.password}
                className="flex-1 bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Profile */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Your profile</h2>
              <p className="text-sm text-slate-500 mt-0.5">Tell us a little about yourself.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">First name</label>
                <input type="text" value={form.firstName} onChange={e => set('firstName', e.target.value)}
                  placeholder="Sarah"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Last name</label>
                <input type="text" value={form.lastName} onChange={e => set('lastName', e.target.value)}
                  placeholder="Mitchell"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500" />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Phone number</label>
              <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="+61 4XX XXX XXX"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Suburb / Postcode</label>
              <input type="text" value={form.suburb} onChange={e => set('suburb', e.target.value)}
                placeholder="e.g. Surry Hills 2010"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500" />
            </div>
            <div className="flex gap-3">
              <button onClick={back} className="flex-1 border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl text-sm hover:border-slate-300 transition-colors">Back</button>
              <button onClick={next} disabled={!form.firstName || !form.lastName}
                className="flex-1 bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Bin setup */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Bin setup</h2>
              <p className="text-sm text-slate-500 mt-0.5">Help us match you to the right collection service.</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">Which bin type?</label>
              <div className="space-y-2">
                {BIN_TYPES.map(b => (
                  <button key={b} onClick={() => set('binType', b)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                      form.binType === b ? 'border-eco-500 bg-eco-50 text-eco-900' : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}>
                    {b}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">Preferred pickup frequency</label>
              <div className="grid grid-cols-2 gap-2">
                {PICKUP_FREQ.map(f => (
                  <button key={f} onClick={() => set('pickupFreq', f)}
                    className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors text-center ${
                      form.pickupFreq === f ? 'border-eco-500 bg-eco-50 text-eco-900' : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">Materials you typically recycle</label>
              <div className="flex flex-wrap gap-2">
                {MATERIALS.map(m => (
                  <button key={m} onClick={() => toggleMat(m)}
                    className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-colors ${
                      form.materials.includes(m) ? 'bg-eco-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={back} className="flex-1 border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl text-sm hover:border-slate-300 transition-colors">Back</button>
              <button onClick={next}
                className="flex-1 bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 4: KYC prompt */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Verify your identity</h2>
              <p className="text-sm text-slate-500 mt-0.5">Required to unlock full wallet features and withdrawals.</p>
            </div>
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 space-y-3">
              <div className="w-10 h-10 bg-eco-100 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-eco-700" />
              </div>
              <div className="text-sm font-semibold text-slate-900">What you'll need</div>
              <ul className="space-y-2 text-sm text-slate-600">
                {["Government-issued photo ID (driver's licence or passport)", "A selfie taken live in-app", "Proof of address (utility bill or bank statement)"].map(i => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-eco-600 flex-shrink-0 mt-0.5" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-3">
              <button onClick={back} className="flex-1 border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl text-sm hover:border-slate-300 transition-colors">Back</button>
              <button onClick={next}
                className="flex-1 bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                Start Verification <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button onClick={next} className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors">
              Skip for now — verify later
            </button>
          </div>
        )}

        {/* Step 5: Done */}
        {step === 5 && (
          <div className="text-center space-y-5">
            <div className="w-16 h-16 bg-eco-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-9 h-9 text-eco-700" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">You're all set{form.firstName ? `, ${form.firstName}` : ''}!</h2>
              <p className="text-slate-500 text-sm mt-2">Your CirclLoop account is ready. Start finding a zone or book your first pickup.</p>
            </div>
            <div className="bg-eco-50 border border-eco-100 rounded-2xl p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Welcome bonus</span><span className="font-bold text-eco-700">+200 Eco Points</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tier</span><span className="font-semibold text-slate-900">Bronze</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Wallet balance</span><span className="font-semibold text-slate-900">$0.00 AUD</span></div>
            </div>
            <button
              onClick={() => navigate('/consumer')}
              className="w-full bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Go to My Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>

      <p className="text-center text-xs text-slate-400 mt-6">
        Step {step + 1} of {STEPS.length} — {STEPS[step].label}
      </p>
    </div>
  )
}
