/* eslint-disable import/first */
// the ConfirmAdmin confirmation_token (not the legacy deleted_action_code) is what
// handleChangeActiveUser and handleDeleteSeveralUsers now carry to the API, when the caller has one.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  chain: null,
  showToast: vi.fn(),
  session: { token: 'session-token', user: { id: 1, level: 0 } },
  ordering: { root: 'https://api.test' },
  events: { on: vi.fn(), off: vi.fn() },
  socket: { on: vi.fn(), off: vi.fn() }
}))

vi.mock('../../../contexts/SessionContext', () => ({ useSession: () => [mocks.session] }))
vi.mock('../../../contexts/ApiContext', () => ({ useApi: () => [mocks.ordering] }))
vi.mock('../../../contexts/ToastContext', () => ({
  ToastType: { Info: 'INFO', Error: 'ERROR', Success: 'SUCCESS' },
  useToast: () => [null, { showToast: mocks.showToast }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({ useLanguage: () => [null, (_key, fallback) => fallback] }))
vi.mock('../../../contexts/EventContext', () => ({ useEvent: () => [mocks.events] }))
vi.mock('../../../contexts/WebsocketContext', () => ({ useWebsocket: () => mocks.socket }))

import { UsersList } from '..'

const PAGINATION = { current_page: 1, total_pages: 1, total: 2, page_size: 10, from: 1, to: 2 }
const ANA = { id: 1, name: 'Ana', lastname: 'Lopez', enabled: true, level: 0 }
const BETO = { id: 2, name: 'Beto', lastname: 'Diaz', enabled: true, level: 0 }

const makeChain = () => {
  const chain = { wheres: [] }
  chain.setAccessToken = vi.fn(() => chain)
  chain.users = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.parameters = vi.fn(() => chain)
  chain.where = vi.fn((where) => { chain.wheres.push(where); return chain })
  chain.get = vi.fn(async () => ({ content: { error: false, result: [{ ...ANA }, { ...BETO }], pagination: PAGINATION } }))
  chain.save = vi.fn(async () => ({ content: { error: false, result: { id: 1, enabled: false } } }))
  return chain
}

const renderList = async (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => { ui.current = uiProps; return null }
  render(<UsersList UIComponent={UIComponent} {...props} />)
  await waitFor(() => expect(ui.current.usersList.users).toHaveLength(2))
  return ui
}

const RealFetch = global.fetch
afterEach(() => { global.fetch = RealFetch })

describe('UsersList · confirmation_token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chain = makeChain()
    mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
  })

  it('handleChangeActiveUser sends confirmation_token when given one (the admin-toggle path)', async () => {
    const ui = await renderList()
    await act(async () => { await ui.current.handleChangeActiveUser({ id: 1, enabled: false, confirmationToken: 'tok-1' }) })
    expect(mocks.chain.save).toHaveBeenCalledWith({ enabled: false, confirmation_token: 'tok-1' })
  })

  it('handleChangeActiveUser sends no confirmation_token when none was given, as before', async () => {
    const ui = await renderList()
    await act(async () => { await ui.current.handleChangeActiveUser({ id: 1, enabled: false }) })
    expect(mocks.chain.save).toHaveBeenCalledWith({ enabled: false })
    expect(Object.keys(mocks.chain.save.mock.calls[0][0])).not.toContain('confirmation_token')
  })

  it('handleDeleteSeveralUsers sends confirmation_token, not the legacy deleted_action_code', async () => {
    global.fetch = vi.fn(async () => ({ json: async () => ({ error: false, result: [] }) }))
    const ui = await renderList()
    act(() => { ui.current.handleSelectedUsers(1) })
    await act(async () => { await ui.current.handleDeleteSeveralUsers('tok-del-1') })

    expect(global.fetch).toHaveBeenCalledWith('https://api.test/users', expect.objectContaining({ method: 'DELETE' }))
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body).toEqual({ users_id: [1], confirmation_token: 'tok-del-1' })
    expect(body.deleted_action_code).toBeUndefined()
  })

  it('handleDeleteSeveralUsers with no token sends no confirmation_token, as a password confirmation does', async () => {
    global.fetch = vi.fn(async () => ({ json: async () => ({ error: false, result: [] }) }))
    const ui = await renderList()
    act(() => { ui.current.handleSelectedUsers(2) })
    await act(async () => { await ui.current.handleDeleteSeveralUsers() })

    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body).toEqual({ users_id: [2] })
  })
})
