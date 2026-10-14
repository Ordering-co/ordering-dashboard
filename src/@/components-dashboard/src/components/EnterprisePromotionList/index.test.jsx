import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { EnterprisePromotionList } from './index'

vi.mock('../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test' }] }))
vi.mock('../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'test-token', user: { level: 0 } }] }))
vi.mock('../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (key, fallback) => fallback || key] }))
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => [{}, { showToast: vi.fn() }], ToastType: {} }))

const offers = Array.from({ length: 23 }, (_, index) => ({ id: index + 1, name: `Offer ${index + 1}` }))
let exposed

const Probe = props => {
  exposed = props
  return (
    <>
      <input aria-label='Search promotions' onChange={event => props.onSearch(event.target.value)} />
      <button onClick={() => props.getPromotions(2, props.paginationProps.pageSize)}>Next page</button>
      <button onClick={() => props.getPromotions(1, props.paginationProps.pageSize)}>Refresh first page</button>
      <ol>{props.promotionListState.promotions.map(offer => <li key={offer.id}>{offer.name}</li>)}</ol>
      <span>Page {props.paginationProps.currentPage}</span>
      {props.promotionListState.error && <div role='alert'>{props.promotionListState.error.join(', ')}</div>}
    </>
  )
}

const offerRequests = () => global.fetch.mock.calls.map(([url]) => new URL(url)).filter(url => url.pathname === '/offers')

beforeEach(() => {
  exposed = null
  global.fetch = vi.fn(async endpoint => {
    const url = new URL(endpoint)
    if (url.pathname !== '/offers') return { json: async () => ({ error: false, result: [] }) }
    const page = Number(url.searchParams.get('page'))
    const pageSize = Number(url.searchParams.get('page_size'))
    const sorted = url.searchParams.get('orderBy') === '-id' ? [...offers].reverse() : offers
    return {
      json: async () => ({
        error: false,
        result: sorted.slice((page - 1) * pageSize, page * pageSize),
        pagination: { current_page: page, page_size: pageSize, total: 23, total_pages: Math.ceil(23 / pageSize), from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, 23) }
      })
    }
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('EnterprisePromotionList server ordering', () => {
  test('requests newest first before pagination and preserves it through search and refresh', async () => {
    render(<EnterprisePromotionList UIComponent={Probe} orderBy='-id' paginationSettings={{ initialPage: 1, pageSize: 10, controlType: 'pages' }} isSearchByPromotionName />)
    await waitFor(() => expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual(['Offer 23', 'Offer 22', 'Offer 21', 'Offer 20', 'Offer 19', 'Offer 18', 'Offer 17', 'Offer 16', 'Offer 15', 'Offer 14']))
    fireEvent.click(screen.getByText('Next page'))
    await screen.findByText('Page 2')
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Offer 13')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Offer' } })
    await screen.findByText('Page 1')
    expect(offerRequests().at(-1).searchParams.get('where')).toContain('Offer')
    fireEvent.click(screen.getByText('Refresh first page'))
    await waitFor(() => expect(offerRequests()).toHaveLength(4))
    expect(offerRequests().map(url => url.searchParams.get('orderBy'))).toEqual(['-id', '-id', '-id', '-id'])
    expect(offerRequests().map(url => url.searchParams.get('page_size'))).toEqual(['10', '10', '10', '10'])
    expect(offerRequests().map(url => url.searchParams.get('page'))).toEqual(['1', '2', '1', '1'])
  })

  test('omitting ordering preserves the legacy page, page size and server order', async () => {
    render(<EnterprisePromotionList UIComponent={Probe} paginationSettings={{ initialPage: 3, pageSize: 5, controlType: 'pages' }} />)
    await screen.findByText('Offer 11')
    expect(offerRequests()[0].searchParams.has('orderBy')).toBe(false)
    expect(offerRequests()[0].searchParams.get('page')).toBe('3')
    expect(offerRequests()[0].searchParams.get('page_size')).toBe('5')
    fireEvent.click(screen.getByText('Next page'))
    await screen.findByText('Page 2')
    expect(offerRequests()[1].searchParams.has('orderBy')).toBe(false)
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Offer 6')
  })

  test('retains ordered query on API error and retry and accepts an empty result', async () => {
    render(<EnterprisePromotionList UIComponent={Probe} orderBy='-id' />)
    await screen.findByText('Offer 23')
    global.fetch.mockResolvedValueOnce({ json: async () => ({ error: true, result: ['Temporary failure'] }) })
    await act(async () => exposed.getPromotions(2, 10))
    expect(screen.getByRole('alert')).toHaveTextContent('Temporary failure')
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Offer 23')
    await act(async () => exposed.getPromotions(2, 10))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Offer 13')
    global.fetch.mockResolvedValueOnce({ json: async () => ({ error: false, result: [], pagination: { current_page: 1, page_size: 10, total: 0, total_pages: 0, from: 0, to: 0 } }) })
    await act(async () => exposed.getPromotions(1, 10))
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(offerRequests().map(url => url.searchParams.get('orderBy'))).toEqual(['-id', '-id', '-id', '-id'])
  })
})
