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
        destination: '/industry',
        permanent: false,
      },
    ]
  },
  async headers() {
    return [
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
