/* eslint-disable import/first */
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
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

import { TrialExtensionBanner } from '..'

// redesign (R2): the banner is a Product InlineNotice; its look lives in a plain CSS file.
const CSS = readFileSync(path.resolve(__dirname, '../trial-extension-banner.css'), 'utf8')
const collapse = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '')

describe('TrialExtensionBanner', () => {
  it('renders the offer with days remaining and opens booking from the CTA', () => {
    renderWithProviders(<TrialExtensionBanner />)

    expect(screen.getByText('Extend your free trial to 14 days')).toBeInTheDocument()
    expect(screen.getByTestId('trial-extension-banner-full')).toHaveTextContent(/Your trial ends in 3 days\./)

    fireEvent.click(screen.getByRole('button', { name: 'Book a call' }))
    expect(mocks.trialExtension.openBooking).toHaveBeenCalledWith('banner')
  })

  it('uses singular day wording when only one day remains', () => {
    mocks.trialExtension.daysRemaining = 1
    renderWithProviders(<TrialExtensionBanner />)
    expect(screen.getByTestId('trial-extension-banner-full')).toHaveTextContent(/Your trial ends in 1 day\./)
    expect(screen.getByTestId('trial-extension-banner-short')).toHaveTextContent('Your trial ends in 1 day.')
    mocks.trialExtension.daysRemaining = 3
  })

  it('dismisses the banner via the close button', () => {
    renderWithProviders(<TrialExtensionBanner />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(mocks.trialExtension.dismissBanner).toHaveBeenCalled()
  })

  it('renders nothing when not available', () => {
    mocks.trialExtension.available = false
    const { container } = renderWithProviders(<TrialExtensionBanner />)
    expect(container).toBeEmptyDOMElement()
    mocks.trialExtension.available = true
  })

  it('renders nothing when dismissed', () => {
    mocks.trialExtension.bannerDismissed = true
    const { container } = renderWithProviders(<TrialExtensionBanner />)
    expect(container).toBeEmptyDOMElement()
    mocks.trialExtension.bannerDismissed = false
  })

  it('is a Product info notice: a labelled region with a primary CTA and an icon-only close with its name', () => {
    renderWithProviders(<TrialExtensionBanner />)
    const region = screen.getByRole('region', { name: 'Extend your free trial to 14 days' })
    expect(region).toHaveClass('odc-notice')
    expect(region).toHaveAttribute('data-tone', 'info')
    expect(region.querySelector('svg.odc-icon')).not.toBeNull()

    const book = screen.getByRole('button', { name: 'Book a call' })
    expect(book).toHaveClass('odc-btn')
    expect(book).toHaveAttribute('data-variant', 'primary')

    const close = screen.getByRole('button', { name: 'Close' })
    expect(close).toHaveClass('odc-btn')
    expect(close).toHaveAttribute('data-icon-only')
    expect(close).toHaveAttribute('title', 'Close')
    expect(region).toContainElement(book)
    expect(region).toContainElement(close)
  })

  it('on narrow screens swaps the long sentence for the days remaining next to the CTA', () => {
    renderWithProviders(<TrialExtensionBanner />)

    const full = screen.getByTestId('trial-extension-banner-full')
    const short = screen.getByTestId('trial-extension-banner-short')
    expect(full).toHaveTextContent("Book a short call with our team before it ends and we'll extend it to 14 days.")
    expect(short).toHaveTextContent(/^Your trial ends in 3 days\.$/)
    expect(screen.getByRole('button', { name: 'Book a call' })).toBeInTheDocument()

    // Desktop: the short text is hidden by its own rule; below 768px (the Product phone breakpoint) the full one hides and the short shows.
    const css = collapse(CSS)
    expect(css).toMatch(new RegExp(`\\.${short.className}\\{display:none;`))
    expect(css).toContain('@media(max-width:767px){')
    const mobile = css.slice(css.indexOf('@media(max-width:767px){'))
    expect(mobile).toContain(`.${full.className}{display:none;}`)
    expect(mobile).toContain(`.${short.className}{display:inline;}`)
  })

  it('stays in normal document flow (never fixed/sticky or stacked above modals) and is not printed', () => {
    renderWithProviders(<TrialExtensionBanner />)
    const region = screen.getByRole('region', { name: 'Extend your free trial to 14 days' })
    expect(region).toHaveClass('odc-trial-banner')
    expect(region.closest('.odc-banner-stack')).toBeNull()
    const css = collapse(CSS)
    expect(css).not.toMatch(/position:(fixed|sticky)/)
    expect(css).not.toContain('z-index')
    expect(css).toContain('@mediaprint{.odc-notice.odc-trial-banner{display:none;}}')
  })

  it('brings no styled-components, hex colors or pixel sizes of its own', () => {
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(CSS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '')).not.toMatch(/\d(px|rem)\b/)
    const source = readFileSync(path.resolve(__dirname, '../index.js'), 'utf8')
    expect(source).not.toMatch(/styled-components|react-bootstrap-icons|from '\.\/styles'/)
  })
})
