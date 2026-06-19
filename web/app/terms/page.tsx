import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service | Verigo',
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-slate">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-500 mb-10">
          Last updated 18 June 2026. Published by PSP Education Pty Ltd (ABN 21 628 429 925), trading as Verigo
          (&ldquo;Verigo&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
        </p>

        <h2>1. Agreement to these terms</h2>
        <p>
          These terms govern access to and use of the Verigo platform, including the 7-day free trial and any
          paid subscription. By creating an account or starting a trial, you agree to these terms on behalf of
          yourself and the business you represent. If you don&apos;t agree, don&apos;t use Verigo.
        </p>

        <h2>2. What Verigo is — and isn&apos;t</h2>
        <p>
          Verigo is a software platform that helps Australian reporting entities manage AML/CTF compliance —
          customer onboarding, KYC/KYB workflows, transaction monitoring, case management, and AUSTRAC report
          preparation (SMR, TTR, IFTI).
        </p>
        <p>
          Verigo is not a law firm, registered AUSTRAC agent, or your AML/CTF Compliance Officer. Using Verigo
          does not, by itself, satisfy your obligations under the AML/CTF Act 2006. Pre-loaded AML/CTF Program
          templates are reference material only — your business remains solely responsible for tailoring its
          own AML/CTF Program, conducting risk assessments, and lodging accurate, timely reports with AUSTRAC.
        </p>

        <h2>3. Eligibility and accounts</h2>
        <ul>
          <li>You must be an authorised representative of the business you sign up on behalf of.</li>
          <li>You&apos;re responsible for keeping your account credentials confidential and for all activity under your account.</li>
          <li>You must provide accurate information about your business and industry — see our{' '}
            <Link href="/start-trial">trial signup flow</Link> for industry-specific eligibility, including
            sectors that require a custom package rather than self-serve signup.</li>
          <li>One account per business entity unless covered by a Reporting Group or Enterprise arrangement.</li>
        </ul>

        <h2>4. Free trial</h2>
        <p>
          The trial provides full platform access for 7 days, no credit card required. We may suspend or
          terminate trial access at our discretion, including where an industry is not eligible for self-serve
          signup. At the end of the trial, your access ends unless you subscribe to a paid plan — trial data is
          retained for a limited period afterwards as described in our{' '}
          <Link href="/privacy">Privacy Policy</Link> and is not guaranteed to be preserved indefinitely.
        </p>

        <h2>5. Subscriptions, billing, and cancellation</h2>
        <ul>
          <li>Paid plans are billed annually in advance via Stripe, in the amounts shown on our{' '}
            <Link href="/pricing">Pricing</Link> page at the time of purchase.</li>
          <li>Fees are non-refundable except where required by law, including the Australian Consumer Law.</li>
          <li>You can cancel at any time; cancellation takes effect at the end of the current billing period and we don&apos;t pro-rate partial periods.</li>
          <li>We may change plan pricing or features on renewal with reasonable advance notice.</li>
          <li>Custom-package and Enterprise pricing is governed by your separately signed order form or customer agreement, which takes precedence over these terms where inconsistent.</li>
        </ul>

        <h2>6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use Verigo to facilitate money laundering, terrorism financing, sanctions evasion, or any other unlawful activity.</li>
          <li>Submit false, misleading, or fabricated information in any AML/CTF Program, KYC/KYB record, or AUSTRAC report.</li>
          <li>Attempt to access another tenant&apos;s data, reverse-engineer the platform, or circumvent rate limits or security controls.</li>
          <li>Resell or sublicense the platform without an applicable Reporting Group or Enterprise white-label arrangement.</li>
        </ul>

        <h2>7. Your data and your customers&apos; data</h2>
        <p>
          You retain ownership of the customer, transaction, and compliance data you input into Verigo. We
          process it solely to provide the platform and as described in our{' '}
          <Link href="/privacy">Privacy Policy</Link> and{' '}
          <Link href="/trust-centre">Trust Centre</Link>. You&apos;re responsible for having a lawful basis to
          collect and process your customers&apos; personal information, and for responding to your customers&apos;
          own privacy rights requests.
        </p>

        <h2>8. Availability and support</h2>
        <p>
          We target 99.9% uptime on paid plans, as reflected on our{' '}
          <Link href="/pricing">Pricing</Link> page, but the platform is provided on an &ldquo;as available&rdquo;
          basis without warranty of uninterrupted or error-free operation. Support response times vary by plan
          tier.
        </p>

        <h2>9. Disclaimers and limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Verigo is provided &ldquo;as is&rdquo; without warranties of any
          kind. We are not liable for any AUSTRAC enforcement action, penalty, fine, or regulatory finding
          arising from your use, misuse, or non-use of the platform, including reliance on reference AML/CTF
          Program templates. Nothing in these terms excludes any guarantee, right, or remedy you have under the
          Australian Consumer Law that cannot lawfully be excluded.
        </p>
        <p>
          Where liability cannot be excluded, our total liability arising out of or in connection with these
          terms is limited to the fees you paid us in the 12 months before the event giving rise to the claim.
        </p>

        <h2>10. Termination</h2>
        <p>
          We may suspend or terminate your access for breach of these terms, including unlawful use, abuse of
          the platform, or non-payment. You may terminate by cancelling your subscription. On termination, we
          will make your data available for export for a reasonable period before deletion, subject to any
          AUSTRAC record-keeping retention obligations described in our{' '}
          <Link href="/trust-centre">Trust Centre</Link>.
        </p>

        <h2>11. Changes to these terms</h2>
        <p>
          We may update these terms from time to time. Material changes will be notified by email or in-platform
          notice before they take effect. Continued use after changes take effect means you accept the updated
          terms.
        </p>

        <h2>12. Governing law</h2>
        <p>
          These terms are governed by the laws of New South Wales, Australia, and you submit to the
          non-exclusive jurisdiction of its courts.
        </p>

        <h2>13. Contact</h2>
        <p>
          Questions about these terms can be sent to{' '}
          <a href="mailto:legal@verigo.com.au">legal@verigo.com.au</a>.
        </p>

        <p className="text-sm text-slate-500 mt-12">
          This page is a plain-language summary for general visitors. It is not legal advice and does not
          modify the terms in any signed customer agreement, which takes precedence in the event of a conflict.
        </p>
      </div>
    </div>
  )
}
