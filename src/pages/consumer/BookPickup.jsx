import React, { useState } from 'react'
import { Calendar, Clock, Package, CheckCircle, ArrowRight, Recycle } from 'lucide-react'

const TIME_SLOTS = [
  { id: 'am', label: '8:00 am – 12:00 pm', available: true },
  { id: 'pm', label: '12:00 pm – 4:00 pm',  available: true },
  { id: 'eve', label: '4:00 pm – 7:00 pm', available: false },
]

const DAYS = ['Mon 26', 'Tue 27', 'Wed 28', 'Thu 29', 'Fri 30', 'Sat 31']

const MATERIALS = [
  { id: 'mixed',   label: 'Mixed Recyclables',   rate: '$0.38/kg', icon: Recycle },
  { id: 'alum',    label: 'Aluminium',            rate: '$1.85/kg', icon: Recycle },
  { id: 'cardboard', label: 'Cardboard & Paper', rate: '$0.14/kg', icon: Package },
  { id: 'glass',   label: 'Glass Bottles',        rate: '$0.02/kg', icon: Recycle },
]

export default function BookPickup() {
  const [step, setStep]         = useState(1)
  const [day, setDay]           = useState('Thu 29')
  const [slot, setSlot]         = useState('am')
  const [matls, setMatls]       = useState(['mixed'])
  const [confirmed, setConfirmed] = useState(false)

  const toggleMaterial = id =>
    setMatls(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id],
    )

  if (confirmed) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-4">
        <div className="w-16 h-16 bg-eco-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-eco-700" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Pickup Booked!</h2>
        <p className="text-slate-500">
          Your 240L collection is confirmed for <strong>Thursday 29 May, 8:00 am – 12:00 pm</strong>.
          You'll receive a reminder the evening before.
        </p>
        <div className="bg-eco-50 border border-eco-100 rounded-2xl p-5 text-left mt-6">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Booking Summary</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-semibold text-slate-900">Thu 29 May 2025</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Time</span><span className="font-semibold text-slate-900">8:00 am – 12:00 pm</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Address</span><span className="font-semibold text-slate-900">14 Garden St, Surry Hills</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Bin</span><span className="font-semibold text-slate-900">240L Mixed Recyclables</span></div>
            <div className="flex justify-between border-t border-eco-200 pt-2 mt-2"><span className="text-slate-500">Estimated value</span><span className="font-bold text-eco-700">$4.20 – $6.50</span></div>
          </div>
        </div>
        <button
          onClick={() => { setStep(1); setConfirmed(false) }}
          className="mt-4 text-sm text-eco-700 font-semibold hover:underline"
        >
          Book another pickup
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Book a Pickup</h1>
        <p className="text-sm text-slate-500 mt-1">
          Schedule a 240L bin collection and we'll credit your recovered value within 24 hours.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {[
          { n: 1, label: 'Date & Time' },
          { n: 2, label: 'Materials' },
          { n: 3, label: 'Confirm' },
        ].map((s, i) => (
          <React.Fragment key={s.n}>
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step >= s.n ? 'bg-eco-700 text-white' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {step > s.n ? <CheckCircle className="w-4 h-4" /> : s.n}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${step >= s.n ? 'text-slate-900' : 'text-slate-400'}`}>
                {s.label}
              </span>
            </div>
            {i < 2 && <div className={`flex-1 h-px mx-3 ${step > s.n ? 'bg-eco-300' : 'bg-slate-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Date & Time */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-3 block">Select Date</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {DAYS.map(d => (
                <button
                  key={d}
                  onClick={() => setDay(d)}
                  className={`py-3 px-2 rounded-xl text-xs font-semibold text-center border transition-all ${
                    day === d
                      ? 'border-eco-700 bg-eco-700 text-white'
                      : 'border-slate-200 text-slate-700 hover:border-eco-300'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-3 block">Select Time Window</label>
            <div className="space-y-2">
              {TIME_SLOTS.map(ts => (
                <button
                  key={ts.id}
                  onClick={() => ts.available && setSlot(ts.id)}
                  disabled={!ts.available}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-sm font-medium transition-all ${
                    !ts.available
                      ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                      : slot === ts.id
                      ? 'border-eco-700 bg-eco-50 text-eco-800'
                      : 'border-slate-200 text-slate-700 hover:border-eco-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4" />
                    {ts.label}
                  </div>
                  {!ts.available && <span className="text-xs">Unavailable</span>}
                  {ts.available && slot === ts.id && <CheckCircle className="w-4 h-4 text-eco-700" />}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            className="w-full bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 2: Materials */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1 block">
              What's in your 240L bin?
            </label>
            <p className="text-xs text-slate-400 mb-4">
              Select all that apply. We'll sort and weigh on collection — value is commodity-linked.
            </p>
            <div className="space-y-2">
              {MATERIALS.map(m => (
                <button
                  key={m.id}
                  onClick={() => toggleMaterial(m.id)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-sm transition-all ${
                    matls.includes(m.id)
                      ? 'border-eco-700 bg-eco-50'
                      : 'border-slate-200 hover:border-eco-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      matls.includes(m.id) ? 'border-eco-700 bg-eco-700' : 'border-slate-300'
                    }`}>
                      {matls.includes(m.id) && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    <span className="font-medium text-slate-800">{m.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-eco-700">{m.rate}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl hover:border-slate-300 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={matls.length === 0}
              className="flex-1 bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          <h3 className="font-semibold text-slate-900">Confirm Your Booking</h3>
          <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-sm">
            {[
              { label: 'Date', value: `${day} May 2025` },
              { label: 'Time Window', value: TIME_SLOTS.find(t => t.id === slot)?.label },
              { label: 'Address', value: '14 Garden St, Surry Hills NSW 2010' },
              { label: 'Bin Type', value: '240L Wheelie Bin' },
              { label: 'Materials', value: matls.map(m => MATERIALS.find(x => x.id === m)?.label).join(', ') },
            ].map(r => (
              <div key={r.label} className="flex justify-between gap-4">
                <span className="text-slate-500">{r.label}</span>
                <span className="font-semibold text-slate-900 text-right">{r.value}</span>
              </div>
            ))}
            <div className="border-t border-slate-200 pt-3 flex justify-between">
              <span className="text-slate-500">Estimated Value</span>
              <span className="font-bold text-eco-700">$4.20 – $6.50</span>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Final value is determined after sorting and weighing at our processing facility. Credits are applied within 24 hours of collection.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl hover:border-slate-300 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setConfirmed(true)}
              className="flex-1 bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Confirm Booking <CheckCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
