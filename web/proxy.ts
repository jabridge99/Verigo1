import { NextRequest, NextResponse } from 'next/server'

// P50b: nonce-based CSP, replacing script-src 'unsafe-inline'. A random
// nonce is minted per request and threaded two ways: into the CSP header
// (so only <script> tags carrying it may run) and into an `x-nonce`
// request header the root layout reads via next/headers' headers() and
// passes to next-themes' ThemeProvider, the one inline script this app
// renders itself. 'strict-dynamic' lets Next.js's own nonce-tagged
// framework/page bundle scripts load their own child scripts without
// needing every chunk URL allow-listed by 'self' — Next.js auto-applies
// the nonce to its own script tags once it sees one in this header
// (supported since Next 13.4; this app is on 16).
//
// Cost of this change (why it was a parked decision, not a default): a
// nonce differs every request, so every route under this middleware/root
// layout loses static generation and CDN caching -- confirmed when this
// was first prototyped for P50 (every previously static/SSG page became
// dynamic in the build output). Revisited and accepted on your direction.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const apiOrigin = process.env.NEXT_PUBLIC_API_URL || 'https://api.verigo.com.au'

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: blob:`,
    `connect-src 'self' ${apiOrigin} https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `form-action 'self'`,
    `upgrade-insecure-requests`,
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    /*
     * Run on everything except:
     * - /api (proxied straight to the backend at Vercel's edge, not a Next.js route)
     * - _next/static, _next/image (build assets, images — already immutable/cached)
     * - files with an extension (favicon.png, manifest.json, sw.js, etc.)
     */
    '/((?!api|_next/static|_next/image|.*\\..*).*)',
  ],
}
