/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  trialExtension: {
    available: true,
    bannerDismissed: false,
    daysRemaining: 3,
    dismissBanner: vi.fn(),
    openBooking: vi.fn()
  }
}))

vi.mock('../../../../../../index.js', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))
vi.mock('../../../../contexts/TrialExtensionContext', () => ({
  useTrialExtension: () => mocks.trialExtension
}))
vi.mock('../../../../styles', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>
}))

import { TrialExtensionBanner } from '..'
import { BANNER_MOBILE_BREAKPOINT } from '../styles'

const collapse = (css) => css.replace(/\s+/g, '')
const lastClass = (element) => element.className.split(' ').filter(Boolean).pop()

const theme = { colors: { info: '#27BCFD', backgroundInfo: '#F5F9FF', lightPrimary: '#E9F2FE' } }

describe('TrialExtensionBanner', () => {
  it('renders the offer with days remaining and opens booking from the CTA', () => {
    renderWithProviders(<TrialExtensionBanner />, { theme })

    expect(screen.getByText('Extend your free trial to 14 days')).toBeInTheDocument()
    expect(screen.getByTestId('trial-extension-banner-full')).toHaveTextContent(/Your trial ends in 3 days\./)

    fireEvent.click(screen.getByRole('button', { name: 'Book a call' }))
    expect(mocks.trialExtension.openBooking).toHaveBeenCalledWith('banner')
  })

  it('uses singular day wording when only one day remains', () => {
    mocks.trialExtension.daysRemaining = 1
    renderWithProviders(<TrialExtensionBanner />, { theme })
    expect(screen.getByTestId('trial-extension-banner-full')).toHaveTextContent(/Your trial ends in 1 day\./)
    expect(screen.getByTestId('trial-extension-banner-short')).toHaveTextContent('Your trial ends in 1 day.')
    mocks.trialExtension.daysRemaining = 3
  })

  it('dismisses the banner via the close button', () => {
    renderWithProviders(<TrialExtensionBanner />, { theme })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(mocks.trialExtension.dismissBanner).toHaveBeenCalled()
  })

  it('renders nothing when not available', () => {
    mocks.trialExtension.available = false
    const { container } = renderWithProviders(<TrialExtensionBanner />, { theme })
    expect(container).toBeEmptyDOMElement()
    mocks.trialExtension.available = true
  })

  it('renders nothing when dismissed', () => {
    mocks.trialExtension.bannerDismissed = true
    const { container } = renderWithProviders(<TrialExtensionBanner />, { theme })
    expect(container).toBeEmptyDOMElement()
    mocks.trialExtension.bannerDismissed = false
  })

  it('is a labelled region with 44px action targets and an accessible close name', () => {
    renderWithProviders(<TrialExtensionBanner />, { theme })
    expect(screen.getByRole('region', { name: 'Extend your free trial to 14 days' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Book a call' }).style.minHeight).toBe('44px')
    const close = screen.getByRole('button', { name: 'Close' })
    expect(close.style.minHeight).toBe('44px')
    expect(close.style.minWidth).toBe('44px')
  })

  it('on narrow screens swaps the long sentence for the days remaining next to the CTA', () => {
    renderWithProviders(<TrialExtensionBanner />, { theme })

    const full = screen.getByTestId('trial-extension-banner-full')
    const short = screen.getByTestId('trial-extension-banner-short')
    expect(full).toHaveTextContent("Book a short call with our team before it ends and we'll extend it to 14 days.")
    expect(short).toHaveTextContent(/^Your trial ends in 3 days\.$/)
    expect(screen.getByRole('button', { name: 'Book a call' })).toBeInTheDocument()

    // Desktop: the short text is hidden. Below the breakpoint the full one hides and the short shows.
    expect(window.getComputedStyle(short).display).toBe('none')
    expect(window.getComputedStyle(full).display).not.toBe('none')

    const css = collapse(Array.from(document.querySelectorAll('style')).map(style => style.textContent).join(''))
    const mobile = `@media(max-width:${BANNER_MOBILE_BREAKPOINT})`
    expect(css).toContain(`${mobile}{.${lastClass(full)}{display:none;}}`)
    expect(css).toContain(`${mobile}{.${lastClass(short)}{display:inline;}}`)
  })

  it('stays in normal document flow (never fixed/sticky or stacked above modals)', () => {
    renderWithProviders(<TrialExtensionBanner />, { theme })
    const region = screen.getByRole('region', { name: 'Extend your free trial to 14 days' })
    const style = window.getComputedStyle(region)
    expect(['', 'static']).toContain(style.position)
    expect(['', 'auto']).toContain(style.zIndex)
    expect(style.display).toBe('flex')
  })
})
