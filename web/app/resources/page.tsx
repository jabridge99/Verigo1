import Link from 'next/link'
import { ArrowRight, BookOpen, Clock } from 'lucide-react'

export const metadata = {
  title: 'Compliance Resources | Verigo',
  description: 'Free AML/CTF compliance guides for Australian businesses. Learn about KYC, KYB, sanctions screening, AUSTRAC reporting, transaction monitoring, and the Tranche 2 reform.',
}

const guides = [
  {
    slug: 'aml-fundamentals',
    category: 'Foundations',
    categoryColor: 'bg-blue-50 text-blue-700 ring-blue-700/10',
    title: 'AML/CTF Fundamentals',
    desc: 'A complete guide to Australia\'s AML/CTF regime — what it is, who it covers, the obligations that apply, and how AUSTRAC supervises and enforces compliance.',
    readTime: '12 min read',
  },
  {
    slug: 'kyc-guide',
    category: 'Foundations',
    categoryColor: 'bg-blue-50 text-blue-700 ring-blue-700/10',
    title: 'KYC Guide for Australian Businesses',
    desc: 'Identity verification requirements for Australian reporting entities. What documents are required, when CDD must be completed, and how electronic verification works.',
    readTime: '10 min read',
  },
  {
    slug: 'kyb-guide',
    category: 'Foundations',
    categoryColor: 'bg-blue-50 text-blue-700 ring-blue-700/10',
    title: 'KYB Guide — Verifying Business Customers',
    desc: 'How to verify corporate customers under the AML/CTF Act. Company verification, beneficial ownership mapping, trust structures, and source of funds.',
    readTime: '10 min read',
  },
  {
    slug: 'sanctions-screening',
    category: 'Screening',
    categoryColor: 'bg-red-50 text-red-700 ring-red-700/10',
    title: 'Sanctions Screening Guide',
    desc: 'Australia\'s sanctions regime explained. Which lists apply, how to screen, how to handle matches, and what obligations arise when a sanctioned person is identified.',
    readTime: '8 min read',
  },
  {
    slug: 'pep-screening',
    category: 'Screening',
    categoryColor: 'bg-red-50 text-red-700 ring-red-700/10',
    title: 'PEP Screening Guide',
    desc: 'Politically exposed persons under the AML/CTF Act. Who qualifies as a PEP, what enhanced due diligence is required, and how to manage ongoing PEP relationships.',
    readTime: '8 min read',
  },
  {
    slug: 'adverse-media-screening',
    category: 'Screening',
    categoryColor: 'bg-red-50 text-red-700 ring-red-700/10',
    title: 'Adverse Media Screening',
    desc: 'How negative news screening fits into your AML/CTF program. What to look for, how to assess relevance, and how continuous monitoring differs from onboarding checks.',
    readTime: '7 min read',
  },
  {
    slug: 'transaction-monitoring',
    category: 'Monitoring',
    categoryColor: 'bg-amber-50 text-amber-700 ring-amber-700/10',
    title: 'Transaction Monitoring Guide',
    desc: 'How to detect suspicious activity across your transaction data. Rules, typologies, alert management, investigation workflows, and documentation requirements.',
    readTime: '10 min read',
  },
  {
    slug: 'smr-guide',
    category: 'Reporting',
    categoryColor: 'bg-emerald-50 text-emerald-700 ring-emerald-700/10',
    title: 'SMR Guide — Suspicious Matter Reports',
    desc: 'The suspicion threshold, timing obligations, what to include in an SMR, the tipping-off offence, and how to maintain quality AUSTRAC intelligence submissions.',
    readTime: '9 min read',
  },
  {
    slug: 'ifti-guide',
    category: 'Reporting',
    categoryColor: 'bg-emerald-50 text-emerald-700 ring-emerald-700/10',
    title: 'IFTI Guide — International Funds Transfer Instructions',
    desc: 'Who must lodge IFTIs, what triggers the obligation, what data is required, timing deadlines, and the relationship between IFTIs and the Travel Rule.',
    readTime: '7 min read',
  },
  {
    slug: 'ttr-guide',
    category: 'Reporting',
    categoryColor: 'bg-emerald-50 text-emerald-700 ring-emerald-700/10',
    title: 'TTR Guide — Threshold Transaction Reports',
    desc: 'The $10,000 cash transaction threshold, the structuring offence, what counts as cash, TTR timing obligations, and how TTRs and SMRs interact.',
    readTime: '7 min read',
  },
  {
    slug: 'austrac-reform-guide',
    category: 'Reform',
    categoryColor: 'bg-purple-50 text-purple-700 ring-purple-700/10',
    title: 'Australian AML Reform Guide — Tranche 2',
    desc: 'The complete guide to Australia\'s AML/CTF Amendment Act 2024. Who is affected, what obligations apply, key deadlines, and how to prepare your business for 1 July 2026.',
    readTime: '14 min read',
    featured: true,
  },
  {
    slug: 'reporting-groups-guide',
    category: 'Advanced',
    categoryColor: 'bg-indigo-50 text-indigo-700 ring-indigo-700/10',
    title: 'Reporting Groups Guide',
    desc: 'How reporting groups work under the AML/CTF Act. Eligibility, benefits, shared CDD, consolidated reporting, governance requirements, and implementation steps.',
    readTime: '8 min read',
  },
]

const categoryOrder = ['Foundations', 'Screening', 'Monitoring', 'Reporting', 'Reform', 'Advanced']

export default function ResourcesPage() {
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
            Practical, accurate, and written specifically for the Australian AML/CTF regime. No legal jargon.
            No overseas examples. Just clear guidance for Australian reporting entities.
          </p>
        </div>
      </section>

      {/* Featured guide */}
      <section className="pb-0 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/learn/austrac-reform-guide" className="pub-card-hover block bg-gradient-to-br from-blue-600 to-blue-700 text-white p-8 md:p-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white mb-4">
                  Featured — Essential Reading
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
                  Australian AML Reform Guide — Tranche 2
                </h2>
                <p className="text-blue-100 leading-relaxed max-w-xl">
                  The biggest AML reform in 18 years. Lawyers, accountants, real estate professionals,
                  conveyancers, and precious metals dealers will all face AML/CTF obligations from 1 July 2026.
                  This guide explains everything.
                </p>
                <div className="flex items-center gap-4 mt-4">
                  <span className="flex items-center gap-1.5 text-blue-200 text-sm"><Clock className="w-3.5 h-3.5" /> 14 min read</span>
                  <span className="text-blue-200 text-sm">Updated June 2025</span>
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

      {/* All guides by category */}
      <section className="pub-section bg-white">
        <div className="pub-container">
          {categoryOrder.map(cat => {
            const catGuides = guides.filter(g => g.category === cat && !g.featured)
            if (catGuides.length === 0) return null
            return (
              <div key={cat} className="mb-14 last:mb-0">
                <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
                  {cat}
                  <span className="text-sm font-normal text-slate-400">{catGuides.length} guides</span>
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {catGuides.map(guide => (
                    <Link key={guide.slug} href={`/learn/${guide.slug}`} className="pub-card-hover group flex flex-col">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${guide.categoryColor}`}>
                          {guide.category}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
                          <Clock className="w-3 h-3" /> {guide.readTime}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{guide.title}</h3>
                      <p className="text-slate-500 text-sm leading-relaxed flex-1 mb-4">{guide.desc}</p>
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
          <h2 className="text-3xl font-black text-white mb-4">Ready to put compliance into practice?</h2>
          <p className="text-slate-400 mb-8 max-w-xl mx-auto">
            VeriGo automates the obligations these guides describe. Start a free 7-day trial and see how
            the platform maps to your specific industry requirements.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-8 py-4 text-base font-semibold text-white ring-1 ring-slate-700 hover:bg-slate-700 transition-colors">
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
