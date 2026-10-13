import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, mockFetch, mockFetchError } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useApi: () => [{ root: 'https://api.test/v400/en/demo', appId: 'dashboard', appInternalName: 'dashboard_web' }],
  useSession: () => [{ token: 'token', user: { level: 0 } }]
}))

import { ApiUsageLimits } from '../index'

const limit = (overrides = {}) => ({
  scope: 'http:POST auth',
  key: 'project',
  metric: 'requests',
  window: 'minute',
  mode: 'hard',
  limit: 30,
  usage: 4,
  remaining: 26,
  used_pct: 13,
  reset_in: 17,
  reset_at: new Date(Date.now() + 17000).toISOString(),
  status: 'ok',
  ...overrides
})

const response = (result) => ({
  error: false,
  result: { project_id: 1, as_of: '2026-09-17T10:03:41Z', degraded: false, limits: [], ...result }
})

const render = () => renderWithProviders(<ApiUsageLimits />, {
  initialEntries: ['/settings?group=developers&category=api_usage']
})

describe('ApiUsageLimits', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('asks the API without monitor limits and with the dashboard headers', async () => {
    mockFetch(response())
    render()

    await screen.findByText('This project has no active usage limits.')
    const [url, options] = global.fetch.mock.calls[0]
    expect(url).toBe('https://api.test/v400/en/demo/usage_limits')
    expect(url).not.toContain('include=monitor')
    expect(options.cache).toBe('no-store')
    expect(options.headers).toMatchObject({
      Authorization: 'Bearer token',
      'X-APP-X': 'dashboard',
      'X-INTERNAL-PRODUCT-X': 'dashboard_web'
    })
  })

  it('shows each limit with usage, remaining and reset, worst status first', async () => {
    mockFetch(response({
      limits: [
        limit(),
        limit({ scope: 'resource:sms', window: 'day', mode: 'soft', limit: 500, usage: 430, remaining: 70, used_pct: 86, status: 'warning' }),
        limit({ scope: '*', key: 'app', window: 'hour', limit: 10000, usage: 13200, remaining: 0, used_pct: 132, status: 'exceeded' })
      ]
    }))
    render()

    const cards = await screen.findAllByTestId('api-usage-limit')
    expect(cards.map(card => card.querySelector('h3').textContent)).toEqual(['Whole project · per hour', 'SMS messages · per day', 'POST /auth · per minute'])

    expect(screen.getByText('Limit exceeded')).toBeInTheDocument()
    expect(screen.getByText('Near the limit')).toBeInTheDocument()
    expect(screen.getByText('OK')).toBeInTheDocument()
    expect(screen.getByText('132%')).toBeInTheDocument()
    expect(screen.getByText('All API requests · Per app · Blocks when exceeded')).toBeInTheDocument()
    expect(cards[2]).toHaveTextContent('4 / 30 requests13%')
    expect(cards[2]).toHaveTextContent('Remaining: 26')
    expect(cards[2]).toHaveTextContent(/Resets in 1\d s/)

    const bars = screen.getAllByRole('progressbar')
    expect(bars[0]).toHaveAttribute('aria-valuenow', '100')
    expect(bars[2]).toHaveAttribute('aria-valuenow', '13')
  })

  it('filters the cards with a fuzzy search', async () => {
    mockFetch(response({
      limits: [
        limit(),
        limit({ scope: 'resource:email', metric: 'units', window: 'day', mode: 'soft' }),
        limit({ scope: '*', window: 'hour' })
      ]
    }))
    render()

    await screen.findAllByTestId('api-usage-limit')
    const input = screen.getByPlaceholderText('Search limits')
    const titles = () => screen.queryAllByTestId('api-usage-limit').map(card => card.querySelector('h3').textContent)

    fireEvent.change(input, { target: { value: 'emial' } })
    expect(titles()).toEqual(['Emails · per day'])

    fireEvent.change(input, { target: { value: 'post min' } })
    expect(titles()).toEqual(['POST /auth · per minute'])

    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(titles()).toEqual([])
    expect(screen.getByText('No limits match your search.')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: '' } })
    expect(titles()).toHaveLength(3)
  })

  it('hides the search when there are no limits', async () => {
    mockFetch(response())
    render()

    await screen.findByText('This project has no active usage limits.')
    expect(screen.queryByPlaceholderText('Search limits')).not.toBeInTheDocument()
  })

  it('shows limits without usage when the read is degraded', async () => {
    mockFetch(response({
      degraded: true,
      limits: [limit({ usage: null, remaining: null, used_pct: null, status: null })]
    }))
    render()

    expect(await screen.findByText('Usage data is not available right now. The limits are shown without their current usage.')).toBeInTheDocument()
    const card = screen.getByTestId('api-usage-limit')
    expect(card).toHaveTextContent('Limit: 30 requests')
    expect(card).toHaveTextContent('No usage data')
    expect(card).not.toHaveTextContent('Remaining')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an inline error and retries on refresh', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockFetchError('Network down')
    render()

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load the usage limits.')

    mockFetch(response())
    await act(async () => { vi.advanceTimersByTime(5000) })
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByText('This project has no active usage limits.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lets the Refresh button ask at most once every 5 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockFetch(response())
    render()

    await screen.findByText('This project has no active usage limits.')
    const button = screen.getByRole('button', { name: 'Refresh' })
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('5 s')
    expect(button).toHaveAttribute('title', 'You can refresh again in 5 s')
    expect(screen.getByTestId('api-usage-refresh-cooldown')).toBeInTheDocument()

    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(button).toBeEnabled()
    expect(button).not.toHaveTextContent(/\d+ s/)
    expect(screen.queryByTestId('api-usage-refresh-cooldown')).not.toBeInTheDocument()
    fireEvent.click(button)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(global.fetch).toHaveBeenCalledTimes(2)

    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
  })

  it('never refreshes on its own, even after a window restarts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockFetch(response({ limits: [limit({ reset_in: 3, reset_at: new Date(Date.now() + 3000).toISOString() })] }))
    render()

    const card = await screen.findByTestId('api-usage-limit')
    expect(global.fetch).toHaveBeenCalledTimes(1)

    await act(async () => { vi.advanceTimersByTime(5 * 60000) })
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(card).toHaveTextContent('Window restarted, refresh to update')
  })
})
