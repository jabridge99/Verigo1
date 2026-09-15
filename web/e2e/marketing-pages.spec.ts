import { expect, test } from '@playwright/test'

test.describe('marketing pages render for real', () => {
  // Excludes failed-resource-load messages (net::ERR_...) -- this sandboxed
  // test environment's outbound-HTTPS proxy uses its own CA, which an
  // unconfigured browser doesn't trust, so the Google Fonts stylesheet
  // request in app/layout.tsx fails here with ERR_CERT_AUTHORITY_INVALID
  // regardless of the app's own correctness. Real JS/React errors still fail
  // the test.
  const isRealAppError = (text: string) => !text.includes('net::ERR_')

  test('homepage shows the real hero heading with no console errors', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && isRealAppError(msg.text())) consoleErrors.push(msg.text())
    })

    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: /compliance made practical/i })).toBeVisible()
    expect(consoleErrors).toEqual([])
  })

  test('pricing page renders real plan pricing with no console errors', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && isRealAppError(msg.text())) consoleErrors.push(msg.text())
    })

    const response = await page.goto('/pricing')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: /simple, transparent pricing/i })).toBeVisible()
    // Real dollar amounts, not just static copy -- proves fetchPlanPrices()'s
    // fallback path (no backend reachable in this test) actually rendered
    // pricing rather than the page silently breaking.
    await expect(page.getByText(/\$\d/).first()).toBeVisible()
    expect(consoleErrors).toEqual([])
  })

  test('an SSG industry solutions page renders', async ({ page }) => {
    const response = await page.goto('/solutions/vasp')
    expect(response?.status()).toBe(200)
    await expect(page.locator('h1').first()).toBeVisible()
  })
})

test.describe('security headers (P50 regression coverage)', () => {
  test('homepage response carries the real CSP and HSTS headers', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response?.headers() ?? {}
    expect(headers['content-security-policy']).toContain("default-src 'self'")
    expect(headers['strict-transport-security']).toContain('max-age=')
  })

  test('no CSP violations are reported while loading the homepage', async ({ page }) => {
    const violations: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /content security policy/i.test(msg.text())) {
        violations.push(msg.text())
      }
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(violations).toEqual([])
  })
})
