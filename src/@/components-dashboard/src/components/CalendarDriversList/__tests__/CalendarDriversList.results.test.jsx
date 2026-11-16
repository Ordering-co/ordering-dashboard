/* eslint-disable import/first */
// redesign DT-B1 (DT-10, DT-15, DT-20, DT-23): the CalendarDriversList controller keeps the range as local days and turns them into
// UTC only in the request, loads every driver on arrival (decision 1), keeps only the answer to the last request, does not mutate
// its state, respects the page size, and tells its UI how a block save/edit/delete went (`{ ok: true }` or `{ ok: false, error }`).
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0, id: 1 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test' }]
}))
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, text) => text]
}))

import { CalendarDriversList } from '../index'
import { localBlocks, todayDay, toRequestRange } from '../../../ui/src/components/Delivery/DriversTimeCalendar/blockData'

const HEADERS = { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' }

const rawUser = (id, blocks = []) => ({ id, name: `Driver ${id}`, lastname: 'Test', email: `d${id}@test.dev`, enabled: true, level: 4, delivery_blocks: blocks })
const rawBlock = (id) => ({ id, name: `Block ${id}`, start: '2026-10-14 08:00:00', end: '2026-10-14 16:00:00', break_start: '2026-10-14 12:00:00', break_end: '2026-10-14 12:30:00', rrule: null, until: null })

const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })
const deferred = () => {
  let settle
  const promise = new Promise(resolve => { settle = resolve })
  return { promise, resolve: (body) => settle({ json: () => Promise.resolve(body) }) }
}

// answers a list request like the API: echoes the page and the page size it was asked for
const listAnswer = (url, users = [rawUser(1, [rawBlock(10)]), rawUser(2)]) => {
  const query = new URL(url).searchParams
  const page = Number(query.get('page'))
  const pageSize = Number(query.get('page_size'))
  return {
    error: false,
    result: users,
    pagination: { current_page: page, page_size: pageSize, total_pages: 5, total: 47, from: (page - 1) * pageSize + 1, to: page * pageSize }
  }
}

let ui
const draw = (props = {}) => {
  ui = null
  const UI = (p) => {
    ui = p
    return null
  }
  return render(<CalendarDriversList UIComponent={UI} paginationSettings={{ initialPage: 1, pageSize: 10 }} propsToFetch={['id', 'name']} {...props} />)
}

const isList = ([url, options]) => /^https:\/\/api\.test\/(users|drivergroups\/\d+\/drivers)\?/.test(url) && options?.method === 'GET'
const listCalls = () => mocks.fetch.mock.calls.filter(isList)
const lastListUrl = () => listCalls().at(-1)[0]
const queryOf = (url) => new URL(url).searchParams
const whereOf = (url) => JSON.parse(queryOf(url).get('where'))

beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.fetch.mockImplementation((url, options) => {
    if (isList([url, options])) return json(listAnswer(url))
    return json({ error: false, result: {} })
  })
  globalThis.fetch = mocks.fetch
})

describe('CalendarDriversList controller · the load', () => {
  it('arrives with every driver: loads /users on mount, without choosing a mode (decision 1)', async () => {
    draw()
    await waitFor(() => expect(ui.driversList.users).toHaveLength(2))
    expect(ui.driversList.loading).toBe(false)
    expect(ui.driversList.error).toBeNull()
    expect(listCalls()).toHaveLength(1)
    const [url, options] = listCalls()[0]
    expect(url.startsWith('https://api.test/users?')).toBe(true)
    expect(options.headers).toEqual(HEADERS)
    const query = queryOf(url)
    expect(query.get('page')).toBe('1')
    expect(query.get('page_size')).toBe('10')
    expect(query.get('params')).toBe('id,name')
    expect(whereOf(url)).toEqual({ conditions: [{ attribute: 'level', value: '4' }], conector: 'AND' })
  })

  it('starts on today–today (local days) and asks the API for that range in UTC', async () => {
    draw()
    await waitFor(() => expect(ui.driversList.users).toHaveLength(2))
    expect(ui.range).toEqual({ from: todayDay(), to: todayDay() })
    const [from, to] = toRequestRange(ui.range)
    const query = queryOf(lastListUrl())
    expect(query.get('delivery_block_from')).toBe(from)
    expect(query.get('delivery_block_to')).toBe(to)
  })

  it('gives the blocks in local time (localBlocks) and the pagination', async () => {
    draw()
    await waitFor(() => expect(ui.driversList.users).toHaveLength(2))
    expect(ui.driversList.users[0].delivery_blocks).toEqual(localBlocks([rawBlock(10)]))
    expect(ui.driversList.users[1].delivery_blocks).toEqual([])
    expect(ui.paginationProps).toEqual({ currentPage: 1, pageSize: 10, totalPages: 5, totalItems: 47, from: 1, to: 10 })
  })

  it('DT-24: a driver without delivery_blocks does not break the load', async () => {
    mocks.fetch.mockImplementation((url) => json(listAnswer(url, [{ id: 1, name: 'No blocks' }, { id: 2, name: 'Null', delivery_blocks: null }])))
    draw()
    await waitFor(() => expect(ui.driversList.users).toHaveLength(2))
    expect(ui.driversList.users.map(u => u.delivery_blocks)).toEqual([[], []])
  })

  it('with a group it asks /drivergroups/:id/drivers, and a new group clears the driver filter', async () => {
    draw()
    await waitFor(() => expect(ui.driversList.users).toHaveLength(2))
    act(() => ui.toggleDriver(7))
    await waitFor(() => expect(listCalls()).toHaveLength(2))
    expect(ui.driverIds).toEqual([7])
    act(() => ui.setSelectedGroup({ id: 3, name: 'Night' }))
    await waitFor(() => expect(lastListUrl().startsWith('https://api.test/drivergroups/3/drivers?')).toBe(true))
    expect(ui.selectedGroup).toEqual({ id: 3, name: 'Night' })
    expect(ui.driverIds).toEqual([])
    expect(whereOf(lastListUrl()).conditions).toEqual([{ attribute: 'level', value: '4' }])
    act(() => ui.setSelectedGroup(null))
    await waitFor(() => expect(lastListUrl().startsWith('https://api.test/users?')).toBe(true))
  })

  it('toggleDriver and clearDrivers drive the where of the request', async () => {
    draw()
    await waitFor(() => expect(ui.driversList.users).toHaveLength(2))
    act(() => ui.toggleDriver(7))
    await waitFor(() => expect(whereOf(lastListUrl()).conditions).toEqual([{ attribute: 'level', value: '4' }, { attribute: 'id', value: [7] }]))
    act(() => ui.toggleDriver(9))
    await waitFor(() => expect(whereOf(lastListUrl()).conditions.at(-1)).toEqual({ attribute: 'id', value: [7, 9] }))
    act(() => ui.toggleDriver(7))
    await waitFor(() => expect(whereOf(lastListUrl()).conditions.at(-1)).toEqual({ attribute: 'id', value: [9] }))
    act(() => ui.clearDrivers())
    await waitFor(() => expect(ui.driverIds).toEqual([]))
    await waitFor(() => expect(whereOf(lastListUrl()).conditions).toEqual([{ attribute: 'level', value: '4' }]))
  })

  it('clearing an already empty filter does not ask again', async () => {
    draw()
    await waitFor(() => expect(ui.driversList.users).toHaveLength(2))
    act(() => ui.clearDrivers())
    await Promise.resolve()
    expect(listCalls()).toHaveLength(1)
  })

  it('a new range reloads from page 1 with the new range in UTC', async () => {
    draw()
    await waitFor(() => expect(ui.driversList.users).toHaveLength(2))
    await act(async () => { await ui.changePage(3) })
    act(() => ui.setRange({ from: '2026-10-11', to: '2026-10-17' }))
    await waitFor(() => expect(listCalls()).toHaveLength(3))
    const [from, to] = toRequestRange({ from: '2026-10-11', to: '2026-10-17' })
    const query = queryOf(lastListUrl())
    expect(query.get('delivery_block_from')).toBe(from)
    expect(query.get('delivery_block_to')).toBe(to)
    expect(query.get('page')).toBe('1')
  })

  it('stops loading and keeps the messages when the API refuses', async () => {
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['Session expired'] }))
    draw()
    await waitFor(() => expect(ui.driversList.loading).toBe(false))
    expect(ui.driversList.error).toEqual(['Session expired'])
  })

  it('stops loading and keeps the message when the request throws', async () => {
    mocks.fetch.mockImplementation(() => Promise.reject(new Error('Network down')))
    draw()
    await waitFor(() => expect(ui.driversList.loading).toBe(false))
    expect(ui.driversList.error).toEqual(['Network down'])
  })
})

describe('CalendarDriversList controller · DT-23 keeps the last answer and does not mutate', () => {
  it('an old answer that arrives late does not overwrite the new one', async () => {
    const first = deferred()
    const second = deferred()
    mocks.fetch.mockImplementationOnce(() => first.promise)
    mocks.fetch.mockImplementationOnce(() => second.promise)
    draw()
    await waitFor(() => expect(listCalls()).toHaveLength(1))
    act(() => ui.setRange({ from: '2026-10-11', to: '2026-10-17' }))
    await waitFor(() => expect(listCalls()).toHaveLength(2))
    await act(async () => { second.resolve(listAnswer(lastListUrl(), [rawUser(22)])) })
    await waitFor(() => expect(ui.driversList.users.map(u => u.id)).toEqual([22]))
    await act(async () => { first.resolve(listAnswer(listCalls()[0][0], [rawUser(11)])) })
    expect(ui.driversList.users.map(u => u.id)).toEqual([22])
    expect(ui.driversList.loading).toBe(false)
  })

  it('an old failure does not write over the new answer either', async () => {
    const first = deferred()
    mocks.fetch.mockImplementationOnce(() => first.promise)
    draw()
    await waitFor(() => expect(listCalls()).toHaveLength(1))
    act(() => ui.setRange({ from: '2026-10-11', to: '2026-10-17' }))
    await waitFor(() => expect(ui.driversList.users.map(u => u.id)).toEqual([1, 2]))
    await act(async () => { first.resolve({ error: true, result: ['Old failure'] }) })
    expect(ui.driversList.error).toBeNull()
    expect(ui.driversList.users.map(u => u.id)).toEqual([1, 2])
  })

  it('does not mutate the state it already gave', async () => {
    draw()
    await waitFor(() => expect(ui.driversList.users).toHaveLength(2))
    const before = ui.driversList
    const usersBefore = before.users
    const snapshot = JSON.parse(JSON.stringify(before))
    mocks.fetch.mockImplementation((url) => json(listAnswer(url, [rawUser(5)])))
    await act(async () => { await ui.reload() })
    await waitFor(() => expect(ui.driversList.users.map(u => u.id)).toEqual([5]))
    expect(ui.driversList).not.toBe(before)
    expect(before.users).toBe(usersBefore)
    expect(JSON.parse(JSON.stringify(before))).toEqual(snapshot)
  })
})

describe('CalendarDriversList controller · pages (DT-10)', () => {
  it('changePageSize(25) asks page=1&page_size=25 and the next page keeps the size', async () => {
    draw()
    await waitFor(() => expect(ui.driversList.users).toHaveLength(2))
    await act(async () => { await ui.changePage(3) })
    expect(queryOf(lastListUrl()).get('page')).toBe('3')
    await act(async () => { await ui.changePageSize(25) })
    let query = queryOf(lastListUrl())
    expect(query.get('page')).toBe('1')
    expect(query.get('page_size')).toBe('25')
    await waitFor(() => expect(ui.paginationProps.pageSize).toBe(25))
    await act(async () => { await ui.changePage(2) })
    query = queryOf(lastListUrl())
    expect(query.get('page')).toBe('2')
    expect(query.get('page_size')).toBe('25')
    expect(ui.paginationProps.currentPage).toBe(2)
  })

  it('a change of range or filter after choosing a size keeps that size', async () => {
    draw()
    await waitFor(() => expect(ui.driversList.users).toHaveLength(2))
    await act(async () => { await ui.changePageSize(50) })
    await waitFor(() => expect(ui.paginationProps.pageSize).toBe(50))
    act(() => ui.toggleDriver(7))
    await waitFor(() => expect(whereOf(lastListUrl()).conditions.at(-1)).toEqual({ attribute: 'id', value: [7] }))
    expect(queryOf(lastListUrl()).get('page_size')).toBe('50')
  })

  it('reload asks for the current page and size again', async () => {
    draw()
    await waitFor(() => expect(ui.driversList.users).toHaveLength(2))
    await act(async () => { await ui.changePage(2) })
    const count = listCalls().length
    await act(async () => { await ui.reload() })
    expect(listCalls()).toHaveLength(count + 1)
    expect(queryOf(lastListUrl()).get('page')).toBe('2')
    expect(queryOf(lastListUrl()).get('page_size')).toBe('10')
  })
})

describe('CalendarDriversList controller · blocks tell how they went', () => {
  const addBody = { start: '2026-10-14 07:00:00', end: '2026-10-14 15:00:00', until: '2026-10-14 21:59:59' }

  it('addBlock: POST to the driver, { ok: true }, and the current page is loaded again', async () => {
    draw()
    await waitFor(() => expect(ui.driversList.users).toHaveLength(2))
    await act(async () => { await ui.changePage(2) })
    const count = listCalls().length
    let result
    await act(async () => { result = await ui.addBlock(3, addBody) })
    expect(result).toEqual({ ok: true })
    expect(mocks.fetch).toHaveBeenCalledWith('https://api.test/drivers/3/delivery_blocks', { method: 'POST', headers: HEADERS, body: JSON.stringify(addBody) })
    expect(listCalls()).toHaveLength(count + 1)
    expect(queryOf(lastListUrl()).get('page')).toBe('2')
  })

  it('editBlock: PUT with the body as it comes (propagation included), { ok: true } and reload', async () => {
    draw()
    await waitFor(() => expect(ui.driversList.users).toHaveLength(2))
    const count = listCalls().length
    const body = { ...addBody, propagation: 'from_event' }
    let result
    await act(async () => { result = await ui.editBlock(3, 8, body) })
    expect(result).toEqual({ ok: true })
    expect(mocks.fetch).toHaveBeenCalledWith('https://api.test/drivers/3/delivery_blocks/8', { method: 'PUT', headers: HEADERS, body: JSON.stringify(body) })
    expect(listCalls()).toHaveLength(count + 1)
  })

  it('deleteBlock: DELETE with { propagation }, { ok: true } and reload', async () => {
    draw()
    await waitFor(() => expect(ui.driversList.users).toHaveLength(2))
    const count = listCalls().length
    let result
    await act(async () => { result = await ui.deleteBlock(3, 8, 'all') })
    expect(result).toEqual({ ok: true })
    expect(mocks.fetch).toHaveBeenCalledWith('https://api.test/drivers/3/delivery_blocks/8', { method: 'DELETE', headers: HEADERS, body: JSON.stringify({ propagation: 'all' }) })
    expect(listCalls()).toHaveLength(count + 1)
  })

  const verbs = [
    ['addBlock', (api) => api.addBlock(3, addBody)],
    ['editBlock', (api) => api.editBlock(3, 8, { ...addBody, propagation: 'none' })],
    ['deleteBlock (DT-15)', (api) => api.deleteBlock(3, 8, 'none')]
  ]

  it.each(verbs)('%s: the API refuses → { ok: false, error } and no reload', async (_name, run) => {
    draw()
    await waitFor(() => expect(ui.driversList.users).toHaveLength(2))
    const count = listCalls().length
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['Not allowed'] }))
    let result
    await act(async () => { result = await run(ui) })
    expect(result).toEqual({ ok: false, error: ['Not allowed'] })
    expect(listCalls()).toHaveLength(count)
  })

  it.each(verbs)('%s: the network fails → { ok: false, error: [message] }', async (_name, run) => {
    draw()
    await waitFor(() => expect(ui.driversList.users).toHaveLength(2))
    mocks.fetch.mockImplementation(() => Promise.reject(new Error('Offline')))
    let result
    await act(async () => { result = await run(ui) })
    expect(result).toEqual({ ok: false, error: ['Offline'] })
  })
})

// with a group chosen, the days and the hours are the group's zone (driver_groups.timezone), not the browser's
describe('CalendarDriversList controller · the zone of the group', () => {
  const originalTZ = process.env.TZ
  beforeEach(() => { process.env.TZ = 'Asia/Tokyo' })
  afterEach(() => {
    if (originalTZ === undefined) delete process.env.TZ
    else process.env.TZ = originalTZ
  })

  it('asks for the group\'s days, draws its blocks in the group\'s hours and hands the zone to the page', async () => {
    draw()
    await waitFor(() => expect(ui.driversList.users).toHaveLength(2))
    expect(ui.timeZone).toEqual({ zone: 'Asia/Tokyo', fallback: true })
    act(() => {
      ui.setRange({ from: '2026-10-14', to: '2026-10-14' })
      ui.setSelectedGroup({ id: 7, name: 'Bogotá', timezone: 'America/Bogota' })
    })
    await waitFor(() => expect(lastListUrl()).toContain('/drivergroups/7/drivers'))
    await waitFor(() => expect(ui.driversList.loading).toBe(false))
    const query = queryOf(lastListUrl())
    expect([query.get('delivery_block_from'), query.get('delivery_block_to')]).toEqual(['2026-10-14 05:00:00', '2026-10-15 04:59:59'])
    expect(ui.driversList.users[0].delivery_blocks[0]).toMatchObject({ start: '2026-10-14 03:00:00', end: '2026-10-14 11:00:00' })
    expect(ui.timeZone).toEqual({ zone: 'America/Bogota', fallback: false })
  })
})
