/* eslint-disable import/first */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

vi.mock('../../../contexts/SessionContext', () => ({
  useSession: () => [{ token: 'test-token', loading: false, user: { level: 0 } }]
}))
vi.mock('../../../contexts/ApiContext', () => ({
  useApi: () => [{ root: 'https://api.test/v400/en/demo' }]
}))

import { PayoutsList } from '../index'

const payout = { id: 3, order_id: 12122, business_id: 41, status: 'paid', currency: 'mxn', restaurant_amount: 13.63 }

const UI = ({ payoutsState, paginationProps, handleChangePage, handleChangePageSize }) => (
  <>
    <output data-testid='state'>{JSON.stringify(payoutsState)}</output>
    <output data-testid='pagination'>{JSON.stringify(paginationProps)}</output>
    <button onClick={() => handleChangePage(2)}>next</button>
    <button onClick={() => handleChangePageSize(25)}>size</button>
  </>
)

const answer = (result, pagination, error = false) => ({ ok: !error, json: async () => ({ error, result, pagination }) })
const readState = () => JSON.parse(screen.getByTestId('state').textContent)
const readPagination = () => JSON.parse(screen.getByTestId('pagination').textContent)
const queryOf = (call) => new URL(call[0]).searchParams

describe('PayoutsList controller', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads the payouts of a business, most recent first', async () => {
    fetchMock.mockResolvedValue(answer([payout], { current_page: 1, page_size: 10, total: 1, total_pages: 1 }))

    render(<PayoutsList UIComponent={UI} businessId={41} />)

    await waitFor(() => expect(readState().loading).toBe(false))
    const [url, options] = fetchMock.mock.calls[0]
    expect(url.startsWith('https://api.test/v400/en/demo/payouts?')).toBe(true)
    expect(options.headers.Authorization).toBe('Bearer test-token')
    const query = queryOf(fetchMock.mock.calls[0])
    expect(query.get('page')).toBe('1')
    expect(query.get('page_size')).toBe('10')
    expect(query.get('orderBy')).toBe('-id')
    expect(JSON.parse(query.get('where'))).toEqual([{ attribute: 'business_id', value: 41 }])
    expect(readState()).toEqual({ loading: false, error: null, payouts: [payout] })
    expect(readPagination()).toEqual({ currentPage: 1, pageSize: 10, totalItems: 1, totalPages: 1 })
  })

  it('narrows by driver, and asks for everything it may see when nothing narrows it', async () => {
    fetchMock.mockResolvedValue(answer([], { current_page: 1, page_size: 10, total: 0, total_pages: 0 }))

    const { unmount } = render(<PayoutsList UIComponent={UI} driverId='6' />)
    await waitFor(() => expect(readState().loading).toBe(false))
    expect(JSON.parse(queryOf(fetchMock.mock.calls[0]).get('where'))).toEqual([{ attribute: 'driver_id', value: 6 }])
    unmount()

    render(<PayoutsList UIComponent={UI} />)
    await waitFor(() => expect(readState().loading).toBe(false))
    expect(queryOf(fetchMock.mock.calls[1]).has('where')).toBe(false)
  })

  it('changes page, and goes back to the first one when the page size changes', async () => {
    fetchMock
      .mockResolvedValueOnce(answer([payout], { current_page: 1, page_size: 10, total: 30, total_pages: 3 }))
      .mockResolvedValueOnce(answer([payout], { current_page: 2, page_size: 10, total: 30, total_pages: 3 }))
      .mockResolvedValueOnce(answer([payout], { current_page: 1, page_size: 25, total: 30, total_pages: 2 }))

    render(<PayoutsList UIComponent={UI} businessId={41} />)
    await waitFor(() => expect(readState().loading).toBe(false))

    await act(async () => { screen.getByText('next').click() })
    expect(queryOf(fetchMock.mock.calls[1]).get('page')).toBe('2')
    expect(readPagination().currentPage).toBe(2)

    await act(async () => { screen.getByText('size').click() })
    const query = queryOf(fetchMock.mock.calls[2])
    expect(query.get('page')).toBe('1')
    expect(query.get('page_size')).toBe('25')
    expect(readPagination()).toEqual({ currentPage: 1, pageSize: 25, totalItems: 30, totalPages: 2 })
  })

  it('ignores a page that arrives after a newer one', async () => {
    let answerPrevious
    fetchMock
      .mockResolvedValueOnce(answer([payout], { current_page: 1, page_size: 10, total: 30, total_pages: 3 }))
      .mockReturnValueOnce(new Promise(resolve => { answerPrevious = resolve }))
      .mockResolvedValueOnce(answer([{ ...payout, id: 9 }], { current_page: 2, page_size: 10, total: 30, total_pages: 3 }))

    render(<PayoutsList UIComponent={UI} businessId={41} />)
    await waitFor(() => expect(readState().loading).toBe(false))

    act(() => { screen.getByText('next').click() })
    await act(async () => { screen.getByText('next').click() })
    await waitFor(() => expect(readState().payouts.map(item => item.id)).toEqual([9]))

    await act(async () => {
      answerPrevious(answer([{ ...payout, id: 4 }], { current_page: 2, page_size: 10, total: 30, total_pages: 3 }))
    })
    expect(readState().payouts.map(item => item.id)).toEqual([9])
    expect(readPagination().currentPage).toBe(2)
  })

  it('keeps the error of a list that could not be read', async () => {
    fetchMock.mockResolvedValue(answer(['Not allowed'], undefined, true))

    render(<PayoutsList UIComponent={UI} businessId={41} />)

    await waitFor(() => expect(readState().loading).toBe(false))
    expect(readState()).toEqual({ loading: false, error: ['Not allowed'], payouts: [] })
  })
})
