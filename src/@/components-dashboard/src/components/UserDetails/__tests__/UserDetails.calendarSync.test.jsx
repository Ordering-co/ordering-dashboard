/* eslint-disable import/first */
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Calendar sync of a professional. A failed POST takes the «Loading» toast down, and a request that never reached the
// server says it in words (the panel's own «We couldn't sync the calendar. Try again.») instead of the raw «Failed to fetch».
const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  hideToast: vi.fn(),
  fetch: vi.fn(),
  session: { token: 'tok-9', user: { id: 1, level: 0 } },
  api: { root: 'https://api.test' }
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.api, { configurations: {} }] }))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast, hideToast: mocks.hideToast }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))

import { UserDetails } from '..'

const USER = { id: 23514, name: 'Ana', lastname: 'Lopez', level: 8 }
const SYNC_FAILED = "We couldn't sync the calendar. Try again."

const renderDetails = () => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  render(<UserDetails UIComponent={UIComponent} userId={USER.id} user={USER} />)
  return ui
}

describe('UserDetails · handleGoogleCalendarSync failures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mocks.fetch)
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('a network error reads in words and closes «Loading»', async () => {
    mocks.fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    const ui = renderDetails()
    await act(async () => { await ui.current.handleGoogleCalendarSync() })
    expect(mocks.fetch).toHaveBeenCalledWith('https://api.test/users/23514/google/calendar/sync', expect.objectContaining({ method: 'POST' }))
    expect(ui.current.actionStatus).toEqual({ loading: false, error: [SYNC_FAILED] })
    expect(mocks.hideToast).toHaveBeenCalled()
  })

  it('any other thrown error keeps its message and closes «Loading»', async () => {
    mocks.fetch.mockResolvedValue({ json: async () => { throw new SyntaxError('Unexpected token <') } })
    const ui = renderDetails()
    await act(async () => { await ui.current.handleGoogleCalendarSync() })
    expect(ui.current.actionStatus).toEqual({ loading: false, error: ['Unexpected token <'] })
    expect(mocks.hideToast).toHaveBeenCalled()
  })

  it('an API error keeps the API lines and closes «Loading»', async () => {
    mocks.fetch.mockResolvedValue({ json: async () => ({ error: true, result: ['Calendar not linked'] }) })
    const ui = renderDetails()
    await act(async () => { await ui.current.handleGoogleCalendarSync() })
    expect(ui.current.actionStatus).toEqual({ loading: false, error: ['Calendar not linked'] })
    expect(mocks.hideToast).toHaveBeenCalled()
  })

  it('a success says so, as before (the success toast replaces «Loading»)', async () => {
    mocks.fetch.mockResolvedValue({ json: async () => ({ error: false, result: {} }) })
    const ui = renderDetails()
    await act(async () => { await ui.current.handleGoogleCalendarSync() })
    expect(mocks.showToast).toHaveBeenLastCalledWith('SUCCESS', 'Your calendar will be synchronized')
  })
})
