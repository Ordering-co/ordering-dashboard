/* eslint-disable import/first */
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign (PF-02): handleReloadSessions retries the sessions GET after an error
const mocks = vi.hoisted(() => ({
  session: [
    { user: { id: 5, session_strategy: 'jwt_session' }, token: 'tok-123' },
    { login: () => {}, logout: () => {} }
  ]
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => mocks.session }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test' }] }))

import { Sessions } from '..'

const jsonResponse = (body) => ({ json: () => Promise.resolve(body) })

const renderSessions = () => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  render(<Sessions UIComponent={UIComponent} />)
  return ui
}

describe('Sessions · handleReloadSessions (PF-02)', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes handleReloadSessions to the UIComponent', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ error: false, result: [] }))
    const ui = renderSessions()
    await act(async () => {})
    expect(typeof ui.current.handleReloadSessions).toBe('function')
  })

  it('after a failed GET, reload clears the error while loading, repeats the GET with the token and fills sessions', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ error: true, result: ['boom'] }))
    const ui = renderSessions()
    await act(async () => {})

    expect(ui.current.sessionsList.error).toEqual(['boom'])
    expect(ui.current.sessionsList.loading).toBe(false)
    expect(global.fetch).toHaveBeenCalledTimes(1)

    let resolveReload
    global.fetch.mockReturnValueOnce(new Promise(resolve => { resolveReload = resolve }))
    let pending
    await act(async () => { pending = ui.current.handleReloadSessions() })

    expect(ui.current.sessionsList.loading).toBe(true)
    expect(ui.current.sessionsList.error).toBeNull()

    const sessions = [{ id: 1, current: true }, { id: 2, current: false }]
    await act(async () => {
      resolveReload(jsonResponse({ error: false, result: sessions }))
      await pending
    })

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(global.fetch).toHaveBeenLastCalledWith('https://api.test/users/5/sessions', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok-123' }
    })
    expect(ui.current.sessionsList).toEqual({ loading: false, error: null, sessions })
  })

  it('a reload that fails again keeps an error and does not lose the previous sessions', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ error: false, result: [{ id: 1 }] }))
    const ui = renderSessions()
    await act(async () => {})

    global.fetch.mockRejectedValueOnce(new Error('network down'))
    await act(async () => { await ui.current.handleReloadSessions() })

    expect(ui.current.sessionsList.error).toEqual(['network down'])
    expect(ui.current.sessionsList.sessions).toEqual([{ id: 1 }])
    expect(ui.current.sessionsList.loading).toBe(false)
  })
})
