import React, { useState } from 'react'
import { Bell, CheckCircle, DollarSign, MapPin, Users, Gift, AlertCircle, Check } from 'lucide-react'

const INITIAL = [
  { id: 1, read: false, icon: DollarSign, color: 'bg-eco-50 text-eco-700', title: 'Deposit confirmed — $5.40 added', body: 'Surry Hills Hub processed your deposit. Earnings added to wallet.', time: '2 min ago', category: 'earnings' },
  { id: 2, read: false, icon: Users,      color: 'bg-blue-50 text-blue-700',  title: 'Priya K. joined via your referral', body: 'You earned $5.00 AUD from the referral bonus.', time: '3 hrs ago', category: 'referrals' },
  { id: 3, read: false, icon: MapPin,     color: 'bg-amber-50 text-amber-700', title: 'Pickup confirmed for Friday', body: 'Your 240L bin pickup is booked for 30 May 7–9 AM. Driver: Liam C.', time: '1 day ago', category: 'pickups' },
  { id: 4, read: true,  icon: Gift,       color: 'bg-violet-50 text-violet-700', title: 'New reward available: Bamboo Kit', body: 'A new eco reward has been added to the marketplace. Only 12 left.', time: '2 days ago', category: 'rewards' },
  { id: 5, read: true,  icon: CheckCircle,color: 'bg-eco-50 text-eco-700', title: 'KYC verification approved', body: 'Your identity has been verified. Full wallet features are now unlocked.', time: '4 days ago', category: 'account' },
  { id: 6, read: true,  icon: AlertCircle,color: 'bg-red-50 text-red-700', title: 'Price update: Aluminium up 4%', body: 'Commodity rates updated. Your next deposit may earn more.', time: '5 days ago', category: 'earnings' },
  { id: 7, read: true,  icon: DollarSign, color: 'bg-eco-50 text-eco-700', title: 'Withdrawal processed — $20.00', body: 'Funds transferred to your bank account ending in 4821. ETA 2 business days.', time: '1 week ago', category: 'earnings' },
]

const CATS = ['All', 'Earnings', 'Pickups', 'Referrals', 'Rewards', 'Account']
const PREFS = ['Deposit confirmations', 'Pickup reminders', 'Price alerts', 'Referral bonuses', 'New rewards', 'Account updates']

export default function Notifications() {
  const [items, setItems] = useState(INITIAL)
  const [cat,   setCat]   = useState('All')
  const [tab,   setTab]   = useState('notifications') // 'notifications' | 'preferences'

  const unread = items.filter(i => !i.read).length

  const markAll = () => setItems(prev => prev.map(i => ({ ...i, read: true })))
  const markOne = id => setItems(prev => prev.map(i => i.id === id ? { ...i, read: true } : i))

  const filtered = items.filter(i =>
    cat === 'All' ? true : i.category === cat.toLowerCase()
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {unread > 0 ? `${unread} unread notification${unread !== 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAll}
            className="flex items-center gap-1.5 text-sm font-semibold text-eco-700 hover:text-eco-800 border border-eco-200 bg-eco-50 px-4 py-2 rounded-xl transition-colors"
          >
            <Check className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => setTab('notifications')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'notifications' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          Notifications
        </button>
        <button
          onClick={() => setTab('preferences')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'preferences' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          Preferences
        </button>
      </div>

      {tab === 'notifications' ? (
        <>
          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {CATS.map(c => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  cat === c ? 'bg-eco-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
            {filtered.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-slate-400">No notifications in this category.</div>
            )}
            {filtered.map(n => (
              <div
                key={n.id}
                onClick={() => markOne(n.id)}
                className={`flex gap-3.5 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors ${!n.read ? 'bg-eco-50/40' : ''}`}
              >
                <div className={`w-9 h-9 ${n.color.split(' ')[0]} rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <n.icon className={`w-4 h-4 ${n.color.split(' ')[1]}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${n.read ? 'text-slate-700' : 'text-slate-900'}`}>{n.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</div>
                  <div className="text-[11px] text-slate-400 mt-1">{n.time}</div>
                </div>
                {!n.read && (
                  <div className="w-2 h-2 bg-eco-500 rounded-full flex-shrink-0 mt-2" />
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Notification Preferences</h2>
          <p className="text-sm text-slate-500">Choose what you'd like to be notified about.</p>
          <div className="space-y-3">
            {PREFS.map((p, i) => (
              <div key={p} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <span className="text-sm font-medium text-slate-700">{p}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked={i < 4} className="sr-only peer" />
                  <div className="w-10 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-eco-500 rounded-full peer peer-checked:bg-eco-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4" />
                </label>
              </div>
            ))}
          </div>
          <div className="pt-2">
            <p className="text-xs text-slate-400">Notification method: In-app + Email. SMS coming soon.</p>
          </div>
        </div>
      )}
    </div>
  )
}
