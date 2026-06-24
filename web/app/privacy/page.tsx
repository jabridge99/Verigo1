import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | Verigo',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-slate">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-10">
          Last updated 18 June 2026. Published by PSP Education Pty Ltd (ABN 21 628 429 925), trading as Verigo.
        </p>

        <h2>1. Who this applies to</h2>
        <p>
          This policy covers verigo.com.au and the Verigo platform. It does not extend to the AML/CTF
          compliance data (customer records, KYC documents, transactions, AML programs, audit logs) our
          business customers process using Verigo on behalf of their own customers — that data is governed
          by the data processing terms in our customer agreement and is handled under the Australian data
          residency commitments described on our{' '}
          <Link href="/trust-centre">Trust Centre</Link> page.
        </p>

        <h2>2. Cookies we use</h2>
        <p>
          Verigo uses one essential, first-party session cookie (<code>tvg_session</code>) to keep you
          signed in. It is strictly necessary for the platform to function and cannot be disabled without
          losing the ability to log in. We do not use third-party advertising or cross-site tracking
          cookies.
        </p>

        <h2>3. Analytics</h2>
        <p>
          Our marketing site uses{' '}
          <a href="https://vercel.com/docs/analytics/privacy-policy" target="_blank" rel="noreferrer">
            Vercel Web Analytics
          </a>{' '}
          to understand aggregate traffic and performance. It is cookieless — it does not set cookies, does
          not use persistent identifiers, and does not collect personal information. It records anonymised
          page-view counts, country-level location (derived from IP, which is not stored), referrer, and
          device/browser type. Onboarding links and verification links that contain single-use tokens are
          redacted before being sent.
        </p>
        <p>
          Because this data isn&apos;t personal information, the Australian Privacy Act doesn&apos;t require
          opt-in consent for it, but you can still turn it off any time using the cookie notice shown on
          your first visit, or by clearing your browser&apos;s local storage and selecting &ldquo;Opt out of
          analytics&rdquo; again.
        </p>

        <h2>4. Where data is processed</h2>
        <p>
          AML/CTF compliance data is hosted exclusively in AWS Sydney, Australia — see the{' '}
          <Link href="/trust-centre">Trust Centre</Link> for details. Our public marketing site is hosted on
          Vercel's global edge network, and the anonymised analytics described above are processed by
          Vercel as part of that hosting. The sub-processors we use, and what each handles, are:
        </p>
        <ul>
          <li><strong>Vercel</strong> — website hosting and anonymised, cookieless web analytics.</li>
          <li><strong>AWS (Sydney, Australia)</strong> — application database and document storage.</li>
          <li><strong>Stripe</strong> — subscription billing; we never see or store full card numbers.</li>
          <li><strong>Resend</strong> — transactional email delivery (e.g. verification, notifications).</li>
          <li><strong>Sentry</strong> — error monitoring, used to diagnose bugs; configured not to collect personal information by default.</li>
        </ul>

        <h2>5. Your rights</h2>
        <p>
          Under the Australian Privacy Act 1988 you can request access to, or correction of, personal
          information we hold about you. Contact us at{' '}
          <a href="mailto:privacy@verigo.com.au">privacy@verigo.com.au</a>.
        </p>

        <p className="text-sm text-slate-500 mt-12">
          This page is a plain-language summary for general visitors. It is not legal advice and does not
          modify the data processing terms in any signed customer agreement.
        </p>
      </div>
    </div>
  )
}
