/* eslint-disable import/first */
// redesign GC-A: the gift cards list searches by code and recipient email (opt-in), keeps only the latest
// response, sends `&where=` (not `&&where=`), exposes `reload`, keeps API / thrown errors and resets to page 1 on a new
// search or status.
import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', loading: false }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test' }]
}))

import { GiftCardsList } from '../index'

const json = (body) => Promise.resolve({ json: () => Promise.resolve(body) })
const page = (current, size = 10, total = 30) => ({
  current_page: current,
  page_size: size,
  total_pages: Math.ceil(total / size),
  total,
  from: 1,
  to: size
})
const ok = (list, pagination = page(1)) => ({ error: false, result: list, pagination })

// A request that only settles when the test says so.
const deferred = () => {
  let settle
  const promise = new Promise((resolve) => { settle = resolve })
  return { promise, resolve: (body) => settle({ json: () => Promise.resolve(body) }) }
}

const urlOf = (call) => mocks.fetch.mock.calls[call][0]
const whereOf = (call) => JSON.parse(urlOf(call).split('where=')[1])
const lastCall = () => mocks.fetch.mock.calls.length - 1

let ui
const UI = (p) => {
  ui = p
  return null
}

beforeEach(() => {
  mocks.fetch.mockReset()
  globalThis.fetch = mocks.fetch
})

describe('GiftCardsList controller', () => {
  it('lands on the gift cards and keeps the props the UI already got', async () => {
    mocks.fetch.mockImplementation(() => json(ok([{ id: 1 }], page(1, 10, 1))))
    render(<GiftCardsList UIComponent={UI} />)
    expect(ui.giftCards.loading).toBe(true)
    await waitFor(() => expect(ui.giftCards.loading).toBe(false))
    expect(ui.giftCards.list).toEqual([{ id: 1 }])
    expect(ui.activeStatus).toBe('pending')
    expect(ui.searchValue).toBe(null)
    expect(ui.paginationProps.totalItems).toBe(1)
    expect(typeof ui.setActiveStatus).toBe('function')
    expect(typeof ui.getGiftCards).toBe('function')
    expect(typeof ui.onSearch).toBe('function')
  })

  it('sends `&where=` and not `&&where=`', async () => {
    mocks.fetch.mockImplementation(() => json(ok([])))
    render(<GiftCardsList UIComponent={UI} />)
    await waitFor(() => expect(ui.giftCards.loading).toBe(false))
    expect(urlOf(0)).toContain('/gift_cards?page=1&page_size=10&where=')
    expect(urlOf(0)).not.toContain('&&where')
  })

  it('searches by code and recipient email only when the props ask for it', async () => {
    mocks.fetch.mockImplementation(() => json(ok([])))
    render(<GiftCardsList UIComponent={UI} isSearchById isSearchByCode isSearchByRecipientEmail />)
    await waitFor(() => expect(ui.giftCards.loading).toBe(false))
    act(() => ui.onSearch('ab c'))
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2))
    const or = whereOf(1).conditions.find((c) => c.conector === 'OR')
    const like = { condition: 'ilike', value: encodeURIComponent('%ab c%') }
    expect(or.conditions).toEqual([
      { attribute: 'id', value: like },
      { attribute: 'code', value: like },
      { attribute: 'user_email', value: like }
    ])
  })

  // redesign GC-A (D4, audit F7): a «+», «&» or «#» in the search (an email like ana+gift@x.com) reaches the API as typed
  it('encodes the whole search value, «+», «&» and «#» included', async () => {
    mocks.fetch.mockImplementation(() => json(ok([])))
    render(<GiftCardsList UIComponent={UI} isSearchByRecipientEmail />)
    await waitFor(() => expect(ui.giftCards.loading).toBe(false))
    act(() => ui.onSearch('ana+gift&x#1@ex.com'))
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2))
    const raw = urlOf(1).split('where=')[1]
    expect(raw).toContain('%25ana%2Bgift%26x%231%40ex.com%25')
    expect(raw).not.toContain('+')
    expect(raw).not.toContain('&')
    expect(raw).not.toContain('#')
  })

  it('does not search by code or recipient email by default', async () => {
    mocks.fetch.mockImplementation(() => json(ok([])))
    render(<GiftCardsList UIComponent={UI} isSearchById />)
    await waitFor(() => expect(ui.giftCards.loading).toBe(false))
    act(() => ui.onSearch('abc'))
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2))
    const or = whereOf(1).conditions.find((c) => c.conector === 'OR')
    expect(or.conditions.map((c) => c.attribute)).toEqual(['id'])
  })

  it('keeps the last request when the first one answers after the second', async () => {
    const first = deferred()
    const second = deferred()
    mocks.fetch
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    render(<GiftCardsList UIComponent={UI} />)
    act(() => ui.onSearch('new'))
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2))
    await act(async () => { second.resolve(ok([{ id: 2 }], page(1, 10, 1))) })
    await waitFor(() => expect(ui.giftCards.list).toEqual([{ id: 2 }]))
    await act(async () => { first.resolve(ok([{ id: 1 }, { id: 99 }], page(4, 10, 99))) })
    expect(ui.giftCards.list).toEqual([{ id: 2 }])
    expect(ui.giftCards.loading).toBe(false)
    expect(ui.paginationProps.currentPage).toBe(1)
    expect(ui.paginationProps.totalItems).toBe(1)
  })

  it('reload asks again for the current page and size', async () => {
    mocks.fetch.mockImplementation(() => json(ok([{ id: 1 }], page(3, 20, 100))))
    render(<GiftCardsList UIComponent={UI} />)
    await waitFor(() => expect(ui.paginationProps.currentPage).toBe(3))
    expect(typeof ui.reload).toBe('function')
    await act(async () => { await ui.reload() })
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(urlOf(1)).toContain('/gift_cards?page=3&page_size=20&where=')
  })

  it('keeps the API error as `result`, with an empty list and no loading', async () => {
    mocks.fetch.mockImplementation(() => json({ error: true, result: ['Not allowed'] }))
    render(<GiftCardsList UIComponent={UI} />)
    await waitFor(() => expect(ui.giftCards.loading).toBe(false))
    expect(ui.giftCards.error).toEqual(['Not allowed'])
    expect(ui.giftCards.list).toEqual([])
  })

  it('keeps a thrown error as `[message]` and stops loading', async () => {
    mocks.fetch.mockImplementation(() => Promise.reject(new Error('Network down')))
    render(<GiftCardsList UIComponent={UI} />)
    await waitFor(() => expect(ui.giftCards.loading).toBe(false))
    expect(ui.giftCards.error).toEqual(['Network down'])
  })

  it('goes back to page 1 on a new search or status, but starts on the initial page', async () => {
    mocks.fetch.mockImplementation(() => json(ok([], page(2, 10, 50))))
    render(<GiftCardsList UIComponent={UI} paginationSettings={{ initialPage: 2, pageSize: 10 }} />)
    await waitFor(() => expect(ui.giftCards.loading).toBe(false))
    expect(urlOf(0)).toContain('page=2&')
    act(() => ui.onSearch('x'))
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(ui.giftCards.loading).toBe(false))
    expect(urlOf(lastCall())).toContain('page=1&')
    await act(async () => { await ui.getGiftCards(2, 10) })
    expect(urlOf(lastCall())).toContain('page=2&')
    act(() => ui.setActiveStatus('completed'))
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(4))
    expect(urlOf(lastCall())).toContain('page=1&')
    expect(whereOf(lastCall()).conditions[0]).toEqual({ attribute: 'status', value: 'completed' })
  })
})
