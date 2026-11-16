import React from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGoogleActionsVisibility } from '../useGoogleActionsVisibility'

const session = vi.hoisted(() => ({ token: 'token-1' }))

vi.mock('../../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'http://api.test/v400/en/demo' }]
}))
vi.mock('../../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: session.token, user: { level: 0 } }]
}))

const status = (notActivated) => ({ can_activate: true, counts: { not_activated: notActivated, processing: 0, ready: 0, sent: 0, skipped: 0 }, feed: null })
const reply = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

let refresh
const Counter = ({ name }) => {
  const google = useGoogleActionsVisibility()
  refresh = google.refresh
  return <span data-testid={name}>{google.status?.counts.not_activated ?? '-'}</span>
}

const renderBoth = () => render(<><Counter name='banner' /><Counter name='sidebar' /></>)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('project Google status shared by the banner, sidebar and palette', () => {
  it('asks once, and after a refresh every user of the hook gets the new counts', async () => {
    session.token = 'token-refresh'
    const fetchMock = vi.fn()
      .mockReturnValueOnce(reply({ error: false, result: status(5) }))
      .mockReturnValueOnce(reply({ error: false, result: status(4) }))
    vi.stubGlobal('fetch', fetchMock)

    renderBoth()
    await waitFor(() => expect(screen.getByTestId('sidebar').textContent).toBe('5'))
    expect(screen.getByTestId('banner').textContent).toBe('5')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(() => refresh())
    await waitFor(() => expect(screen.getByTestId('banner').textContent).toBe('4'))
    expect(screen.getByTestId('sidebar').textContent).toBe('4')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe('http://api.test/v400/en/demo/google_actions/status')
  })

  it('keeps the last counts when the refresh fails', async () => {
    session.token = 'token-failed'
    const fetchMock = vi.fn()
      .mockReturnValueOnce(reply({ error: false, result: status(5) }))
      .mockReturnValueOnce(reply({ error: true, result: ['ERROR'] }))
    vi.stubGlobal('fetch', fetchMock)

    renderBoth()
    await waitFor(() => expect(screen.getByTestId('banner').textContent).toBe('5'))
    await act(() => refresh())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('banner').textContent).toBe('5')
    expect(screen.getByTestId('sidebar').textContent).toBe('5')
  })
})
