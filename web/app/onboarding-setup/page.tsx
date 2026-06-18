import { Suspense } from 'react'
import { Shield } from 'lucide-react'
import OnboardingWizard from '@/components/OnboardingWizard'

export const metadata = {
  title: 'Set Up Your Organisation | Verigo',
  description: 'Configure your industry, compliance officer, risk appetite, and AML/CTF program.',
}

export default function OnboardingSetupPage() {
  return (
    <div className="bg-white text-slate-900 min-h-screen">
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Set up your organisation</h1>
            <p className="text-slate-500 mt-2 text-sm">A few quick steps to get your AML/CTF program ready.</p>
          </div>
          <Suspense fallback={null}>
            <OnboardingWizard />
          </Suspense>
        </div>
      </section>
    </div>
  )
}
