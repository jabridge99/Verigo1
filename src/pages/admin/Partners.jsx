import React, { useState, useMemo } from 'react'
import {
  Building2, Truck, Recycle, ShoppingBag, Search, ChevronDown,
  CheckCircle, Clock, XCircle, MinusCircle, MapPin, Star,
  Award, Package, BarChart2, Calendar, ExternalLink,
} from 'lucide-react'

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'operators',  label: 'Operators',          icon: Building2  },
  { id: 'logistics',  label: 'Logistics Partners', icon: Truck      },
  { id: 'recyclers',  label: 'Recycling Centres',  icon: Recycle    },
  { id: 'merchants',  label: 'Merchants',           icon: ShoppingBag },
]

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  Active:    { icon: CheckCircle, pill: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  Pending:   { icon: Clock,       pill: 'bg-amber-100  text-amber-700',    dot: 'bg-amber-400'  },
  Suspended: { icon: XCircle,     pill: 'bg-red-100    text-red-700',      dot: 'bg-red-500'    },
  Inactive:  { icon: MinusCircle, pill: 'bg-slate-100  text-slate-500',    dot: 'bg-slate-400'  },
}

const ALL_STATUSES = ['All', 'Active', 'Pending', 'Suspended', 'Inactive']

// ─── Tier config ──────────────────────────────────────────────────────────────
function tier(stations) {
  if (stations >= 25) return { label: 'Gold',   style: 'bg-amber-100  text-amber-700  border border-amber-200' }
  if (stations >= 10) return { label: 'Silver', style: 'bg-slate-100  text-slate-600  border border-slate-200' }
  return                     { label: 'Bronze', style: 'bg-orange-100 text-orange-700 border border-orange-200' }
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const DATA = {
  operators: [
    { name: 'EcoLoop Sydney',        location: 'North Shore, NSW',   stations: 28, revenue: '$9,840',  collections: 1240, status: 'Active',    joined: 'Mar 2024' },
    { name: 'Council West Sydney',   location: 'Parramatta, NSW',    stations: 31, revenue: '$11,200', collections: 1480, status: 'Active',    joined: 'Feb 2024' },
    { name: 'CirclHub Melbourne',    location: 'Inner North, VIC',   stations: 18, revenue: '$6,320',  collections: 980,  status: 'Active',    joined: 'Jun 2024' },
    { name: 'GreenStation Ops',      location: 'Surry Hills, NSW',   stations: 12, revenue: '$4,280',  collections: 847,  status: 'Active',    joined: 'Jan 2024' },
    { name: 'CleanRun Brisbane',     location: 'South Side, QLD',    stations: 9,  revenue: '$3,050',  collections: 620,  status: 'Active',    joined: 'Aug 2024' },
    { name: 'RecoveryLoop Perth',    location: 'Perth CBD, WA',      stations: 0,  revenue: '—',       collections: 0,    status: 'Pending',   joined: 'Apr 2025' },
    { name: 'Circular Adelaide',     location: 'Adelaide CBD, SA',   stations: 14, revenue: '$4,960',  collections: 742,  status: 'Active',    joined: 'Sep 2024' },
    { name: 'TerraLoop Canberra',    location: 'Civic, ACT',         stations: 7,  revenue: '$2,490',  collections: 330,  status: 'Active',    joined: 'Nov 2024' },
    { name: 'BinTech Gold Coast',    location: 'Surfers Paradise, QLD', stations: 5, revenue: '$1,740', collections: 210, status: 'Suspended', joined: 'Jan 2025' },
    { name: 'NorthShore Eco',        location: 'Chatswood, NSW',     stations: 22, revenue: '$7,710',  collections: 1020, status: 'Active',   joined: 'May 2024' },
    { name: 'VicRecovery Ballarat',  location: 'Ballarat, VIC',      stations: 4,  revenue: '—',       collections: 0,    status: 'Inactive',  joined: 'Dec 2024' },
  ],
  logistics: [
    { name: 'FastTruck Co.',          coverage: 'Melbourne North',  vehicles: 5, jobsDone: 2840, rating: 4.8, status: 'Active',    joined: 'Jul 2024' },
    { name: 'Mike Chen Logistics',    coverage: 'Sydney Inner East', vehicles: 1, jobsDone: 920,  rating: 4.9, status: 'Active',    joined: 'Jan 2024' },
    { name: 'GreenMove Fleet',        coverage: 'Brisbane Metro',   vehicles: 8, jobsDone: 3410, rating: 4.7, status: 'Active',    joined: 'Mar 2024' },
    { name: 'Alex W. Haulage',        coverage: 'Sydney Inner East', vehicles: 1, jobsDone: 740,  rating: 4.6, status: 'Active',    joined: 'Mar 2024' },
    { name: 'Jamie L. Transport',     coverage: 'Sydney Inner West', vehicles: 1, jobsDone: 610,  rating: 4.5, status: 'Active',    joined: 'Apr 2024' },
    { name: 'EcoHaul Perth',          coverage: 'Perth Metro',      vehicles: 4, jobsDone: 1620, rating: 4.7, status: 'Active',    joined: 'Aug 2024' },
    { name: 'Capital Couriers',       coverage: 'Canberra, ACT',    vehicles: 2, jobsDone: 480,  rating: 4.4, status: 'Active',    joined: 'Nov 2024' },
    { name: 'Sam R. Delivery',        coverage: 'Sydney South',     vehicles: 2, jobsDone: 390,  rating: 4.3, status: 'Pending',   joined: 'Apr 2025' },
    { name: 'BlueLine Logistics',     coverage: 'Adelaide Metro',   vehicles: 3, jobsDone: 0,    rating: null, status: 'Pending',  joined: 'May 2025' },
    { name: 'SpeedBin Co.',           coverage: 'Gold Coast, QLD',  vehicles: 2, jobsDone: 210,  rating: 3.9, status: 'Suspended', joined: 'Feb 2025' },
  ],
  recyclers: [
    { name: 'Veolia Recycling Sydney',   location: 'St Peters, NSW',       capacity: '500 t/day', materials: 'Alu, PET, Glass, Steel',   expires: 'Dec 2026', status: 'Active'   },
    { name: 'SUEZ Materials Recovery',   location: 'Kemps Creek, NSW',     capacity: '350 t/day', materials: 'PET, HDPE, Glass',         expires: 'Jun 2026', status: 'Active'   },
    { name: 'Planet Ark Melbourne',      location: 'Campbellfield, VIC',   capacity: '280 t/day', materials: 'Alu, PET, Cardboard',      expires: 'Mar 2027', status: 'Active'   },
    { name: 'CleanCo Brisbane Facility', location: 'Acacia Ridge, QLD',    capacity: '200 t/day', materials: 'Glass, Steel, PET',        expires: '—',        status: 'Pending'  },
    { name: 'Remondis Perth',            location: 'Malaga, WA',           capacity: '180 t/day', materials: 'Alu, Steel, HDPE',         expires: 'Sep 2025', status: 'Active'   },
    { name: 'Re.Group Adelaide',         location: 'Wingfield, SA',        capacity: '120 t/day', materials: 'Mixed Recyclables',        expires: 'Jan 2027', status: 'Active'   },
    { name: 'ResourceCo Canberra',       location: 'Hume, ACT',            capacity: '80 t/day',  materials: 'Alu, PET',                 expires: '—',        status: 'Inactive' },
    { name: 'Polytrade Geelong',         location: 'Geelong, VIC',         capacity: '220 t/day', materials: 'PET, HDPE, PP',            expires: 'Nov 2026', status: 'Active'   },
  ],
  merchants: [
    { name: 'Woolworths Group',   category: 'Grocery',      offers: 3, redemptions: 18420, commission: '2.5%', status: 'Active',    joined: 'Feb 2024' },
    { name: 'Who Gives A Crap',   category: 'Eco Products', offers: 4, redemptions: 9810,  commission: '4.0%', status: 'Active',    joined: 'Mar 2024' },
    { name: 'Patagonia ANZ',      category: 'Apparel',      offers: 2, redemptions: 6340,  commission: '3.5%', status: 'Active',    joined: 'Apr 2024' },
    { name: 'AGL Green Energy',   category: 'Utilities',    offers: 1, redemptions: 4280,  commission: '1.8%', status: 'Active',    joined: 'May 2024' },
    { name: 'The Body Shop AU',   category: 'Beauty',       offers: 3, redemptions: 7120,  commission: '3.2%', status: 'Active',    joined: 'Jun 2024' },
    { name: 'Kathmandu',          category: 'Outdoor',      offers: 2, redemptions: 3940,  commission: '3.0%', status: 'Active',    joined: 'Aug 2024' },
    { name: 'Guzman y Gomez',     category: 'Food & Bev',   offers: 0, redemptions: 0,     commission: '2.0%', status: 'Pending',   joined: 'Apr 2025' },
    { name: "Farmer's Table",     category: 'Food & Bev',   offers: 1, redemptions: 1240,  commission: '2.8%', status: 'Active',    joined: 'Jan 2025' },
    { name: 'Zero Co.',           category: 'Eco Products', offers: 2, redemptions: 2180,  commission: '4.5%', status: 'Active',    joined: 'Oct 2024' },
    { name: 'EnergyAustralia',    category: 'Utilities',    offers: 0, redemptions: 0,     commission: '1.5%', status: 'Suspended', joined: 'Nov 2024' },
  ],
}

// ─── Per-tab summary stats ────────────────────────────────────────────────────
function buildStats(tab, rows) {
  const total  = rows.length
  const active = rows.filter(r => r.status === 'Active').length
  const pending = rows.filter(r => r.status === 'Pending').length
  const suspended = rows.filter(r => r.status === 'Suspended').length

  if (tab === 'operators') {
    const stations = rows.reduce((s, r) => s + (r.stations || 0), 0)
    const mtdCollections = rows.reduce((s, r) => s + (r.collections || 0), 0)
    return [
      { label: 'Total Operators',     value: total },
      { label: 'Active',              value: active },
      { label: 'Pending Approval',    value: pending },
      { label: 'Total Stations',      value: stations },
      { label: 'MTD Collections',     value: mtdCollections.toLocaleString() },
    ]
  }
  if (tab === 'logistics') {
    const vehicles = rows.reduce((s, r) => s + (r.vehicles || 0), 0)
    const jobs = rows.reduce((s, r) => s + (r.jobsDone || 0), 0)
    return [
      { label: 'Total Partners', value: total },
      { label: 'Active',         value: active },
      { label: 'Pending',        value: pending },
      { label: 'Fleet Size',     value: vehicles },
      { label: 'Jobs Completed', value: jobs.toLocaleString() },
    ]
  }
  if (tab === 'recyclers') {
    return [
      { label: 'Total Centres', value: total },
      { label: 'Active',        value: active },
      { label: 'Pending',       value: pending },
      { label: 'Suspended',     value: suspended },
    ]
  }
  // merchants
  const totalOffers = rows.reduce((s, r) => s + (r.offers || 0), 0)
  const totalRedemptions = rows.reduce((s, r) => s + (r.redemptions || 0), 0)
  return [
    { label: 'Total Merchants',  value: total },
    { label: 'Active',           value: active },
    { label: 'Active Offers',    value: totalOffers },
    { label: 'MTD Redemptions',  value: totalRedemptions.toLocaleString() },
  ]
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.Inactive
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${cfg.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  )
}

// ─── Action buttons ───────────────────────────────────────────────────────────
function ActionGroup({ status }) {
  return (
    <div className="flex items-center gap-1.5">
      {status === 'Pending' && (
        <button className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors">
          Approve
        </button>
      )}
      {(status === 'Active') && (
        <button className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
          Suspend
        </button>
      )}
      {status === 'Suspended' && (
        <button className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
          Reinstate
        </button>
      )}
      <button className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center gap-1">
        <ExternalLink className="w-3 h-3" /> View
      </button>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ query, tab }) {
  const Icon = TABS.find(t => t.id === tab)?.icon || Building2
  return (
    <tr>
      <td colSpan={10}>
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Icon className="w-7 h-7 text-slate-400" />
          </div>
          <div className="text-slate-700 font-semibold mb-1">No results found</div>
          <div className="text-sm text-slate-400">
            {query ? `No matches for "${query}".` : 'There are no partners in this category yet.'}
          </div>
        </div>
      </td>
    </tr>
  )
}

// ─── Table: Operators ─────────────────────────────────────────────────────────
function OperatorsTable({ rows, query }) {
  return (
    <>
      <thead>
        <tr className="bg-slate-50 border-b border-slate-100">
          {['Operator', 'Location', 'Tier', 'Stations', 'MTD Revenue', 'MTD Collections', 'Status', 'Actions'].map(h => (
            <th key={h} className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-5 py-3 whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {rows.length === 0 ? <EmptyState query={query} tab="operators" /> : rows.map(r => {
          const t = tier(r.stations)
          return (
            <tr key={r.name} className="hover:bg-slate-50/60 transition-colors">
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-violet-700" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{r.name}</div>
                    <div className="text-[11px] text-slate-400">Joined {r.joined}</div>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <MapPin className="w-3 h-3 flex-shrink-0" /> {r.location}
                </div>
              </td>
              <td className="px-5 py-3.5">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${t.style}`}>
                  <Award className="w-2.5 h-2.5" /> {t.label}
                </span>
              </td>
              <td className="px-5 py-3.5 font-bold text-slate-800 text-sm">{r.stations}</td>
              <td className="px-5 py-3.5 font-semibold text-violet-700 text-sm">{r.revenue}</td>
              <td className="px-5 py-3.5 text-sm text-slate-700">{r.collections > 0 ? r.collections.toLocaleString() : '—'}</td>
              <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>
              <td className="px-5 py-3.5"><ActionGroup status={r.status} /></td>
            </tr>
          )
        })}
      </tbody>
    </>
  )
}

// ─── Table: Logistics ─────────────────────────────────────────────────────────
function LogisticsTable({ rows, query }) {
  return (
    <>
      <thead>
        <tr className="bg-slate-50 border-b border-slate-100">
          {['Partner', 'Coverage Area', 'Vehicles', 'Jobs Done', 'Avg Rating', 'Status', 'Actions'].map(h => (
            <th key={h} className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-5 py-3 whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {rows.length === 0 ? <EmptyState query={query} tab="logistics" /> : rows.map(r => (
          <tr key={r.name} className="hover:bg-slate-50/60 transition-colors">
            <td className="px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Truck className="w-4 h-4 text-blue-700" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{r.name}</div>
                  <div className="text-[11px] text-slate-400">Joined {r.joined}</div>
                </div>
              </div>
            </td>
            <td className="px-5 py-3.5">
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="w-3 h-3 flex-shrink-0" /> {r.coverage}
              </div>
            </td>
            <td className="px-5 py-3.5 font-bold text-slate-800 text-sm">{r.vehicles}</td>
            <td className="px-5 py-3.5 text-sm text-slate-700">{r.jobsDone > 0 ? r.jobsDone.toLocaleString() : '—'}</td>
            <td className="px-5 py-3.5">
              {r.rating ? (
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-sm font-semibold text-slate-800">{r.rating}</span>
                </div>
              ) : <span className="text-slate-400 text-xs">—</span>}
            </td>
            <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>
            <td className="px-5 py-3.5"><ActionGroup status={r.status} /></td>
          </tr>
        ))}
      </tbody>
    </>
  )
}

// ─── Table: Recyclers ─────────────────────────────────────────────────────────
function RecyclersTable({ rows, query }) {
  return (
    <>
      <thead>
        <tr className="bg-slate-50 border-b border-slate-100">
          {['Centre', 'Location', 'Capacity', 'Materials Accepted', 'Contract Expires', 'Status', 'Actions'].map(h => (
            <th key={h} className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-5 py-3 whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {rows.length === 0 ? <EmptyState query={query} tab="recyclers" /> : rows.map(r => (
          <tr key={r.name} className="hover:bg-slate-50/60 transition-colors">
            <td className="px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Recycle className="w-4 h-4 text-teal-700" />
                </div>
                <div className="text-sm font-semibold text-slate-900">{r.name}</div>
              </div>
            </td>
            <td className="px-5 py-3.5">
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="w-3 h-3 flex-shrink-0" /> {r.location}
              </div>
            </td>
            <td className="px-5 py-3.5">
              <span className="text-xs font-semibold px-2 py-0.5 bg-teal-50 text-teal-700 rounded-lg">
                {r.capacity}
              </span>
            </td>
            <td className="px-5 py-3.5 text-xs text-slate-600 max-w-[180px]">{r.materials}</td>
            <td className="px-5 py-3.5">
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Calendar className="w-3 h-3" />
                {r.expires === '—' ? <span className="text-slate-300">Not set</span> : r.expires}
              </div>
            </td>
            <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>
            <td className="px-5 py-3.5"><ActionGroup status={r.status} /></td>
          </tr>
        ))}
      </tbody>
    </>
  )
}

// ─── Table: Merchants ─────────────────────────────────────────────────────────
function MerchantsTable({ rows, query }) {
  return (
    <>
      <thead>
        <tr className="bg-slate-50 border-b border-slate-100">
          {['Merchant', 'Category', 'Active Offers', 'Redemptions (MTD)', 'Commission Rate', 'Status', 'Actions'].map(h => (
            <th key={h} className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-5 py-3 whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {rows.length === 0 ? <EmptyState query={query} tab="merchants" /> : rows.map(r => (
          <tr key={r.name} className="hover:bg-slate-50/60 transition-colors">
            <td className="px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-rose-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-4 h-4 text-rose-700" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{r.name}</div>
                  <div className="text-[11px] text-slate-400">Joined {r.joined}</div>
                </div>
              </div>
            </td>
            <td className="px-5 py-3.5">
              <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg">{r.category}</span>
            </td>
            <td className="px-5 py-3.5">
              <div className="flex items-center gap-1 text-sm font-bold text-slate-800">
                <Package className="w-3.5 h-3.5 text-slate-400" />
                {r.offers}
              </div>
            </td>
            <td className="px-5 py-3.5 font-semibold text-violet-700 text-sm">
              {r.redemptions > 0 ? r.redemptions.toLocaleString() : '—'}
            </td>
            <td className="px-5 py-3.5">
              <div className="flex items-center gap-1">
                <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm font-semibold text-slate-800">{r.commission}</span>
              </div>
            </td>
            <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>
            <td className="px-5 py-3.5"><ActionGroup status={r.status} /></td>
          </tr>
        ))}
      </tbody>
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminPartners() {
  const [tab,         setTab]         = useState('operators')
  const [query,       setQuery]       = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [showFilter,  setShowFilter]  = useState(false)

  const allRows = DATA[tab]

  const filteredRows = useMemo(() => {
    return allRows.filter(r => {
      const q = query.toLowerCase()
      const matchesQuery =
        r.name.toLowerCase().includes(q) ||
        (r.location  || '').toLowerCase().includes(q) ||
        (r.coverage  || '').toLowerCase().includes(q) ||
        (r.category  || '').toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'All' || r.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [allRows, query, statusFilter])

  const stats = buildStats(tab, allRows)

  function handleTabChange(id) {
    setTab(id)
    setQuery('')
    setStatusFilter('All')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Partner Directory</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage all EcoBin ecosystem partners across four categories.
          </p>
        </div>
        <button className="flex items-center gap-2 bg-violet-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-violet-700 transition-colors shadow-sm">
          + Invite Partner
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
              tab === t.id ? 'bg-violet-100 text-violet-700' : 'bg-slate-200 text-slate-500'
            }`}>
              {DATA[t.id].length}
            </span>
          </button>
        ))}
      </div>

      {/* Summary Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3">
            <div className="text-lg font-bold text-slate-900">{s.value}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${tab}…`}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
          />
        </div>

        {/* Status filter dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowFilter(v => !v)}
            className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300 transition-colors"
          >
            <span className={`w-2 h-2 rounded-full ${statusFilter === 'All' ? 'bg-slate-400' : STATUS_CFG[statusFilter]?.dot || 'bg-slate-400'}`} />
            {statusFilter}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          {showFilter && (
            <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-lg z-10 py-1 min-w-[140px]">
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setShowFilter(false) }}
                  className={`w-full flex items-center gap-2 px-3.5 py-2 text-sm text-left hover:bg-slate-50 transition-colors ${statusFilter === s ? 'font-semibold text-violet-700' : 'text-slate-700'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${s === 'All' ? 'bg-slate-400' : STATUS_CFG[s]?.dot || 'bg-slate-400'}`} />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="text-xs text-slate-400 ml-auto">
          {filteredRows.length} of {allRows.length} {tab}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {tab === 'operators'  && <OperatorsTable  rows={filteredRows} query={query} />}
            {tab === 'logistics'  && <LogisticsTable  rows={filteredRows} query={query} />}
            {tab === 'recyclers'  && <RecyclersTable  rows={filteredRows} query={query} />}
            {tab === 'merchants'  && <MerchantsTable  rows={filteredRows} query={query} />}
          </table>
        </div>

        {/* Table footer */}
        {filteredRows.length > 0 && (
          <div className="px-5 py-3.5 border-t border-slate-50 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs text-slate-400">Showing {filteredRows.length} partner{filteredRows.length !== 1 ? 's' : ''}</span>
            <span className="text-xs text-slate-400">Page 1 of 1</span>
          </div>
        )}
      </div>
    </div>
  )
}
