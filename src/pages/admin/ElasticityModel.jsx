import React, { useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { ELASTICITY_DATA } from '../../data/shadowLab'

const DEVICE_LABELS = {
  smartphone: 'Smartphone', laptop: 'Laptop', desktop: 'Desktop PC',
  tablet: 'Tablet', tv_monitor: 'TV / Monitor', large_appliance: 'Large Appliance',
  mixed_ewaste: 'Mixed E-Waste',
}

function ElasticityBadge({ coefficient }) {
  const abs = Math.abs(coefficient)
  if (abs > 1.2) return <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-full">Highly Elastic</span>
  if (abs > 0.8) return <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">Elastic</span>
  if (abs > 0.5) return <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">Inelastic</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 bg-eco-100 text-eco-700 rounded-full">Very Inelastic</span>
}

function DemandCurve({ curve, referenceOffer, simulatedMult }) {
  const maxVolMult = Math.max(...curve.map(p => p.volume_mult))
  const barHeight = 120

  return (
    <div className="relative">
      <div className="flex items-end gap-1 h-32 pb-0">
        {curve.map((pt, i) => {
          const h = (pt.volume_mult / maxVolMult) * barHeight
          const isBase = Math.abs(pt.price_mult - 1.0) < 0.05
          const isSim = simulatedMult && Math.abs(pt.price_mult - simulatedMult) < 0.06
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5">
              <div
                className={`w-full rounded-t-sm transition-all ${
                  isSim ? 'bg-violet-500' : isBase ? 'bg-eco-500' : 'bg-slate-200'
                }`}
                style={{ height: `${h}px` }}
                title={`Price ×${pt.price_mult} → Volume ×${pt.volume_mult}`}
              />
              <p className={`text-[8px] font-mono ${isBase ? 'text-eco-600 font-bold' : 'text-slate-400'}`}>
                {pt.price_mult.toFixed(1)}x
              </p>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[9px] text-slate-400 mt-1 px-1">
        <span>Lower offer ▸</span>
        <span>▸ Higher offer</span>
      </div>
    </div>
  )
}

export default function ElasticityModel() {
  const [device, setDevice] = useState('smartphone')
  const [priceMult, setPriceMult] = useState(1.0)

  const data = ELASTICITY_DATA[device]
  const simPoint = data.curve.reduce((closest, pt) =>
    Math.abs(pt.price_mult - priceMult) < Math.abs(closest.price_mult - priceMult) ? pt : closest
  , data.curve[0])
  const simOffer = (data.reference_offer_aud * priceMult).toFixed(2)
  const simVolume = Math.round(data.reference_volume_wk * simPoint.volume_mult)
  const simRevenue = (simVolume * data.reference_offer_aud * priceMult * (1 - 0.284)).toFixed(0)

  const crossElasticityTable = Object.entries(ELASTICITY_DATA)
    .filter(([d]) => d !== device)
    .slice(0, 4)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Price Elasticity Model</h1>
        <p className="text-sm text-slate-500 mt-0.5">How volume responds to offer price changes · derived from 90-day A/B test data</p>
      </div>

      {/* Device selector */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(DEVICE_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => { setDevice(key); setPriceMult(1.0) }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
              device === key
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-700'
            }`}>{label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — curve + coefficient */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-bold text-slate-900">{DEVICE_LABELS[device]}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{data.label}</p>
            </div>
            <ElasticityBadge coefficient={data.coefficient} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-slate-900">{data.coefficient}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Elasticity coefficient</p>
              <p className="text-[10px] text-slate-400">1% price rise → {Math.abs(data.coefficient).toFixed(2)}% volume drop</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-slate-900">${data.reference_offer_aud}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Current offer (AUD)</p>
              <p className="text-[10px] text-slate-400">{data.reference_volume_wk} units / wk baseline</p>
            </div>
          </div>

          <DemandCurve curve={data.curve} referenceOffer={data.reference_offer_aud} simulatedMult={priceMult} />
          <p className="text-[10px] text-slate-400 text-center">
            Green bar = current price · Violet bar = simulated price · Y-axis = relative volume
          </p>
        </div>

        {/* Right — simulator */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5">
          <h2 className="font-bold text-slate-900">What-If Simulator</h2>

          <div>
            <div className="flex justify-between text-xs font-semibold mb-2">
              <span className="text-slate-500">Price multiplier</span>
              <span className="text-violet-700 font-mono">{priceMult.toFixed(2)}×</span>
            </div>
            <input type="range" min="0.70" max="1.50" step="0.05"
              value={priceMult}
              onChange={e => setPriceMult(parseFloat(e.target.value))}
              className="w-full accent-violet-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>0.70× (−30%)</span><span>1.00× baseline</span><span>1.50× (+50%)</span>
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl p-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Simulated Offer</p>
              <p className="text-2xl font-bold text-white">${simOffer}</p>
              <p className={`text-xs font-bold mt-0.5 ${priceMult > 1 ? 'text-red-400' : priceMult < 1 ? 'text-eco-400' : 'text-slate-400'}`}>
                {priceMult === 1 ? 'No change' : priceMult > 1 ? `+${((priceMult - 1) * 100).toFixed(0)}% above baseline` : `${((priceMult - 1) * 100).toFixed(0)}% below baseline`}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Projected Volume / wk</p>
              <p className="text-2xl font-bold text-white">{simVolume.toLocaleString()}</p>
              <p className={`text-xs font-bold mt-0.5 ${simPoint.volume_mult > 1 ? 'text-eco-400' : simPoint.volume_mult < 1 ? 'text-red-400' : 'text-slate-400'}`}>
                {((simPoint.volume_mult - 1) * 100).toFixed(1)}% vs baseline
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Gross Revenue / wk</p>
              <p className="text-xl font-bold text-white">${parseInt(simRevenue).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Revenue Change</p>
              <p className={`text-xl font-bold ${
                parseInt(simRevenue) > data.reference_volume_wk * data.reference_offer_aud * 0.716 ? 'text-eco-400' : 'text-red-400'
              }`}>
                {(((parseInt(simRevenue) / (data.reference_volume_wk * data.reference_offer_aud * 0.716)) - 1) * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Interpretation */}
          <div className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-600">
            {Math.abs(priceMult - 1.0) < 0.04 ? (
              <p>At baseline pricing. Adjust the slider to simulate offer changes.</p>
            ) : priceMult > 1 ? (
              <p>Raising the offer by {((priceMult - 1) * 100).toFixed(0)}% increases cost to EcoBin. Volume drops by {((1 - simPoint.volume_mult) * 100).toFixed(0)}%.
                {simPoint.volume_mult < 0.85 ? ' Significant volume risk — consider partial rollout via A/B test before committing.' : ' Volume impact is manageable.'}</p>
            ) : (
              <p>Lowering the offer by {((1 - priceMult) * 100).toFixed(0)}% boosts volume by {((simPoint.volume_mult - 1) * 100).toFixed(0)}%.
                Monitor fraud rate closely — volume surges attract opportunistic submissions.</p>
            )}
          </div>
        </div>
      </div>

      {/* Cross-elasticity reference */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 bg-slate-900">
          <h2 className="font-bold text-white">All Device Elasticity Summary</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Ranked by absolute elasticity coefficient</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50">
                <th className="text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Device</th>
                <th className="text-center px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Coefficient</th>
                <th className="text-left px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Classification</th>
                <th className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase">Ref. Offer</th>
                <th className="text-right px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Ref. Volume / wk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {Object.entries(ELASTICITY_DATA)
                .sort((a, b) => Math.abs(b[1].coefficient) - Math.abs(a[1].coefficient))
                .map(([d, data]) => (
                  <tr key={d} className={d === device ? 'bg-violet-50/40' : ''}>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-800">{DEVICE_LABELS[d]}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="font-mono font-bold text-slate-700">{data.coefficient}</span>
                    </td>
                    <td className="px-3 py-3"><ElasticityBadge coefficient={data.coefficient} /></td>
                    <td className="px-3 py-3 text-right text-sm text-slate-600">${data.reference_offer_aud}</td>
                    <td className="px-5 py-3 text-right text-sm text-slate-600">{data.reference_volume_wk.toLocaleString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
