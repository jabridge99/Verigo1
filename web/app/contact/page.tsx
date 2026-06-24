import Link from 'next/link'
import { Mail, Clock, ArrowRight, MessageSquare, Headphones, BookOpen } from 'lucide-react'
import { industries } from '@/lib/industries'

export const metadata = {
  title: 'Contact Us | Verigo',
  description: 'Contact the VeriGo team for sales enquiries, technical support, or compliance advisory questions. We\'re here to help.',
}

const contactOptions = [
  {
    icon: MessageSquare,
    color: 'bg-blue-50 text-blue-600',
    title: 'Sales & Pricing',
    desc: 'Discuss your requirements, explore pricing options, or start a free trial to see the platform in action. Our sales team understands compliance — not just software.',
    email: 'sales@verigo.com.au',
    cta: { label: 'Start Free Trial', href: '/start-trial' },
    hours: 'Mon–Fri 9am–5pm AEST',
  },
  {
    icon: Headphones,
    color: 'bg-emerald-50 text-emerald-600',
    title: 'Customer Support',
    desc: 'Technical support for existing VeriGo customers. Platform issues, workflow questions, and integration assistance.',
    email: 'support@verigo.com.au',
    cta: null,
    hours: 'Mon–Fri 9am–5pm AEST',
  },
  {
    icon: BookOpen,
    color: 'bg-amber-50 text-amber-600',
    title: 'Compliance Advisory',
    desc: 'Questions about your AML/CTF obligations under the AML/CTF Act, what Tranche 2 means for your business, or how to structure your compliance program.',
    email: 'compliance@verigo.com.au',
    cta: null,
    hours: 'Mon–Fri 9am–5pm AEST',
  },
]

export default function ContactPage() {
  return (
    <div className="bg-white text-slate-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="pub-label mb-6 block w-fit mx-auto">Contact</span>
            <h1 className="text-5xl font-black text-slate-900 mb-4">Get in touch with the VeriGo team.</h1>
            <p className="text-xl text-slate-600 max-w-xl mx-auto">
              Whether you have a question about the platform, want to discuss your compliance requirements,
              or need help getting started — we&apos;re here.
            </p>
          </div>

          {/* Contact option cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-20">
            {contactOptions.map(opt => (
              <div key={opt.title} className="pub-card flex flex-col">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${opt.color}`}>
                  <opt.icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-2">{opt.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-4 flex-1">{opt.desc}</p>
                <div className="space-y-2">
                  <a
                    href={`mailto:${opt.email}`}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Mail className="w-4 h-4" /> {opt.email}
                  </a>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock className="w-3.5 h-3.5" /> {opt.hours}
                  </div>
                  {opt.cta && (
                    <Link href={opt.cta.href} className="pub-btn-secondary text-sm mt-2">
                      {opt.cta.label} <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Contact form */}
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="text-3xl font-black text-slate-900 mb-4">Send us a message.</h2>
              <p className="text-slate-600 leading-relaxed mb-6">
                Use the form to reach our team directly. We aim to respond to all enquiries within one business day.
              </p>
              <p className="text-slate-600 leading-relaxed mb-6">
                If you&apos;re evaluating VeriGo for your business, mention your industry and the specific compliance
                challenges you&apos;re trying to solve. The more context you give us, the more useful our response
                will be.
              </p>
              <div className="pub-card bg-blue-50 border-0 ring-1 ring-blue-100">
                <p className="text-sm font-semibold text-blue-900 mb-2">Not ready to contact us?</p>
                <p className="text-sm text-blue-800 mb-4">
                  Start a free 7-day trial and explore the platform yourself. No credit card required.
                  Your industry compliance pack is configured on day one.
                </p>
                <Link href="/start-trial" className="pub-btn-primary text-sm">
                  Start Free Trial <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="pub-card">
              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">First name</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Jane"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Last name</label>
                    <input
                      type="text"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Smith"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Work email</label>
                  <input
                    type="email"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="jane@company.com.au"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company name</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Acme Pty Ltd"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                  <select className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                    <option value="">Select your industry (optional)</option>
                    {industries.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.label}{i.regime === 'expanded' ? ' (Tranche 2)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                  <select className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                    <option value="">Select a subject</option>
                    <option>General Enquiry</option>
                    <option>Sales & Pricing</option>
                    <option>Technical Support</option>
                    <option>Compliance Question</option>
                    <option>Integration Question</option>
                    <option>Partnership</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                  <textarea
                    rows={5}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Tell us about your business, your compliance challenges, or what you'd like to know about VeriGo..."
                  />
                </div>
                <button type="submit" className="pub-btn-primary w-full justify-center py-3">
                  Send Message <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-slate-400 text-xs text-center">
                  We respond to all enquiries within one business day.
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
