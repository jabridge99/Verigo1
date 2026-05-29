import React, { useState } from 'react'
import { Layers, Calculator } from 'lucide-react'
import { DEVICE_COMPOSITIONS, COMMODITIES } from '../../data/pie'

const METAL_COLOR = {
  copper: { bar: 'bg-orange-400', dot: 'bg-orange-400', text: 'text-orange-600' },
  aluminium: { bar: 'bg-slate-400', dot: 'bg-slate-400', text: 'text-slate-500' },
  tin: { bar: 'bg-sky-400', dot: 'bg-sky-400', text: 'text-sky-600' },
  gold: { bar: 'bg-amber-400', dot: 'bg-amber-400', text: 'text-amber-600' },
  silver: { bar: 'bg-violet-300', dot: 'bg-violet-300', text: 'text-violet-500' },
  palladium: { bar: 'bg-violet-600', dot: 'bg-violet-600', text: 'text-violet-700' },
  nickel: { bar: 'bg-lime-500', dot: 'bg-lime-500', text: 'text-lime-600' },
}

const METALS = ['copper', 'aluminium', 'tin', 'gold', 'silver', 'palladium', 'nickel']

function computeRecovery(device) {
  const effBase = device.efficiency.base
  const effPrec = device.efficiency.precious
  let total = 0
  const breakdown = {}
  METALS.forEach(m => {
    const grams = device.materials[m] || 0
    const eff = ['gold', 'silver', 'palladium'].includes(m) ? effPrec : effBase
    const commodity = COMMODITIES[m]
    const aud_per_g = commodity?.aud_per_g || 0
    const value = grams * eff * aud_per_g
    breakdown[m] = { grams, recoverable: +(grams * eff).toFixed(4), value: +value.toFixed(4) }
    total += value
  })
  return { total: +total.toFixed(2), breakdown }
}

export default function MaterialComposition() {
  const [selectedDevice, setSelectedDevice] = useState('smartphone')
  const [batchSize, setBatchSize] = useState(1)

  const device = DEVICE_COMPOSITIONS[selectedDevice]
  const { total, breakdown } = computeRecovery(device)
  const grossRecovery = total
  const logisticsTotal = (device.logistics_aud + device.processing_aud) * batchSize
  const netRecovery = Math.max(0, grossRecovery * batchSize - logisticsTotal)

  // Sort metals by value contribution for display
  const metalsByValue = METALS
    .map(m => ({ metal: m, ...breakdown[m] }))
    .sort((a, b) => b.value - a.value)

  const maxValue = metalsByValue[0]?.value || 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Material Composition Engine</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Device yield model · Metal exposure per category · Recovery value calculator
        </p>
      </div>

      {/* Device selector */}
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Device Category</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(DEVICE_COMPOSITIONS).map(([key, dev]) => (
            <button
              key={key}
              onClick={() => setSelectedDevice(key)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                selectedDevice === key
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >{dev.label}</button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Composition breakdown */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-600" />
            <h2 className="font-bold text-slate-900">{device.label} — Material Breakdown</h2>
          </div>

          {/* Device meta */}
          <div className="px-5 py-3 border-b border-slate-50 flex items-center gap-6 text-sm text-slate-500">
            <span>Weight: <strong className="text-slate-800">{device.weight_g}g</strong></span>
            <span>Unit: <strong className="text-slate-800">{device.unit}</strong></span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded-full">{device.characterisation}</span>
          </div>

          <div className="divide-y divide-slate-50">
            {metalsByValue.map(({ metal, grams, recoverable, value }) => {
              const mc = METAL_COLOR[metal] || { bar: 'bg-slate-300', dot: 'bg-slate-300', text: 'text-slate-500' }
              const barPct = maxValue > 0 ? (value / maxValue) * 100 : 0
              const pctOfTotal = grossRecovery > 0 ? (value / grossRecovery) * 100 : 0
              return (
                <div key={metal} className="px-5 py-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${mc.dot}`} />
                      <span className="text-sm font-semibold text-slate-800 capitalize">{metal}</span>
                      <span className="text-[11px] text-slate-400">{grams >= 1 ? `${grams}g` : `${(grams * 1000).toFixed(1)}mg`} raw</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${mc.text}`}>${value.toFixed(value >= 1 ? 2 : 4)}</span>
                      <span className="text-[10px] text-slate-400 ml-1">({pctOfTotal.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${mc.bar}`} style={{ width: `${barPct}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 w-32 text-right">
                      {recoverable >= 1 ? `${recoverable.toFixed(3)}g` : `${(recoverable * 1000).toFixed(2)}mg`} recoverable
                      × ${COMMODITIES[metal]?.aud_per_g.toFixed(metal === 'copper' || metal === 'aluminium' || metal === 'nickel' ? 4 : 2)}/g
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Base recovery eff: <span className="font-semibold text-slate-700">{(device.efficiency.base * 100).toFixed(0)}%</span></p>
              <p className="text-xs text-slate-500">Precious recovery eff: <span className="font-semibold text-slate-700">{(device.efficiency.precious * 100).toFixed(0)}%</span></p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-slate-900">${grossRecovery.toFixed(2)}</p>
              <p className="text-[11px] text-slate-400">gross recovery / {device.unit.split(' ').pop()}</p>
            </div>
          </div>
        </div>

        {/* Batch calculator */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-4 h-4 text-violet-600" />
              <h2 className="font-bold text-slate-900">Batch Recovery Calculator</h2>
            </div>

            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Batch Size</label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min="1" max="500" value={batchSize}
                  onChange={e => setBatchSize(Number(e.target.value))}
                  className="flex-1 accent-violet-600"
                />
                <div className="flex items-center border border-slate-200 rounded-lg">
                  <button onClick={() => setBatchSize(b => Math.max(1, b - 1))} className="px-3 py-2 text-slate-500 hover:text-slate-800 font-bold">−</button>
                  <input
                    type="number" value={batchSize} min="1" max="9999"
                    onChange={e => setBatchSize(Math.max(1, Number(e.target.value)))}
                    className="w-16 text-center text-sm font-bold text-slate-900 focus:outline-none py-2"
                  />
                  <button onClick={() => setBatchSize(b => Math.min(9999, b + 1))} className="px-3 py-2 text-slate-500 hover:text-slate-800 font-bold">+</button>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{device.unit}s</p>
            </div>

            <div className="space-y-3">
              {[
                { label: `Gross Recovery (${batchSize}× ${device.label})`, value: `$${(grossRecovery * batchSize).toFixed(2)}`, color: 'text-slate-800' },
                { label: `Logistics & Processing`, value: `-$${logisticsTotal.toFixed(2)}`, color: 'text-red-500' },
                { label: 'Net Recovery Value', value: `$${netRecovery.toFixed(2)}`, color: 'text-eco-700', bold: true },
              ].map(row => (
                <div key={row.label} className={`flex justify-between items-center text-sm ${row.bold ? 'font-bold border-t border-slate-100 pt-3' : ''}`}>
                  <span className={row.bold ? 'text-slate-900' : 'text-slate-500'}>{row.label}</span>
                  <span className={`font-bold ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-400 mt-4 bg-slate-50 rounded-xl px-3 py-2">
              Net recovery = input to pricing engine. Consumer offer is calculated by the Dynamic Pricing Engine applying current margin parameters.
            </p>
          </div>

          {/* Metal exposure summary */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="font-bold text-slate-900 mb-3">Metal Exposure (% of Recovery Value)</h2>
            <div className="flex items-end gap-1.5 h-24 mb-3">
              {metalsByValue.filter(m => m.value > 0).map(({ metal, value }) => {
                const mc = METAL_COLOR[metal] || { bar: 'bg-slate-300' }
                const pct = grossRecovery > 0 ? (value / grossRecovery) * 100 : 0
                return (
                  <div key={metal} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-full rounded-sm ${mc.bar}`} style={{ height: `${Math.max(2, pct * 0.9)}px`, maxHeight: 80 }} />
                    <span className="text-[9px] text-slate-400 capitalize">{metal.slice(0,2)}</span>
                  </div>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {metalsByValue.filter(m => m.value > 0.001).slice(0, 4).map(({ metal, value }) => {
                const mc = METAL_COLOR[metal]
                const pct = grossRecovery > 0 ? (value / grossRecovery) * 100 : 0
                return (
                  <div key={metal} className="flex items-center gap-1.5 text-xs">
                    <div className={`w-2 h-2 rounded-sm flex-shrink-0 ${mc?.dot || 'bg-slate-300'}`} />
                    <span className="text-slate-600 capitalize flex-1 truncate">{metal}</span>
                    <span className={`font-bold ${mc?.text || 'text-slate-600'}`}>{pct.toFixed(1)}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
