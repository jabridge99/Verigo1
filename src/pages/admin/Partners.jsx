import React, { useState } from 'react'
import { Building2, Truck, Recycle, ShoppingBag, Search, CheckCircle, Clock, AlertCircle } from 'lucide-react'

const TABS = [
  { id: 'operators',  label: 'Operators',        icon: Building2 },
  { id: 'logistics',  label: 'Logistics',         icon: Truck },
  { id: 'recycling',  label: 'Recycling Centres', icon: Recycle },
  { id: 'merchants',  label: 'Green Merchants',   icon: ShoppingBag },
]

const DATA = {
  operators: [
    { name: 'GreenStation Ops',   location: 'Surry Hills, NSW',   status: 'Active',    stations: 12, joinDate: 'Jan 2024' },
    { name: 'EcoLoop Sydney',     location: 'North Shore, NSW',   status: 'Active',    stations: 22, joinDate: 'Mar 2024' },
    { name: 'CirclHub Melbourne', location: 'Inner North, VIC',   status: 'Active',    stations: 18, joinDate: 'Jun 2024' },
    { name: 'CleanRun Brisbane',  location: 'South Side, QLD',    status: 'Active',    stations: 9,  joinDate: 'Aug 2024' },
    { name: 'RecoveryLoop Perth', location: 'Perth CBD, WA',      status: 'Pending',   stations: 0,  joinDate: 'May 2025' },
    { name: 'Council West Sydney', location: 'Parramatta, NSW',   status: 'Active',    stations: 31, joinDate: 'Feb 2024' },
  ],
  logistics: [
    { name: 'Mike Chen',     location: 'Sydney Inner East', status: 'Active',    vehicles: 1, joinDate: 'Jan 2024' },
    { name: 'Alex W.',       location: 'Sydney Inner East', status: 'Active',    vehicles: 1, joinDate: 'Mar 2024' },
    { name: 'Jamie L.',      location: 'Sydney Inner West', status: 'Active',    vehicles: 1, joinDate: 'Apr 2024' },
    { name: 'Sam R.',        location: 'Sydney South',      status: 'Active',    vehicles: 2, joinDate: 'May 2024' },
    { name: 'FastTruck Co.', location: 'Melbourne North',   status: 'Active',    vehicles: 5, joinDate: 'Jul 2024' },
  ],
  recycling: [
    { name: 'Veolia Recycling Sydney',     location: 'St Peters, NSW',    status: 'Active',    capacity: '500t/day', joinDate: 'Jan 2024' },
    { name: 'SUEZ Materials Recovery',     location: 'Kemps Creek, NSW',  status: 'Active',    capacity: '350t/day', joinDate: 'Jan 2024' },
    { name: 'Planet Ark Melbourne',        location: 'Campbellfield, VIC', status: 'Active',   capacity: '280t/day', joinDate: 'Jun 2024' },
    { name: 'CleanCo Brisbane Facility',   location: 'Acacia Ridge, QLD', status: 'Pending',   capacity: '200t/day', joinDate: 'May 2025' },
  ],
  merchants: [
    { name: 'Woolworths Group',   location: 'Australia-wide', status: 'Active', offers: 3, joinDate: 'Feb 2024' },
    { name: 'Patagonia ANZ',      location: 'Online',         status: 'Active', offers: 2, joinDate: 'Apr 2024' },
    { name: 'Who Gives A Crap',   location: 'Online',         status: 'Active', offers: 4, joinDate: 'Mar 2024' },
    { name: 'AGL Green Energy',   location: 'Australia-wide', status: 'Active', offers: 1, joinDate: 'May 2024' },
    { name: 'Guzman y Gomez',     location: 'Stores + App',   status: 'Pending', offers: 0, joinDate: 'May 2025' },
  ],
}

const STATUS_STYLE = {
  Active:   'bg-eco-100 text-eco-700',
  Pending:  'bg-amber-100 text-amber-700',
  Inactive: 'bg-slate-100 text-slate-500',
}

export default function AdminPartners() {
  const [tab, setTab]     = useState('operators')
  const [query, setQuery] = useState('')

  const rows = DATA[tab].filter(r =>
    r.name.toLowerCase().includes(query.toLowerCase()) ||
    r.location.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Partner Directory</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage all CirclLoop ecosystem partners across four categories.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-violet-100 text-violet-700' : 'bg-slate-200 text-slate-500'}`}>
              {DATA[t.id].length}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Search ${tab}…`}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Location</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">
                  {tab === 'operators' ? 'Stations' : tab === 'logistics' ? 'Vehicles' : tab === 'recycling' ? 'Capacity' : 'Offers'}
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Joined</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(r => (
                <tr key={r.name} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-900">{r.name}</td>
                  <td className="px-6 py-4 text-slate-500 text-xs">{r.location}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900">
                    {r.stations ?? r.vehicles ?? r.capacity ?? r.offers}
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs">{r.joinDate}</td>
                  <td className="px-6 py-4">
                    <button className="text-xs text-violet-600 font-semibold hover:underline">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
