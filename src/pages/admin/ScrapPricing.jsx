import React, { useState, useEffect } from 'react'
import { Star } from 'lucide-react'
import { SCRAP_FEEDS, COMMODITIES } from '../../data/pie'
import { marketFeed, COMMODITIES as ECOBIN_MATS } from '../../lib/marketFeed'

const MATERIAL_ORDER = ['copper', 'aluminium', 'tin', 'nickel', 'gold', 'silver', 'palladium']
const GRADE_COLOR = { A: 'bg-eco-100 text-eco-700', B: 'bg-amber-100 text-amber-700', C: 'bg-red-100 text-red-600' }
const MATERIAL_COLOR = {
  copper: 'bg-orange-100 text-orange-700', aluminium: 'bg-slate-100 text-slate-700',
  tin: 'bg-sky-100 text-sky-700', nickel: 'bg-lime-100 text-lime-700',
  gold: 'bg-amber-100 text-amber-700', silver: 'bg-violet-50 text-violet-600',
  palladium: 'bg-violet-100 text-violet-700',
}

const DEALERS = ['Sims Metal Management', 'Cleanaway Metals', 'Visy Industries', 'Precious Metal Recovery', 'Metalrecycle AU']

export default function ScrapPricing() {
  const [selectedMaterial, setSelectedMaterial] = useState('copper')
  const [selectedGrade, setSelectedGrade]        = useState('A')
  const [liveRates, setLiveRates]                = useState({})

  useEffect(() => {
    marketFeed.start()
    const unsub = marketFeed.subscribe(null, r => {
      setLiveRates(prev => ({ ...prev, [r.material]: r }))
    })
    return () => { unsub(); marketFeed.stop() }
  }, [])

  const filteredFeeds = SCRAP_FEEDS.filter(
    f => f.material === selectedMaterial && f.grade === selectedGrade
  )
  const allGradesForMaterial = SCRAP_FEEDS.filter(f => f.material === selectedMaterial)
  const grades = [...new Set(allGradesForMaterial.map(f => f.grade))].sort()

  const maxPrice = filteredFeeds.length ? Math.max(...filteredFeeds.map(f => f.aud_per_kg)) : 1
  const minPrice = filteredFeeds.length ? Math.min(...filteredFeeds.map(f => f.aud_per_kg)) : 0
  const bestDeal = filteredFeeds.reduce((best, f) => (!best || f.aud_per_kg > best.aud_per_kg) ? f : best, null)

  // LME/CME reference price for this material (what the market says it's worth)
  const commodity = COMMODITIES[selectedMaterial]
  const referenceAudKg = commodity?.aud_per_kg

  const isPrecious = ['gold', 'silver', 'palladium'].includes(selectedMaterial)
  const unitLabel = isPrecious ? '/kg' : '/kg'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Scrap Pricing Layer</h1>
        <p className="text-sm text-slate-500 mt-0.5">Australian recycler & scrap dealer rates by material and grade</p>
      </div>

      {/* Live EcoBin Recyclable Spot Rates */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 bg-eco-500 rounded-full animate-pulse" />
          <h2 className="text-sm font-bold text-slate-700">Live EcoBin Spot Rates</h2>
          <span className="text-[10px] text-slate-400 ml-auto">Consumer rate · AUD/kg</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {Object.entries(ECOBIN_MATS).map(([key, cfg]) => {
            const r = liveRates[key]
            return (
              <div key={key} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <p className="text-[10px] text-slate-500 font-semibold truncate">{cfg.label}</p>
                <p className="text-base font-bold text-eco-700 mt-1">
                  {r ? `$${r.consumer_rate.toFixed(4)}` : '—'}
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  {r ? `$${r.spot.toLocaleString('en-AU', { maximumFractionDigits: 0 })}/t` : 'Loading'}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Material selector */}
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Select Material</p>
        <div className="flex flex-wrap gap-2">
          {MATERIAL_ORDER.map(m => (
            <button
              key={m}
              onClick={() => { setSelectedMaterial(m); setSelectedGrade('A') }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all capitalize ${
                selectedMaterial === m
                  ? `border-transparent ${MATERIAL_COLOR[m]}`
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >{m}</button>
          ))}
        </div>
      </div>

      {/* Grade selector */}
      {grades.length > 1 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Grade</p>
          <div className="flex gap-2">
            {grades.map(g => (
              <button
                key={g}
                onClick={() => setSelectedGrade(g)}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  selectedGrade === g
                    ? `border-transparent ${GRADE_COLOR[g]}`
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >Grade {g}</button>
            ))}
          </div>
        </div>
      )}

      {/* Summary strip */}
      {filteredFeeds.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Best Offer',   value: `$${maxPrice.toFixed(maxPrice >= 100 ? 0 : 2)}/kg`,  color: 'text-eco-700',   bg: 'bg-eco-50' },
            { label: 'Worst Offer',  value: `$${minPrice.toFixed(minPrice >= 100 ? 0 : 2)}/kg`,  color: 'text-slate-800', bg: 'bg-slate-50' },
            { label: 'Spread',       value: `$${(maxPrice - minPrice).toFixed(2)}/kg`,            color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'LME/CME Ref', value: referenceAudKg ? `$${referenceAudKg.toFixed(referenceAudKg >= 100 ? 0 : 2)}/kg` : '—', color: 'text-violet-600', bg: 'bg-violet-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Dealer price comparison */}
      {filteredFeeds.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 capitalize">
              {selectedMaterial} — Grade {selectedGrade} Offers
            </h2>
            <span className="text-[11px] text-slate-400">Sorted by offer price ↓</span>
          </div>
          <div className="divide-y divide-slate-50">
            {[...filteredFeeds].sort((a, b) => b.aud_per_kg - a.aud_per_kg).map((feed, i) => {
              const isBest = feed.aud_per_kg === maxPrice
              const barPct = maxPrice > 0 ? (feed.aud_per_kg / maxPrice) * 100 : 0
              const refPct = referenceAudKg ? (feed.aud_per_kg / referenceAudKg) * 100 : null
              return (
                <div key={`${feed.dealer}-${feed.material}-${feed.grade}`} className={`px-5 py-4 ${isBest ? 'bg-eco-50/50' : ''}`}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      {isBest && <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                      <div>
                        <p className="text-sm font-bold text-slate-900">{feed.dealer}</p>
                        <p className="text-[11px] text-slate-400">
                          Updated {new Date(feed.updated).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xl font-bold ${isBest ? 'text-eco-700' : 'text-slate-800'}`}>
                        ${feed.aud_per_kg.toLocaleString(undefined, { minimumFractionDigits: feed.aud_per_kg >= 100 ? 0 : 2 })}/kg
                      </p>
                      {refPct && (
                        <p className="text-[10px] text-slate-400">
                          {refPct.toFixed(1)}% of {commodity.exchange} reference
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${isBest ? 'bg-eco-500' : 'bg-violet-400'}`} style={{ width: `${barPct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          {bestDeal && (
            <div className="px-5 py-3 border-t border-slate-50 bg-eco-50">
              <p className="text-xs text-eco-700 font-semibold">
                Best rate: <span className="font-bold">{bestDeal.dealer}</span> at ${bestDeal.aud_per_kg.toLocaleString()}/kg
                {referenceAudKg && (
                  <span className="font-normal text-eco-600">
                    {' '}— {((bestDeal.aud_per_kg / referenceAudKg) * 100).toFixed(1)}% of LME/CME spot
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-50 rounded-2xl border border-slate-100 px-5 py-10 text-center">
          <p className="text-sm text-slate-500">No dealer feeds for {selectedMaterial} Grade {selectedGrade}</p>
        </div>
      )}

      {/* All dealer matrix */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">Full Dealer Matrix</h2>
          <p className="text-xs text-slate-400 mt-0.5">All materials, Grade A — AUD/kg</p>
        </div>
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-slate-50 bg-slate-50">
              <th className="text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase">Dealer</th>
              {MATERIAL_ORDER.map(m => (
                <th key={m} className="text-right px-3 py-3 text-[11px] text-slate-400 font-semibold uppercase capitalize">{m.slice(0, 3)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {DEALERS.map(dealer => (
              <tr key={dealer} className="hover:bg-slate-50">
                <td className="px-5 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{dealer}</td>
                {MATERIAL_ORDER.map(mat => {
                  const feed = SCRAP_FEEDS.find(f => f.dealer === dealer && f.material === mat && f.grade === 'A')
                  const allForMat = SCRAP_FEEDS.filter(f => f.material === mat && f.grade === 'A')
                  const matMax = allForMat.length ? Math.max(...allForMat.map(f => f.aud_per_kg)) : 0
                  const isBest = feed && feed.aud_per_kg === matMax
                  return (
                    <td key={mat} className={`px-3 py-3 text-right text-xs ${isBest ? 'font-bold text-eco-700' : 'text-slate-600'}`}>
                      {feed ? (
                        <span>{feed.aud_per_kg >= 1000 ? `$${(feed.aud_per_kg/1000).toFixed(1)}k` : `$${feed.aud_per_kg.toFixed(feed.aud_per_kg >= 100 ? 0 : 2)}`}</span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
