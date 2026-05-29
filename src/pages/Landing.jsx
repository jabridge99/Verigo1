import React from 'react'
import { Link } from 'react-router-dom'
import {
  MapPin, Package, DollarSign, BarChart3, RefreshCw,
  ArrowRight, ChevronRight, Users, Building2, Leaf,
  CheckCircle, Globe, Zap, Shield, Gift, Recycle,
  Coins, TrendingUp,
} from 'lucide-react'

// ─── 1. HERO ─────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white pt-24 pb-20 lg:pt-36 lg:pb-32">
      <div className="absolute inset-0 bg-gradient-to-br from-eco-50 via-white to-white pointer-events-none" />
      <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-eco-50/60 to-transparent pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-eco-100 text-eco-800 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-7">
            <Leaf className="w-3 h-3" strokeWidth={2.5} />
            Australia's Smart Recovery Ecosystem
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 tracking-tight leading-[1.05] mb-7">
            Schedule. Fill.
            <br />
            <span className="text-eco-700">Recover Value.</span>
          </h1>

          <p className="text-xl text-slate-600 leading-relaxed mb-10 max-w-2xl">
            CirclLoop collects your 240L bin of recyclable materials and credits your account at live commodity prices — instantly. Designed for households, businesses, offices, and councils.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#deposit"
              className="inline-flex items-center justify-center gap-2 bg-eco-700 hover:bg-eco-800 text-white font-semibold px-8 py-4 rounded-xl shadow-lg shadow-eco-700/25 hover:shadow-eco-700/40 transition-all duration-200 group"
            >
              Deposit &amp; Recover Value
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a
              href="#find-station"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-900 font-semibold px-8 py-4 rounded-xl border border-slate-200 transition-colors"
            >
              <MapPin className="w-5 h-5 text-eco-700" />
              Find Your Collection Zone
            </a>
          </div>

          <div className="flex flex-wrap gap-10 mt-14 pt-10 border-t border-slate-100">
            {[
              { value: '2,400+', label: 'Collection Zones' },
              { value: '$18M+',  label: 'Value Recovered' },
              { value: '340K+',  label: 'Active Members' },
            ].map(s => (
              <div key={s.label}>
                <div className="text-2xl font-bold text-slate-900">{s.value}</div>
                <div className="text-sm text-slate-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── 2. TRUST BAR ────────────────────────────────────────────────────────────

function TrustBar() {
  const partners = [
    'City of Sydney', 'Woolworths Group', 'Coles',
    'Veolia', 'Planet Ark', 'CleanCo', 'TOMRA',
  ]
  return (
    <section className="bg-slate-900 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-slate-500 text-xs font-semibold uppercase tracking-widest mb-7">
          Trusted by leading organisations
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-14">
          {partners.map(p => (
            <span key={p} className="text-slate-400 font-semibold text-sm opacity-60 hover:opacity-100 transition-opacity">
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── 3. USER LOOP ────────────────────────────────────────────────────────────

function UserLoopSection() {
  const steps = [
    { Icon: MapPin,     step: '01', label: 'Find Zone',         desc: 'Locate your nearest CirclLoop collection zone or schedule doorstep pickup.' },
    { Icon: Package,    step: '02', label: 'Deposit Materials',  desc: 'Fill your 240L bin with recyclables and drop off or book a home collection.' },
    { Icon: DollarSign, step: '03', label: 'Recover Value',      desc: 'Receive value instantly, calculated at live commodity prices per kg.' },
    { Icon: BarChart3,  step: '04', label: 'Track Rewards',      desc: 'Monitor earnings, environmental impact, and household contributions live.' },
    { Icon: RefreshCw,  step: '05', label: 'Repeat',             desc: 'Build sustainable habits and grow your recovery earnings over time.' },
  ]

  return (
    <section id="how-it-works" className="bg-eco-50 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-eco-100 text-eco-800 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-4">
            Core User Loop
          </div>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight">How CirclLoop Works</h2>
          <p className="text-lg text-slate-600 mt-4 max-w-xl mx-auto">
            Five steps from deposit to value recovery — built for individuals, households, and enterprise scale.
          </p>
        </div>

        <div className="relative">
          <div className="hidden lg:block absolute top-[2.2rem] h-px bg-eco-200" style={{ left: '11%', right: '11%' }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-4">
            {steps.map(({ Icon, step, label, desc }) => (
              <div key={step} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 w-14 h-14 bg-white border-2 border-eco-200 rounded-2xl flex items-center justify-center shadow-sm mb-5">
                  <Icon className="w-6 h-6 text-eco-700" />
                </div>
                <div className="text-[10px] font-bold text-eco-500 uppercase tracking-widest mb-1">{step}</div>
                <div className="text-base font-bold text-slate-900 mb-2">{label}</div>
                <div className="text-sm text-slate-500 leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── 4. DEPOSIT MATERIALS ────────────────────────────────────────────────────

const MATERIALS = [
  { label: 'Aluminium Cans',    rate: '$1.85/kg' },
  { label: 'PET Plastic',       rate: '$0.24/kg' },
  { label: 'HDPE Containers',   rate: '$0.21/kg' },
  { label: 'Clear Glass',       rate: '$0.02/kg' },
  { label: 'Steel Cans',        rate: '$0.14/kg' },
  { label: 'Paperboard',        rate: '$0.06/kg' },
]

function DepositSection() {
  return (
    <section id="deposit" className="bg-white py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-eco-100 text-eco-800 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-6">
              Steps 1 &amp; 2
            </div>
            <h2 className="text-4xl font-bold text-slate-900 tracking-tight mb-6">
              Deposit Your Materials
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed mb-8">
              Fill your 240L wheelie bin with eligible recyclables and schedule a doorstep collection or drop-off. Value is calculated at live commodity prices — no flat rates, no caps.
            </p>
            <ul className="space-y-3 mb-10">
              {[
                'Doorstep 240L bin collection — scheduled or on-demand',
                'Commodity-linked pricing updated daily',
                'Bulk collection for offices, factories, and councils',
                'Collection zones across metro and regional Australia',
              ].map(item => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-eco-600 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/consumer/find"
              className="inline-flex items-center gap-2 bg-eco-700 hover:bg-eco-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Find Your Collection Zone
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="bg-eco-50 rounded-3xl p-8 border border-eco-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-6">
              Material Rate Card — Commodity Linked
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MATERIALS.map(m => (
                <div key={m.label} className="bg-white rounded-xl px-4 py-3 border border-eco-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Recycle className="w-4 h-4 text-eco-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-800">{m.label}</span>
                  </div>
                  <span className="text-sm font-bold text-eco-700 whitespace-nowrap">{m.rate}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 bg-eco-700 rounded-2xl px-6 py-5 text-white">
              <div className="text-xs font-semibold text-eco-200 uppercase tracking-wider mb-1">Collection Network</div>
              <div className="text-3xl font-bold">2,400+</div>
              <div className="text-sm text-eco-200 mt-0.5">Active zones nationwide · 240L bin focus</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── 5. RECOVER VALUE ────────────────────────────────────────────────────────

function RecoverSection() {
  const options = [
    { Icon: Coins,    title: 'Cash Refund',       desc: 'Direct bank transfer or cash payout via partner ATMs.',            bg: 'bg-amber-50 border-amber-100', icon: 'text-amber-600' },
    { Icon: Gift,     title: 'Gift Cards',         desc: 'Redeem at major retailers, supermarkets, and restaurants.',        bg: 'bg-blue-50 border-blue-100',   icon: 'text-blue-600' },
    { Icon: Leaf,     title: 'Eco Credits',        desc: 'Apply credits toward eco-friendly products in the Marketplace.',   bg: 'bg-eco-50 border-eco-100',     icon: 'text-eco-600' },
    { Icon: Globe,    title: 'Charity Donation',   desc: 'Direct your recovered value to a verified environmental charity.', bg: 'bg-purple-50 border-purple-100', icon: 'text-purple-600' },
  ]

  return (
    <section id="recover-value" className="bg-slate-50 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-eco-100 text-eco-800 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-4">
            Step 3
          </div>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight">Recover Real Value</h2>
          <p className="text-lg text-slate-600 mt-4 max-w-2xl mx-auto">
            Your material is weighed, sorted, and valued at live commodity prices. Choose exactly how you want to use it.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          {options.map(({ Icon, title, desc, bg, icon }) => (
            <div key={title} className={`${bg} border rounded-2xl p-6 hover:shadow-md transition-shadow`}>
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mb-4 shadow-sm">
                <Icon className={`w-5 h-5 ${icon}`} />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 px-8 py-10 lg:px-14">
          <div className="grid sm:grid-cols-3 gap-8 text-center divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {[
              { value: '$/kg',     label: 'Commodity-linked pricing',  sub: 'Rates updated daily, transparently' },
              { value: '< 24h',   label: 'Time to credit',             sub: 'Post-collection processing' },
              { value: '$260/yr', label: 'Avg household recovery',      sub: 'Based on 240L weekly collections' },
            ].map(s => (
              <div key={s.label} className="py-4 sm:py-0 sm:px-8 space-y-1">
                <div className="text-4xl font-bold text-eco-700">{s.value}</div>
                <div className="text-sm font-semibold text-slate-900">{s.label}</div>
                <div className="text-xs text-slate-400">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── 6. HOUSEHOLD RECYCLING CIRCLE ───────────────────────────────────────────

const CIRCLE_MEMBERS = [
  { name: 'Sarah M.', items: 42, earned: '$24.20', initials: 'SM' },
  { name: 'James M.', items: 38, earned: '$18.80', initials: 'JM' },
  { name: 'Ella M.',  items: 29, earned: '$12.90', initials: 'EM' },
]

function HouseholdSection() {
  return (
    <section id="household" className="bg-white py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Dashboard mockup */}
          <div className="bg-slate-900 rounded-3xl p-8 lg:p-10 text-white order-last lg:order-first">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-6">
              Household Recycling Circle — Live Dashboard
            </p>
            <div className="space-y-3">
              {CIRCLE_MEMBERS.map(m => (
                <div key={m.name} className="flex items-center gap-4 bg-white/5 hover:bg-white/10 rounded-xl px-4 py-3 transition-colors">
                  <div className="w-9 h-9 bg-eco-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {m.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{m.name}</div>
                    <div className="text-xs text-slate-400">{m.items} collections this month</div>
                  </div>
                  <div className="text-sm font-bold text-eco-400">{m.earned}</div>
                </div>
              ))}
            </div>
            <div className="bg-eco-900/50 border border-eco-800 rounded-2xl px-5 py-5 mt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] text-eco-400 font-semibold uppercase tracking-widest mb-1">Circle Total</div>
                  <div className="text-2xl font-bold text-white">
                    $55.90 <span className="text-sm font-normal text-slate-400">this month</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-eco-400 font-semibold uppercase tracking-widest mb-1">Collections</div>
                  <div className="text-2xl font-bold text-eco-400">109</div>
                </div>
              </div>
            </div>
          </div>

          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-eco-100 text-eco-800 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-6">
              Household Recycling Circle
            </div>
            <h2 className="text-4xl font-bold text-slate-900 tracking-tight mb-6">
              Grow Your<br />Household Circle
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed mb-8">
              Invite family members, housemates, or flatmates to your Household Recycling Circle. Track contributions, pool your recovered value, and build collective impact.
            </p>
            <ul className="space-y-5 mb-10">
              {[
                { title: 'Shared Dashboard',  desc: "See every member's collections, earnings, and impact in one unified view." },
                { title: 'Pooled Rewards',    desc: "Combine your household's recovered value for bigger redemptions in the Eco Rewards Marketplace." },
                { title: 'Leaderboards',      desc: 'Friendly streaks and rankings keep every household member engaged and consistent.' },
              ].map(item => (
                <li key={item.title} className="flex gap-4">
                  <div className="w-5 h-5 bg-eco-100 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                    <CheckCircle className="w-3.5 h-3.5 text-eco-700" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <div className="text-sm text-slate-500 mt-0.5">{item.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              to="/consumer/circle"
              className="inline-flex items-center gap-2 bg-eco-700 hover:bg-eco-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Start Your Household Circle
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── 7. OPERATOR PARTNER PROGRAM ─────────────────────────────────────────────

const OPERATOR_TIERS = [
  {
    audience: 'SME & Retail',
    Icon: Building2,
    features: [
      'Deploy a CirclLoop 240L collection zone at your premises',
      'Revenue share on every collection processed',
      'Branded, customer-facing station experience',
      'Staff and access management portal',
    ],
  },
  {
    audience: 'Enterprise & Councils',
    Icon: Globe,
    features: [
      'Multi-site operator dashboard and fleet management',
      'Logistics and collection scheduling integration',
      'Custom branding and full API access',
      'Dedicated account management and SLA',
      'Compliance, audit, and sustainability reporting suite',
    ],
  },
]

function OperatorSection() {
  return (
    <section id="operator" className="bg-eco-50 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-eco-100 text-eco-800 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-4">
            Operator Partner Program
          </div>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight">
            Operate Recycling Stations
          </h2>
          <p className="text-lg text-slate-600 mt-4 max-w-2xl mx-auto">
            Partner with CirclLoop to deploy and operate 240L collection zones for your community, customers, or council area. Earn revenue and deliver verified sustainability outcomes.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-10">
          {OPERATOR_TIERS.map(({ audience, Icon, features }) => (
            <div key={audience} className="bg-white rounded-3xl border border-eco-100 p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-eco-100 rounded-2xl flex items-center justify-center mb-5">
                <Icon className="w-6 h-6 text-eco-700" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-5">{audience}</h3>
              <ul className="space-y-3 mb-8">
                {features.map(f => (
                  <li key={f} className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-eco-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-700">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/operator"
                className="inline-flex items-center gap-1.5 border border-eco-200 hover:border-eco-500 text-eco-700 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                Learn More <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {[
            { Icon: Zap,      title: 'Quick Setup',      desc: 'Zones are activated and operational within 2–4 weeks of approval.' },
            { Icon: Shield,   title: 'Fully Managed',    desc: 'CirclLoop handles logistics, compliance, and collections end-to-end.' },
            { Icon: BarChart3, title: 'Live Analytics',  desc: 'Monitor throughput, revenue, and impact via your operator portal.' },
          ].map(({ Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl border border-eco-100 p-6 flex gap-4 shadow-sm">
              <div className="w-10 h-10 bg-eco-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-eco-700" />
              </div>
              <div>
                <div className="font-semibold text-slate-900 mb-1">{title}</div>
                <div className="text-sm text-slate-500 leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── 8. ECO REWARDS MARKETPLACE ──────────────────────────────────────────────

const REWARD_CATEGORIES = ['Sustainable Products', 'Grocery & Food', 'Entertainment', 'Travel', 'Health & Wellbeing', 'Charity']

const PARTNERS = [
  { name: 'Woolworths', category: 'Grocery',    reward: 'Up to 5% back' },
  { name: 'JB Hi-Fi',   category: 'Electronics', reward: 'Gift cards' },
  { name: 'Patagonia',  category: 'Sustainable', reward: '10% eco credit' },
  { name: 'GYG',        category: 'Food',        reward: 'Meal credits' },
]

function EcoRewardsSection() {
  return (
    <section id="eco-rewards" className="bg-slate-900 py-20 lg:py-28 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-eco-900 text-eco-300 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-6">
              Eco Rewards Marketplace
            </div>
            <h2 className="text-4xl font-bold tracking-tight mb-6">Spend Your Eco Credits</h2>
            <p className="text-lg text-slate-300 leading-relaxed mb-8">
              The Eco Rewards Marketplace transforms your recovered value into purchasing power across hundreds of partner brands — from sustainability specialists to major Australian retailers.
            </p>
            <div className="flex flex-wrap gap-2 mb-10">
              {REWARD_CATEGORIES.map(cat => (
                <span key={cat} className="bg-white/8 border border-white/10 text-slate-300 text-xs font-medium px-3 py-1.5 rounded-full">
                  {cat}
                </span>
              ))}
            </div>
            <Link
              to="/consumer/rewards"
              className="inline-flex items-center gap-2 bg-eco-700 hover:bg-eco-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Explore Marketplace
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {PARTNERS.map(p => (
              <div key={p.name} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                <div className="text-xs text-slate-400 font-medium mb-2">{p.category}</div>
                <div className="text-base font-bold text-white mb-1">{p.name}</div>
                <div className="text-xs text-eco-400 font-semibold">{p.reward}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── 9. FINAL CTA ────────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section className="bg-eco-700 py-20 lg:py-28">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 bg-eco-800 text-eco-200 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-7">
          Get Started Today
        </div>
        <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tight mb-6">
          Ready to Deposit &amp;<br />Recover Your Value?
        </h2>
        <p className="text-xl text-eco-100 mb-10 max-w-2xl mx-auto leading-relaxed">
          Join 340,000+ Australians already recovering real value from their recyclables. Register in 60 seconds — first collection free.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/consumer"
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-eco-50 text-eco-800 font-bold px-8 py-4 rounded-xl transition-colors shadow-lg"
          >
            Deposit &amp; Recover Value
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            to="/operator"
            className="inline-flex items-center justify-center gap-2 bg-eco-800 hover:bg-eco-900 text-white font-semibold px-8 py-4 rounded-xl border border-eco-600 transition-colors"
          >
            <Building2 className="w-5 h-5" />
            Operator Partner Enquiry
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <main>
      <HeroSection />
      <TrustBar />
      <UserLoopSection />
      <DepositSection />
      <RecoverSection />
      <HouseholdSection />
      <OperatorSection />
      <EcoRewardsSection />
      <CTASection />
    </main>
  )
}
