import React, { useState } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Info } from 'lucide-react'

const LAST_UPDATED = '29 May 2026, 14:32 AEST'

const SOURCES = [
  { id: 'commodity_news',   label: 'Commodity News',   weight: 40, score: 71 },
  { id: 'social_media',     label: 'Social Media',     weight: 20, score: 58 },
  { id: 'industry_reports', label: 'Industry Reports', weight: 30, score: 74 },
  { id: 'regulatory',       label: 'Regulatory',       weight: 10, score: 62 },
]

const OVERALL_SCORE = 68

const SIGNALS = [
  { ts: '2026-05-29 14:18', source: 'Commodity News',   headline: 'Aluminium prices rally amid global supply squeeze and rising EV demand', score: 0.78, impact: 'H', material: 'Aluminium' },
  { ts: '2026-05-29 13:55', source: 'Industry Reports', headline: 'Copper deficit forecast deepens for Q3; mining output falls short in Chile', score: 0.65, impact: 'H', material: 'Copper' },
  { ts: '2026-05-29 13:30', source: 'Social Media',     headline: 'Trending: #RecycleMore campaign drives consumer e-waste submissions up 18%', score: 0.44, impact: 'M', material: 'Mixed' },
  { ts: '2026-05-29 12:47', source: 'Regulatory',       headline: 'EPA announces extended producer responsibility rules effective Q4 2026', score: 0.52, impact: 'M', material: 'All' },
  { ts: '2026-05-29 12:10', source: 'Commodity News',   headline: 'Steel scrap market softens on weak Chinese construction data for April', score: -0.61, impact: 'H', material: 'Steel' },
  { ts: '2026-05-29 11:33', source: 'Industry Reports', headline: 'Lithium oversupply persists; battery-grade prices down 12% month-on-month', score: -0.72, impact: 'H', material: 'Lithium' },
  { ts: '2026-05-29 10:58', source: 'Social Media',     headline: 'Consumer complaints spike over delayed payout processing at recyclers', score: -0.38, impact: 'L', material: 'Mixed' },
  { ts: '2026-05-29 10:14', source: 'Regulatory',       headline: 'Government extends circular economy grants through 2027 in budget update', score: 0.59, impact: 'M', material: 'All' },
  { ts: '2026-05-29 09:41', source: 'Commodity News',   headline: 'Nickel futures gain on Indonesian export quota concerns, up 3.4% overnight', score: 0.47, impact: 'M', material: 'Nickel' },
  { ts: '2026-05-29 09:05', source: 'Industry Reports', headline: 'Plastics recovery rate stagnates; contamination rates remain industry challenge', score: -0.29, impact: 'L', material: 'Plastics' },
]

// 30-day sentiment trend data (daily overall score 0–100)
const TREND_DATA = [
  52, 55, 53, 58, 61, 59, 57, 62, 65, 63, 61, 64, 67, 70, 68, 66, 69, 72, 70, 68,
  65, 63, 66, 68, 71, 69, 67, 70, 68, 68,
]

const POSITIVE_KEYWORDS = [
  'supply squeeze', 'EV demand', 'deficit forecast', 'circular economy',
  'recycling grants', 'producer responsibility',
]
const NEGATIVE_KEYWORDS = [
  'oversupply', 'weak construction', 'contamination', 'delayed payout',
  'price decline', 'export quota',
]

function scoreToBand(score) {
  if (score <= 35) return { label: 'Bearish', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' }
  if (score <= 64) return { label: 'Neutral', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' }
  return { label: 'Bullish', color: 'text-eco-700', bg: 'bg-eco-50', border: 'border-eco-200' }
}

function ScoreBadge({ score }) {
  const abs = Math.abs(score)
  if (score >= 0.5)  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-eco-100 text-eco-700">{score.toFixed(2)}</span>
  if (score >= 0.2)  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-eco-50 text-eco-600">{score.toFixed(2)}</span>
  if (score <= -0.5) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{score.toFixed(2)}</span>
  if (score <= -0.2) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">{score.toFixed(2)}</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">{score.toFixed(2)}</span>
}

function ImpactBadge({ impact }) {
  const map = { H: 'bg-red-100 text-red-700', M: 'bg-amber-100 text-amber-700', L: 'bg-slate-100 text-slate-500' }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${map[impact]}`}>{impact}</span>
}

function MiniBar({ value, max = 100, color }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function SentimentGauge({ score }) {
  const pct = Math.max(0, Math.min(100, score))
  const band = scoreToBand(score)
  return (
    <div className="space-y-3">
      {/* Zone labels */}
      <div className="flex text-[10px] font-semibold">
        <span className="w-[35%] text-red-500">Bearish (0–35)</span>
        <span className="w-[29%] text-center text-amber-500">Neutral (36–64)</span>
        <span className="flex-1 text-right text-eco-600">Bullish (65–100)</span>
      </div>
      {/* Bar */}
      <div className="relative h-5 rounded-full overflow-hidden flex">
        <div className="h-full bg-red-200" style={{ width: '35%' }} />
        <div className="h-full bg-amber-200" style={{ width: '29%' }} />
        <div className="h-full bg-eco-200" style={{ width: '36%' }} />
        {/* Needle */}
        <div
          className="absolute top-0 h-full w-1 bg-slate-900 rounded-full shadow-md transition-all"
          style={{ left: `calc(${pct}% - 2px)` }}
        />
      </div>
      {/* Tick marks */}
      <div className="relative h-4">
        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => (
          <span
            key={v}
            className="absolute text-[9px] text-slate-400 -translate-x-1/2"
            style={{ left: `${v}%` }}
          >{v}</span>
        ))}
      </div>
      {/* Score readout */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${band.bg} border ${band.border}`}>
        <span className={`text-3xl font-black ${band.color}`}>{score}</span>
        <div>
          <p className={`text-sm font-bold ${band.color}`}>{band.label}</p>
          <p className="text-xs text-slate-500">Overall market sentiment score (0–100)</p>
        </div>
      </div>
    </div>
  )
}

function TrendChart({ data }) {
  const W = 560
  const H = 160
  const PAD = { top: 20, right: 20, bottom: 28, left: 36 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const minY = 0
  const maxY = 100

  function xOf(i) { return PAD.left + (i / (data.length - 1)) * chartW }
  function yOf(v) { return PAD.top + chartH - ((v - minY) / (maxY - minY)) * chartH }

  const points = data.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ')
  const areaPoints = `${xOf(0)},${yOf(0)} ${points} ${xOf(data.length - 1)},${yOf(0)}`

  // Zone horizontal bands y positions
  const yBearishTop = yOf(35)
  const yNeutralTop = yOf(64)
  const yBullishTop = yOf(100)
  const yBottom = yOf(0)

  // X-axis labels: every 5 days
  const xLabels = [1, 5, 10, 15, 20, 25, 30]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      {/* Zone bands */}
      <rect x={PAD.left} y={yBullishTop} width={chartW} height={yNeutralTop - yBullishTop} fill="#dcfce7" opacity="0.5" />
      <rect x={PAD.left} y={yNeutralTop} width={chartW} height={yBearishTop - yNeutralTop} fill="#fef9c3" opacity="0.5" />
      <rect x={PAD.left} y={yBearishTop} width={chartW} height={yBottom - yBearishTop} fill="#fee2e2" opacity="0.5" />

      {/* Zone boundary lines */}
      <line x1={PAD.left} y1={yNeutralTop} x2={PAD.left + chartW} y2={yNeutralTop} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" />
      <line x1={PAD.left} y1={yBearishTop} x2={PAD.left + chartW} y2={yBearishTop} stroke="#ef4444" strokeWidth="1" strokeDasharray="4 3" />

      {/* Zone labels right side */}
      <text x={PAD.left + chartW - 2} y={yBullishTop + 12} textAnchor="end" fontSize="8" fill="#16a34a" fontWeight="600">Bullish</text>
      <text x={PAD.left + chartW - 2} y={yNeutralTop + 12} textAnchor="end" fontSize="8" fill="#d97706" fontWeight="600">Neutral</text>
      <text x={PAD.left + chartW - 2} y={yBearishTop + 12} textAnchor="end" fontSize="8" fill="#dc2626" fontWeight="600">Bearish</text>

      {/* Area fill */}
      <polygon points={areaPoints} fill="#4ade80" opacity="0.12" />

      {/* Polyline */}
      <polyline points={points} fill="none" stroke="#16a34a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* Current point dot */}
      <circle cx={xOf(data.length - 1)} cy={yOf(data[data.length - 1])} r="4" fill="#16a34a" stroke="#fff" strokeWidth="2" />

      {/* Y-axis labels */}
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line x1={PAD.left - 4} y1={yOf(v)} x2={PAD.left} y2={yOf(v)} stroke="#cbd5e1" strokeWidth="1" />
          <text x={PAD.left - 6} y={yOf(v) + 3} textAnchor="end" fontSize="8" fill="#94a3b8">{v}</text>
        </g>
      ))}

      {/* X-axis labels */}
      {xLabels.map(d => (
        <text key={d} x={xOf(d - 1)} y={H - 6} textAnchor="middle" fontSize="8" fill="#94a3b8">D{d}</text>
      ))}

      {/* X-axis line */}
      <line x1={PAD.left} y1={yOf(0)} x2={PAD.left + chartW} y2={yOf(0)} stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  )
}

export default function SentimentEngine() {
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(LAST_UPDATED)

  function handleRefresh() {
    setRefreshing(true)
    setTimeout(() => {
      setRefreshing(false)
      setLastUpdated(new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' AEST')
    }, 1400)
  }

  const overallBand = scoreToBand(OVERALL_SCORE)
  const weightedScore = SOURCES.reduce((sum, s) => sum + (s.score * s.weight) / 100, 0).toFixed(1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Market Sentiment Engine</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            NLP-driven multi-source sentiment analysis · Last updated: <span className="font-semibold text-slate-700">{lastUpdated}</span>
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            refreshing ? 'bg-violet-100 text-violet-400 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700 text-white'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Feed
        </button>
      </div>

      {/* Overall sentiment gauge */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold text-slate-900 mb-4">Overall Sentiment Gauge</h2>
        <SentimentGauge score={OVERALL_SCORE} />
      </div>

      {/* Source breakdown */}
      <div>
        <h2 className="font-bold text-slate-900 mb-3">Source Breakdown</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {SOURCES.map(src => {
            const band = scoreToBand(src.score)
            const barColor = src.score >= 65 ? 'bg-eco-500' : src.score >= 36 ? 'bg-amber-400' : 'bg-red-500'
            return (
              <div key={src.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-1 mb-2">
                  <p className="text-xs font-bold text-slate-700 leading-snug">{src.label}</p>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full flex-shrink-0">
                    {src.weight}%
                  </span>
                </div>
                <p className={`text-2xl font-black ${band.color}`}>{src.score}</p>
                <p className={`text-[10px] font-semibold ${band.color}`}>{band.label}</p>
                <MiniBar value={src.score} max={100} color={barColor} />
                <p className="text-[10px] text-slate-400 mt-1.5">Weight: {src.weight}% of composite</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent sentiment signals table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-900">Recent Sentiment Signals</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Latest 10 signals ingested across all sources</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase">Timestamp</th>
                <th className="text-left px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Source</th>
                <th className="text-left px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Headline</th>
                <th className="text-center px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Score</th>
                <th className="text-center px-3 py-3 text-[10px] font-semibold text-slate-400 uppercase">Impact</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase">Material</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {SIGNALS.map((sig, i) => (
                <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3 text-[11px] text-slate-400 whitespace-nowrap font-mono">{sig.ts}</td>
                  <td className="px-3 py-3 text-[11px] text-slate-500 whitespace-nowrap font-semibold">{sig.source}</td>
                  <td className="px-3 py-3 text-xs text-slate-700 max-w-xs">
                    <p className="truncate">{sig.headline}</p>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <ScoreBadge score={sig.score} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <ImpactBadge impact={sig.impact} />
                  </td>
                  <td className="px-5 py-3 text-xs font-semibold text-slate-600">{sig.material}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 30-day sentiment trend chart */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-slate-900">30-Day Sentiment Trend</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Daily composite score — shaded bands show Bearish / Neutral / Bullish zones</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-semibold">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-eco-200 inline-block" /> Bullish</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-amber-200 inline-block" /> Neutral</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-red-200 inline-block" /> Bearish</span>
          </div>
        </div>
        <TrendChart data={TREND_DATA} />
      </div>

      {/* Keyword chips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-eco-700 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Positive Keywords
          </h3>
          <div className="flex flex-wrap gap-2">
            {POSITIVE_KEYWORDS.map(kw => (
              <span key={kw} className="px-3 py-1.5 bg-eco-50 border border-eco-200 text-eco-700 text-xs font-semibold rounded-full">
                {kw}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-red-600 mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Negative Keywords
          </h3>
          <div className="flex flex-wrap gap-2">
            {NEGATIVE_KEYWORDS.map(kw => (
              <span key={kw} className="px-3 py-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-full">
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing recommendation card */}
      <div className="bg-slate-900 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-eco-600 rounded-xl flex-shrink-0">
            <Info className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pricing Recommendation</p>
            <p className="text-white font-bold text-base leading-snug">
              Based on sentiment ({overallBand.label}, {OVERALL_SCORE}/100): consider{' '}
              <span className="text-eco-400">+2–4% on Aluminium consumer rate</span>
            </p>
            <p className="text-slate-400 text-xs mt-2">
              Composite weighted score: <span className="text-white font-mono font-bold">{weightedScore}/100</span> · Source weights: Commodity News 40%, Industry Reports 30%, Social Media 20%, Regulatory 10%.
              Bullish signal sustained for 6+ days; conditions favour modest price increase before next scheduled review on 5 Jun 2026.
            </p>
            <div className="flex gap-3 mt-3">
              <button className="px-4 py-2 bg-eco-600 hover:bg-eco-700 text-white text-xs font-bold rounded-xl transition-colors">
                Apply Recommendation
              </button>
              <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl transition-colors">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
