/* eslint-disable import/first */
// redesign reviews FD2 (D1, D2, D6, D7, D9; RV-01, RV-07, RV-10, RV-11, RV-15): the page of /intelligence/reviews. The lists (D1), the
// panels (C), the store picker (A2) and the CSV dialog are other pieces and are stand-ins here that record what they receive; what is
// tested is how the page composes them and what it owns: the tab, the URL, the open record, the search and the focus. The Product
// wrappers the page is made of (PageHeader, Tabs, FilterBar, SearchField, SplitView, EmptyState) are the real ones.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scanSource } from '../../../../../../../../../../scripts/product-ui/literal-guard.mjs'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const seen = vi.hoisted(() => ({
  business: null,
  users: [],
  products: null,
  businessPanel: null,
  userPanel: null,
  productPanel: null,
  store: null,
  exportCsv: null,
  learn: null,
  businessLookups: []
}))
const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))
const lookup = vi.hoisted(() => ({ name: 'Casa Pepe', fail: false, pending: false, resolve: null }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
  useApi: () => [{
    businesses: (id) => {
      const call = { id }
      seen.businessLookups.push(call)
      const chain = {
        select: (fields) => { call.select = fields; return chain },
        get: () => {
          call.get = true
          if (lookup.pending) return new Promise(resolve => { lookup.resolve = () => resolve({ content: { result: { id, name: lookup.name } } }) })
          if (lookup.fail) return Promise.reject(new Error('network'))
          return Promise.resolve({ content: { result: { id, name: lookup.name } } })
        }
      }
      return chain
    }
  }]
}))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))
vi.mock('../../../Shared/LearnDropDown', () => ({
  LearnDropDown: (props) => {
    seen.learn = props
    return <button type='button'>Learn</button>
  }
}))
vi.mock('../../AnalyticsKit/StorePicker', () => ({
  StorePicker: (props) => {
    seen.store = props
    return (
      <div role='group' aria-label='Store stand-in' data-default-open={String(Boolean(props.defaultOpen))} data-include-inactive={String(Boolean(props.includeInactive))}>
        <span data-testid='store-pill'>{props.business.selected ? props.business.selected.name : (props.business.restoring ? 'Loading' : 'Select business')}</span>
        <button type='button' onClick={() => props.business.select({ id: 9, name: 'Cafe Nuevo', external_id: 'z' })}>Choose Cafe Nuevo</button>
      </div>
    )
  }
}))
vi.mock('../ReviewsExport', () => ({
  ReviewsExport: (props) => {
    seen.exportCsv = props
    return <div data-testid='export' data-open={String(props.open)} data-tab={props.tab} />
  }
}))

const SHOP = { id: 2, name: 'Casa Pepe', address: 'Calle 1', logo: null, reviews: { total: 4.9, reviews_count: 63 } }
const OTHER = { id: 3, name: 'Cafe Viejo', address: 'Calle 2', logo: null, reviews: { total: 0 } }
const DRIVER = { id: 7, name: 'Ana', lastname: 'Ruiz', email: 'ana@example.com', qualification: 4.5 }
const PRODUCT = { id: 100, name: 'Burger', images: null, category: { id: 5 }, reviews: { total: 4 } }

vi.mock('../../BusinessReviewList', () => ({
  BusinessReviewList: (props) => {
    seen.business = props
    return (
      <div role='region' aria-label='Business list' data-search={String(props.parentSearchValue)}>
        {[SHOP, OTHER].map(row => (
          <div key={row.id} data-row-id={row.id} tabIndex={-1} data-active={String(props.activeId === row.id)}>
            <button type='button' onClick={() => props.onOpenRow(row)}>Open business {row.id}</button>
          </div>
        ))}
      </div>
    )
  }
}))
vi.mock('../../UsersReviewList', () => ({
  UsersReviewList: (props) => {
    seen.users.push(props)
    return (
      <div role='region' aria-label={`Users list ${props.defaultUserTypesSelected.join(',')}`} data-search={String(props.parentSearchValue)}>
        <div data-row-id={DRIVER.id} tabIndex={-1}>
          <button type='button' onClick={() => props.onOpenRow(DRIVER)}>Open user {DRIVER.id}</button>
        </div>
      </div>
    )
  }
}))
vi.mock('../../ReviewProductsListing', () => ({
  ReviewProductsListing: (props) => {
    seen.products = props
    return (
      <div role='region' aria-label={`Products of ${props.businessId}`} data-search={String(props.parentSearchValue)}>
        <div data-row-id={PRODUCT.id} tabIndex={-1}>
          <button type='button' onClick={() => props.onOpenRow(PRODUCT)}>Open product {PRODUCT.id}</button>
        </div>
      </div>
    )
  }
}))
vi.mock('../../BusinessReviewDetails', () => ({
  BusinessReviewDetails: (props) => {
    seen.businessPanel = props
    return (
      <div data-testid='business-panel'>
        <span>Panel of business {props.businessId}</span>
        <span data-testid='business-panel-row'>{props.business ? props.business.name : 'no row'}</span>
        <button type='button' onClick={props.onClose}>Close panel</button>
        <button type='button' onClick={() => props.onExpandedChange(!props.expanded)}>Expand</button>
        <button type='button' onClick={() => props.onOpenProducts({ id: props.businessId, name: 'Casa Pepe' })}>Product reviews</button>
      </div>
    )
  }
}))
vi.mock('../../UserReviewDetails', () => ({
  UserReviewDetails: (props) => {
    seen.userPanel = props
    return (
      <div data-testid='user-panel'>
        <span>Panel of user {props.userId}</span>
        <button type='button' onClick={props.onClose}>Close panel</button>
        <button type='button' onClick={() => props.onExpandedChange(!props.expanded)}>Expand</button>
      </div>
    )
  }
}))
vi.mock('../../ProductReviewDetails', () => ({
  ProductReviewDetails: (props) => {
    seen.productPanel = props
    return (
      <div data-testid='product-panel'>
        <span>Panel of product {props.productId} of {props.businessId} in {props.categoryId}</span>
        <button type='button' onClick={props.onClose}>Close panel</button>
      </div>
    )
  }
}))

import { ReviewsListing } from '../../ReviewsListing'

const ROUTE = '/intelligence/reviews'
const params = () => Object.fromEntries(new URLSearchParams(window.location.search))

const renderPage = (search = '', props = {}) => {
  window.history.replaceState(null, '', `${ROUTE}${search}`)
  return renderWithProviders(<ReviewsListing isUseQuery {...props} />, { initialEntries: [`${ROUTE}${search}`] })
}

// jsdom answers matchMedia with `matches: false`: the split view reads (min|max)-width queries, so one is installed that evaluates
// them against a width (1440: the split mode, the panel sits beside the list)
const installViewport = (width) => {
  const original = { matchMedia: window.matchMedia, innerWidth: window.innerWidth }
  const matches = query => query.split(/\s+and\s+/).every(part => {
    const [, kind, value] = part.match(/\(\s*(min|max)-width:\s*(\d+)px\s*\)/) || []
    if (!kind) return false
    return kind === 'min' ? width >= Number(value) : width <= Number(value)
  })
  window.matchMedia = query => ({
    media: query,
    get matches () { return matches(query) },
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {}
  })
  window.innerWidth = width
  return () => Object.assign(window, original)
}

class FakeResizeObserver {
  observe () {}
  unobserve () {}
  disconnect () {}
}

const tabOf = (name) => screen.getByRole('tab', { name })
const exportButton = () => screen.queryByRole('button', { name: 'Export CSV' })

let restoreViewport
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  restoreViewport = installViewport(1440)
  window.localStorage.clear()
  infoShare.isCollapse = false
  infoShare.handleMenuCollapse.mockClear()
  Object.assign(seen, { business: null, users: [], products: null, businessPanel: null, userPanel: null, productPanel: null, store: null, exportCsv: null, learn: null, businessLookups: [] })
  Object.assign(lookup, { name: 'Casa Pepe', fail: false, pending: false, resolve: null })
})

afterEach(() => {
  cleanup()
  restoreViewport()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
  document.getElementById('app-modals')?.remove()
})

describe('the header and the tabs', () => {
  it('has the title, Learn with the two entries of main, and the five tabs in the order of main, wrapping', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Reviews manager' })).toHaveClass('odc-pagehead-title')
    expect(screen.getByRole('button', { name: 'Learn' })).toBeInTheDocument()
    expect(seen.learn.learnOptions).toHaveLength(2)
    const list = screen.getByRole('tablist', { name: 'Reviews of' })
    expect(within(list).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Business', 'Drivers', 'Customers', 'Professionals', 'Products'])
    expect(list.closest('.odc-tabs')).toHaveAttribute('data-wrap', 'true')
    expect(tabOf('Business')).toHaveAttribute('aria-selected', 'true')
  })

  it('is one line: no menu button unless the sidebar is collapsed, and then it opens it', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    cleanup()
    infoShare.isCollapse = true
    renderPage()
    const opener = screen.getByRole('button', { name: 'Open menu' })
    // the opener is PageHeader's `leading`, the first child of the title block
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await user.click(opener)
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it('Export CSV is there only in the Business and Drivers tabs, as main', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(exportButton()).toBeInTheDocument()
    await user.click(tabOf('Drivers'))
    expect(exportButton()).toBeInTheDocument()
    for (const name of ['Customers', 'Professionals', 'Products']) {
      await user.click(tabOf(name))
      expect(exportButton(), name).toBeNull()
    }
    await user.click(tabOf('Business'))
    expect(exportButton()).toBeInTheDocument()
  })

  it('Export CSV opens the dialog for the tab that is on', async () => {
    const user = userEvent.setup()
    renderPage('?tab=drivers')
    expect(screen.getByTestId('export')).toHaveAttribute('data-open', 'false')
    await user.click(exportButton())
    expect(screen.getByTestId('export')).toHaveAttribute('data-open', 'true')
    expect(screen.getByTestId('export')).toHaveAttribute('data-tab', 'drivers')
    act(() => seen.exportCsv.onOpenChange(false))
    expect(screen.getByTestId('export')).toHaveAttribute('data-open', 'false')
  })
})

describe('the tabs and the URL', () => {
  it.each([
    ['business', 'Business list'],
    ['drivers', 'Users list 4'],
    ['customers', 'Users list 3'],
    ['professionals', 'Users list 8']
  ])('?tab=%s shows its list', (tab, region) => {
    renderPage(`?tab=${tab}`)
    expect(screen.getByRole('region', { name: region })).toBeInTheDocument()
    expect(params().tab).toBe(tab)
  })

  it('without ?tab it is Business and adds tab=business', () => {
    renderPage()
    expect(screen.getByRole('region', { name: 'Business list' })).toBeInTheDocument()
    expect(params().tab).toBe('business')
  })

  it('RV-15: the first load without ?tab keeps ?id, ?page and ?pageSize (it only adds tab)', () => {
    renderPage('?id=2&page=3&pageSize=25')
    expect(params()).toEqual({ id: '2', page: '3', pageSize: '25', tab: 'business' })
    expect(seen.business.paginationSettings).toEqual({ initialPage: 3, pageSize: 25, controlType: 'pages' })
  })

  it('a tab that is not one of the five is Business', () => {
    renderPage('?tab=nope')
    expect(screen.getByRole('region', { name: 'Business list' })).toBeInTheDocument()
    expect(params().tab).toBe('business')
  })

  it('changing the tab removes the parameters of main, writes tab and closes the panel', async () => {
    const user = userEvent.setup()
    renderPage('?tab=business&page=3&pageSize=25&id=2&business=4&category=5&product=6')
    expect(await screen.findByTestId('business-panel')).toBeInTheDocument()
    await user.click(tabOf('Drivers'))
    expect(params()).toEqual({ tab: 'drivers' })
    expect(screen.queryByTestId('business-panel')).toBeNull()
    expect(screen.getByRole('region', { name: 'Users list 4' })).toBeInTheDocument()
  })

  it('the tab that is already selected does nothing', async () => {
    const user = userEvent.setup()
    renderPage('?tab=business&page=3&pageSize=25&id=2')
    await user.click(tabOf('Business'))
    expect(params()).toEqual({ tab: 'business', page: '3', pageSize: '25', id: '2' })
    expect(screen.getByTestId('business-panel')).toBeInTheDocument()
  })

  it('after the first change the lists no longer take the page of the URL', async () => {
    const user = userEvent.setup()
    renderPage('?tab=business&page=3&pageSize=25')
    expect(seen.business.paginationSettings).toEqual({ initialPage: 3, pageSize: 25, controlType: 'pages' })
    await user.click(tabOf('Drivers'))
    const drivers = seen.users[seen.users.length - 1]
    expect(drivers.defaultUserTypesSelected).toEqual([4])
    expect(drivers.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
    expect(drivers.isUseQuery).toBe(true)
  })

  it('the first load hands the drivers list the page and size of the URL, and the three user tabs their own types', async () => {
    const user = userEvent.setup()
    renderPage('?tab=drivers&page=2&pageSize=50')
    expect(seen.users[seen.users.length - 1].paginationSettings).toEqual({ initialPage: 2, pageSize: 50, controlType: 'pages' })
    await user.click(tabOf('Customers'))
    expect(seen.users[seen.users.length - 1].defaultUserTypesSelected).toEqual([3])
    await user.click(tabOf('Professionals'))
    expect(seen.users[seen.users.length - 1].defaultUserTypesSelected).toEqual([8])
  })

  it('without isUseQuery the lists do not read the URL', () => {
    renderPage('?tab=business&page=3&pageSize=25', { isUseQuery: false })
    expect(seen.business.isUseQuery).toBe(false)
    expect(seen.business.paginationSettings).toEqual({ initialPage: 1, pageSize: 10, controlType: 'pages' })
  })
})

describe('the panel of a business or a user', () => {
  it('opening a row opens its panel beside the list, writes ?id and marks the row', async () => {
    const user = userEvent.setup()
    renderPage('?tab=business')
    await user.click(screen.getByRole('button', { name: 'Open business 2' }))
    expect(params().id).toBe('2')
    expect(screen.getByText('Panel of business 2')).toBeInTheDocument()
    expect(seen.businessPanel).toMatchObject({ businessId: 2, business: SHOP, expanded: false })
    expect(seen.business.activeId).toBe(2)
  })

  it('opens the panel of ?id on the first load, even without ?tab, with no row (the panel loads it)', async () => {
    renderPage('?id=2')
    expect(await screen.findByText('Panel of business 2')).toBeInTheDocument()
    expect(screen.getByTestId('business-panel-row')).toHaveTextContent('no row')
    expect(seen.business.activeId).toBe(2)
  })

  it('opens the panel of a driver with ?tab=drivers&id=7', async () => {
    renderPage('?tab=drivers&id=7')
    expect(await screen.findByText('Panel of user 7')).toBeInTheDocument()
    expect(seen.userPanel).toMatchObject({ userId: 7 })
  })

  it('closing removes ?id and gives the focus back to the row', async () => {
    const user = userEvent.setup()
    renderPage('?tab=business')
    await user.click(screen.getByRole('button', { name: 'Open business 3' }))
    await user.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(params().id).toBeUndefined()
    expect(screen.queryByTestId('business-panel')).toBeNull()
    await waitFor(() => expect(document.activeElement?.closest('[data-row-id]')?.getAttribute('data-row-id')).toBe('3'))
  })

  it('«Open as page» expands the panel and closing puts it back', async () => {
    const user = userEvent.setup()
    renderPage('?tab=business')
    await user.click(screen.getByRole('button', { name: 'Open business 2' }))
    await user.click(screen.getByRole('button', { name: 'Expand' }))
    expect(seen.businessPanel.expanded).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Close panel' }))
    await user.click(screen.getByRole('button', { name: 'Open business 2' }))
    expect(seen.businessPanel.expanded).toBe(false)
  })

  it('another row replaces the panel', async () => {
    const user = userEvent.setup()
    renderPage('?tab=business')
    await user.click(screen.getByRole('button', { name: 'Open business 2' }))
    await user.click(screen.getByRole('button', { name: 'Open business 3' }))
    expect(screen.getByText('Panel of business 3')).toBeInTheDocument()
    expect(params().id).toBe('3')
  })

  it('the user panel can be expanded too', async () => {
    const user = userEvent.setup()
    renderPage('?tab=customers')
    await user.click(screen.getByRole('button', { name: 'Open user 7' }))
    await user.click(screen.getByRole('button', { name: 'Expand' }))
    expect(seen.userPanel.expanded).toBe(true)
    expect(params().id).toBe('7')
  })
})

describe('Products and «Product reviews» (RV-01)', () => {
  it('«Product reviews» in the panel of a business goes to Products with that business', async () => {
    const user = userEvent.setup()
    renderPage('?tab=business&page=3&pageSize=25')
    await user.click(screen.getByRole('button', { name: 'Open business 2' }))
    await user.click(screen.getByRole('button', { name: 'Product reviews' }))
    expect(params()).toEqual({ tab: 'products', business: '2' })
    expect(screen.queryByTestId('business-panel')).toBeNull()
    expect(tabOf('Products')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('region', { name: 'Products of 2' })).toBeInTheDocument()
    expect(seen.products.businessId).toBe(2)
    expect(screen.getByTestId('store-pill')).toHaveTextContent('Casa Pepe')
    expect(seen.products.defaultPage).toBe(1)
    expect(seen.products.defaultPageSize).toBe(10)
  })

  it('RV-07: Products without a business shows the empty state and the picker open', async () => {
    const user = userEvent.setup()
    renderPage('?tab=business')
    await user.click(tabOf('Products'))
    expect(screen.getByText('Choose a business to see its product reviews')).toBeInTheDocument()
    expect(seen.products).toBeNull()
    expect(screen.getByRole('group', { name: 'Store stand-in' })).toHaveAttribute('data-default-open', 'true')
    expect(screen.getByRole('group', { name: 'Store stand-in' })).toHaveAttribute('data-include-inactive', 'true')
    expect(params()).toEqual({ tab: 'products' })
  })

  it('the picker is only in the Products tab', async () => {
    const user = userEvent.setup()
    renderPage('?tab=business')
    expect(screen.queryByRole('group', { name: 'Store stand-in' })).toBeNull()
    await user.click(tabOf('Products'))
    expect(screen.getByRole('group', { name: 'Store stand-in' })).toBeInTheDocument()
    await user.click(tabOf('Drivers'))
    expect(screen.queryByRole('group', { name: 'Store stand-in' })).toBeNull()
  })

  it('RV-11: ?business= on the load sets the business, asks its name once and the pill says Loading meanwhile', async () => {
    lookup.pending = true
    renderPage('?tab=products&business=2')
    expect(screen.getByTestId('store-pill')).toHaveTextContent('Loading')
    expect(screen.getByRole('region', { name: 'Products of 2' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Store stand-in' })).toHaveAttribute('data-default-open', 'false')
    expect(seen.businessLookups).toEqual([{ id: 2, select: ['name'], get: true }])
    await act(async () => { lookup.resolve() })
    await waitFor(() => expect(screen.getByTestId('store-pill')).toHaveTextContent('Casa Pepe'))
    expect(seen.businessLookups).toHaveLength(1)
  })

  it('a business whose name cannot be read is named by its number', async () => {
    lookup.fail = true
    renderPage('?tab=products&business=2')
    await waitFor(() => expect(screen.getByTestId('store-pill')).toHaveTextContent('#2'))
  })

  it('choosing another business writes ?business and drops page, pageSize, category and product', async () => {
    const user = userEvent.setup()
    renderPage('?tab=products&business=2&page=3&pageSize=25&category=5&product=100')
    expect(await screen.findByTestId('product-panel')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Choose Cafe Nuevo' }))
    expect(params()).toEqual({ tab: 'products', business: '9' })
    expect(screen.getByRole('region', { name: 'Products of 9' })).toBeInTheDocument()
    expect(screen.queryByTestId('product-panel')).toBeNull()
    expect(screen.getByTestId('store-pill')).toHaveTextContent('Cafe Nuevo')
    expect(seen.products.defaultPage).toBe(1)
  })

  it('a late answer about the business of the URL does not undo a business chosen meanwhile', async () => {
    const user = userEvent.setup()
    lookup.pending = true
    renderPage('?tab=products&business=2')
    await user.click(screen.getByRole('button', { name: 'Choose Cafe Nuevo' }))
    await act(async () => { lookup.resolve() })
    expect(screen.getByTestId('store-pill')).toHaveTextContent('Cafe Nuevo')
  })

  it('opening a product writes ?category and ?product; closing removes them and gives the focus back', async () => {
    const user = userEvent.setup()
    renderPage('?tab=products&business=2')
    await user.click(screen.getByRole('button', { name: 'Open product 100' }))
    expect(params()).toMatchObject({ tab: 'products', business: '2', category: '5', product: '100' })
    expect(seen.productPanel).toMatchObject({ businessId: 2, categoryId: 5, productId: 100, product: PRODUCT })
    expect(seen.products.activeId).toBe(100)
    expect(seen.productPanel.onExpandedChange).toBeUndefined()
    await user.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(params()).toEqual({ tab: 'products', business: '2' })
    await waitFor(() => expect(document.activeElement?.closest('[data-row-id]')?.getAttribute('data-row-id')).toBe('100'))
  })

  it('?category=&product= on the load opens the panel of the product', async () => {
    renderPage('?tab=products&business=2&category=5&product=100')
    expect(await screen.findByText('Panel of product 100 of 2 in 5')).toBeInTheDocument()
    expect(seen.productPanel.product).toBeNull()
  })

  it('coming back to Products with a business already chosen writes it in the URL again', async () => {
    const user = userEvent.setup()
    renderPage('?tab=products&business=2')
    await user.click(tabOf('Drivers'))
    expect(params()).toEqual({ tab: 'drivers' })
    await user.click(tabOf('Products'))
    expect(params()).toEqual({ tab: 'products', business: '2' })
    expect(screen.getByRole('region', { name: 'Products of 2' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Store stand-in' })).toHaveAttribute('data-default-open', 'false')
  })
})

describe('the search', () => {
  it('is one box for every tab, with no search at first', () => {
    renderPage()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
    expect(seen.business.parentSearchValue).toBeNull()
  })

  it('what is typed reaches the list as parentSearchValue after 750 ms, not before', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'pepe')
    expect(seen.business.parentSearchValue).toBeNull()
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 500)) })
    expect(seen.business.parentSearchValue).toBeNull()
    await waitFor(() => expect(seen.business.parentSearchValue).toBe('pepe'), { timeout: 2000 })
  })

  it('is not cleared when the tab changes: the next list gets it', async () => {
    const user = userEvent.setup()
    renderPage()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: 'ana' } })
    await waitFor(() => expect(seen.business.parentSearchValue).toBe('ana'), { timeout: 2000 })
    await user.click(tabOf('Drivers'))
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('ana')
    expect(seen.users[seen.users.length - 1].parentSearchValue).toBe('ana')
    await user.click(tabOf('Customers'))
    expect(seen.users[seen.users.length - 1].parentSearchValue).toBe('ana')
  })

  it('the clear button empties the box and the lists get the empty search', async () => {
    const user = userEvent.setup()
    renderPage()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: 'ana' } })
    await waitFor(() => expect(seen.business.parentSearchValue).toBe('ana'), { timeout: 2000 })
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('')
    await waitFor(() => expect(seen.business.parentSearchValue).toBe(''), { timeout: 2000 })
  })
})

describe('the sources of the page', () => {
  const base = path.join(__dirname, '..', '..')

  it('have no literal color, size, weight, duration or z-index', () => {
    for (const name of ['ReviewsListing/index.js', 'ReviewsDirectory/useReviewsQuery.js', 'ReviewsDirectory/reviews-page.css']) {
      const source = readFileSync(path.join(base, name), 'utf8')
      expect(scanSource(source, name), name).toEqual([])
    }
  })

  it('do not import the pieces the page left (header select, calendar, FirstSelect, Modal, SearchBar, SideBar, styled-components)', () => {
    const source = readFileSync(path.join(base, 'ReviewsListing/index.js'), 'utf8')
    expect(source).not.toMatch(/BusinessSelectHeader|AnalyticsCalendar|FirstSelect|\bModal\b|SearchBar|SideBar|styled-components|from '\.\/styles'/)
  })

  it('the CSS has no physical direction property and only its own odc-rv- classes', () => {
    const css = readFileSync(path.join(base, 'ReviewsDirectory/reviews-page.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css.match(/(?:^|[\s;{])(?:margin|padding|border)-(?:left|right|top|bottom)\s*:|(?:^|[\s;{])(?:left|right|top|bottom|(?:min-|max-)?width|(?:min-|max-)?height)\s*:|text-align\s*:\s*(?:left|right)/gm) ?? []).toEqual([])
  })
})
