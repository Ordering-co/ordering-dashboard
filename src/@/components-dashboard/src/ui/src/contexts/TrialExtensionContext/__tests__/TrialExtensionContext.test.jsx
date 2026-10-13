/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  session: [{ auth: 'token', user: { level: 0, user_system_id: 1, name: 'Ada', lastname: 'Lovelace', email: 'ada@example.com' } }],
  project: [{ project: { code: 'acme' }, trialSubscription: null }],
  config: [{ configs: {}, loading: false, fetchedWithToken: true }]
}))

vi.mock('../../../../../index', () => ({
  useSession: () => mocks.session,
  useConfig: () => mocks.config
}))
vi.mock('../../ProjectContext', () => ({
  useProjectState: () => mocks.project
}))
vi.mock('styled-components', async () => {
  const actual = await vi.importActual('styled-components')
  return {
    ...actual,
    useTheme: () => ({ colors: { primary: '#2C7BE5', headingColor: '#344050', backgroundPage: '#FFF' } })
  }
})

import { TRIAL_EXTENSION_CLOCK_INTERVAL_MS, TrialExtensionProvider, useTrialExtension } from '..'

const CONFIG = { enabled: true, booking_url: 'https://calendly.com/orderingteam/ordering-demo', days: 14 }
const NOW = Date.now()
const DAY_MS = 24 * 60 * 60 * 1000

const trialingSubscription = () => ({
  status: 'trialing',
  start_date: new Date(NOW - DAY_MS).toISOString(),
  trial_end: new Date(NOW + DAY_MS * 2).toISOString()
})

const Probe = () => {
  const trialExtension = useTrialExtension()
  return (
    <div>
      <span data-testid='available'>{String(trialExtension.available)}</span>
      <span data-testid='booked'>{String(trialExtension.booked)}</span>
      <span data-testid='justBooked'>{String(trialExtension.justBooked)}</span>
      <span data-testid='daysRemaining'>{trialExtension.daysRemaining}</span>
      <span data-testid='isModalOpen'>{String(trialExtension.isModalOpen)}</span>
      <span data-testid='bannerDismissed'>{String(trialExtension.bannerDismissed)}</span>
      <span data-testid='bookingUrl'>{trialExtension.bookingUrl}</span>
      <button onClick={() => trialExtension.openBooking('home')}>open</button>
      <button onClick={() => trialExtension.closeBooking()}>close</button>
      <button onClick={() => trialExtension.dismissBanner()}>dismiss</button>
      <button onClick={() => trialExtension.markBooked()}>book</button>
    </div>
  )
}

const providerTree = (config = CONFIG, props = {}) => (
  <TrialExtensionProvider config={config} {...props}>
    <Probe />
  </TrialExtensionProvider>
)

const renderProvider = (config = CONFIG, props = {}) => render(providerTree(config, props))

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.history.pushState({}, '', '/')
  mocks.session = [{ auth: 'token', user: { level: 0, user_system_id: 1, name: 'Ada', lastname: 'Lovelace', email: 'ada@example.com' } }]
  mocks.project = [{ project: { code: 'acme' }, trialSubscription: null }]
  mocks.config = [{ configs: {}, loading: false, fetchedWithToken: true }]
})

afterEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.history.pushState({}, '', '/')
})

describe('TrialExtensionProvider', () => {
  it.each([14, 15])('withdraws the offer when Stripe dates refresh to a %s-day trial', async (duration) => {
    const trial = trialingSubscription()
    mocks.project = [{ project: { code: 'acme' }, trialSubscription: trial }]
    const { rerender } = renderProvider()
    await waitFor(() => expect(screen.getByTestId('isModalOpen').textContent).toBe('true'))

    mocks.project = [{
      project: { code: 'acme' },
      trialSubscription: {
        ...trial,
        trial_end: new Date(new Date(trial.start_date).getTime() + duration * DAY_MS).toISOString()
      }
    }]
    rerender(providerTree())

    await waitFor(() => expect(screen.getByTestId('isModalOpen').textContent).toBe('false'))
    expect(screen.getByTestId('available').textContent).toBe('false')
    expect(screen.getByTestId('daysRemaining').textContent).toBe(String(duration - 1))
    expect(screen.getByTestId('booked').textContent).toBe('false')
  })

  it('is unavailable without a trialing subscription', () => {
    renderProvider()
    expect(screen.getByTestId('available').textContent).toBe('false')
  })

  it('is available for a billing owner mid-trial and exposes a bookingUrl with attribution params', async () => {
    mocks.project = [{ project: { code: 'acme' }, trialSubscription: trialingSubscription() }]
    renderProvider()

    await waitFor(() => expect(screen.getByTestId('available').textContent).toBe('true'))
    expect(screen.getByTestId('daysRemaining').textContent).toBe('2')

    const url = new URL(screen.getByTestId('bookingUrl').textContent)
    expect(url.searchParams.get('utm_content')).toBe('acme')
    expect(url.searchParams.get('embed_domain')).toBe(window.location.host)
    expect(url.searchParams.get('embed_type')).toBe('Inline')
  })

  it('auto-opens the modal at most once per session when eligible', async () => {
    mocks.project = [{ project: { code: 'acme' }, trialSubscription: trialingSubscription() }]
    const { unmount } = renderProvider()

    await waitFor(() => expect(screen.getByTestId('isModalOpen').textContent).toBe('true'))
    expect(window.sessionStorage.getItem('trial_extension_popup_shown:acme')).toBe('1')
    unmount()

    renderProvider()
    // Popup already shown this session: it must not force-open the modal again.
    await waitFor(() => expect(screen.getByTestId('available').textContent).toBe('true'))
    expect(screen.getByTestId('isModalOpen').textContent).toBe('false')
  })

  it('openBooking/closeBooking toggle the modal', async () => {
    mocks.project = [{ project: { code: 'acme' }, trialSubscription: trialingSubscription() }]
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('available').textContent).toBe('true'))

    // Auto-popup already opened it; close it first.
    fireEvent.click(screen.getByText('close'))
    expect(screen.getByTestId('isModalOpen').textContent).toBe('false')

    fireEvent.click(screen.getByText('open'))
    expect(screen.getByTestId('isModalOpen').textContent).toBe('true')
  })

  it('dismissBanner persists for the session', async () => {
    mocks.project = [{ project: { code: 'acme' }, trialSubscription: trialingSubscription() }]
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('available').textContent).toBe('true'))

    fireEvent.click(screen.getByText('dismiss'))
    expect(screen.getByTestId('bannerDismissed').textContent).toBe('true')
    expect(window.sessionStorage.getItem('trial_extension_banner_dismissed:acme')).toBe('1')
  })

  it('markBooked persists to localStorage and flips available to false', async () => {
    mocks.project = [{ project: { code: 'acme' }, trialSubscription: trialingSubscription() }]
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('available').textContent).toBe('true'))

    fireEvent.click(screen.getByText('book'))
    expect(screen.getByTestId('booked').textContent).toBe('true')
    expect(screen.getByTestId('available').textContent).toBe('false')
    expect(window.localStorage.getItem('trial_extension_booked:acme')).toBeTruthy()
  })

  it('treats a stored booked flag as already booked on mount', async () => {
    window.localStorage.setItem('trial_extension_booked:acme', new Date().toISOString())
    mocks.project = [{ project: { code: 'acme' }, trialSubscription: trialingSubscription() }]
    renderProvider()

    await waitFor(() => expect(screen.getByTestId('booked').textContent).toBe('true'))
    expect(screen.getByTestId('available').textContent).toBe('false')
    expect(screen.getByTestId('isModalOpen').textContent).toBe('false')
  })

  it('marks the project as booked when accounts redirects with ?trial_extension_booked=1', async () => {
    window.history.pushState({}, '', '/?token=abc&project=acme&trial_extension_booked=1')
    mocks.project = [{ project: { code: 'acme' }, trialSubscription: trialingSubscription() }]
    renderProvider()

    await waitFor(() => expect(screen.getByTestId('booked').textContent).toBe('true'))
    expect(window.localStorage.getItem('trial_extension_booked:acme')).toBeTruthy()
    expect(screen.getByTestId('available').textContent).toBe('false')
  })

  it('never throws when storage access fails', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })

    mocks.project = [{ project: { code: 'acme' }, trialSubscription: trialingSubscription() }]

    expect(() => {
      act(() => {
        renderProvider()
      })
    }).not.toThrow()

    getItem.mockRestore()
    setItem.mockRestore()
  })
  it('never offers the extension for a white-label deployment (is_white_label)', async () => {
    mocks.project = [{ project: { code: 'acme' }, trialSubscription: trialingSubscription() }]
    renderProvider(CONFIG, { isWhiteLabel: true })

    await act(async () => {})
    expect(screen.getByTestId('available').textContent).toBe('false')
    expect(screen.getByTestId('isModalOpen').textContent).toBe('false')
  })

  it('closes an open modal when the offer is withdrawn (the trial is no longer trialing)', async () => {
    mocks.project = [{ project: { code: 'acme' }, trialSubscription: trialingSubscription() }]
    const { rerender } = renderProvider()
    await waitFor(() => expect(screen.getByTestId('isModalOpen').textContent).toBe('true'))

    mocks.project = [{ project: { code: 'acme' }, trialSubscription: { ...trialingSubscription(), status: 'active' } }]
    rerender(providerTree())

    await waitFor(() => expect(screen.getByTestId('isModalOpen').textContent).toBe('false'))
    expect(screen.getByTestId('available').textContent).toBe('false')
  })

  it('keeps the modal open after a booking so the success state shows', async () => {
    mocks.project = [{ project: { code: 'acme' }, trialSubscription: trialingSubscription() }]
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('isModalOpen').textContent).toBe('true'))

    fireEvent.click(screen.getByText('book'))
    await act(async () => {})

    expect(screen.getByTestId('available').textContent).toBe('false')
    expect(screen.getByTestId('isModalOpen').textContent).toBe('true')
  })

  describe('trial plan with the white_label_module project config (production data)', () => {
    // Projects created on the trial plan ("Marketplace Platform. All Inclusive + AI Suite")
    // carry `white_label_module: true`. That config hides Ordering branding from the
    // customer's own business users; it must not hide the offer from the billing owner.
    const productionTrial = () => ({
      status: 'trialing',
      start_date: '2026-10-01T12:35:54',
      trial_end: '2026-10-04T12:35:54'
    })

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-01T15:00:00.000Z'))
      mocks.config = [{ configs: { white_label_module: { value: true } }, loading: false, fetchedWithToken: true }]
      mocks.project = [{ project: { code: 'acme' }, trialSubscription: productionTrial() }]
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('offers the extension and auto-opens the popup for the billing owner', async () => {
      renderProvider()

      await waitFor(() => expect(screen.getByTestId('available').textContent).toBe('true'))
      expect(screen.getByTestId('daysRemaining').textContent).toBe('3')
      expect(screen.getByTestId('isModalOpen').textContent).toBe('true')
      expect(window.sessionStorage.getItem('trial_extension_popup_shown:acme')).toBe('1')
    })

    it('offers it even while project configs are still loading', async () => {
      mocks.config = [{ configs: {}, loading: true }]
      renderProvider()

      await waitFor(() => expect(screen.getByTestId('available').textContent).toBe('true'))
    })

    it('still hides it on a white-label deployment (is_white_label)', async () => {
      renderProvider(CONFIG, { isWhiteLabel: true })

      await act(async () => {})
      expect(screen.getByTestId('available').textContent).toBe('false')
      expect(screen.getByTestId('isModalOpen').textContent).toBe('false')
    })

    it('does not offer it to a user who is not the billing owner', async () => {
      mocks.session = [{ auth: 'token', user: { level: 2, user_system_id: 1 } }]
      renderProvider()

      await act(async () => {})
      expect(screen.getByTestId('available').textContent).toBe('false')
    })
  })

  it('drops the booked param from the URL (keeping other params and the hash) once consumed', async () => {
    window.history.pushState({}, '', '/home?token=abc&trial_extension_booked=1&project=acme#section')
    mocks.project = [{ project: { code: 'acme' }, trialSubscription: trialingSubscription() }]
    renderProvider()

    await waitFor(() => expect(screen.getByTestId('booked').textContent).toBe('true'))
    expect(window.location.pathname).toBe('/home')
    expect(window.location.search).toBe('?token=abc&project=acme')
    expect(window.location.hash).toBe('#section')
  })

  it('consumes ?trial_extension_booked=1 only for the current project, never for the next one', async () => {
    window.history.pushState({}, '', '/?trial_extension_booked=1')
    mocks.project = [{ project: { code: 'acme' }, trialSubscription: trialingSubscription() }]
    const { rerender } = renderProvider()
    await waitFor(() => expect(screen.getByTestId('booked').textContent).toBe('true'))

    mocks.project = [{ project: { code: 'beta' }, trialSubscription: trialingSubscription() }]
    rerender(providerTree())

    await waitFor(() => expect(screen.getByTestId('available').textContent).toBe('true'))
    expect(screen.getByTestId('booked').textContent).toBe('false')
    expect(window.localStorage.getItem('trial_extension_booked:beta')).toBeNull()
    expect(window.localStorage.getItem('trial_extension_booked:acme')).toBeTruthy()
  })

  it('does not carry the URL flag over to the next project when the first one was already booked', async () => {
    window.localStorage.setItem('trial_extension_booked:acme', new Date().toISOString())
    window.history.pushState({}, '', '/?trial_extension_booked=1')
    mocks.project = [{ project: { code: 'acme' }, trialSubscription: trialingSubscription() }]
    const { rerender } = renderProvider()
    await waitFor(() => expect(screen.getByTestId('booked').textContent).toBe('true'))
    expect(window.location.search).toBe('')

    mocks.project = [{ project: { code: 'beta' }, trialSubscription: trialingSubscription() }]
    rerender(providerTree())

    await waitFor(() => expect(screen.getByTestId('available').textContent).toBe('true'))
    expect(window.localStorage.getItem('trial_extension_booked:beta')).toBeNull()
  })

  it('acts on the current project after a project switch (no stale callbacks or flags)', async () => {
    window.localStorage.setItem('trial_extension_booked:acme', new Date().toISOString())
    mocks.project = [{ project: { code: 'acme' }, trialSubscription: trialingSubscription() }]
    const { rerender } = renderProvider()
    await waitFor(() => expect(screen.getByTestId('booked').textContent).toBe('true'))

    mocks.project = [{ project: { code: 'beta' }, trialSubscription: trialingSubscription() }]
    rerender(providerTree())

    // acme's booked flag does not leak into beta.
    await waitFor(() => expect(screen.getByTestId('available').textContent).toBe('true'))
    expect(screen.getByTestId('booked').textContent).toBe('false')

    fireEvent.click(screen.getByText('close'))
    fireEvent.click(screen.getByText('dismiss'))
    fireEvent.click(screen.getByText('book'))

    expect(window.sessionStorage.getItem('trial_extension_banner_dismissed:beta')).toBe('1')
    expect(window.sessionStorage.getItem('trial_extension_banner_dismissed:acme')).toBeNull()
    expect(window.localStorage.getItem('trial_extension_booked:beta')).toBeTruthy()
    expect(screen.getByTestId('booked').textContent).toBe('true')
    expect(screen.getByTestId('justBooked').textContent).toBe('true')
    expect(screen.getByTestId('bannerDismissed').textContent).toBe('true')
  })

  describe('clock', () => {
    const START = new Date('2026-10-01T12:00:00.000Z').getTime()
    const TRIAL_END = START + 90 * 1000

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
      vi.setSystemTime(START)
      mocks.project = [{
        project: { code: 'acme' },
        trialSubscription: { status: 'trialing', start_date: '2026-09-29 12:00:00', trial_end: new Date(TRIAL_END).toISOString() }
      }]
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('re-evaluates the offer every minute so it disappears when the trial ends with the tab open', () => {
      renderProvider()
      expect(screen.getByTestId('available').textContent).toBe('true')
      expect(screen.getByTestId('daysRemaining').textContent).toBe('1')

      act(() => {
        vi.advanceTimersByTime(TRIAL_EXTENSION_CLOCK_INTERVAL_MS)
      })
      expect(screen.getByTestId('available').textContent).toBe('true')

      act(() => {
        vi.advanceTimersByTime(TRIAL_EXTENSION_CLOCK_INTERVAL_MS)
      })
      expect(screen.getByTestId('available').textContent).toBe('false')
      expect(screen.getByTestId('daysRemaining').textContent).toBe('0')
    })

    it('re-evaluates the offer when the tab becomes visible again', () => {
      const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
      renderProvider()
      expect(screen.getByTestId('available').textContent).toBe('true')

      // Time passes while the tab is in the background (timers throttled): no interval tick.
      vi.setSystemTime(TRIAL_END + 1000)
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      expect(screen.getByTestId('available').textContent).toBe('false')
      visibility.mockRestore()
    })

    it('clears the interval and the visibility listener on unmount', () => {
      const removeListener = vi.spyOn(document, 'removeEventListener')
      const { unmount } = renderProvider()
      expect(vi.getTimerCount()).toBe(1)

      unmount()
      expect(vi.getTimerCount()).toBe(0)
      expect(removeListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
      removeListener.mockRestore()
    })
  })
})
