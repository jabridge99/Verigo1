import React, { useState } from 'react'
import { QrCode, CheckCircle, MapPin, Clock, ArrowRight, Keyboard } from 'lucide-react'

const RECENT = [
  { code: 'CZ-001-A', name: 'Surry Hills Hub',    address: '42 Crown St', date: '27 May', value: '$5.40' },
  { code: 'CZ-002-B', name: 'Redfern Node',       address: '155 Redfern St', date: '13 May', value: '$8.80' },
]

export default function Scan() {
  const [mode,    setMode]    = useState('camera')   // 'camera' | 'manual'
  const [code,    setCode]    = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = e => {
    e.preventDefault()
    if (code.trim().length > 3) setSuccess(true)
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto text-center space-y-5 py-10">
        <div className="w-16 h-16 bg-eco-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-eco-700" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Station Verified!</h2>
          <p className="text-slate-500 mt-2 text-sm">
            Code <strong>{code || 'CZ-001-A'}</strong> — Surry Hills Hub confirmed.
          </p>
        </div>
        <div className="bg-eco-50 border border-eco-100 rounded-2xl p-5 text-left space-y-3 text-sm">
          {[
            { label: 'Station',        value: 'Surry Hills Hub (CZ-001)' },
            { label: 'Materials',      value: 'Mixed Recyclables accepted' },
            { label: 'Estimated value', value: '$0.38/kg (commodity rate)' },
            { label: 'Status',         value: 'Ready to receive' },
          ].map(r => (
            <div key={r.label} className="flex justify-between">
              <span className="text-slate-500">{r.label}</span>
              <span className="font-semibold text-slate-900">{r.value}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setSuccess(false); setCode('') }}
            className="flex-1 border border-slate-200 text-slate-700 font-semibold py-3 rounded-xl text-sm hover:border-slate-300 transition-colors"
          >
            Scan Another
          </button>
          <button className="flex-1 bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
            Confirm Deposit <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Scan QR Code</h1>
        <p className="text-sm text-slate-500 mt-1">
          Scan a CirclLoop station QR code to verify and begin your deposit.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => setMode('camera')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            mode === 'camera' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          <QrCode className="w-4 h-4" /> Camera Scan
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            mode === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          <Keyboard className="w-4 h-4" /> Enter Code
        </button>
      </div>

      {mode === 'camera' ? (
        <div className="space-y-4">
          {/* Camera viewfinder */}
          <div className="relative bg-slate-800 rounded-2xl overflow-hidden aspect-square max-w-sm mx-auto flex items-center justify-center">
            {/* Corner markers */}
            {[
              'top-6 left-6',  'top-6 right-6',
              'bottom-6 left-6', 'bottom-6 right-6',
            ].map((pos, i) => (
              <div key={i} className={`absolute ${pos} w-10 h-10`}>
                <div className={`absolute top-0 left-0 w-full h-1 bg-eco-400 ${i > 1 ? 'top-auto bottom-0' : ''}`} />
                <div className={`absolute top-0 left-0 h-full w-1 bg-eco-400 ${i % 2 !== 0 ? 'left-auto right-0' : ''}`} />
              </div>
            ))}
            {/* Scan line animation */}
            <div className="absolute left-8 right-8 h-0.5 bg-eco-400/70 animate-bounce" style={{ top: '50%' }} />
            <div className="text-center">
              <QrCode className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-300 text-sm font-medium">Camera access required</p>
              <p className="text-slate-500 text-xs mt-1">Point at a station QR code</p>
            </div>
          </div>
          <p className="text-center text-xs text-slate-400">
            Camera will activate on a real device.{' '}
            <button onClick={() => setMode('manual')} className="text-eco-700 font-semibold hover:underline">
              Enter code manually →
            </button>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Station Code</label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. CZ-001-A"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500"
            />
            <p className="text-xs text-slate-400 mt-1.5">Find the code on the station label or confirmation card.</p>
          </div>
          <button
            type="submit"
            disabled={code.trim().length < 4}
            className="w-full bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Verify Station
          </button>
        </form>
      )}

      {/* Recent scans */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-900 text-sm">Recent Scans</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {RECENT.map(r => (
            <div key={r.code} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
              <div className="w-8 h-8 bg-eco-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-eco-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900">{r.name}</div>
                <div className="text-xs text-slate-400">{r.code} · {r.address} · {r.date}</div>
              </div>
              <div className="text-sm font-bold text-eco-700 flex-shrink-0">{r.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
