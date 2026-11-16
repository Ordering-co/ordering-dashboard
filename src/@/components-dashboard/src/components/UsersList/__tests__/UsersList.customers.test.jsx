/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// redesign UC-B1 (M-10, decision 2A): opt-in outcomes and full-name search of the users list controller
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

const PAGINATION = { current_page: 1, total_pages: 1, total: 2, page_size: 10, from: 1, to: 2 }
const ANA = { id: 1, name: 'Ana', lastname: 'Lopez', enabled: true, level: 3 }
const BETO = { id: 2, name: 'Beto', lastname: 'Diaz', enabled: true, level: 3 }

// A chainable fake of the SDK builder: every step returns the chain, `get`/`save` are the spies.
const makeChain = () => {
  const chain = { wheres: [] }
  chain.setAccessToken = vi.fn(() => chain)
  chain.users = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.parameters = vi.fn(() => chain)
  chain.where = vi.fn((where) => { chain.wheres.push(where); return chain })
  chain.get = vi.fn(async () => ({ content: { error: false, result: [{ ...ANA }, { ...BETO }], pagination: PAGINATION } }))
  chain.save = vi.fn()
  return chain
}

const renderList = async (props = {}) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  render(<UsersList UIComponent={UIComponent} {...props} />)
  await waitFor(() => expect(ui.current.usersList.users).toHaveLength(2))
  return ui
}

const lastWhere = () => mocks.chain.wheres[mocks.chain.wheres.length - 1]
const searchGroup = (where) => where.conditions.find(condition => condition.conector === 'OR')

describe('UsersList · handleChangeActiveUser outcome (UC-B1 / M-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chain = makeChain()
    mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
  })

  it('resolves { ok: true, error: null } and drops the user from the active list, as before', async () => {
    mocks.chain.save.mockResolvedValue({ content: { error: false, result: { id: 1, enabled: false } } })
    const ui = await renderList()

    let outcome
    await act(async () => { outcome = await ui.current.handleChangeActiveUser({ id: 1, enabled: false }) })

    // additive, the outcome also carries the record the API returned
    expect(outcome).toEqual({ ok: true, error: null, user: { id: 1, enabled: false } })
    expect(mocks.chain.users).toHaveBeenCalledWith(1)
    expect(mocks.chain.save).toHaveBeenCalledWith({ enabled: false })
    expect(ui.current.usersList.users.map(user => user.id)).toEqual([2])
    expect(ui.current.actionStatus).toEqual({ loading: false, error: null })
    expect(mocks.showToast).toHaveBeenCalledWith('INFO', 'Loading')
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Updated')
  })

  // the row follows what the API returned (result.enabled), not what was asked
  it('decides with result.enabled: when the API keeps the user active, the row stays in the Active list', async () => {
    mocks.chain.save.mockResolvedValue({ content: { error: false, result: { ...ANA, enabled: true } } })
    const ui = await renderList()

    let outcome
    await act(async () => { outcome = await ui.current.handleChangeActiveUser({ id: 1, enabled: false }) })

    expect(outcome).toEqual({ ok: true, error: null, user: { ...ANA, enabled: true } })
    expect(ui.current.usersList.users.map(user => user.id)).toEqual([1, 2])
    expect(ui.current.usersList.users[0]).toMatchObject({ id: 1, enabled: true })
  })

  it('a row that stays changes only `enabled`: the other fields of the response never replace the list\'s', async () => {
    mocks.chain.save.mockResolvedValue({ content: { error: false, result: { id: 1, name: 'Ana María', loyalty_level: 7, enabled: false } } })
    const ui = await renderList({ disabledActiveStateCondition: true })

    await act(async () => { await ui.current.handleChangeActiveUser({ id: 1, enabled: false }) })

    expect(ui.current.usersList.users[0]).toEqual({ ...ANA, enabled: false })
  })

  it('a user that is not in the list and now belongs to it enters as the returned record, not the payload', async () => {
    const ZOE = { id: 9, name: 'Zoe', lastname: 'Ruiz', enabled: true, level: 3 }
    mocks.chain.save.mockResolvedValue({ content: { error: false, result: ZOE } })
    const ui = await renderList()

    await act(async () => { await ui.current.handleChangeActiveUser({ id: 9, enabled: true }) })

    expect(ui.current.usersList.users.map(user => user.id)).toEqual([1, 2, 9])
    expect(ui.current.usersList.users[2]).toEqual(ZOE)
  })

  it('without a state condition (disabledActiveStateCondition) the row takes result.enabled in place', async () => {
    mocks.chain.save.mockResolvedValue({ content: { error: false, result: { ...ANA, enabled: false } } })
    const ui = await renderList({ disabledActiveStateCondition: true })

    await act(async () => { await ui.current.handleChangeActiveUser({ id: 1, enabled: false }) })

    expect(ui.current.usersList.users.map(user => user.id)).toEqual([1, 2])
    expect(ui.current.usersList.users[0]).toMatchObject({ id: 1, name: 'Ana', enabled: false })
    expect(ui.current.usersList.users[1]).toMatchObject({ id: 2, enabled: true })
  })

  it('a result without `enabled` falls back to the requested value, as before', async () => {
    mocks.chain.save.mockResolvedValue({ content: { error: false, result: { id: 1 } } })
    const ui = await renderList({ disabledActiveStateCondition: true })

    await act(async () => { await ui.current.handleChangeActiveUser({ id: 1, enabled: false }) })

    expect(ui.current.usersList.users[0]).toMatchObject({ id: 1, name: 'Ana', enabled: false })
  })

  it('resolves { ok: false, error } with the API strings on an API error, and leaves the list untouched', async () => {
    mocks.chain.save.mockResolvedValue({ content: { error: true, result: ['Not allowed', 'Try later'] } })
    const ui = await renderList()

    let outcome
    await act(async () => { outcome = await ui.current.handleChangeActiveUser({ id: 1, enabled: false }) })

    expect(outcome).toEqual({ ok: false, error: ['Not allowed', 'Try later'] })
    expect(ui.current.usersList.users.map(user => user.id)).toEqual([1, 2])
    expect(ui.current.actionStatus).toEqual({ loading: false, error: ['Not allowed', 'Try later'] })
    expect(mocks.showToast).not.toHaveBeenCalledWith('SUCCESS', 'Updated')
  })

  it('never returns an object as error: a result that is not an array of strings becomes null', async () => {
    const ui = await renderList()

    for (const result of ['Not allowed', { message: 'Not allowed' }, [{ message: 'Not allowed' }], null]) {
      mocks.chain.save.mockResolvedValueOnce({ content: { error: true, result } })
      let outcome
      await act(async () => { outcome = await ui.current.handleChangeActiveUser({ id: 1, enabled: false }) })
      expect(outcome).toEqual({ ok: false, error: null })
    }
    expect(ui.current.usersList.users.map(user => user.id)).toEqual([1, 2])
  })

  it('resolves { ok: false } when the request throws, and keeps recording the message in actionStatus', async () => {
    mocks.chain.save.mockRejectedValue(new Error('network down'))
    const ui = await renderList()

    let outcome
    await act(async () => { outcome = await ui.current.handleChangeActiveUser({ id: 1, enabled: false }) })

    expect(outcome.ok).toBe(false)
    expect(outcome.error === null || Array.isArray(outcome.error)).toBe(true)
    expect(ui.current.usersList.users.map(user => user.id)).toEqual([1, 2])
    expect(ui.current.actionStatus).toEqual({ loading: false, error: ['network down'] })
  })
})

describe('UsersList · isSearchByFullName (UC-B1 / decision 2A)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chain = makeChain()
    mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
  })

  const BY_NAME = [
    { attribute: 'name', value: { condition: 'ilike', value: encodeURI('%Olivia Bennett%') } },
    { attribute: 'lastname', value: { condition: 'ilike', value: encodeURI('%Olivia Bennett%') } }
  ]
  const FULL_NAME_MEMBER = {
    conector: 'AND',
    conditions: [
      { attribute: 'name', value: { condition: 'ilike', value: encodeURI('%Olivia%') } },
      { attribute: 'lastname', value: { condition: 'ilike', value: encodeURI('%Bennett%') } }
    ]
  }

  it('with the flag on, «Olivia Bennett» adds the name AND lastname member to the search OR group', async () => {
    await renderList({ isSearchByUserName: true, isSearchByFullName: true, searchSeed: { value: 'Olivia Bennett', key: 'k1' } })

    expect(searchGroup(lastWhere())).toEqual({ conector: 'OR', conditions: [...BY_NAME, FULL_NAME_MEMBER] })
  })

  it('with the flag off (default) the where is exactly today\'s', async () => {
    await renderList({ isSearchByUserName: true, searchSeed: { value: 'Olivia Bennett', key: 'k1' } })

    expect(lastWhere()).toEqual({
      conditions: [
        { attribute: 'enabled', value: true },
        { attribute: 'level', value: [0, 1, 2, 3] },
        { conector: 'OR', conditions: BY_NAME }
      ],
      conector: 'AND'
    })
  })

  it('with the flag on, a single word adds nothing', async () => {
    await renderList({ isSearchByUserName: true, isSearchByFullName: true, searchSeed: { value: '  Olivia ', key: 'k1' } })

    expect(searchGroup(lastWhere()).conditions).toHaveLength(2)
  })

  it('with the flag on, the first word is the name and everything after it the lastname; outer spaces are ignored', async () => {
    await renderList({ isSearchByFullName: true, searchSeed: { value: '  Mary   Ann Smith ', key: 'k1' } })

    expect(searchGroup(lastWhere())).toEqual({
      conector: 'OR',
      conditions: [{
        conector: 'AND',
        conditions: [
          { attribute: 'name', value: { condition: 'ilike', value: encodeURI('%Mary%') } },
          { attribute: 'lastname', value: { condition: 'ilike', value: encodeURI('%Ann Smith%') } }
        ]
      }]
    })
  })

  it('follows a search typed after mount', async () => {
    const ui = await renderList({ isSearchByUserName: true, isSearchByFullName: true })
    expect(lastWhere().conditions.some(condition => condition.conector === 'OR')).toBe(false)

    await act(async () => { ui.current.onSearch('Olivia Bennett') })
    await waitFor(() => expect(searchGroup(lastWhere())?.conditions).toContainEqual(FULL_NAME_MEMBER))
  })
})

// redesign (row 92, M-C18): loading a page used to assign `usersList.users` on the state object before setting it
describe('UsersList · getUsers does not mutate the previous state (row 92, M-C18)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chain = makeChain()
    mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
  })

  it('leaves the state object of the first render untouched and sets the same resulting state', async () => {
    const seen = []
    const UIComponent = (uiProps) => {
      seen.push(uiProps.usersList)
      return null
    }
    render(<UsersList UIComponent={UIComponent} />)
    await waitFor(() => expect(seen[seen.length - 1].users).toHaveLength(2))

    expect(seen[0].users).toEqual([])
    expect(seen[0].loading).toBe(false)
    const last = seen[seen.length - 1]
    expect(last.users.map(user => user.id)).toEqual([1, 2])
    expect(last.loading).toBe(false)
    expect(last.error).toBeNull()
  })
})

// after a failed load, the next good load (Retry, a tab, a search) clears the error and paints the rows
describe('UsersList · a good load after a failed one clears the error', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chain = makeChain()
    mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
  })

  const renderFailing = async (failure) => {
    failure()
    const ui = { current: null }
    const UIComponent = (uiProps) => {
      ui.current = uiProps
      return null
    }
    render(<UsersList UIComponent={UIComponent} />)
    await waitFor(() => expect(ui.current.usersList.error).toBeTruthy())
    return ui
  }

  it.each([
    ['an API error', () => mocks.chain.get.mockResolvedValueOnce({ content: { error: true, result: ['Server error'] } })],
    ['a network error', () => mocks.chain.get.mockRejectedValueOnce(new Error('Failed to fetch'))]
  ])('after %s, Retry brings the rows back with no error', async (_name, failure) => {
    const ui = await renderFailing(failure)
    await act(async () => { await ui.current.getUsers(1, 10) })
    expect(ui.current.usersList.error).toBeNull()
    expect(ui.current.usersList.users.map(user => user.id)).toEqual([1, 2])
    expect(ui.current.usersList.loading).toBe(false)
  })

  it('a new load starts without the old error (the table shows loading, not the error)', async () => {
    const ui = await renderFailing(() => mocks.chain.get.mockResolvedValueOnce({ content: { error: true, result: ['Server error'] } }))
    let release
    mocks.chain.get.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    act(() => { ui.current.getUsers(1, 10) })
    await waitFor(() => expect(ui.current.usersList.loading).toBe(true))
    expect(ui.current.usersList.error).toBeNull()
    await act(async () => { release({ content: { error: false, result: [{ ...ANA }], pagination: PAGINATION } }) })
  })
})
