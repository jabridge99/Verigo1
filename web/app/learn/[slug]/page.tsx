import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Clock, CheckCircle, BookOpen } from 'lucide-react'
import { learnGuides } from '@/lib/learnContent'

export async function generateStaticParams() {
  return learnGuides.map(g => ({ slug: g.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const guide = learnGuides.find(g => g.slug === slug)
  if (!guide) return {}
  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
  }
}

const categoryColors: Record<string, string> = {
  Foundations: 'bg-blue-50 text-blue-700 ring-blue-700/10',
  Screening: 'bg-red-50 text-red-700 ring-red-700/10',
  Monitoring: 'bg-amber-50 text-amber-700 ring-amber-700/10',
  Reporting: 'bg-emerald-50 text-emerald-700 ring-emerald-700/10',
  Reform: 'bg-purple-50 text-purple-700 ring-purple-700/10',
  Advanced: 'bg-indigo-50 text-indigo-700 ring-indigo-700/10',
}

export default async function LearnGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const guide = learnGuides.find(g => g.slug === slug)
  if (!guide) notFound()

  const related = learnGuides.filter(g => guide.relatedSlugs.includes(g.slug))

  return (
    <div className="bg-white text-slate-900">
      {/* Header */}
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/learn" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Learning Centre
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${categoryColors[guide.category] ?? 'bg-slate-50 text-slate-700 ring-slate-700/10'}`}>
              {guide.category}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5" /> {guide.readTime}
            </span>
            <span className="text-xs text-slate-400">Updated {guide.lastUpdated}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-6">{guide.title}</h1>
          <p className="text-xl text-slate-600 leading-relaxed">{guide.summary}</p>
        </div>
      </section>

      {/* Content */}
      <section className="px-4 sm:px-6 lg:px-8 pb-24">
        <div className="max-w-4xl mx-auto">
          {/* Table of contents */}
          <div className="pub-card bg-slate-50 border-0 ring-1 ring-slate-200 mb-12">
            <p className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" /> In this guide
            </p>
            <ol className="space-y-1.5">
              {guide.sections.map((s, i) => (
                <li key={s.heading}>
                  <a href={`#section-${i}`} className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
                    {i + 1}. {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </div>

          {/* Sections */}
          <div className="space-y-16">
            {guide.sections.map((section, i) => (
              <div key={section.heading} id={`section-${i}`}>
                <h2 className="text-2xl font-black text-slate-900 mb-5">{section.heading}</h2>
                <div className="space-y-4">
                  {section.content.split('\n\n').map((para, j) => (
                    <p key={j} className="text-slate-700 leading-relaxed">{para}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Key takeaways */}
          <div className="mt-16 pub-card bg-blue-50 border-0 ring-1 ring-blue-200">
            <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-blue-600" /> Key Takeaways
            </h2>
            <ul className="space-y-3">
              {guide.keyTakeaways.map(t => (
                <li key={t} className="flex items-start gap-3 text-sm text-blue-900">
                  <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="mt-12 pub-card bg-slate-900 text-white">
            <h3 className="text-xl font-bold mb-2">Put this knowledge into practice with VeriGo.</h3>
            <p className="text-slate-400 text-sm mb-5">
              VeriGo automates the obligations described in this guide. Start a free 7-day trial — your industry
              compliance pack is configured on day one.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/start-trial" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/live-demo" className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-6 py-3 text-sm font-semibold text-white ring-1 ring-slate-700 hover:bg-slate-700 transition-colors">
                Book a Demo
              </Link>
            </div>
          </div>

          {/* Related guides */}
          {related.length > 0 && (
            <div className="mt-16">
              <h2 className="text-xl font-black text-slate-900 mb-6">Related guides</h2>
              <div className="grid md:grid-cols-2 gap-5">
                {related.map(r => (
                  <Link key={r.slug} href={`/learn/${r.slug}`} className="pub-card-hover group flex flex-col">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${categoryColors[r.category] ?? 'bg-slate-50 text-slate-700 ring-slate-700/10'}`}>
                        {r.category}
                      </span>
                      <span className="text-xs text-slate-400">{r.readTime}</span>
                    </div>
                    <h3 className="font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors text-sm">{r.title}</h3>
                    <span className="text-blue-600 text-xs font-semibold mt-auto pt-2 flex items-center gap-1 group-hover:gap-2 transition-all">
                      Read Guide <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
