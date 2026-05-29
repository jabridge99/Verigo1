import React, { useState, useEffect } from 'react'
import {
  FileText, X, CheckCircle, Eye, DollarSign,
  MapPin, Package, TrendingUp, Calendar,
} from 'lucide-react'
import { slaEngine } from '../../lib/slaEngine'

const RECYCLERS = [
  {
    id: 'R001',
    name: 'GreenCycle NSW',
    location: 'Sydney, NSW',
    materials: ['Aluminium', 'PET Plastic'],
    weight: 14.3,
    grossValue: 18590,
    platformFeePct: 5,
    contractStatus: 'Active',
    paymentMethod: 'NPP',
    materials_detail: [
      { material: 'Aluminium',   weight: 8.2,  price: 1100, value: 9020  },
      { material: 'PET Plastic', weight: 6.1,  price: 1568, value: 9562.48 },
    ],
  },
  {
    id: 'R002',
    name: 'ScrapMetal Co.',
    location: 'Melbourne, VIC',
    materials: ['Steel', 'Aluminium'],
    weight: 22.7,
    grossValue: 21440,
    platformFeePct: 5,
    contractStatus: 'Active',
    paymentMethod: 'BECS',
    materials_detail: [
      { material: 'Steel',      weight: 14.4, price: 480,  value: 6912   },
      { material: 'Aluminium',  weight: 8.3,  price: 1749, value: 14516.7 },
    ],
  },
  {
    id: 'R003',
    name: 'EcoLoop QLD',
    location: 'Brisbane, QLD',
    materials: ['HDPE', 'Cardboard'],
    weight: 9.8,
    grossValue: 7840,
    platformFeePct: 4,
    contractStatus: 'Active',
    paymentMethod: 'NPP',
    materials_detail: [
      { material: 'HDPE',      weight: 5.2, price: 920, value: 4784  },
      { material: 'Cardboard', weight: 4.6, price: 447, value: 2056.2 },
    ],
  },
  {
    id: 'R004',
    name: 'BinStar SA',
    location: 'Adelaide, SA',
    materials: ['Glass', 'Steel'],
    weight: 18.1,
    grossValue: 12700,
    platformFeePct: 5,
    contractStatus: 'Expiring',
    paymentMethod: 'BECS',
    materials_detail: [
      { material: 'Glass', weight: 11.0, price: 640,  value: 7040  },
      { material: 'Steel', weight: 7.1,  price: 793,  value: 5631  },
    ],
  },
  {
    id: 'R005',
    name: 'RecoverRight VIC',
    location: 'Geelong, VIC',
    materials: ['Aluminium', 'HDPE', 'PET Plastic'],
    weight: 11.2,
    grossValue: 15200,
    platformFeePct: 5,
    contractStatus: 'Active',
    paymentMethod: 'NPP',
    materials_detail: [
      { material: 'Aluminium',   weight: 4.5, price: 1100, value: 4950  },
      { material: 'HDPE',        weight: 3.7, price: 920,  value: 3404  },
      { material: 'PET Plastic', weight: 3.0, price: 1568, value: 4704  },
    ],
  },
]

const MATERIAL_SPOT_PRICES = [
  { material: 'Aluminium',   spotPrice: 1100,  unit: 'AUD/t', source: 'LME spot', date: '2024-05-14' },
  { material: 'PET Plastic', spotPrice: 1568,  unit: 'AUD/t', source: 'ICIS index', date: '2024-05-14' },
  { material: 'HDPE',        spotPrice: 920,   unit: 'AUD/t', source: 'ICIS index', date: '2024-05-14' },
  { material: 'Glass',       spotPrice: 640,   unit: 'AUD/t', source: 'Domestic avg', date: '2024-05-14' },
  { material: 'Steel',       spotPrice: 480,   unit: 'AUD/t', source: 'LME spot', date: '2024-05-14' },
  { material: 'Cardboard',   spotPrice: 447,   unit: 'AUD/t', source: 'Domestic avg', date: '2024-05-14' },
]

const PAYMENT_SCHEDULE = [
  { recycler: 'GreenCycle NSW',   amount: 17660.5, date: '2024-05-15', method: 'NPP' },
  { recycler: 'ScrapMetal Co.',   amount: 20368.0, date: '2024-05-15', method: 'BECS' },
  { recycler: 'EcoLoop QLD',      amount: 7526.4,  date: '2024-05-16', method: 'NPP' },
  { recycler: 'BinStar SA',       amount: 12065.0, date: '2024-05-17', method: 'BECS' },
  { recycler: 'RecoverRight VIC', amount: 14440.0, date: '2024-05-17', method: 'NPP' },
]

const MATERIAL_COLOR = {
  'Aluminium':   'bg-slate-500 text-white',
  'PET Plastic': 'bg-blue-500 text-white',
  'HDPE':        'bg-amber-500 text-white',
  'Glass':       'bg-emerald-500 text-white',
  'Steel':       'bg-rose-500 text-white',
  'Cardboard':   'bg-orange-500 text-white',
}

const CONTRACT_STATUS = {
  Active:    { badge: 'bg-emerald-100 text-emerald-700' },
  Expiring:  { badge: 'bg-amber-100 text-amber-700' },
  Suspended: { badge: 'bg-red-100 text-red-700' },
}

function calcNet(r) {
  const fee = r.grossValue * (r.platformFeePct / 100)
  return r.grossValue - fee
}

function SettlementModal({ recycler, onClose }) {
  if (!recycler) return null
  const fee = recycler.grossValue * (recycler.platformFeePct / 100)
  const net = recycler.grossValue - fee

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between z-10">
          <div>
            <h3 className="text-base font-bold text-slate-900">{recycler.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{recycler.location} · {recycler.id} · May 2024</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Material breakdown */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Material Breakdown</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 text-xs font-semibold text-slate-400">Material</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-400">Weight (t)</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-400">Price/t</th>
                    <th className="text-right py-2 text-xs font-semibold text-slate-400">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recycler.materials_detail.map((m, i) => (
                    <tr key={i}>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${MATERIAL_COLOR[m.material] || 'bg-slate-100 text-slate-600'}`}>
                            {m.material}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-mono text-xs text-slate-600">{m.weight}</td>
                      <td className="py-2.5 text-right font-mono text-xs text-slate-600">${m.price.toLocaleString()}</td>
                      <td className="py-2.5 text-right font-mono text-xs font-semibold text-slate-800">
                        ${m.value.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fee deduction summary */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Gross Material Value</span>
              <span className="font-semibold text-slate-800">${recycler.grossValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-400 text-xs">
              <span>— Platform Fee ({recycler.platformFeePct}%)</span>
              <span>-${fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="font-bold text-slate-900">Net Payable</span>
              <span className="font-bold text-violet-700 text-base">${net.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Payment info */}
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm">
            <div>
              <p className="font-semibold text-slate-800">Payment Method</p>
              <p className="text-xs text-slate-500 mt-0.5">{recycler.paymentMethod} · Contract: {recycler.contractStatus}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${CONTRACT_STATUS[recycler.contractStatus]?.badge || 'bg-slate-100 text-slate-600'}`}>
              {recycler.contractStatus}
            </span>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 bg-slate-100 text-slate-700 font-semibold py-3 rounded-xl text-sm hover:bg-slate-200 transition-colors">
              Close
            </button>
            <button className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5">
              <DollarSign className="w-4 h-4" /> Initiate Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RecyclerSettlement() {
  const [selectedRecycler, setSelectedRecycler] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])

  useEffect(() => {
    setLeaderboard(slaEngine.getLeaderboard())
  }, [])

  const totalPayable = RECYCLERS.reduce((s, r) => s + calcNet(r), 0)
  const totalWeight  = RECYCLERS.reduce((s, r) => s + r.weight, 0)
  const avgPrice     = RECYCLERS.reduce((s, r) => s + r.grossValue, 0) / totalWeight

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recycler Settlement</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Current period: <span className="font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full text-xs ml-1">May 1–14 2024</span>
          </p>
        </div>
        <button className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors">
          <FileText className="w-4 h-4" /> Generate Invoice
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Payable', value: `$${totalPayable.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, color: 'text-violet-700', bg: 'bg-violet-50', icon: DollarSign },
          { label: 'Recyclers This Period', value: RECYCLERS.length, color: 'text-slate-800', bg: 'bg-slate-50', icon: Package },
          { label: 'Materials Processed', value: `${totalWeight.toFixed(1)} t`, color: 'text-emerald-700', bg: 'bg-emerald-50', icon: TrendingUp },
          { label: 'Avg Price Achieved', value: `$${avgPrice.toFixed(0)}/t`, color: 'text-amber-700', bg: 'bg-amber-50', icon: TrendingUp },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Live SLA Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <span className="w-2 h-2 bg-eco-500 rounded-full animate-pulse" />
            <h2 className="font-bold text-slate-900">Live Operator SLA Leaderboard</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {leaderboard.map((op, i) => (
              <div key={op.id} className="px-5 py-4 flex items-center gap-4">
                <span className="text-sm font-bold text-slate-400 w-6">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">{op.name}</p>
                  <p className="text-xs text-slate-400">{op.collections} collections · {op.kg.toLocaleString()} kg</p>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${op.bg} ${op.color}`}>{op.label}</span>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-eco-700">${op.totalAud.toLocaleString('en-AU', { maximumFractionDigits: 0 })}</p>
                  <p className="text-[10px] text-slate-400">{op.multiplier}× rate</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recycler table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Recycler Accounts</h2>
          <span className="text-xs text-slate-400">{RECYCLERS.length} recyclers this period</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Recycler</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Materials</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Weight (t)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Gross Value</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Fee %</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Net Payable</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Contract</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {RECYCLERS.map(r => {
                const net = calcNet(r)
                const cs = CONTRACT_STATUS[r.contractStatus] || CONTRACT_STATUS.Active
                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-semibold text-slate-800 text-xs">{r.name}</p>
                        <p className="text-[10px] text-slate-400">{r.id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {r.location}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {r.materials.map(m => (
                          <span key={m} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${MATERIAL_COLOR[m] || 'bg-slate-100 text-slate-600'}`}>
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-600">{r.weight}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-600">
                      ${r.grossValue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="text-xs font-semibold text-slate-500">{r.platformFeePct}%</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-bold text-violet-700 text-sm">
                        ${net.toLocaleString('en-AU', { minimumFractionDigits: 0 })}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cs.badge}`}>
                        {r.contractStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> Pay
                        </button>
                        <button
                          onClick={() => setSelectedRecycler(r)}
                          className="text-[10px] font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> View
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Material pricing table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Commodity Spot Prices Applied</h2>
          <span className="text-xs text-slate-400">As at 14 May 2024</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Material</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Spot Price</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Source</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Date Applied</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Applied To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {MATERIAL_SPOT_PRICES.map(mp => {
                const recyclers = RECYCLERS.filter(r => r.materials.includes(mp.material))
                return (
                  <tr key={mp.material} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded ${MATERIAL_COLOR[mp.material] || 'bg-slate-100 text-slate-600'}`}>
                        {mp.material}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-slate-800">
                      ${mp.spotPrice.toLocaleString()} {mp.unit}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">{mp.source}</td>
                    <td className="px-4 py-3.5 text-xs font-mono text-slate-500">{mp.date}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {recyclers.map(r => (
                          <span key={r.id} className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{r.name}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment schedule */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Payment Schedule</h2>
          <span className="text-xs text-violet-600 font-semibold bg-violet-50 px-2 py-0.5 rounded-full">{PAYMENT_SCHEDULE.length} upcoming</span>
        </div>
        <div className="divide-y divide-slate-50">
          {PAYMENT_SCHEDULE.map((p, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{p.recycler}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Via {p.method} · {p.date}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-violet-700">${p.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</p>
                <p className="text-[10px] text-slate-400">net payable</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedRecycler && (
        <SettlementModal recycler={selectedRecycler} onClose={() => setSelectedRecycler(null)} />
      )}
    </div>
  )
}
