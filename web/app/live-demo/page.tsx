import { CheckCircle, Calendar, Clock, Users } from 'lucide-react'

export const metadata = { title: 'Book a Demo | Verigo' }

export default function LiveDemoPage() {
  return (
    <div className="bg-white text-slate-900">
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <span className="pub-label mb-6 block w-fit">Live Demo</span>
              <h1 className="text-4xl font-black text-slate-900 mb-6">See Verigo in action.</h1>
              <p className="text-slate-600 leading-relaxed mb-8">Book a 30-minute guided demo with our compliance team. We&apos;ll walk you through the full platform — from customer onboarding to AUSTRAC submission — using your industry as the example.</p>

              <div className="space-y-4 mb-8">
                {[
                  { icon: Calendar, text: '30-minute focused session' },
                  { icon: Users, text: 'Led by a compliance specialist' },
                  { icon: Clock, text: 'Available weekdays 9am–5pm AEST' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3">
                    <Icon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <span className="text-slate-700 text-sm font-medium">{text}</span>
                  </div>
                ))}
              </div>

              <div className="pub-card">
                <p className="text-sm font-semibold text-slate-900 mb-3">What we&apos;ll cover:</p>
                <ul className="space-y-2">
                  {['Your industry compliance obligations', 'Customer onboarding and KYC workflow', 'Transaction monitoring and AML alerts', 'AUSTRAC report preparation and submission', 'Pricing and onboarding timeline'].map(item => (
                    <li key={item} className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> {item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pub-card">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Book your demo</h2>
              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">First name</label>
                    <input type="text" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Jane" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Last name</label>
                    <input type="text" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Smith" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Work email</label>
                  <input type="email" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="jane@company.com.au" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company name</label>
                  <input type="text" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Acme Pty Ltd" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                  <select className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="">Select your industry</option>
                    <option>Digital Currency Exchange</option>
                    <option>Remittance Provider</option>
                    <option>Foreign Exchange</option>
                    <option>Real Estate Professional</option>
                    <option>Lawyer</option>
                    <option>Accountant</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preferred time</label>
                  <input type="text" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g. Tue 2pm AEST" />
                </div>
                <button type="submit" className="pub-btn-primary w-full justify-center py-3">Request Demo</button>
                <p className="text-slate-400 text-xs text-center">We&apos;ll confirm your booking within one business day.</p>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
