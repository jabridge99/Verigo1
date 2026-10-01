import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import CookieNotice from './CookieNotice'

describe('CookieNotice', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('shows the notice on first visit (nothing recorded yet)', () => {
    render(<CookieNotice />)
    expect(screen.getByText(/Read our Privacy Policy/i)).toBeInTheDocument()
  })

  it('does not show the notice again once already dismissed', () => {
    window.localStorage.setItem('verigo_cookie_notice_seen', '1')
    render(<CookieNotice />)
    expect(screen.queryByText(/Read our Privacy Policy/i)).not.toBeInTheDocument()
  })

  it('dismissing with "Got it" hides the banner and does not opt out of analytics', async () => {
    const user = userEvent.setup()
    render(<CookieNotice />)

    await user.click(screen.getByRole('button', { name: /got it/i }))

    expect(screen.queryByText(/Read our Privacy Policy/i)).not.toBeInTheDocument()
    expect(window.localStorage.getItem('verigo_cookie_notice_seen')).toBe('1')
    expect(window.localStorage.getItem('verigo_analytics_opt_out')).toBeNull()
  })

  it('dismissing with "Opt out of analytics" hides the banner and actually records the opt-out', async () => {
    const user = userEvent.setup()
    render(<CookieNotice />)

    await user.click(screen.getByRole('button', { name: /opt out of analytics/i }))

    expect(screen.queryByText(/Read our Privacy Policy/i)).not.toBeInTheDocument()
    expect(window.localStorage.getItem('verigo_analytics_opt_out')).toBe('1')
  })
})
