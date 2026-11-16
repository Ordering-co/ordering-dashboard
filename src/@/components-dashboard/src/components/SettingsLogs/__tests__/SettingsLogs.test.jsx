/* eslint-disable import/first */
// redesign settings-logs (; M-SL5, M-SL6): the settings logs controller.
//  - the first call asks for the page size (`page_size=10`), not `page_size=null`;
//  - the request carries the session token and the JSON content type;
//  - an API error keeps `logs: []` but sets `error` (so the UI can say it instead of looking empty), on `content.error` and on a throw;
//  - `reload()` asks the same page again («Try again»);
//  - the state is updated functionally: a slow answer of an older request never replaces a newer one, and a failure keeps the totals.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test', project: 'demo' }]
}))

import { SettingsLogs } from '../index'

const log = (id, extra = {}) => ({
  id,
  config_id: 851,
  event: 'data_changed',
  data: [{ attribute: 'value', old: '0', new: '1' }],
  user_agent: 'Mozilla/5.0',
  created_at: '2026-10-10 02:03:45',
  config: {
    id: 851,
    name: 'Enable Facebook Login',
    key: 'facebook_login_enabled',
    type: 2,
    options: [{ text: 'YES', value: '1' }, { text: 'NO', value: '0' }]
  },
  author: { name: 'QA', lastname: 'User', email: 'qa@example.invalid' },
  ...extra
})
const pagination = (extra = {}) => ({ current_page: 1, page_size: 10, total: 25, total_pages: 3, from: 1, to: 10, ...extra })

const answer = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

let ui
let fetchMock
const draw = (props = {}) => {
  ui = null
  const UI = (uiProps) => {
    ui = uiProps
    return null
  }
  render(<SettingsLogs UIComponent={UI} {...props} />)
}
const urlOf = (call) => new URL(call[0])
const urls = () => fetchMock.mock.calls.map(urlOf)

beforeEach(() => {
  fetchMock = vi.fn(() => answer({ error: false, result: [log(1), log(2)], pagination: pagination() }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SettingsLogs controller · first call', () => {
  it('asks for page 1 with the page size (10), never `page_size=null`', async () => {
    draw()
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    // the other request names the admins (/users)
    expect(urls().filter(item => item.pathname === '/configs/logs')).toHaveLength(1)
    const url = urlOf(fetchMock.mock.calls[0])
    expect(url.pathname).toBe('/configs/logs')
    expect(url.searchParams.get('orderBy')).toBe('-id')
    expect(url.searchParams.get('page')).toBe('1')
    expect(url.searchParams.get('page_size')).toBe('10')
    expect(fetchMock.mock.calls[0][0]).not.toContain('null')
  })

  it('sends the session token and the JSON content type', async () => {
    draw()
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    const init = fetchMock.mock.calls[0][1]
    expect(init.method).toBe('GET')
    expect(init.headers.Authorization).toBe('Bearer test-token')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('uses the page size of paginationSettings when the shell gives one', async () => {
    draw({ paginationSettings: { initialPage: 1, pageSize: 25, controlType: 'pages' } })
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    expect(urls()[0].searchParams.get('page_size')).toBe('25')
  })

  it('exposes the logs and the totals of the page, and the names the UI uses', async () => {
    draw()
    expect(ui.logsList).toEqual({ logs: [], loading: true, error: null })
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    expect(ui.logsList.logs.map(item => item.id)).toEqual([1, 2])
    expect(ui.logsList.logs[0].config.key).toBe('facebook_login_enabled')
    expect(ui.logsList.error).toBeNull()
    expect(ui.paginationProps).toMatchObject({ currentPage: 1, pageSize: 10, totalItems: 25, totalPages: 3, from: 1, to: 10 })
    expect(typeof ui.getSettingsLogs).toBe('function')
    expect(typeof ui.reload).toBe('function')
  })

  it('falls back to the page size when getSettingsLogs gets a null size', async () => {
    draw()
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    await act(async () => { await ui.getSettingsLogs(2, null) })
    const last = urls()[urls().length - 1]
    expect(last.searchParams.get('page')).toBe('2')
    expect(last.searchParams.get('page_size')).toBe('10')
    expect(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0]).not.toContain('null')
  })
})

describe('SettingsLogs controller · an error is not an empty list', () => {
  it('keeps logs: [] and sets the API message as error on content.error', async () => {
    fetchMock.mockImplementation(() => answer({ error: true, result: ['Forbidden'] }))
    draw()
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    expect(ui.logsList.logs).toEqual([])
    expect(ui.logsList.error).toBe('Forbidden')
  })

  it('reads a message that is not wrapped in a list', async () => {
    fetchMock.mockImplementation(() => answer({ error: true, result: 'Access denied' }))
    draw()
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    expect(ui.logsList.error).toBe('Access denied')
  })

  it('still sets a truthy error when the API says error and gives no text', async () => {
    fetchMock.mockImplementation(() => answer({ error: true }))
    draw()
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    expect(ui.logsList.logs).toEqual([])
    expect(ui.logsList.error).toBeTruthy()
  })

  it('sets the error when the request throws, with no rows', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('Network down')))
    draw()
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    expect(ui.logsList.logs).toEqual([])
    expect(ui.logsList.error).toBe('Network down')
  })

  it('sets a truthy error when the answer is not JSON', async () => {
    fetchMock.mockImplementation(() => Promise.resolve({ json: () => Promise.reject(new SyntaxError('Unexpected token <')) }))
    draw()
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    expect(ui.logsList.error).toBeTruthy()
  })

  it('keeps the totals of the last good page when a later page fails', async () => {
    draw()
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    fetchMock.mockImplementation(() => answer({ error: true, result: ['Boom'] }))
    await act(async () => { await ui.getSettingsLogs(2, 10) })
    expect(ui.logsList.error).toBe('Boom')
    expect(ui.paginationProps).toMatchObject({ totalItems: 25, totalPages: 3 })
  })
})

describe('SettingsLogs controller · reload (Try again)', () => {
  it('asks the same page and size again and recovers', async () => {
    draw()
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    fetchMock.mockImplementation(() => answer({ error: true, result: ['Boom'] }))
    await act(async () => { await ui.getSettingsLogs(2, 10) })
    expect(ui.logsList.error).toBe('Boom')

    fetchMock.mockImplementation(() => answer({ error: false, result: [log(11)], pagination: pagination({ current_page: 2, from: 11, to: 20 }) }))
    await act(async () => { await ui.reload() })
    const last = urls()[urls().length - 1]
    expect(last.pathname).toBe('/configs/logs')
    expect(last.searchParams.get('page')).toBe('2')
    expect(last.searchParams.get('page_size')).toBe('10')
    expect(ui.logsList.error).toBeNull()
    expect(ui.logsList.logs.map(item => item.id)).toEqual([11])
    expect(ui.paginationProps.currentPage).toBe(2)
  })

  it('goes through a loading state without the old error', async () => {
    fetchMock.mockImplementationOnce(() => answer({ error: true, result: ['Boom'] }))
    draw()
    await waitFor(() => expect(ui.logsList.error).toBe('Boom'))
    let release
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    act(() => { ui.reload() })
    expect(ui.logsList.loading).toBe(true)
    expect(ui.logsList.error).toBeNull()
    await act(async () => { release({ json: () => Promise.resolve({ error: false, result: [log(1)], pagination: pagination() }) }) })
    expect(ui.logsList.loading).toBe(false)
  })
})

describe('SettingsLogs controller · functional state', () => {
  it('a slow answer of an older request never replaces the answer of a newer one', async () => {
    draw()
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    let releaseOld
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { releaseOld = resolve }))
    fetchMock.mockImplementationOnce(() => answer({ error: false, result: [log(30)], pagination: pagination({ current_page: 3, from: 21, to: 25 }) }))
    act(() => { ui.getSettingsLogs(2, 10) })
    await act(async () => { await ui.getSettingsLogs(3, 10) })
    expect(ui.logsList.logs.map(item => item.id)).toEqual([30])
    await act(async () => { releaseOld({ json: () => Promise.resolve({ error: false, result: [log(11)], pagination: pagination({ current_page: 2 }) }) }) })
    expect(ui.logsList.logs.map(item => item.id)).toEqual([30])
    expect(ui.paginationProps.currentPage).toBe(3)
  })

  it('keeps the page size of the request when the answer has no pagination block', async () => {
    fetchMock.mockImplementation(() => answer({ error: false, result: [log(1)] }))
    draw()
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    expect(ui.paginationProps.currentPage).toBe(1)
    expect(ui.paginationProps.pageSize).toBe(10)
  })
})

// filters, one log by id and the admins, through the `where` of GET /configs/logs.
const whereOfUrl = (url) => JSON.parse(url.searchParams.get('where'))

describe('SettingsLogs controller · filters with where', () => {
  const answers = (logsBody, usersBody = { error: false, result: [{ id: 7, name: 'Ana', lastname: 'Diaz', email: 'ana@example.invalid' }] }) => {
    fetchMock.mockImplementation((href) => answer(new URL(href).pathname === '/users' ? usersBody : logsBody))
  }

  it('sends setting, user and days in one `where`, the days as whole days of the stored stamp', async () => {
    answers({ error: false, result: [log(1)], pagination: pagination() })
    draw({ initialFilters: { configIds: [851, 852], authorIds: [7], from: '2026-10-01', to: '2026-10-02' } })
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    const url = urls().find(item => item.pathname === '/configs/logs')
    expect(whereOfUrl(url)).toEqual([
      { attribute: 'config_id', value: [851, 852] },
      { attribute: 'author_id', value: [7] },
      { attribute: 'created_at', value: { condition: '>=', value: '2026-10-01 00:00:00' } },
      { attribute: 'created_at', value: { condition: '<=', value: '2026-10-02 23:59:59' } }
    ])
  })

  it('changeFilters asks page 1 of the new filters at the same size, and reload keeps them', async () => {
    answers({ error: false, result: [log(1)], pagination: pagination() })
    draw({ paginationSettings: { initialPage: 3, pageSize: 20 } })
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    await act(async () => { await ui.changeFilters({ configIds: [], authorIds: [7], from: null, to: null }) })
    const logs = () => urls().filter(item => item.pathname === '/configs/logs')
    expect(logs().at(-1).searchParams.get('page')).toBe('1')
    expect(logs().at(-1).searchParams.get('page_size')).toBe('20')
    expect(whereOfUrl(logs().at(-1))).toEqual([{ attribute: 'author_id', value: [7] }])
    expect(ui.filters.authorIds).toEqual([7])
    await act(async () => { await ui.reload() })
    expect(whereOfUrl(logs().at(-1))).toEqual([{ attribute: 'author_id', value: [7] }])
  })

  it('names the admins (level 0) once', async () => {
    answers({ error: false, result: [log(1)], pagination: pagination() })
    draw()
    await waitFor(() => expect(ui.authorsList.loading).toBe(false))
    const users = urls().filter(item => item.pathname === '/users')
    expect(users).toHaveLength(1)
    expect(whereOfUrl(users[0])).toEqual([{ attribute: 'level', value: [0] }])
    expect(ui.authorsList.users.map(user => user.id)).toEqual([7])
  })

  it('getSettingsLog finds a log by id, and is null when the API answers another one or fails', async () => {
    answers({ error: false, result: [log(1)], pagination: pagination() })
    draw()
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    fetchMock.mockImplementationOnce(() => answer({ error: false, result: [log(42)] }))
    expect((await ui.getSettingsLog(42)).id).toBe(42)
    expect(whereOfUrl(urlOf(fetchMock.mock.calls.at(-1)))).toEqual([{ attribute: 'id', value: 42 }])
    fetchMock.mockImplementationOnce(() => answer({ error: false, result: [log(1)] }))
    expect(await ui.getSettingsLog(42)).toBeNull()
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('offline')))
    expect(await ui.getSettingsLog(42)).toBeNull()
  })
})
