import React, { useState } from 'react'
import {
  Building2, MapPin, Award, TrendingUp, DollarSign, FileText,
  CheckCircle, Clock, AlertCircle, ChevronRight, Phone, Mail,
  Package, Zap, Users, Star, Download,
} from 'lucide-react'
import { slaEngine, SLA_TIERS } from '../../lib/slaEngine'

// ── Franchise tiers ───────────────────────────────────────────────────────────

const FRANCHISE_TIERS = [
  {
    tier: 'starter',    label: 'Starter',    minStations: 1,  maxStations: 3,
    revenueSharePct: 70, setupFeeAud: 2_500, monthlyFeeAud: 250,
    color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200',
    perks: ['Equipment lease included', 'Basic analytics', 'Email support'],
  },
  {
    tier: 'growth',     label: 'Growth',     minStations: 4,  maxStations: 9,
    revenueSharePct: 75, setupFeeAud: 0,     monthlyFeeAud: 180,
    color: 'text-eco-700', bg: 'bg-eco-50', border: 'border-eco-200',
    perks: ['Equipment lease included', 'Full analytics dashboard', 'Priority support', 'Marketing co-op'],
  },
  {
    tier: 'enterprise', label: 'Enterprise', minStations: 10, maxStations: Infinity,
    revenueSharePct: 80, setupFeeAud: 0,     monthlyFeeAud: 120,
    color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200',
    perks: ['Equipment lease + insurance', 'White-label branding', 'Dedicated account manager', 'Territory exclusivity', 'Volume commodity pricing'],
  },
]

// ── Demo franchise state ──────────────────────────────────────────────────────

const MY_FRANCHISE = {
  name:          'GreenLoop Inner West',
  abn:           '51 824 753 982',
  territory:     'Inner West Sydney (Newtown, Marrickville, Glebe, Leichhardt)',
  tierIndex:     1, // Growth
  stationCount:  5,
  licenseNo:     'FRN-2025-0047',
  licenseExpiry: '2027-06-30',
  agreementDate: '2025-07-01',
  contact:       { name: 'Jordan Clarke', phone: '0412 555 842', email: 'jordan@greenloopinnwest.com.au' },
}

const EQUIPMENT = [
  { id: 'EQ-001', model: 'BinPod 240L Standard',     serial: 'BP24-20250712-001', station: 'ST-001', status: 'operational', leaseMonthly: 85  },
  { id: 'EQ-002', model: 'BinPod 240L Standard',     serial: 'BP24-20250712-002', station: 'ST-002', status: 'operational', leaseMonthly: 85  },
  { id: 'EQ-003', model: 'BinPod 120L Compact',      serial: 'BP12-20250712-003', station: 'ST-003', status: 'maintenance', leaseMonthly: 60  },
  { id: 'EQ-004', model: 'BinPod 240L Standard',     serial: 'BP24-20260201-004', station: 'ST-004', status: 'operational', leaseMonthly: 85  },
  { id: 'EQ-005', model: 'BinPod 360L Commercial',   serial: 'BP36-20260201-005', station: 'ST-006', status: 'operational', leaseMonthly: 120 },
]

const REVENUE_HISTORY = [
  { month: 'Dec', grossAud: 3_820, shareAud: 2_865 },
  { month: 'Jan', grossAud: 4_210, shareAud: 3_158 },
  { month: 'Feb', grossAud: 3_940, shareAud: 2_955 },
  { month: 'Mar', grossAud: 4_580, shareAud: 3_435 },
  { month: 'Apr', grossAud: 4_920, shareAud: 3_690 },
  { month: 'May', grossAud: 5_280, shareAud: 3_960 },
]

const MILESTONES = [
  { label: 'Franchise Agreement Signed', date: '1 Jul 2025',   done: true },
  { label: 'First Station Deployed',     date: '15 Jul 2025',  done: true },
  { label: 'Growth Tier Achieved',       date: '3 Oct 2025',   done: true },
  { label: 'First $10k Monthly Revenue', date: 'In progress',  done: false },
  { label: 'Enterprise Tier (10 stations)', date: 'Target: Q3 2026', done: false },
]

const STATUS_META = {
  operational: { label: 'Operational', style: 'bg-eco-100 text-eco-700',   icon: CheckCircle },
  maintenance:  { label: 'Maintenance', style: 'bg-amber-100 text-amber-700', icon: Clock },
  offline:      { label: 'Offline',     style: 'bg-red-100 text-red-700',   icon: AlertCircle },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Franchise() {
  const [tab, setTab] = useState('overview')
  const tier  = FRANCHISE_TIERS[MY_FRANCHISE.tierIndex]
  const nextTier = FRANCHISE_TIERS[MY_FRANCHISE.tierIndex + 1] ?? null
  const stationsToNext = nextTier ? Math.max(0, nextTier.minStations - MY_FRANCHISE.stationCount) : 0
  const maxRev = Math.max(...REVENUE_HISTORY.map(r => r.grossAud))
  const currentMonth = REVENUE_HISTORY.at(-1)
  const totalLeaseCost = EQUIPMENT.reduce((s, e) => s + e.leaseMonthly, 0)
  const netMonthly = currentMonth.shareAud - totalLeaseCost - tier.monthlyFeeAud

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Franchise Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">{MY_FRANCHISE.name} · Licence {MY_FRANCHISE.licenseNo}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 border border-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-lg text-sm hover:border-slate-300 transition-colors"
        >
          <Download className="w-4 h-4" /> Franchise Statement
        </button>
      </div>

      {/* Tier badge + KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`rounded-2xl border shadow-sm p-5 ${tier.bg} ${tier.border} col-span-2 lg:col-span-1`}>
          <div className="flex items-center gap-2 mb-2">
            <Award className={`w-5 h-5 ${tier.color}`} />
            <span className={`text-sm font-bold ${tier.color}`}>{tier.label} Franchise</span>
          </div>
          <div className={`text-2xl font-bold ${tier.color}`}>{tier.revenueSharePct}%</div>
          <div className="text-xs text-slate-500 mt-0.5">revenue share</div>
          {nextTier && (
            <div className="mt-2 text-[11px] text-slate-400">
              {stationsToNext} more station{stationsToNext !== 1 ? 's' : ''} → {nextTier.label}
            </div>
          )}
        </div>

        {[
          { label: 'This Month Gross', value: `$${currentMonth.grossAud.toLocaleString()}`, sub: `${MY_FRANCHISE.stationCount} stations`, icon: TrendingUp, iconBg: 'bg-indigo-100', iconC: 'text-indigo-700' },
          { label: 'Your Revenue Share', value: `$${currentMonth.shareAud.toLocaleString()}`, sub: `${tier.revenueSharePct}% of gross`, icon: DollarSign, iconBg: 'bg-eco-100', iconC: 'text-eco-700' },
          { label: 'Net After Fees', value: `$${netMonthly.toLocaleString()}`, sub: `after lease + platform fee`, icon: Zap, iconBg: 'bg-amber-100', iconC: 'text-amber-700' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.iconBg}`}>
              <c.icon className={`w-5 h-5 ${c.iconC}`} />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-900">{c.value}</div>
              <div className="text-xs font-semibold text-slate-500 mt-0.5">{c.label}</div>
              <div className="text-[11px] text-slate-400">{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit overflow-x-auto">
        {['overview', 'equipment', 'tiers', 'milestones'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize whitespace-nowrap transition-colors ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Revenue chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="font-semibold text-slate-900 mb-5">Monthly Revenue</h2>
            <div className="flex items-end gap-3 h-44">
              {REVENUE_HISTORY.map((m, i) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex flex-col items-stretch gap-0.5">
                    <span className="text-[10px] text-center font-semibold text-slate-500">
                      ${(m.shareAud / 1000).toFixed(1)}k
                    </span>
                  </div>
                  <div className="w-full flex flex-col gap-0.5" style={{ height: `${(m.grossAud / maxRev) * 140}px` }}>
                    <div
                      className={`w-full rounded-t-lg ${i === REVENUE_HISTORY.length - 1 ? 'bg-indigo-600' : 'bg-slate-200'}`}
                      style={{ flex: `${m.grossAud - m.shareAud}` }}
                    />
                    <div
                      className={`w-full ${i === REVENUE_HISTORY.length - 1 ? 'bg-eco-500' : 'bg-slate-400'}`}
                      style={{ flex: `${m.shareAud}` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${i === REVENUE_HISTORY.length - 1 ? 'text-indigo-700' : 'text-slate-400'}`}>
                    {m.month}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="w-3 h-3 rounded bg-indigo-600" /> Gross
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className="w-3 h-3 rounded bg-eco-500" /> Your share
              </div>
            </div>
          </div>

          {/* Franchise details */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" /> Licence Details
              </h2>
              <div className="space-y-2.5 text-sm">
                {[
                  ['ABN',         MY_FRANCHISE.abn],
                  ['Licence No.', MY_FRANCHISE.licenseNo],
                  ['Expires',     MY_FRANCHISE.licenseExpiry],
                  ['Signed',      MY_FRANCHISE.agreementDate],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-slate-500">{k}</span>
                    <span className="font-semibold text-slate-900 text-xs">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" /> Territory
              </h2>
              <p className="text-sm text-slate-600">{MY_FRANCHISE.territory}</p>
              <div className="mt-3 text-xs text-eco-700 font-semibold bg-eco-50 rounded-lg px-3 py-1.5">
                Exclusive territory · 5 deployed stations
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" /> Account Manager
              </h2>
              <div className="space-y-2 text-sm">
                <div className="font-semibold text-slate-900">{MY_FRANCHISE.contact.name}</div>
                <a href={`tel:${MY_FRANCHISE.contact.phone}`} className="flex items-center gap-2 text-slate-500 hover:text-eco-700">
                  <Phone className="w-3.5 h-3.5" /> {MY_FRANCHISE.contact.phone}
                </a>
                <a href={`mailto:${MY_FRANCHISE.contact.email}`} className="flex items-center gap-2 text-slate-500 hover:text-eco-700 break-all">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" /> {MY_FRANCHISE.contact.email}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Equipment tab */}
      {tab === 'equipment' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Leased Equipment</h2>
            <span className="text-xs text-slate-400">Total lease: ${totalLeaseCost}/mo</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Equipment ID', 'Model', 'Serial', 'Station', 'Status', 'Monthly Lease'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {EQUIPMENT.map(eq => {
                  const s = STATUS_META[eq.status]
                  const Icon = s.icon
                  return (
                    <tr key={eq.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{eq.id}</td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-900">{eq.model}</div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{eq.serial}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-700">{eq.station}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${s.style}`}>
                          <Icon className="w-3 h-3" /> {s.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-900">${eq.leaseMonthly}/mo</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tiers tab */}
      {tab === 'tiers' && (
        <div className="grid sm:grid-cols-3 gap-5">
          {FRANCHISE_TIERS.map((t, i) => {
            const isCurrent = i === MY_FRANCHISE.tierIndex
            return (
              <div key={t.tier} className={`rounded-2xl border shadow-sm p-6 space-y-4 ${isCurrent ? `${t.bg} ${t.border} ring-2 ring-offset-2 ring-indigo-400` : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold ${t.color}`}>{t.label}</span>
                  {isCurrent && <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">CURRENT</span>}
                </div>
                <div className="space-y-1.5">
                  {[
                    ['Stations', `${t.minStations}${t.maxStations === Infinity ? '+' : `–${t.maxStations}`}`],
                    ['Revenue Share', `${t.revenueSharePct}%`],
                    ['Setup Fee', t.setupFeeAud === 0 ? 'Waived' : `$${t.setupFeeAud.toLocaleString()}`],
                    ['Monthly Fee', `$${t.monthlyFeeAud}/mo`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-slate-500">{k}</span>
                      <span className="font-semibold text-slate-900">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-slate-100 space-y-1.5">
                  {t.perks.map(p => (
                    <div key={p} className="flex items-center gap-2 text-xs text-slate-600">
                      <CheckCircle className="w-3.5 h-3.5 text-eco-600 flex-shrink-0" /> {p}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Milestones tab */}
      {tab === 'milestones' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-900 mb-6">Franchise Journey</h2>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-100" />
            <div className="space-y-6">
              {MILESTONES.map((m, i) => (
                <div key={i} className="flex items-start gap-4 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                    m.done ? 'bg-eco-600' : 'bg-slate-200'
                  }`}>
                    {m.done
                      ? <CheckCircle className="w-4 h-4 text-white" />
                      : <Clock className="w-4 h-4 text-slate-400" />
                    }
                  </div>
                  <div className="flex-1 pt-1">
                    <div className={`text-sm font-semibold ${m.done ? 'text-slate-900' : 'text-slate-400'}`}>{m.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{m.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
