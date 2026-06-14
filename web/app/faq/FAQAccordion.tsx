'use client'

import { useState } from 'react'
import { ChevronDown, CheckCircle } from 'lucide-react'

export type FAQItem = { question: string; answer: string }

function FAQItemRow({ faq, index }: { faq: FAQItem; index: number }) {
  const [open, setOpen] = useState(false)

  const renderAnswer = (answer: string) =>
    answer.split('\n\n').map((para, i) => {
      // Numbered list with bold headings: "1. **Title** rest"
      if (para.match(/^\d+\.\s/m)) {
        return (
          <div key={i} className="space-y-2">
            {para.split('\n').map((line, j) => {
              const numbered = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*(.*)/)
              if (numbered) return (
                <div key={j} className="flex gap-3">
                  <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-[10px] font-black text-blue-600 flex-shrink-0 mt-0.5">{numbered[1]}</span>
                  <p><span className="font-semibold text-slate-800">{numbered[2]}</span>{numbered[3]}</p>
                </div>
              )
              const plain = line.match(/^(\d+)\.\s+(.+)/)
              if (plain) return (
                <div key={j} className="flex gap-3">
                  <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-[10px] font-black text-blue-600 flex-shrink-0 mt-0.5">{plain[1]}</span>
                  <p>{plain[2]}</p>
                </div>
              )
              return line ? <p key={j}>{line}</p> : null
            })}
          </div>
        )
      }
      // Bullet list
      if (para.match(/^- /m)) {
        return (
          <div key={i} className="space-y-1.5">
            {para.split('\n').map((line, j) => {
              if (line.startsWith('- ')) {
                const content = line.slice(2)
                const bold = content.match(/^\*\*(.+?)\*\*(.*)/)
                return (
                  <div key={j} className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p>{bold ? <><span className="font-semibold text-slate-800">{bold[1]}</span>{bold[2]}</> : content}</p>
                  </div>
                )
              }
              return line ? <p key={j} className="font-semibold text-slate-800 mb-1 mt-2">{line}</p> : null
            })}
          </div>
        )
      }
      // Bold heading block: "**Heading**\nContent"
      if (para.startsWith('**') && para.split('\n').length > 1) {
        const lines = para.split('\n')
        return (
          <div key={i}>
            <p className="font-semibold text-slate-800 mb-1">{lines[0].replace(/\*\*/g, '')}</p>
            {lines.slice(1).map((l, j) => <p key={j}>{l}</p>)}
          </div>
        )
      }
      // Default paragraph — inline bold via dangerouslySetInnerHTML
      return (
        <p key={i} dangerouslySetInnerHTML={{
          __html: para.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        }} />
      )
    })

  return (
    <div className={`border-b border-slate-100 last:border-0 transition-colors ${open ? 'bg-blue-50/40' : ''}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between gap-4 px-6 py-5 text-left"
      >
        <div className="flex items-start gap-4">
          <span className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-black text-slate-400 flex-shrink-0 mt-0.5">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="font-semibold text-slate-900 text-base leading-snug">{faq.question}</span>
        </div>
        <ChevronDown className={`w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-6 pb-6 pl-[4.25rem]">
          <div className="text-slate-600 text-sm leading-relaxed space-y-3">
            {renderAnswer(faq.answer)}
          </div>
        </div>
      )}
    </div>
  )
}

export default function FAQAccordion({ faqs }: { faqs: FAQItem[] }) {
  return (
    <div className="bg-white ring-1 ring-slate-100 rounded-2xl shadow-sm overflow-hidden divide-y divide-slate-100">
      {faqs.map((faq, i) => (
        <FAQItemRow key={i} faq={faq} index={i} />
      ))}
    </div>
  )
}
