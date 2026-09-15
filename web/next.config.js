const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 'standalone' is for Docker only — Vercel builds natively without it
  ...(process.env.DOCKER_BUILD === '1' && { output: 'standalone' }),
  async redirects() {
    return [
      {
        source: '/solutions/payment-service-provider',
        destination: '/solutions/remittance',
        permanent: true,
      },
      {
        source: '/ifti',
        destination: '/reporting?type=ifti',
        permanent: false,
      },
      {
        source: '/packs',
        destination: '/industries',
        permanent: false,
      },
      {
        source: '/live-demo',
        destination: '/start-trial',
        permanent: true,
      },
    ]
  },
  async headers() {
    // P50 (Security Hardening): the page a browser actually loads from
    // this app had no Content-Security-Policy or HSTS at all -- the CSP
    // found during the Stage 15 survey (app/middleware.py's
    // SecurityHeadersMiddleware) only wraps the FastAPI backend's JSON API
    // responses, not this frontend's HTML/JS. vercel.json's existing
    // X-Content-Type-Options/X-Frame-Options/Referrer-Policy headers are
    // untouched; this adds the two that were missing entirely.
    //
    // script-src keeps 'unsafe-inline' rather than a nonce: a nonce-based
    // CSP needs the nonce read via next/headers' headers() inside a Server
    // Component (next-themes' ThemeProvider is the one inline <script>
    // this app renders itself, and it accepts a nonce prop for exactly
    // this), but calling headers() in the root layout forces every page
    // under it into fully dynamic (per-request) rendering -- confirmed by
    // building with that change: every marketing/app page that was static
    // (○) or SSG'd (●) became dynamic (ƒ), losing CDN caching across the
    // whole site (60+ routes), not just the few pages that were already
    // dynamic. That's a real, site-wide performance/cost tradeoff, not a
    // one-line fix -- tracked as its own decision (P50b) rather than
    // applied unilaterally here. Every other directive below is a real,
    // no-cost improvement that doesn't touch script-src.
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL || 'https://api.verigo.com.au'
    const csp = [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline'`,
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
      `font-src 'self' https://fonts.gstatic.com`,
      `img-src 'self' data: blob:`,
      // Sentry's ingest host depends on the DSN configured per deployment
      // (NEXT_PUBLIC_SENTRY_DSN, not present in this repo) -- allowing its
      // documented ingest domains rather than guessing one project
      // subdomain, so error reporting doesn't silently break once a real
      // DSN is set.
      `connect-src 'self' ${apiOrigin} https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io`,
      `frame-ancestors 'none'`,
      `base-uri 'self'`,
      `object-src 'none'`,
      `form-action 'self'`,
      `upgrade-insecure-requests`,
    ].join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ]
  },
}

// Sentry source-map upload only runs when SENTRY_AUTH_TOKEN is set (CI/prod
// builds); local/dev builds skip it silently. Error reporting itself only
// activates client/server-side when NEXT_PUBLIC_SENTRY_DSN is set.
module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  disableLogger: true,
  widenClientFileUpload: false,
})
