/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../index.js', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useApi: () => [{ project: 'demo' }]
}))

import { PhoneNotice } from '..'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36'
const TEXT = 'For the best experience while setting up your project, we recommend using a computer.'
const KEY = 'ordering:phone-notice-dismissed:demo'

const setUserAgent = value => vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(value)

// the phone notice is a shell notice (InlineNotice info in the BannerStack), and its close is remembered per browser.
describe('PhoneNotice', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setUserAgent(IPHONE)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('shows an info status notice with a named close button on a phone', () => {
    renderWithProviders(<PhoneNotice />)

    const notice = screen.getByRole('status')
    expect(notice).toHaveAttribute('data-tone', 'info')
    expect(notice).toHaveTextContent(TEXT)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('does not show on a desktop', () => {
    setUserAgent(DESKTOP)
    renderWithProviders(<PhoneNotice />)

    expect(screen.queryByText(TEXT)).not.toBeInTheDocument()
  })

  it('stays closed after a reload once closed, and comes back when the storage is cleared', () => {
    const { unmount } = renderWithProviders(<PhoneNotice />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText(TEXT)).not.toBeInTheDocument()
    expect(window.localStorage.getItem(KEY)).toBe('1')
    unmount()

    const second = renderWithProviders(<PhoneNotice />)
    expect(screen.queryByText(TEXT)).not.toBeInTheDocument()
    second.unmount()

    window.localStorage.clear()
    renderWithProviders(<PhoneNotice />)
    expect(screen.getByText(TEXT)).toBeInTheDocument()
  })

  it('shows and closes as before when the storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })

    renderWithProviders(<PhoneNotice />)
    expect(screen.getByText(TEXT)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText(TEXT)).not.toBeInTheDocument()
  })
})
