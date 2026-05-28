import React, { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react'
import { SENTIMENT_FEED, MACRO_SIGNALS, COMMODITIES } from '../../data/pie'

const METAL_ORDER = ['copper', 'aluminium', 'tin', 'nickel', 'gold', 'silver', 'palladium']

function SentimentBar({ score }) {
  // score: -1 (bearish) to +1 (bullish)
  const pct = ((score + 1) / 2) * 100  // 0-100 scale
  const color = score > 0.3 ? 'bg-eco-500' : score < -0.3 ? 'bg-red-500' : 'bg-amber-400'
  const label = score > 0.5 ? 'Bullish' : score > 0.2 ? 'Mildly Bullish' : score < -0.5 ? 'Bearish' : score < -0.2 ? 'Mildly Bearish' : 'Neutral'
  const labelColor = score > 0.3 ? 'text-eco-700' : score < -0.3 ? 'text-red-700' : 'text-amber-700'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400 w-12 text-right">Bearish</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full relative">
        <div className="absolute left-1/2 top-0 w-px h-full bg-slate-300" />
        <div className={`absolute top-0 h-full rounded-full ${color}`}
          style={{ left: `${score < 0 ? pct : 50}%`, width: `${Math.abs(score * 50)}%` }} />
      </div>
      <span className="text-[10px] text-slate-400 w-12">Bullish</span>
      <span className={`text-[10px] font-bold w-24 ${labelColor}`}>{label} ({score > 0 ? '+' : ''}{score.toFixed(2)})</span>
    </div>
  )
}

function SentimentChip({ score }) {
  const color = score > 0.3 ? 'bg-eco-100 text-eco-700 border-eco-200'
    : score < -0.3 ? 'bg-red-100 text-red-700 border-red-200'
    : 'bg-amber-100 text-amber-700 border-amber-200'
  const label = score > 0.5 ? 'Bullish' : score > 0.2 ? 'Mildly +' : score < -0.5 ? 'Bearish' : score < -0.2 ? 'Mildly −' : 'Neutral'
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${color}`}>{label}</span>
}

function MacroSignalCard({ signal }) {
  const TrendIcon = signal.trend === 'up' ? TrendingUp : signal.trend === 'down' ? TrendingDown : Minus
  const impactColor = signal.impact === 'bullish' ? 'text-eco-600' : signal.impact === 'bearish' ? 'text-red-500' : 'text-slate-400'
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs font-bold text-slate-700">{signal.signal}</p>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize ${
          signal.impact === 'bullish' ? 'bg-eco-100 text-eco-700' :
          signal.impact === 'bearish' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
        }`}>{signal.impact}</span>
      </div>
      <div className="flex items-center gap-2">
        <TrendIcon className={`w-4 h-4 flex-shrink-0 ${impactColor}`} />
        <p className="text-lg font-bold text-slate-900">{signal.value}</p>
      </div>
      <p className="text-[11px] text-slate-500 mt-2">{signal.note}</p>
      {signal.metals.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {signal.metals.map(m => (
            <span key={m} className="text-[9px] font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded capitalize">{m}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SentimentEngine() {
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all'
    ? SENTIMENT_FEED
    : filter === 'bullish'
    ? SENTIMENT_FEED.filter(s => s.sentiment_score > 0.2)
    : SENTIMENT_FEED.filter(s => s.sentiment_score < -0.2)

  // Aggregate sentiment by metal
  const metalSentiment = METAL_ORDER.map(metal => {
    const articles = SENTIMENT_FEED.filter(s => s.metals.includes(metal))
    if (!articles.length) return { metal, score: 0, count: 0 }
    const avg = articles.reduce((s, a) => s + a.sentiment_score, 0) / articles.length
    return { metal, score: avg, count: articles.length }
  })

  const bullishCount = SENTIMENT_FEED.filter(s => s.sentiment_score > 0.2).length
  const bearishCount = SENTIMENT_FEED.filter(s => s.sentiment_score < -0.2).length
  const avgScore = SENTIMENT_FEED.reduce((s, a) => s + a.sentiment_score, 0) / SENTIMENT_FEED.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sentiment Engine</h1>
        <p className="text-sm text-slate-500 mt-0.5">NLP news analysis · Macro signals · Metal-specific sentiment scoring</p>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Market Sentiment',   value: avgScore > 0 ? 'Mildly Bullish' : 'Mildly Bearish', color: avgScore > 0 ? 'text-eco-700' : 'text-red-600', bg: avgScore > 0 ? 'bg-eco-50' : 'bg-red-50' },
          { label: 'Bullish Articles',   value: bullishCount,  color: 'text-eco-700',  bg: 'bg-eco-50' },
          { label: 'Bearish Articles',   value: bearishCount,  color: 'text-red-600',  bg: 'bg-red-50' },
          { label: 'Articles Processed', value: SENTIMENT_FEED.length, color: 'text-slate-800', bg: 'bg-slate-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-100 shadow-sm p-4`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Metal sentiment heatmap */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold text-slate-900 mb-4">Metal Sentiment Heat</h2>
        <div className="space-y-3">
          {metalSentiment.map(({ metal, score, count }) => (
            <div key={metal} className="flex items-center gap-4">
              <span className="text-xs font-bold text-slate-700 capitalize w-20 flex-shrink-0">{metal}</span>
              <div className="flex-1">
                <SentimentBar score={score} />
              </div>
              <span className="text-[11px] text-slate-400 flex-shrink-0">{count} art.</span>
            </div>
          ))}
        </div>
      </div>

      {/* Macro signals */}
      <div>
        <h2 className="font-bold text-slate-900 mb-3">Macro Market Signals</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MACRO_SIGNALS.map(signal => (
            <MacroSignalCard key={signal.signal} signal={signal} />
          ))}
        </div>
      </div>

      {/* News feed */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-bold text-slate-900">News Feed</h2>
          <div className="flex gap-2">
            {[
              { id: 'all',     label: 'All' },
              { id: 'bullish', label: 'Bullish' },
              { id: 'bearish', label: 'Bearish' },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  filter === f.id ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>{f.label}</button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {filtered.map(article => (
            <div key={article.id} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                  article.sentiment_score > 0.3 ? 'bg-eco-500' :
                  article.sentiment_score < -0.3 ? 'bg-red-500' : 'bg-amber-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-slate-900 flex-1">{article.headline}</p>
                    <SentimentChip score={article.sentiment_score} />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                    <span className="font-semibold text-slate-500">{article.source}</span>
                    <span>{new Date(article.published_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <div className="flex gap-1">
                      {article.metals.map(m => (
                        <span key={m} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-semibold capitalize">{m}</span>
                      ))}
                    </div>
                    <span className={`font-bold ${article.magnitude === 'High' ? 'text-red-500' : article.magnitude === 'Medium' ? 'text-amber-500' : 'text-slate-400'}`}>
                      {article.magnitude} impact
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
