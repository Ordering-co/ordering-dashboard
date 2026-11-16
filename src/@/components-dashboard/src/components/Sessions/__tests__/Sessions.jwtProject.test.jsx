/* eslint-disable import/first */
import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// with a `jwt` session, «Active sessions» logs in again with the strategy changed to `jwt_session`. SessionContext
// writes `values.project` to localStorage, so that login has to carry the current project or it stores the string "undefined".
const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  user: { id: 5, session_strategy: 'jwt' }
}))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ user: mocks.user, token: 'tok-123', project: 'acme' }, { login: mocks.login, logout: () => {} }]
}))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test' }] }))

import { Sessions } from '..'

const renderSessions = () => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  render(<Sessions UIComponent={UIComponent} />)
  return ui
}

describe('Sessions · enabling sessions on a jwt strategy', () => {
  beforeEach(() => {
    mocks.login.mockClear()
    global.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ error: false, result: {} }) })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs in with the current project, the token and the user on jwt_session', async () => {
    const ui = renderSessions()
    await act(async () => { await ui.current.handleDeleteAllSessions(false) })

    expect(mocks.login).toHaveBeenCalledTimes(1)
    expect(mocks.login).toHaveBeenCalledWith({
      token: 'tok-123',
      project: 'acme',
      user: { ...mocks.user, session_strategy: 'jwt_session' }
    })
  })
})
