import Link from 'next/link'
import { ArrowRight, Clock, BookOpen } from 'lucide-react'
import { learnGuides } from '@/lib/learnContent'

export const metadata = {
  title: 'Compliance Learning Centre | Verigo',
  description: 'Free AML/CTF compliance guides for Australian businesses. KYC, KYB, sanctions screening, AUSTRAC reporting, transaction monitoring, and Tranche 2 reform — explained clearly.',
}

const categoryColors: Record<string, string> = {
  Foundations: 'bg-blue-50 text-blue-700 ring-blue-700/10',
  Screening: 'bg-red-50 text-red-700 ring-red-700/10',
  Monitoring: 'bg-amber-50 text-amber-700 ring-amber-700/10',
  Reporting: 'bg-emerald-50 text-emerald-700 ring-emerald-700/10',
  Reform: 'bg-purple-50 text-purple-700 ring-purple-700/10',
  Advanced: 'bg-indigo-50 text-indigo-700 ring-indigo-700/10',
}

const categoryOrder = ['Foundations', 'Screening', 'Monitoring', 'Reporting', 'Reform', 'Advanced']

export default function LearnPage() {
  const featured = learnGuides.find(g => g.slug === 'austrac-reform-guide')!
  const rest = learnGuides.filter(g => g.slug !== 'austrac-reform-guide')

  return (
    <div className="bg-white text-slate-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <span className="pub-label mb-6 block w-fit mx-auto">Compliance Learning Centre</span>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 leading-tight tracking-tight mb-6">
            Free compliance guides<br />for Australian businesses.
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Practical, accurate educational content written specifically for Australia&apos;s AML/CTF regime.
            From AML fundamentals to AUSTRAC reporting — explained in plain language.
          </p>
        </div>
      </section>

      {/* Featured */}
      <section className="pb-0 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href={`/learn/${featured.slug}`} className="block pub-card-hover bg-gradient-to-br from-blue-600 to-blue-700 text-white p-8 md:p-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white mb-4">
                  Featured — Essential Reading
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-white mb-3">{featured.title}</h2>
                <p className="text-blue-100 leading-relaxed max-w-xl">{featured.summary}</p>
                <div className="flex items-center gap-4 mt-4">
                  <span className="flex items-center gap-1.5 text-blue-200 text-sm"><Clock className="w-3.5 h-3.5" /> {featured.readTime}</span>
                  <span className="text-blue-200 text-sm">Updated {featured.lastUpdated}</span>
                </div>
              </div>
              <div className="flex-shrink-0">
                <span className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-blue-700">
                  Read Guide <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Guides by category */}
      <section className="pub-section bg-white">
        <div className="pub-container">
          {categoryOrder.map(cat => {
            const guides = rest.filter(g => g.category === cat)
            if (!guides.length) return null
            return (
              <div key={cat} className="mb-14 last:mb-0">
                <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
                  {cat}
                  <span className="text-sm font-normal text-slate-400">{guides.length} guides</span>
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {guides.map(g => (
                    <Link key={g.slug} href={`/learn/${g.slug}`} className="pub-card-hover group flex flex-col">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${categoryColors[g.category] ?? 'bg-slate-50 text-slate-700 ring-slate-700/10'}`}>
                          {g.category}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
                          <Clock className="w-3 h-3" /> {g.readTime}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{g.title}</h3>
                      <p className="text-slate-500 text-sm leading-relaxed flex-1 mb-4">{g.summary}</p>
                      <span className="text-blue-600 text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                        Read Guide <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="pub-section bg-slate-900">
        <div className="pub-container text-center">
          <BookOpen className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <h2 className="text-3xl font-black text-white mb-4">Ready to automate your compliance?</h2>
          <p className="text-slate-400 mb-8 max-w-xl mx-auto">
            VeriGo automates the obligations these guides describe. Start a free 7-day trial.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/live-demo" className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-8 py-4 text-base font-semibold text-white ring-1 ring-slate-700 hover:bg-slate-700 transition-colors">
              Book a Demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
