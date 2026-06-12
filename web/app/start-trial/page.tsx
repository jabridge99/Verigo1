import Link from 'next/link'
import { CheckCircle, ArrowRight } from 'lucide-react'
import { industries } from '@/lib/industries'

export const metadata = { title: 'Start Free Trial | Verigo' }

export default function StartTrialPage() {
  return (
    <div className="section">
      <div className="container-xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-start max-w-5xl mx-auto">
          <div>
            <span className="badge bg-gold-400/20 text-gold-400 border border-gold-400/30 mb-4">7-Day Free Trial</span>
            <h1 className="text-4xl font-bold mb-6">Start compliant today.</h1>
            <p className="text-white/60 leading-relaxed mb-6">Full access to all features. No credit card required. Set up takes less than 10 minutes.</p>
            <ul className="space-y-3 mb-8">
              {[
                'Your industry compliance pack loaded on day one',
                'Customer onboarding and KYC workflow ready to use',
                'Sanctions and PEP screening enabled',
                'AUSTRAC report templates pre-configured',
                'Onboarding call with our compliance team included',
              ].map(f => (
                <li key={f} className="flex items-start gap-3 text-sm text-white/70"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> {f}</li>
              ))}
            </ul>
          </div>
          <div className="card">
            <h2 className="text-xl font-bold mb-6">Create your account</h2>
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
                  {industries.map(i => <option key={i.id} value={i.id}>{i.label}{i.regime === 'expanded' ? ' (Tranche 2)' : ''}</option>)}
                </select>
              </div>
              <div><label className="block text-sm text-white/60 mb-1">Password</label><input type="password" className="field-input" placeholder="Minimum 12 characters" /></div>
              <button type="submit" className="btn-gold w-full justify-center py-3">Create Account & Start Trial <ArrowRight className="w-4 h-4" /></button>
              <p className="text-white/40 text-xs text-center">By creating an account you agree to our <Link href="#" className="underline">Terms of Service</Link> and <Link href="#" className="underline">Privacy Policy</Link>.</p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
