import { CheckCircle, Calendar, Clock, Users } from 'lucide-react'

export const metadata = { title: 'Book a Demo | Verigo' }

export default function LiveDemoPage() {
  return (
    <div className="section">
      <div className="container-xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-start">
          <div>
            <span className="badge bg-brand-900/50 text-brand-400 border border-brand-700/30 mb-4">Live Demo</span>
            <h1 className="text-4xl font-bold mb-6">See Verigo in action.</h1>
            <p className="text-white/60 leading-relaxed mb-8">Book a 30-minute guided demo with our compliance team. We&apos;ll walk you through the full platform — from customer onboarding to AUSTRAC submission — using your industry as the example.</p>
            <div className="space-y-4 mb-8">
              {[
                { icon: Calendar, text: '30-minute focused session' },
                { icon: Users, text: 'Led by a compliance specialist' },
                { icon: Clock, text: 'Available weekdays 9am–5pm AEST' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-white/70"><Icon className="w-5 h-5 text-brand-400" /> {text}</div>
              ))}
            </div>
            <div className="card border-brand-700/30 bg-brand-900/10">
              <p className="text-sm font-semibold text-white mb-3">What we&apos;ll cover:</p>
              <ul className="space-y-2">
                {['Your industry compliance obligations', 'Customer onboarding and KYC workflow', 'Transaction monitoring and AML alerts', 'AUSTRAC report preparation and submission', 'Pricing and onboarding timeline'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-white/70"><CheckCircle className="w-4 h-4 text-green-400" /> {item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="card">
            <h2 className="text-xl font-bold mb-6">Book your demo</h2>
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm text-white/60 mb-1">First name</label><input type="text" className="field-input" placeholder="Jane" /></div>
                <div><label className="block text-sm text-white/60 mb-1">Last name</label><input type="text" className="field-input" placeholder="Smith" /></div>
              </div>
              <div><label className="block text-sm text-white/60 mb-1">Work email</label><input type="email" className="field-input" placeholder="jane@company.com.au" /></div>
              <div><label className="block text-sm text-white/60 mb-1">Company name</label><input type="text" className="field-input" placeholder="Acme Pty Ltd" /></div>
              <div>
                <label className="block text-sm text-white/60 mb-1">Industry</label>
                <select className="field-input">
                  <option value="">Select your industry</option>
                  <option>Digital Currency Exchange</option>
                  <option>Remittance Provider</option>
                  <option>Foreign Exchange</option>
                  <option>Real Estate Professional</option>
                  <option>Lawyer</option>
                  <option>Accountant</option>
                </select>
              </div>
              <div><label className="block text-sm text-white/60 mb-1">Preferred time</label><input type="text" className="field-input" placeholder="e.g. Tue 2pm AEST" /></div>
              <button type="submit" className="btn-gold w-full justify-center py-3">Request Demo</button>
              <p className="text-white/40 text-xs text-center">We&apos;ll confirm your booking within one business day.</p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
