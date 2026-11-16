/* eslint-disable import/first */
// redesign stores 5.16 (; G2-33): the business logs controller.
//  - the first call asks for the page size (`page_size=10`), not `page_size=null`;
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

import { BusinessLogs } from '../index'

const log = (id, extra = {}) => ({
  id,
  event: 'data_changed',
  data: [{ attribute: 'featured', old: false, new: true }],
  created_at: '2026-10-09 21:55:08',
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
  render(<BusinessLogs UIComponent={UI} businessId={7} {...props} />)
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

describe('BusinessLogs controller · first call', () => {
  it('asks for page 1 with the page size (10), never `page_size=null`', async () => {
    draw()
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = urlOf(fetchMock.mock.calls[0])
    expect(url.pathname).toBe('/business/7/logs')
    expect(url.searchParams.get('orderBy')).toBe('-id')
    expect(url.searchParams.get('page')).toBe('1')
    expect(url.searchParams.get('page_size')).toBe('10')
    expect(fetchMock.mock.calls[0][0]).not.toContain('null')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token')
  })

  it('uses the page size of paginationSettings when the shell gives one', async () => {
    draw({ paginationSettings: { initialPage: 1, pageSize: 25, controlType: 'pages' } })
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    expect(urls()[0].searchParams.get('page_size')).toBe('25')
  })

  it('exposes the logs and the totals of the page, and the names the UI already uses', async () => {
    draw()
    expect(ui.logsList).toEqual({ logs: [], loading: true, error: null })
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    expect(ui.logsList.logs.map(item => item.id)).toEqual([1, 2])
    expect(ui.logsList.error).toBeNull()
    expect(ui.paginationProps).toMatchObject({ currentPage: 1, pageSize: 10, totalItems: 25, totalPages: 3, from: 1, to: 10 })
    expect(typeof ui.getBusinessLogs).toBe('function')
    expect(typeof ui.reload).toBe('function')
  })

  it('asks again from page 1 when the business changes', async () => {
    const UI = (props) => {
      ui = props
      return null
    }
    const { rerender } = render(<BusinessLogs UIComponent={UI} businessId={7} />)
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    rerender(<BusinessLogs UIComponent={UI} businessId={8} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(urls()[1].pathname).toBe('/business/8/logs')
    expect(urls()[1].searchParams.get('page')).toBe('1')
  })
})

describe('BusinessLogs controller · G2-33 an error is not an empty list', () => {
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
    await act(async () => { await ui.getBusinessLogs(2, 10) })
    expect(ui.logsList.error).toBe('Boom')
    expect(ui.paginationProps).toMatchObject({ totalItems: 25, totalPages: 3 })
  })
})

describe('BusinessLogs controller · reload (Try again)', () => {
  it('asks the same page and size again and recovers', async () => {
    draw()
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    fetchMock.mockImplementation(() => answer({ error: true, result: ['Boom'] }))
    await act(async () => { await ui.getBusinessLogs(2, 10) })
    expect(ui.logsList.error).toBe('Boom')

    fetchMock.mockImplementation(() => answer({ error: false, result: [log(11)], pagination: pagination({ current_page: 2, from: 11, to: 20 }) }))
    await act(async () => { await ui.reload() })
    const last = urls()[urls().length - 1]
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

describe('BusinessLogs controller · functional state', () => {
  it('a slow answer of an older request never replaces the answer of a newer one', async () => {
    draw()
    await waitFor(() => expect(ui.logsList.loading).toBe(false))
    let releaseOld
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { releaseOld = resolve }))
    fetchMock.mockImplementationOnce(() => answer({ error: false, result: [log(30)], pagination: pagination({ current_page: 3, from: 21, to: 25 }) }))
    act(() => { ui.getBusinessLogs(2, 10) })
    await act(async () => { await ui.getBusinessLogs(3, 10) })
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
