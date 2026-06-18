import StartTrialForm from './StartTrialForm'

export const metadata = {
  title: 'Start Free Trial | Verigo',
  description: 'Start your 7-day free Verigo trial. No credit card required. Your industry compliance pack is configured on day one.',
}

export default function StartTrialPage() {
  return (
    <div className="bg-white text-slate-900">
      <section className="bg-gradient-to-b from-slate-50 to-white pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <StartTrialForm />
        </div>
      </section>
    </div>
  )
}
