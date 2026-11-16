/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const session = { token: 'tok-123', user: { level: 0 } }

vi.mock('../../../../../index.js', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback],
  useUtils: () => [{ parseDate: (value) => `parsed(${value})` }],
  useApi: () => [{ project: 'demo' }],
  useSession: () => [session]
}))

import { LegacyDashboardNotice } from '..'
import {
  buildLegacyDashboardUrl,
  isLegacyDashboardNoticeActive,
  legacyDashboardLastDay
} from '../legacyDashboard'

const CONFIG = {
  enabled: true,
  url: 'https://previous.example.test',
  hosts: ['dashboard.example.test'],
  ends_at: '2026-12-09T23:59:59-06:00'
}
const BEFORE_END = Date.parse('2026-11-09T18:00:00Z')
const AFTER_END = Date.parse('2026-12-10T06:00:00Z')

const setHostname = hostname => vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, hostname })

// temporary way back to the previous dashboard, signed in, for 30 days after the launch.
describe('isLegacyDashboardNoticeActive', () => {
  it('is on for a listed host before the end date', () => {
    expect(isLegacyDashboardNoticeActive(CONFIG, { hostname: 'dashboard.example.test', now: BEFORE_END })).toBe(true)
  })

  it('turns itself off at the end date', () => {
    expect(isLegacyDashboardNoticeActive(CONFIG, { hostname: 'dashboard.example.test', now: Date.parse(CONFIG.ends_at) })).toBe(false)
    expect(isLegacyDashboardNoticeActive(CONFIG, { hostname: 'dashboard.example.test', now: AFTER_END })).toBe(false)
  })

  it('is off on other hosts, without config, disabled or with a bad date', () => {
    expect(isLegacyDashboardNoticeActive(CONFIG, { hostname: 'other.example.test', now: BEFORE_END })).toBe(false)
    expect(isLegacyDashboardNoticeActive(CONFIG, { hostname: 'localhost', now: BEFORE_END })).toBe(false)
    expect(isLegacyDashboardNoticeActive(undefined, { hostname: 'dashboard.example.test', now: BEFORE_END })).toBe(false)
    expect(isLegacyDashboardNoticeActive({ ...CONFIG, enabled: false }, { hostname: 'dashboard.example.test', now: BEFORE_END })).toBe(false)
    expect(isLegacyDashboardNoticeActive({ ...CONFIG, ends_at: 'soon' }, { hostname: 'dashboard.example.test', now: BEFORE_END })).toBe(false)
  })
})

describe('buildLegacyDashboardUrl', () => {
  it('opens the root with the autologin params the previous dashboard reads', () => {
    expect(buildLegacyDashboardUrl(CONFIG.url, { project: 'demo', token: 'a b', trustedOrigin: CONFIG.url }))
      .toBe('https://previous.example.test/?project=demo&token=a+b')
  })

  it.each(['http://previous.example.test', 'https://user:password@previous.example.test', 'not a URL'])('rejects an unsafe or invalid destination: %s', (url) => {
    expect(isLegacyDashboardNoticeActive({ ...CONFIG, url }, { hostname: CONFIG.hosts[0], now: BEFORE_END })).toBe(false)
    expect(buildLegacyDashboardUrl(url, { project: 'demo', token: 'session-sample', trustedOrigin: CONFIG.url })).toBeNull()
  })

  it('does not forward the session to a destination outside the distinct trusted origin', () => {
    expect(buildLegacyDashboardUrl(CONFIG.url, { project: 'demo', token: 'session-sample', trustedOrigin: 'https://other.example.test' }))
      .toBe('https://previous.example.test/')
    expect(buildLegacyDashboardUrl(CONFIG.url, { project: 'demo', token: 'session-sample' }))
      .toBe('https://previous.example.test/')
  })

  it('opens the plain root without a session', () => {
    expect(buildLegacyDashboardUrl(CONFIG.url, { project: 'demo', token: null })).toBe('https://previous.example.test/')
  })
})

describe('legacyDashboardLastDay', () => {
  it('is the calendar day of the end in Central time, whatever the offset it is written with', () => {
    expect(legacyDashboardLastDay(CONFIG.ends_at)).toBe('2026-12-09 00:00:00')
    expect(legacyDashboardLastDay('2026-12-10T05:59:59Z')).toBe('2026-12-09 00:00:00')
    expect(legacyDashboardLastDay('nope')).toBe(null)
  })
})

describe('LegacyDashboardNotice', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    session.token = 'tok-123'
    session.user = { level: 0 }
    setHostname('dashboard.example.test')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    window.sessionStorage.clear()
  })

  it('shows the temporary notice with its end date', () => {
    renderWithProviders(<LegacyDashboardNotice config={CONFIG} now={BEFORE_END} />)

    const notice = screen.getByRole('status')
    expect(notice).toHaveAttribute('data-tone', 'info')
    expect(notice).toHaveTextContent('until parsed(2026-12-09 00:00:00).')
  })

  it('opens the previous dashboard signed in, in a new tab', () => {
    vi.stubEnv('VITE_DASHBOARD_LEGACY_SESSION_ORIGIN', CONFIG.url)
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderWithProviders(<LegacyDashboardNotice config={CONFIG} now={BEFORE_END} />)

    fireEvent.click(screen.getByRole('button', { name: /Open previous dashboard/ }))
    expect(open).toHaveBeenCalledWith(
      'https://previous.example.test/?project=demo&token=tok-123',
      '_blank',
      'noopener,noreferrer'
    )
  })

  it('opens a normal sign-in link without a trusted session origin', () => {
    vi.stubEnv('VITE_DASHBOARD_LEGACY_SESSION_ORIGIN', '')
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderWithProviders(<LegacyDashboardNotice config={CONFIG} now={BEFORE_END} />)
    expect(screen.getByRole('status')).toHaveTextContent('You may need to sign in there.')
    fireEvent.click(screen.getByRole('button', { name: /Open previous dashboard/ }))
    expect(open).toHaveBeenCalledWith('https://previous.example.test/', '_blank', 'noopener,noreferrer')
  })

  it('is gone after the end date', () => {
    renderWithProviders(<LegacyDashboardNotice config={CONFIG} now={AFTER_END} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('is not shown on another host', () => {
    setHostname('other.example.test')
    renderWithProviders(<LegacyDashboardNotice config={CONFIG} now={BEFORE_END} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('is not shown without a session or for a level the previous dashboard does not sign in', () => {
    session.token = null
    const first = renderWithProviders(<LegacyDashboardNotice config={CONFIG} now={BEFORE_END} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    first.unmount()

    session.token = 'tok-123'
    session.user = { level: 3 }
    renderWithProviders(<LegacyDashboardNotice config={CONFIG} now={BEFORE_END} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('stays closed for the rest of the browser session once closed', () => {
    const { unmount } = renderWithProviders(<LegacyDashboardNotice config={CONFIG} now={BEFORE_END} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    unmount()

    renderWithProviders(<LegacyDashboardNotice config={CONFIG} now={BEFORE_END} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
