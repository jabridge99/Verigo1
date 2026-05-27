import React from 'react'
import { Map, Clock, Package, ChevronRight, MapPin } from 'lucide-react'

const ROUTES = [
  {
    id: 'CL-2847',
    name: 'Eastern Suburbs Loop',
    status: 'Active',
    stops: [
      { order: 1, address: '42 Crown St, Surry Hills',      type: '240L Mixed',     eta: '8:00am',  done: true },
      { order: 2, address: '155 Redfern St, Redfern',       type: '240L Mixed',     eta: '9:15am',  done: true },
      { order: 3, address: '300 Victoria St, Darlinghurst', type: '240L Cardboard', eta: '10:30am', done: false, active: true },
      { order: 4, address: '88 Enmore Rd, Newtown',         type: '240L Mixed',     eta: '12:00pm', done: false },
      { order: 5, address: '60 King St, Newtown',           type: '240L Glass',     eta: '1:00pm',  done: false },
    ],
    estVol: '4.2t',
    distance: '18.4 km',
    duration: '5h 30m',
  },
]

export default function LogisticsRoutes() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Routes</h1>
        <p className="text-sm text-slate-500 mt-0.5">Today's collection routes and stop details</p>
      </div>

      {/* Map placeholder */}
      <div className="bg-slate-100 rounded-2xl h-48 flex items-center justify-center border border-slate-200 relative overflow-hidden">
        <div className="text-center">
          <Map className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-500">Route Map</p>
          <p className="text-xs text-slate-400">18.4 km · 5 stops</p>
        </div>
        {[
          { x: '20%', y: '45%', done: true }, { x: '35%', y: '55%', done: true },
          { x: '50%', y: '38%', done: false, active: true }, { x: '65%', y: '50%', done: false },
          { x: '78%', y: '42%', done: false },
        ].map((dot, i) => (
          <div
            key={i}
            className={`absolute w-5 h-5 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[9px] font-bold text-white ${
              dot.done ? 'bg-eco-600' : dot.active ? 'bg-amber-500' : 'bg-slate-400'
            }`}
            style={{ left: dot.x, top: dot.y }}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {ROUTES.map(route => (
        <div key={route.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-6 py-5 border-b border-slate-50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{route.name}</span>
                  <span className="text-[11px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    {route.status}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">{route.id}</div>
              </div>
              <div className="flex gap-4 text-right text-xs text-slate-500">
                <div><div className="font-bold text-slate-900 text-sm">{route.distance}</div>total distance</div>
                <div><div className="font-bold text-slate-900 text-sm">{route.estVol}</div>est. volume</div>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-50">
            {route.stops.map(stop => (
              <div key={stop.order} className="flex items-center gap-4 px-6 py-4">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  stop.done ? 'bg-eco-700 text-white' : stop.active ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {stop.order}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{stop.address}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{stop.type}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  {stop.eta}
                  {stop.done && <span className="text-eco-600 font-semibold">✓</span>}
                  {stop.active && <span className="text-amber-600 font-semibold">Now</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
