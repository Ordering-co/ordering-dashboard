/* eslint-disable import/first */
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// redesign DL-B1 (decision 3|7, M-DL5|M-DL6): opt-in status filter, live drivers room and `{ ok, error }` outcomes of the users list controller
const mocks = vi.hoisted(() => ({
  chain: null,
  showToast: vi.fn(),
  session: null,
  ordering: { root: 'https://api.test' },
  events: { on: vi.fn(), off: vi.fn() },
  io: null,
  socket: null
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
const ANA = { id: 1, name: 'Ana', lastname: 'Lopez', enabled: true, available: true, busy: false, level: 4 }
const BETO = { id: 2, name: 'Beto', lastname: 'Diaz', enabled: true, available: false, busy: false, level: 4 }
const ROOM = { room: 'drivers', user_id: 1, role: 'manager' }
const BASE_CONDITIONS = [
  { attribute: 'enabled', value: true },
  { attribute: 'level', value: [0, 1, 2, 3] }
]

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

const makeSocket = () => {
  mocks.io = { connected: true, on: vi.fn(), off: vi.fn() }
  mocks.socket = { on: vi.fn(), off: vi.fn(), join: vi.fn(), leave: vi.fn(), socket: mocks.io }
}

const setup = () => {
  vi.clearAllMocks()
  mocks.chain = makeChain()
  mocks.ordering = Object.assign(mocks.chain, { root: 'https://api.test' })
  mocks.session = { token: 'token', auth: true, loading: false, user: { id: 1, level: 0 } }
  makeSocket()
  localStorage.clear()
}

const renderList = async (props = {}, expected = 2) => {
  const ui = { current: null }
  const UIComponent = (uiProps) => {
    ui.current = uiProps
    return null
  }
  const view = render(<UsersList UIComponent={UIComponent} {...props} />)
  await waitFor(() => expect(ui.current.usersList.users).toHaveLength(expected))
  const rerender = (nextProps) => view.rerender(<UsersList UIComponent={UIComponent} {...props} {...nextProps} />)
  return { ui, rerender, unmount: view.unmount }
}

const settle = () => act(async () => { await Promise.resolve() })
const ids = (ui) => ui.current.usersList.users.map(user => user.id)
const lastWhere = () => mocks.chain.wheres[mocks.chain.wheres.length - 1]
const handlers = (name) => mocks.socket.on.mock.calls.filter(([event]) => event === name).map(([, handler]) => handler)
const lastHandler = (name) => handlers(name).pop()
const userById = (ui, id) => ui.current.usersList.users.find(user => user.id === id)

describe('UsersList · statusFilter (DL-B1 / decision 3)', () => {
  beforeEach(setup)

  it('without the prop, and with «all», the request is exactly the one a list without the prop sends', async () => {
    await renderList()
    const expectedWhere = { conditions: BASE_CONDITIONS, conector: 'AND' }
    expect(lastWhere()).toEqual(expectedWhere)
    const baseline = mocks.chain.parameters.mock.calls.at(-1)

    setup()
    await renderList({ statusFilter: 'all' })
    expect(lastWhere()).toEqual(expectedWhere)
    expect(mocks.chain.parameters.mock.calls.at(-1)).toEqual(baseline)
    expect(mocks.chain.get).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['available', [{ attribute: 'enabled', value: true }, { attribute: 'available', value: true }, { attribute: 'busy', value: false }]],
    ['busy', [{ attribute: 'enabled', value: true }, { attribute: 'available', value: true }, { attribute: 'busy', value: true }]],
    ['offline', [{ attribute: 'enabled', value: true }, { attribute: 'available', value: false }]]
  ])('«%s» adds exactly its conditions with AND to today\'s', async (statusFilter, extra) => {
    await renderList({ statusFilter })

    expect(lastWhere()).toEqual({ conditions: [...BASE_CONDITIONS, ...extra], conector: 'AND' })
    expect(mocks.chain.get).toHaveBeenCalledTimes(1)
  })

  it('a change after the first load asks once for page 1 with the current page size, and the first render asks once', async () => {
    mocks.chain.get.mockImplementation(async () => ({
      content: { error: false, result: [{ ...ANA }, { ...BETO }], pagination: { ...PAGINATION, page_size: 25 } }
    }))
    const { rerender } = await renderList()
    await settle()
    expect(mocks.chain.get).toHaveBeenCalledTimes(1)

    await act(async () => { rerender({ statusFilter: 'busy' }) })
    await waitFor(() => expect(mocks.chain.get).toHaveBeenCalledTimes(2))
    await settle()

    expect(mocks.chain.get).toHaveBeenCalledTimes(2)
    expect(mocks.chain.parameters.mock.calls.at(-1)).toEqual([{ page: 1, page_size: 25 }])
    expect(lastWhere().conditions).toContainEqual({ attribute: 'busy', value: true })
  })

  it('does not ask again when the value is the same or only moves between undefined and «all»', async () => {
    const { rerender } = await renderList()
    await act(async () => { rerender({ statusFilter: 'all' }) })
    await settle()
    expect(mocks.chain.get).toHaveBeenCalledTimes(1)

    await act(async () => { rerender({ statusFilter: 'available' }) })
    await waitFor(() => expect(mocks.chain.get).toHaveBeenCalledTimes(2))
    await act(async () => { rerender({ statusFilter: 'available' }) })
    await settle()
    expect(mocks.chain.get).toHaveBeenCalledTimes(2)
  })

  describe('level 5 cache (drivers_cache_<id>)', () => {
    const CACHED = { id: 99, name: 'Cached', enabled: true }
    const KEY = 'drivers_cache_5'
    const storedIds = () => JSON.parse(localStorage.getItem(KEY)).map(driver => driver.id)

    beforeEach(() => {
      mocks.session = { token: 'token', auth: true, loading: false, user: { id: 5, level: 5 } }
      vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ error: false, result: [] }) })))
      localStorage.setItem(KEY, JSON.stringify([CACHED]))
    })

    afterEach(() => { vi.unstubAllGlobals() })

    it('with «all» (or no filter) it merges and writes the cache as today', async () => {
      const { ui } = await renderList({ isDriver: true, statusFilter: 'all' }, 3)

      expect(ids(ui)).toEqual([1, 2, 99])
      await waitFor(() => expect(storedIds()).toEqual([1, 2, 99]))
    })

    it('with a filter it neither merges the cache into the result nor writes the filtered rows into it', async () => {
      const { ui } = await renderList({ isDriver: true, statusFilter: 'available' })
      await settle()

      expect(ids(ui)).toEqual([1, 2])
      expect(JSON.parse(localStorage.getItem(KEY))).toEqual([CACHED])
    })

    it('switching from «all» to a filter drops the merged rows and leaves the cache as it was', async () => {
      const { ui, rerender } = await renderList({ isDriver: true, statusFilter: 'all' }, 3)
      await waitFor(() => expect(storedIds()).toEqual([1, 2, 99]))

      mocks.chain.get.mockImplementation(async () => ({ content: { error: false, result: [{ ...ANA }], pagination: PAGINATION } }))
      await act(async () => { rerender({ statusFilter: 'busy' }) })
      await waitFor(() => expect(ids(ui)).toEqual([1]))
      await settle()

      expect(storedIds()).toEqual([1, 2, 99])
    })
  })
})

describe('UsersList · liveDriversRoom (DL-B1 / decision 7)', () => {
  beforeEach(setup)

  it('joins the drivers room as manager when connected, and again on every connect', async () => {
    await renderList({ liveDriversRoom: true })

    expect(mocks.socket.join).toHaveBeenCalledTimes(1)
    expect(mocks.socket.join).toHaveBeenCalledWith(ROOM)
    expect(mocks.io.on).toHaveBeenCalledWith('connect', expect.any(Function))

    const onConnect = mocks.io.on.mock.calls.find(([event]) => event === 'connect')[1]
    act(() => { onConnect() })
    expect(mocks.socket.join).toHaveBeenCalledTimes(2)
    expect(mocks.socket.join).toHaveBeenLastCalledWith(ROOM)
  })

  it('does not join before the socket connects', async () => {
    mocks.io.connected = false
    await renderList({ liveDriversRoom: true })
    expect(mocks.socket.join).not.toHaveBeenCalled()

    const onConnect = mocks.io.on.mock.calls.find(([event]) => event === 'connect')[1]
    act(() => { onConnect() })
    expect(mocks.socket.join).toHaveBeenCalledWith(ROOM)
  })

  it('waits for an authenticated, loaded session and a socket', async () => {
    mocks.session = { token: 'token', auth: false, loading: false, user: { id: 1, level: 0 } }
    await renderList({ liveDriversRoom: true })
    expect(mocks.socket.join).not.toHaveBeenCalled()
    expect(mocks.io.on).not.toHaveBeenCalled()

    setup()
    mocks.session = { token: 'token', auth: true, loading: true, user: { id: 1, level: 0 } }
    await renderList({ liveDriversRoom: true })
    expect(mocks.socket.join).not.toHaveBeenCalled()

    setup()
    mocks.socket.socket = null
    await renderList({ liveDriversRoom: true })
    expect(mocks.socket.join).not.toHaveBeenCalled()
  })

  it('on unmount it leaves the same room and removes its connect handler', async () => {
    const { unmount } = await renderList({ liveDriversRoom: true })
    const onConnect = mocks.io.on.mock.calls.find(([event]) => event === 'connect')[1]

    unmount()

    expect(mocks.socket.leave).toHaveBeenCalledWith(ROOM)
    expect(mocks.io.off).toHaveBeenCalledWith('connect', onConnect)
    expect(mocks.socket.off).toHaveBeenCalledWith('batch_driver_changes', expect.any(Function))
  })

  it('batch_driver_changes applies only available, busy and enabled, only the ones that arrive, to rows already loaded', async () => {
    const { ui } = await renderList({ liveDriversRoom: true })
    const before = ids(ui)

    act(() => {
      lastHandler('batch_driver_changes')([
        {
          driver_id: 1,
          changes: [
            { attribute: 'available', old: true, new: false },
            { attribute: 'name', old: 'Ana', new: 'Renamed' },
            { attribute: 'level', old: 4, new: 0 },
            { attribute: 'location', old: null, new: { lat: 1, lng: 2 } }
          ]
        },
        { driver_id: 2, changes: [{ attribute: 'busy', old: false, new: true }] },
        { driver_id: 777, changes: [{ attribute: 'enabled', old: true, new: false }] }
      ])
    })

    expect(userById(ui, 1)).toEqual({ ...ANA, available: false })
    expect(userById(ui, 2)).toEqual({ ...BETO, busy: true })
    expect(ids(ui)).toEqual(before)
  })

  it('batch_driver_changes uses the functional form: a handler captured earlier still sees the rows of the moment', async () => {
    const { ui } = await renderList({ liveDriversRoom: true })
    const handler = lastHandler('batch_driver_changes')

    act(() => { handler([{ driver_id: 1, changes: [{ attribute: 'available', old: true, new: false }] }]) })
    act(() => { handler([{ driver_id: 1, changes: [{ attribute: 'busy', old: false, new: true }] }]) })

    expect(userById(ui, 1)).toEqual({ ...ANA, available: false, busy: true })
  })

  it('a batch that touches nothing relevant leaves the list object as it was', async () => {
    const { ui } = await renderList({ liveDriversRoom: true })
    const before = ui.current.usersList

    act(() => {
      lastHandler('batch_driver_changes')([
        { driver_id: 777, changes: [{ attribute: 'busy', old: false, new: true }] },
        { driver_id: 1, changes: [{ attribute: 'name', old: 'Ana', new: 'Renamed' }] }
      ])
    })

    expect(ui.current.usersList).toBe(before)
  })

  it('removes the batch_driver_changes listener on unmount', async () => {
    const { unmount } = await renderList({ liveDriversRoom: true })
    const handler = lastHandler('batch_driver_changes')

    unmount()

    expect(mocks.socket.off).toHaveBeenCalledWith('batch_driver_changes', handler)
  })

  it('a list without the new props sends the same where as before and never joins or listens', async () => {
    const { ui } = await renderList({ isDriver: true })

    expect(lastWhere()).toEqual({ conditions: BASE_CONDITIONS, conector: 'AND' })
    expect(mocks.socket.join).not.toHaveBeenCalled()
    expect(mocks.socket.leave).not.toHaveBeenCalled()
    expect(mocks.io.on).not.toHaveBeenCalled()
    expect(handlers('batch_driver_changes')).toHaveLength(0)
    expect(ids(ui)).toEqual([1, 2])
  })
})

describe('UsersList · drivers_update (DL-B1 / M-DL5, fix for every list)', () => {
  beforeEach(setup)

  it('updates the row when only busy changes', async () => {
    const { ui } = await renderList()

    act(() => { lastHandler('drivers_update')({ id: 1, enabled: true, available: true, busy: true }) })

    expect(userById(ui, 1)).toEqual({ ...ANA, busy: true })
  })

  it('copies only the attributes the event carries: an event without busy does not set busy: undefined', async () => {
    const { ui } = await renderList()

    act(() => { lastHandler('drivers_update')({ id: 1, available: false }) })

    expect(userById(ui, 1)).toEqual({ ...ANA, available: false })
    expect(userById(ui, 1).busy).toBe(false)
  })

  it('an event that only carries busy leaves enabled and available as they were', async () => {
    const { ui } = await renderList()

    act(() => { lastHandler('drivers_update')({ id: 2, busy: true }) })

    expect(userById(ui, 2)).toEqual({ ...BETO, busy: true })
  })

  it('still updates when enabled or available differ, as before', async () => {
    const { ui } = await renderList()

    act(() => { lastHandler('drivers_update')({ id: 2, enabled: false, available: true, busy: false }) })

    expect(userById(ui, 2)).toEqual({ ...BETO, enabled: false, available: true })
  })

  it('leaves the list object untouched when nothing differs or the driver is not loaded', async () => {
    const { ui } = await renderList()
    const before = ui.current.usersList

    act(() => { lastHandler('drivers_update')({ id: 1, enabled: true, available: true, busy: false }) })
    act(() => { lastHandler('drivers_update')({ id: 777, enabled: false, available: false, busy: true }) })
    act(() => { lastHandler('drivers_update')({ id: 1 }) })

    expect(ui.current.usersList).toBe(before)
  })

  it('uses the functional form: the first handler registered still sees the rows loaded afterwards', async () => {
    const { ui } = await renderList()
    const first = handlers('drivers_update')[0]

    act(() => { first({ id: 1, available: false }) })
    act(() => { first({ id: 1, busy: true }) })

    expect(userById(ui, 1)).toEqual({ ...ANA, available: false, busy: true })
  })
})

describe('UsersList · busy and available outcomes (DL-B1 / M-DL6)', () => {
  beforeEach(setup)

  const CASES = [
    ['handleChangeBusyUser', 'busy', true],
    ['handleChangeAvailable', 'available', false]
  ]

  it.each(CASES)('%s resolves { ok: true, error: null, user } and keeps updating the row', async (handlerName, attribute, next) => {
    mocks.chain.save.mockResolvedValue({ content: { error: false, result: { id: 1, [attribute]: next } } })
    const { ui } = await renderList()

    let outcome
    await act(async () => { outcome = await ui.current[handlerName]({ id: 1, [attribute]: next }) })

    expect(outcome).toEqual({ ok: true, error: null, user: { id: 1, [attribute]: next } })
    expect(mocks.chain.users).toHaveBeenCalledWith(1)
    expect(mocks.chain.save).toHaveBeenCalledWith({ [attribute]: next }, expect.anything())
    expect(userById(ui, 1)[attribute]).toBe(next)
    expect(mocks.showToast).toHaveBeenCalledWith('SUCCESS', 'Updated')
  })

  // the row follows what the API returned, not what was asked
  it.each(CASES)('%s: the row takes the value the API returned when it is not the one asked for', async (handlerName, attribute, next) => {
    mocks.chain.save.mockResolvedValue({ content: { error: false, result: { id: 1, [attribute]: !next } } })
    const { ui } = await renderList()

    let outcome
    await act(async () => { outcome = await ui.current[handlerName]({ id: 1, [attribute]: next }) })

    expect(outcome).toEqual({ ok: true, error: null, user: { id: 1, [attribute]: !next } })
    expect(userById(ui, 1)[attribute]).toBe(!next)
    expect(userById(ui, 2)).toEqual(BETO)
  })

  it.each(CASES)('%s: the row takes what was asked when the API returns no usable value', async (handlerName, attribute, next) => {
    const { ui } = await renderList()

    for (const result of [{ id: 1 }, { id: 1, [attribute]: null }, null, 'ok']) {
      mocks.chain.save.mockResolvedValueOnce({ content: { error: false, result } })
      let outcome
      await act(async () => { outcome = await ui.current[handlerName]({ id: 1, [attribute]: next }) })
      expect(outcome).toEqual({ ok: true, error: null, user: result })
      expect(userById(ui, 1)[attribute]).toBe(next)
    }
  })

  it.each(CASES)('%s resolves { ok: false, error } with the API strings and leaves the row alone', async (handlerName, attribute, next) => {
    mocks.chain.save.mockResolvedValue({ content: { error: true, result: ['Not allowed', 'Try later'] } })
    const { ui } = await renderList()

    let outcome
    await act(async () => { outcome = await ui.current[handlerName]({ id: 1, [attribute]: next }) })

    expect(outcome).toEqual({ ok: false, error: ['Not allowed', 'Try later'] })
    expect(userById(ui, 1)[attribute]).toBe(ANA[attribute])
    expect(ui.current.actionStatus).toEqual({ loading: false, error: ['Not allowed', 'Try later'] })
  })

  it.each(CASES)('%s never returns an object as error', async (handlerName, attribute, next) => {
    const { ui } = await renderList()

    for (const result of ['Not allowed', { message: 'Not allowed' }, [{ message: 'Not allowed' }], null]) {
      mocks.chain.save.mockResolvedValueOnce({ content: { error: true, result } })
      let outcome
      await act(async () => { outcome = await ui.current[handlerName]({ id: 1, [attribute]: next }) })
      expect(outcome).toEqual({ ok: false, error: null })
    }
  })

  it.each(CASES)('%s resolves { ok: false } when the request throws', async (handlerName, attribute, next) => {
    mocks.chain.save.mockRejectedValue(new Error('network down'))
    const { ui } = await renderList()

    let outcome
    await act(async () => { outcome = await ui.current[handlerName]({ id: 1, [attribute]: next }) })

    expect(outcome.ok).toBe(false)
    expect(outcome.error === null || Array.isArray(outcome.error)).toBe(true)
    expect(ui.current.actionStatus).toEqual({ loading: false, error: ['network down'] })
  })
})
