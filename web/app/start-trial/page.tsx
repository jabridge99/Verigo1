import { CheckCircle, Shield } from 'lucide-react'
import SignupWizard from '@/components/SignupWizard'

export const metadata = {
  title: 'Start Free Trial | Verigo',
  description: 'Start your 7-day free Verigo trial. No credit card required. Your industry compliance pack is configured on day one.',
}

export default function StartTrialPage() {
  return (
    <div className="bg-white text-slate-900">
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            {/* Left column */}
            <div>
              <span className="pub-label mb-6 block w-fit">7-Day Free Trial</span>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-5">
                Start compliant<br />today.
              </h1>
              <p className="text-slate-600 leading-relaxed mb-8">
                Full access to all features. No credit card required. Your industry compliance pack is loaded and configured on day one.
              </p>
              <ul className="space-y-3 mb-10">
                {[
                  'Industry compliance pack configured on day one',
                  'Customer onboarding and KYC/KYB workflows ready',
                  'IFTI, SMR, and TTR report templates pre-loaded',
                  'Sanctions and PEP screening enabled immediately',
                  'Onboarding support included with every trial',
                ].map(f => (
                  <li key={f} className="flex items-start gap-3 text-sm text-slate-700">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-3 bg-blue-50 rounded-2xl p-4">
                <Shield className="w-8 h-8 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Australian data hosting</p>
                  <p className="text-slate-500 text-xs">All data stored in Australia. AES-256 encryption.</p>
                </div>
              </div>
            </div>

            {/* Right column — sign-up wizard */}
            <SignupWizard />
          </div>
        </div>
      </section>
    </div>
  )
}
