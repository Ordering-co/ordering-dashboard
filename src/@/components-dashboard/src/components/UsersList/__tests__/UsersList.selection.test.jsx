/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// redesign (n.º 14, D-55): opt-in `clearSelectionOnQueryChange`, the bulk delete only reaches what is on screen
const mocks = vi.hoisted(() => ({
  chain: null,
  showToast: vi.fn(),
  session: { token: 'token', user: { id: 1, level: 0 } },
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

const PAGINATION = { current_page: 1, total_pages: 3, total: 25, page_size: 10, from: 1, to: 10 }
const ANA = { id: 1, name: 'Ana', lastname: 'Lopez', enabled: true, level: 3 }
const BETO = { id: 2, name: 'Beto', lastname: 'Diaz', enabled: true, level: 3 }

const makeChain = () => {
  const chain = { wheres: [] }
  chain.setAccessToken = vi.fn(() => chain)
  chain.users = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.parameters = vi.fn(() => chain)
  chain.where = vi.fn((where) => { chain.wheres.push(where); return chain })
  chain.get = vi.fn(async () => ({ content: { error: false, result: [{ ...ANA }, { ...BETO }], pagination: PAGINATION } }))
  return chain
}

// the list loaded, two rows selected
const renderSelected = async (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  render(<UsersList UIComponent={UIComponent} {...props} />)
  await waitFor(() => expect(ui.current.usersList.users).toHaveLength(2))
  act(() => { ui.current.handleSelectedUsers(1) })
  act(() => { ui.current.handleSelectedUsers(2) })
  expect(ui.current.selectedUsers).toEqual([1, 2])
  return ui
}

const loaded = (ui) => waitFor(() => expect(ui.current.usersList.loading).toBe(false))

describe('UsersList · the selection with clearSelectionOnQueryChange (n.º 14, D-55)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chain = makeChain()
    mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
  })

  it('empties after a page change', async () => {
    const ui = await renderSelected({ clearSelectionOnQueryChange: true })
    await act(async () => { await ui.current.getUsers(2, 10) })
    expect(ui.current.selectedUsers).toEqual([])
  })

  it('empties after a page size change', async () => {
    const ui = await renderSelected({ clearSelectionOnQueryChange: true })
    await act(async () => { await ui.current.getUsers(1, 25) })
    expect(ui.current.selectedUsers).toEqual([])
  })

  it('empties after the search changes', async () => {
    const ui = await renderSelected({ clearSelectionOnQueryChange: true, isSearchByUserName: true })
    act(() => { ui.current.onSearch('ana') })
    await loaded(ui)
    expect(ui.current.selectedUsers).toEqual([])
  })

  it('empties after a filter changes (state tab, multi filter and the legacy filter values)', async () => {
    const ui = await renderSelected({ clearSelectionOnQueryChange: true })
    act(() => { ui.current.handleChangeUserActiveState() })
    await loaded(ui)
    expect(ui.current.selectedUsers).toEqual([])

    act(() => { ui.current.handleSelectedUsers(1) })
    expect(ui.current.selectedUsers).toEqual([1])
    act(() => { ui.current.handleChangeMultiFilterValues({ name: 'ana' }) })
    await loaded(ui)
    expect(ui.current.selectedUsers).toEqual([])

    act(() => { ui.current.handleSelectedUsers(1) })
    act(() => { ui.current.setFilterValues({ clear: false, changes: { name: 'ana' } }) })
    await loaded(ui)
    expect(ui.current.selectedUsers).toEqual([])
  })

  it('keeps the selection when the same page is asked again (a reload)', async () => {
    const ui = await renderSelected({ clearSelectionOnQueryChange: true })
    await act(async () => { await ui.current.getUsers(1, 10) })
    expect(ui.current.selectedUsers).toEqual([1, 2])
  })

  it('without the prop the selection survives pages, filters and searches, as before', async () => {
    const ui = await renderSelected()
    await act(async () => { await ui.current.getUsers(2, 10) })
    expect(ui.current.selectedUsers).toEqual([1, 2])
    act(() => { ui.current.onSearch('ana') })
    await loaded(ui)
    expect(ui.current.selectedUsers).toEqual([1, 2])
  })
})
