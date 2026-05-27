import React from 'react'
import {
  MapPin, Package, DollarSign, BarChart3, RefreshCw,
  ArrowRight, ChevronRight, Users, Building2, Leaf,
  CheckCircle, Globe, Zap, Shield, Gift, Recycle,
  Coins, Menu,
} from 'lucide-react'

// ─── 1. HERO ─────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white pt-24 pb-20 lg:pt-36 lg:pb-32">
      <div className="absolute inset-0 bg-gradient-to-br from-eco-50 via-white to-white pointer-events-none" />
      <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-l from-eco-50/60 to-transparent pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-eco-100 text-eco-800 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-7">
            <Leaf className="w-3 h-3" strokeWidth={2.5} />
            Australia's Smart Recycling Network
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 tracking-tight leading-[1.05] mb-7">
            Deposit Materials.
            <br />
            <span className="text-eco-700">Recover Value.</span>
          </h1>

          {/* Sub */}
          <p className="text-xl text-slate-600 leading-relaxed mb-10 max-w-2xl">
            Find your nearest EcoBin station, deposit eligible recyclables, and recover real financial value — instantly. Built for households, businesses, and councils.
          </p>

          {/* CTAs */}
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
              Find Your Nearest Station
            </a>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-10 mt-14 pt-10 border-t border-slate-100">
            {[
              { value: '2,400+', label: 'Active Stations' },
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
    {
      Icon: MapPin,
      step: '01',
      label: 'Find Station',
      desc: 'Locate your nearest EcoBin drop-off point via app or web map.',
    },
    {
      Icon: Package,
      step: '02',
      label: 'Deposit Materials',
      desc: 'Drop off eligible containers, bottles, and packaging at the station.',
    },
    {
      Icon: DollarSign,
      step: '03',
      label: 'Recover Value',
      desc: 'Receive your deposit refund instantly — as cash, credits, or gift cards.',
    },
    {
      Icon: BarChart3,
      step: '04',
      label: 'Track Rewards',
      desc: 'Monitor earnings, impact, and household contributions in real time.',
    },
    {
      Icon: RefreshCw,
      step: '05',
      label: 'Repeat',
      desc: 'Build sustainable habits and grow your circular economy earnings.',
    },
  ]

  return (
    <section id="how-it-works" className="bg-eco-50 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-eco-100 text-eco-800 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-4">
            Core User Loop
          </div>
          <h2 className="text-4xl font-bold text-slate-900 tracking-tight">How EcoBin Works</h2>
          <p className="text-lg text-slate-600 mt-4 max-w-xl mx-auto">
            Five simple steps from deposit to value recovery — designed for individuals, households, and enterprise.
          </p>
        </div>

        <div className="relative">
          {/* Connecting line (desktop) */}
          <div
            className="hidden lg:block absolute top-[2.2rem] h-px bg-eco-200"
            style={{ left: '11%', right: '11%' }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-4">
            {steps.map(({ Icon, step, label, desc }) => (
              <div key={step} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 w-14 h-14 bg-white border-2 border-eco-200 rounded-2xl flex items-center justify-center shadow-sm mb-5">
                  <Icon className="w-6 h-6 text-eco-700" />
                </div>
                <div className="text-[10px] font-bold text-eco-500 uppercase tracking-widest mb-1">
                  {step}
                </div>
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
  'PET Plastic Bottles',
  'HDPE Containers',
  'Glass Bottles',
  'Aluminium Cans',
  'Liquid Paperboard',
  'Steel Cans',
]

function DepositSection() {
  return (
    <section id="deposit" className="bg-white py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-eco-100 text-eco-800 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-6">
              Steps 1 &amp; 2
            </div>
            <h2 className="text-4xl font-bold text-slate-900 tracking-tight mb-6">
              Deposit Your Materials
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed mb-8">
              Every eligible container deposited earns the standard 10 cent CDS refund. EcoBin stations accept a full range of materials — scan, drop, and done in under 30 seconds.
            </p>
            <ul className="space-y-3 mb-10">
              {[
                'Reverse vending machines with instant value credit',
                'Real-time station availability via app and web',
                'Bulk deposit options for businesses and households',
                'Accessible stations across metro and regional areas',
              ].map(item => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-eco-600 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
            <a
              href="#find-station"
              className="inline-flex items-center gap-2 bg-eco-700 hover:bg-eco-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Find Your Nearest Station
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Material card grid */}
          <div className="bg-eco-50 rounded-3xl p-8 border border-eco-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-6">
              Accepted Materials — 10¢ Each
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MATERIALS.map(m => (
                <div
                  key={m}
                  className="bg-white rounded-xl px-4 py-3 border border-eco-100 flex items-center gap-3"
                >
                  <Recycle className="w-4 h-4 text-eco-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-slate-800">{m}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 bg-eco-700 rounded-2xl px-6 py-5 text-white">
              <div className="text-xs font-semibold text-eco-200 uppercase tracking-wider mb-1">
                Station Network
              </div>
              <div className="text-3xl font-bold">2,400+</div>
              <div className="text-sm text-eco-200 mt-0.5">Active drop-off points nationwide</div>
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
    {
      Icon: Coins,
      title: 'Cash Refund',
      desc: 'Direct bank transfer or cash payout via partner ATMs.',
      bg: 'bg-amber-50 border-amber-100',
      icon: 'text-amber-600',
    },
    {
      Icon: Gift,
      title: 'Gift Cards',
      desc: 'Redeem at major retailers, supermarkets, and restaurants.',
      bg: 'bg-blue-50 border-blue-100',
      icon: 'text-blue-600',
    },
    {
      Icon: Leaf,
      title: 'Eco Credits',
      desc: 'Apply credits toward eco-friendly products in the Eco Rewards Marketplace.',
      bg: 'bg-eco-50 border-eco-100',
      icon: 'text-eco-600',
    },
    {
      Icon: Globe,
      title: 'Charity Donation',
      desc: 'Direct your recovered value to a verified environmental charity.',
      bg: 'bg-purple-50 border-purple-100',
      icon: 'text-purple-600',
    },
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
            Your recycling effort generates genuine financial return. Choose exactly how you want to receive and use it.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          {options.map(({ Icon, title, desc, bg, icon }) => (
            <div
              key={title}
              className={`${bg} border rounded-2xl p-6 hover:shadow-md transition-shadow`}
            >
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mb-4 shadow-sm">
                <Icon className={`w-5 h-5 ${icon}`} />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Key metrics */}
        <div className="bg-white rounded-3xl border border-slate-200 px-8 py-10 lg:px-14">
          <div className="grid sm:grid-cols-3 gap-8 text-center divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {[
              { value: '10¢',    label: 'Per eligible container', sub: 'Standard CDS refund rate' },
              { value: '< 30s',  label: 'Time to recover value',  sub: 'Instant processing at stations' },
              { value: '$52/yr', label: 'Average household recovery', sub: 'Based on typical usage data' },
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

const MEMBERS = [
  { name: 'Sarah M.', items: 42, earned: '$4.20', initials: 'SM' },
  { name: 'James M.', items: 38, earned: '$3.80', initials: 'JM' },
  { name: 'Ella M.',  items: 29, earned: '$2.90', initials: 'EM' },
]

function HouseholdSection() {
  return (
    <section id="household" className="bg-white py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Dashboard mockup */}
          <div className="bg-slate-900 rounded-3xl p-8 lg:p-10 text-white order-last lg:order-first">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-6">
              Household Recycling Circle — Dashboard
            </p>

            <div className="space-y-3">
              {MEMBERS.map(m => (
                <div
                  key={m.name}
                  className="flex items-center gap-4 bg-white/5 hover:bg-white/10 rounded-xl px-4 py-3 transition-colors"
                >
                  <div className="w-9 h-9 bg-eco-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {m.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{m.name}</div>
                    <div className="text-xs text-slate-400">{m.items} items this month</div>
                  </div>
                  <div className="text-sm font-bold text-eco-400">{m.earned}</div>
                </div>
              ))}
            </div>

            <div className="bg-eco-900/50 border border-eco-800 rounded-2xl px-5 py-5 mt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] text-eco-400 font-semibold uppercase tracking-widest mb-1">
                    Circle Total
                  </div>
                  <div className="text-2xl font-bold text-white">
                    $10.90
                    <span className="text-sm font-normal text-slate-400 ml-1">this month</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-eco-400 font-semibold uppercase tracking-widest mb-1">
                    Items Deposited
                  </div>
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
              Invite family members, housemates, or flatmates to your Household Recycling Circle. Track everyone's contributions, pool rewards, and build collective environmental impact together.
            </p>
            <ul className="space-y-5 mb-10">
              {[
                {
                  title: 'Shared Dashboard',
                  desc: "See every member's deposits, earnings, and environmental impact in one unified view.",
                },
                {
                  title: 'Pooled Rewards',
                  desc: "Combine your household's recovered value for bigger redemptions and marketplace purchases.",
                },
                {
                  title: 'Friendly Competition',
                  desc: 'Leaderboards and streaks keep the whole circle engaged, consistent, and motivated.',
                },
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
            <a
              href="#"
              className="inline-flex items-center gap-2 bg-eco-700 hover:bg-eco-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Start Your Household Circle
              <ArrowRight className="w-4 h-4" />
            </a>
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
      'Host an EcoBin station at your premises',
      'Revenue share on every transaction processed',
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
            Partner with EcoBin to deploy and operate stations for your community, customers, or council area. Earn revenue, deliver sustainability outcomes, and build circular economy infrastructure.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-10">
          {OPERATOR_TIERS.map(({ audience, Icon, features }) => (
            <div
              key={audience}
              className="bg-white rounded-3xl border border-eco-100 p-8 shadow-sm hover:shadow-md transition-shadow"
            >
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
              <a
                href="#"
                className="inline-flex items-center gap-1.5 border border-eco-200 hover:border-eco-500 text-eco-700 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                Learn More <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>

        {/* Support pillars */}
        <div className="grid sm:grid-cols-3 gap-5">
          {[
            {
              Icon: Zap,
              title: 'Quick Setup',
              desc: 'Stations are installed and operational within 2–4 weeks of approval.',
            },
            {
              Icon: Shield,
              title: 'Fully Managed',
              desc: 'EcoBin handles maintenance, compliance, and logistics end-to-end.',
            },
            {
              Icon: BarChart3,
              title: 'Real-time Analytics',
              desc: 'Monitor throughput, revenue, and environmental impact via your operator portal.',
            },
          ].map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="bg-white rounded-2xl border border-eco-100 p-6 flex gap-4 shadow-sm"
            >
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

const REWARD_CATEGORIES = [
  'Sustainable Products',
  'Grocery & Food',
  'Entertainment',
  'Travel & Transport',
  'Health & Wellbeing',
  'Charity',
]

const MARKETPLACE_PARTNERS = [
  { name: 'Woolworths', category: 'Grocery',     reward: 'Up to 5% back' },
  { name: 'JB Hi-Fi',   category: 'Electronics', reward: 'Gift cards' },
  { name: 'Patagonia',  category: 'Sustainable', reward: '10% eco credit' },
  { name: 'GYG',        category: 'Food',        reward: 'Meal credits' },
]

function EcoRewardsSection() {
  return (
    <section id="eco-rewards" className="bg-slate-900 py-20 lg:py-28 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-eco-900 text-eco-300 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-6">
              Eco Rewards Marketplace
            </div>
            <h2 className="text-4xl font-bold tracking-tight mb-6">
              Spend Your Eco Credits
            </h2>
            <p className="text-lg text-slate-300 leading-relaxed mb-8">
              The Eco Rewards Marketplace transforms your recovered value into purchasing power across hundreds of partner brands — from sustainable specialists to major Australian retailers.
            </p>
            <div className="flex flex-wrap gap-2 mb-10">
              {REWARD_CATEGORIES.map(cat => (
                <span
                  key={cat}
                  className="bg-white/8 border border-white/10 text-slate-300 text-xs font-medium px-3 py-1.5 rounded-full"
                >
                  {cat}
                </span>
              ))}
            </div>
            <a
              href="#"
              className="inline-flex items-center gap-2 bg-eco-700 hover:bg-eco-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Explore Marketplace
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Partner cards */}
          <div className="grid grid-cols-2 gap-4">
            {MARKETPLACE_PARTNERS.map(p => (
              <div
                key={p.name}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors"
              >
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
          Join 340,000+ Australians already earning from their recyclables. It takes 60 seconds to register and find your nearest station.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#deposit"
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-eco-50 text-eco-800 font-bold px-8 py-4 rounded-xl transition-colors shadow-lg"
          >
            Deposit &amp; Recover Value
            <ArrowRight className="w-5 h-5" />
          </a>
          <a
            href="#operator"
            className="inline-flex items-center justify-center gap-2 bg-eco-800 hover:bg-eco-900 text-white font-semibold px-8 py-4 rounded-xl border border-eco-600 transition-colors"
          >
            <Building2 className="w-5 h-5" />
            Operator Partner Enquiry
          </a>
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
