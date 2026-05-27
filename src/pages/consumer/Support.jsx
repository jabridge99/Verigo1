import React, { useState } from 'react'
import { HelpCircle, MessageSquare, ChevronDown, ChevronUp, Phone, Mail, ExternalLink, Send } from 'lucide-react'

const FAQS = [
  { q: 'How is my payout calculated?', a: 'Your payout is based on the current commodity market rate (AUD/tonne) for each material type, multiplied by the weight recorded at the recycling station. Rates update weekly.' },
  { q: 'How long does a bank withdrawal take?', a: 'Withdrawals to linked Australian bank accounts typically take 1–3 business days. A $0.50 fee applies to withdrawals under $10.00.' },
  { q: 'My QR scan didn\'t work — what do I do?', a: 'Try the "Enter Code" tab and type the station code manually (e.g. CZ-001-A). If the problem persists, contact the station operator or raise a support ticket.' },
  { q: 'What materials are accepted?', a: 'Aluminium cans, PET plastic (type 1 & 2), glass bottles, paperboard, and steel cans. Mixed or contaminated loads may be rejected. Check the station listing for specific accepted materials.' },
  { q: 'How do Eco Points work?', a: 'You earn 10 Eco Points per $1.00 of recycling income. Points can be redeemed in the Eco Rewards Marketplace for physical and digital rewards. 1 pt = $0.01 redemption value.' },
  { q: 'Can I add family members to my account?', a: 'Yes — use the Household Circle feature to invite family members. You can pool points and see combined activity. Up to 5 members per circle.' },
  { q: 'How do I verify my identity (KYC)?', a: 'Go to KYC & Identity in your account menu. You\'ll need a government-issued ID and a selfie. Verification usually completes within 24 hours.' },
]

const TOPICS = ['General', 'Payments & Wallet', 'Deposits & Pickups', 'Technical Issue', 'Account', 'Other']

export default function Support() {
  const [openFaq, setOpenFaq] = useState(null)
  const [tab,     setTab]     = useState('faq') // 'faq' | 'ticket'
  const [topic,   setTopic]   = useState('')
  const [message, setMessage] = useState('')
  const [sent,    setSent]    = useState(false)

  const handleSend = e => {
    e.preventDefault()
    if (topic && message.trim().length > 10) setSent(true)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Support</h1>
        <p className="text-sm text-slate-500 mt-0.5">Get help with your account, deposits, and payments.</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Phone, label: 'Call Us',        sub: '1300 247 258',       color: 'bg-eco-50 text-eco-700' },
          { icon: Mail,  label: 'Email Support',  sub: 'support@circlloop.com.au', color: 'bg-blue-50 text-blue-700' },
          { icon: ExternalLink, label: 'Help Centre', sub: 'help.circlloop.com.au', color: 'bg-slate-50 text-slate-700' },
        ].map(a => (
          <div key={a.label} className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col items-center text-center gap-2 cursor-pointer hover:shadow-md transition-shadow`}>
            <div className={`w-9 h-9 ${a.color.split(' ')[0]} rounded-xl flex items-center justify-center`}>
              <a.icon className={`w-4 h-4 ${a.color.split(' ')[1]}`} />
            </div>
            <div className="text-sm font-semibold text-slate-900">{a.label}</div>
            <div className="text-[11px] text-slate-400 break-all">{a.sub}</div>
          </div>
        ))}
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => setTab('faq')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'faq' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          <HelpCircle className="w-4 h-4" /> FAQs
        </button>
        <button
          onClick={() => setTab('ticket')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'ticket' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
        >
          <MessageSquare className="w-4 h-4" /> Submit Ticket
        </button>
      </div>

      {tab === 'faq' ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
          {FAQS.map((f, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-slate-50 transition-colors"
              >
                <span className="text-sm font-semibold text-slate-900">{f.q}</span>
                {openFaq === i
                  ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                }
              </button>
              {openFaq === i && (
                <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed">
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : sent ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center space-y-3">
          <div className="w-14 h-14 bg-eco-100 rounded-full flex items-center justify-center mx-auto">
            <MessageSquare className="w-7 h-7 text-eco-700" />
          </div>
          <div className="text-lg font-bold text-slate-900">Ticket Submitted!</div>
          <p className="text-sm text-slate-500">We'll respond to your query within 1–2 business days. Reference: <strong>TKT-{Math.floor(Math.random() * 90000) + 10000}</strong></p>
          <button
            onClick={() => { setSent(false); setTopic(''); setMessage('') }}
            className="mt-2 text-sm font-semibold text-eco-700 hover:underline"
          >
            Submit another ticket
          </button>
        </div>
      ) : (
        <form onSubmit={handleSend} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Topic</label>
            <select
              value={topic}
              onChange={e => setTopic(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500 bg-white"
              required
            >
              <option value="">Select a topic…</option>
              {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Message</label>
            <textarea
              rows={5}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Describe your issue in detail…"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-eco-500 focus:border-eco-500 resize-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={!topic || message.trim().length < 10}
            className="w-full bg-eco-700 hover:bg-eco-800 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> Send Ticket
          </button>
          <p className="text-xs text-slate-400 text-center">Average response time: &lt; 24 hours on business days.</p>
        </form>
      )}
    </div>
  )
}
