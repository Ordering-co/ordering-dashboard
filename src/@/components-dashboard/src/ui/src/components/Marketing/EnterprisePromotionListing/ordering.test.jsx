import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { EnterprisePromotionListing } from './index'

vi.mock('../../../../../contexts/ApiContext', () => ({ useApi: () => [{ root: 'https://api.test' }] }))
vi.mock('../../../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'test-token', user: { level: 0 } }] }))
vi.mock('../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, (key, fallback) => fallback || key] }))
vi.mock('../../../../../contexts/ToastContext', () => ({ useToast: () => [{}, { showToast: vi.fn() }], ToastType: {} }))
vi.mock('../../../../../index', async () => ({
  EnterprisePromotionList: (await vi.importActual('../../../../../components/EnterprisePromotionList')).EnterprisePromotionList,
  useConfig: () => [{ configs: {} }],
  useLanguage: () => [{}, (key, fallback) => fallback || key],
  useSession: () => [{ user: { level: 0 } }]
}))
vi.mock('../../../contexts/InfoShareContext', () => ({ useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }] }))
vi.mock('../../Shared', () => ({ Alert: () => null, LearnDropDown: () => null, SearchBar: () => null, SideBar: () => null }))
vi.mock('../EnterprisePromotionDetails', () => ({ EnterprisePromotionDetails: () => null }))
vi.mock('../PromotionJourneysListing', () => ({
  PromotionJourneysListingUI: ({ promotionListState, getPromotions }) => (
    <section aria-label='Your promotions'>
      {promotionListState.promotions.map(offer => <p key={offer.id}>{offer.name}</p>)}
      <button onClick={() => getPromotions(2, 10)}>Next promotions page</button>
    </section>
  )
}))
vi.mock('../EnterprisePromotionList', () => ({
  EnterprisePromotionList: ({ promotionListState }) => (
    <section aria-label='Advanced promotions'>{promotionListState.promotions.map(offer => <p key={offer.id}>{offer.name}</p>)}</section>
  )
}))

const renderWorkspace = entry => render(
  <ThemeProvider theme={{ colors: { primary: '#266DF0', lightPrimary: '#EAF1FE', backgroundPage: '#FFFFFF', headingColor: '#0B0C0D', borderColor: '#DEE0E3' } }}>
    <MemoryRouter initialEntries={[entry]}>
      <EnterprisePromotionListing isUseQuery />
    </MemoryRouter>
  </ThemeProvider>
)
const offerRequests = () => global.fetch.mock.calls.map(([url]) => new URL(url)).filter(url => url.pathname === '/offers')
const responseFor = (name, page = 1, pageSize = 10) => ({ json: async () => ({ error: false, result: [{ id: name === 'Newest offer' ? 23 : 1, name }], pagination: { current_page: page, page_size: pageSize, total: 23, total_pages: Math.ceil(23 / pageSize) } }) })

beforeEach(() => {
  global.fetch = vi.fn(async endpoint => {
    const url = new URL(endpoint)
    if (url.pathname !== '/offers') return { json: async () => ({ error: false, result: [] }) }
    return responseFor(url.searchParams.get('orderBy') === '-id' ? 'Newest offer' : 'Legacy offer', Number(url.searchParams.get('page')), Number(url.searchParams.get('page_size')))
  })
})

describe('Promotion workspace ordering integration', () => {
  test('Quick offers uses descending server order on every page and Advanced offers retains its own order', async () => {
    renderWorkspace('/marketing/promotions-enterprise')
    await screen.findByText('Newest offer')
    fireEvent.click(screen.getByText('Next promotions page'))
    await waitFor(() => expect(offerRequests()).toHaveLength(2))
    expect(offerRequests().map(url => url.searchParams.get('orderBy'))).toEqual(['-id', '-id'])
    fireEvent.click(screen.getByRole('tab', { name: 'Advanced offers' }))
    await screen.findByText('Legacy offer')
    expect(offerRequests().at(-1).searchParams.has('orderBy')).toBe(false)
    fireEvent.click(screen.getByRole('tab', { name: 'Quick offers' }))
    await screen.findByText('Newest offer')
    expect(offerRequests().at(-1).searchParams.get('page')).toBe('1')
    expect(offerRequests().at(-1).searchParams.get('orderBy')).toBe('-id')
  })

  test('legacy URL pagination remains unchanged', async () => {
    renderWorkspace('/marketing/promotions-enterprise?view=advanced_offers&page=3&pageSize=5')
    await screen.findByText('Legacy offer')
    const request = offerRequests()[0]
    expect(request.searchParams.has('orderBy')).toBe(false)
    expect(request.searchParams.get('page')).toBe('3')
    expect(request.searchParams.get('page_size')).toBe('5')
  })

  test('switching views dispatches the new query while the old request is pending and ignores its late result', async () => {
    let resolveOld
    let firstOfferRequest = true
    global.fetch.mockImplementation(async endpoint => {
      const url = new URL(endpoint)
      if (url.pathname !== '/offers') return { json: async () => ({ error: false, result: [] }) }
      if (firstOfferRequest) {
        firstOfferRequest = false
        return new Promise(resolve => { resolveOld = resolve })
      }
      return responseFor('Legacy offer')
    })
    renderWorkspace('/marketing/promotions-enterprise')
    fireEvent.click(screen.getByRole('tab', { name: 'Advanced offers' }))
    await screen.findByText('Legacy offer')
    await act(async () => resolveOld(responseFor('Late Quick offer')))
    expect(screen.getByText('Legacy offer')).toBeInTheDocument()
    expect(screen.queryByText('Late Quick offer')).toBeNull()
    expect(offerRequests()).toHaveLength(2)
  })
})
