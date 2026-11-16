/* eslint-disable import/first */
// redesign reviews FD1 (D1, D3, D9; RV-03, RV-05, RV-08, RV-12): the three lists of /intelligence/reviews. Each is the UIComponent of a
// controller of `main` (DashboardBusinessList, UsersList, ReviewProductList); here it is driven with the props that controller gives
// it. The lists no longer mount the panel: they tell the page which row opens (`onOpenRow`) and draw which one is open (`activeId`).
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `extra[name](index)` gives the props a stub controller adds on top of the ones it receives, where `index` is how many controllers of that
// name were mounted before this one: it lets a test make the first controller fail and the one mounted after «Try again» succeed
const mocks = vi.hoisted(() => ({ phone: false, controllers: {}, mounts: { products: 0, users: 0 }, extra: {} }))

vi.mock('../../../../../../contexts/ConfigContext', () => ({
  useConfig: () => [{ configs: {} }]
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ loading: false, dictionary: {} }, (_key, fallback) => fallback]
}))
vi.mock('../../../../../../index', async () => {
  const { useUtils } = await import('../../../../../../contexts/UtilsContext')
  const React = await import('react')
  const controller = (name) => {
    const Controller = (props) => {
      const { UIComponent, ...rest } = props
      const [index] = React.useState(() => mocks.mounts[name] ?? 0)
      const extra = mocks.extra[name]?.(index) ?? {}
      mocks.controllers[name] = rest
      React.useEffect(() => { if (name in mocks.mounts) mocks.mounts[name] += 1 }, [])
      return UIComponent ? React.createElement(UIComponent, { ...props, ...extra }) : null
    }
    return Controller
  }
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useUtils,
    DashboardBusinessList: controller('business'),
    UsersList: controller('users'),
    ReviewProductList: controller('products')
  }
})
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mocks.phone }))
// The panel is the page's business now: if a list reached for the old side bar, this marker would show
vi.mock('../../../Shared', () => ({
  SideBar: () => <div data-testid='sidebar' />,
  Confirm: () => <div data-testid='confirm' />,
  Pagination: () => <div data-testid='legacy-pagination' />
}))
vi.mock('../../../Shared/SideBar', () => ({ SideBar: () => <div data-testid='sidebar' /> }))

import { UtilsProviders } from '../../../../../../contexts/UtilsContext'
import { BusinessReviewList, BusinessReviewsListingUI } from '../../BusinessReviewList'
import { UsersReviewList, UsersReviewListUI } from '../../UsersReviewList'
import { ReviewProductsListing, ReviewProductsListingUI } from '../../ReviewProductsListing'

class FakeResizeObserver {
  observe () {}
  unobserve () {}
  disconnect () {}
}

const shop = { id: 1, name: 'Casa Pepe', address: 'Calle Mayor 1', logo: null, reviews: { total: 4.9, reviews_count: 63 } }
const other = { id: 2, name: 'Cafe Nuevo', address: 'Plaza 3', logo: null, reviews: { total: 0, reviews_count: 0 } }
const ana = { id: 7, name: 'Ana', lastname: 'Ruiz', email: 'ana@example.com', photo: null, qualification: 4.5 }
const marco = { id: 8, name: 'Marco', lastname: 'Toss', email: 'marco@example.com', photo: null, qualification: 0 }

const products = Array.from({ length: 12 }, (_, index) => ({
  id: 100 + index,
  name: `Product ${index + 1}`,
  images: null,
  category: { id: 5 },
  reviews: { total: 4 }
}))

const wrap = (node) => <UtilsProviders>{node}</UtilsProviders>

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  mocks.phone = false
  mocks.controllers = {}
  mocks.mounts.products = 0
  mocks.mounts.users = 0
  mocks.extra = {}
  window.history.replaceState({}, '', '/intelligence/reviews?tab=business')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.history.replaceState({}, '', '/')
})

const businessProps = (extra = {}) => ({
  businessList: { loading: false, error: null, businesses: [shop, other] },
  pagination: { currentPage: 1, pageSize: 25, total: 60, totalPages: 3, from: 1, to: 25 },
  parentSearchValue: null,
  getPageBusinesses: vi.fn(),
  onSearch: vi.fn(),
  onOpenRow: vi.fn(),
  activeId: undefined,
  isUseQuery: false,
  ...extra
})

const usersProps = (extra = {}) => ({
  usersList: { loading: false, error: null, users: [ana, marco] },
  paginationProps: { currentPage: 1, pageSize: 25, totalPages: 3, totalItems: 60, from: 1, to: 25 },
  parentSearchValue: null,
  getUsers: vi.fn(),
  onSearch: vi.fn(),
  onOpenRow: vi.fn(),
  activeId: undefined,
  defaultUserTypesSelected: [4],
  isUseQuery: false,
  ...extra
})

const productProps = (extra = {}) => ({
  productState: { loading: false, error: null, products },
  handleChangeSearch: vi.fn(),
  searchValue: null,
  parentSearchValue: null,
  businessId: 3,
  isUseQuery: false,
  defaultPage: 1,
  defaultPageSize: 10,
  firstRender: true,
  onRetry: vi.fn(),
  onOpenRow: vi.fn(),
  activeId: undefined,
  ...extra
})

// the names of the rows on screen (not the initials of the avatars that sit beside them)
const rowNames = () => screen.getAllByRole('rowheader').map(header => header.querySelector('.odc-rv-name').textContent)

describe('BusinessReviewList', () => {
  it('draws the businesses with their rating and count, and no panel', () => {
    render(wrap(<BusinessReviewsListingUI {...businessProps()} />))
    expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual(['Business', 'Rating', 'Reviews'])
    expect(rowNames()[0]).toContain('Casa Pepe')
    expect(screen.getByText('63')).toHaveClass('odc-figure')
    expect(screen.queryByTestId('sidebar')).toBeNull()
    expect(screen.queryByTestId('confirm')).toBeNull()
    expect(screen.queryByTestId('legacy-pagination')).toBeNull()
  })

  it('next page asks getPageBusinesses(25, 2): the page size is kept', async () => {
    const props = businessProps()
    render(wrap(<BusinessReviewsListingUI {...props} />))
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(props.getPageBusinesses).toHaveBeenCalledWith(25, 2)
  })

  it('a new page size asks getPageBusinesses(size, page) with the page the foot keeps in view', async () => {
    const props = businessProps({ pagination: { currentPage: 2, pageSize: 25, total: 60, totalPages: 3, from: 26, to: 50 } })
    render(wrap(<BusinessReviewsListingUI {...props} />))
    await userEvent.click(screen.getByRole('button', { name: /Items per page/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '10' }))
    expect(props.getPageBusinesses).toHaveBeenCalledWith(10, 3)
  })

  it('the parent search reaches onSearch (not while it is null)', () => {
    const idle = businessProps()
    const { unmount } = render(wrap(<BusinessReviewsListingUI {...idle} />))
    expect(idle.onSearch).not.toHaveBeenCalled()
    unmount()
    const props = businessProps({ parentSearchValue: 'pepe' })
    const { rerender } = render(wrap(<BusinessReviewsListingUI {...props} />))
    expect(props.onSearch).toHaveBeenCalledWith('pepe')
    rerender(wrap(<BusinessReviewsListingUI {...props} parentSearchValue='' />))
    expect(props.onSearch).toHaveBeenLastCalledWith('')
  })

  it('a click on a row gives the row to onOpenRow; activeId marks the open one', async () => {
    const props = businessProps({ activeId: 2 })
    const { container } = render(wrap(<BusinessReviewsListingUI {...props} />))
    expect(container.querySelector('tr[data-row-id="2"]')).toHaveAttribute('aria-current', 'true')
    await userEvent.click(within(container.querySelector('tr[data-row-id="1"]')).getByText('Casa Pepe'))
    expect(props.onOpenRow).toHaveBeenCalledWith(shop)
  })

  it('a failure draws the error and «Try again» asks the current page again (RV-08)', async () => {
    const props = businessProps({
      businessList: { loading: false, error: ['boom'], businesses: [shop] },
      pagination: { currentPage: 2, pageSize: 25, total: 60, totalPages: 3, from: 26, to: 50 }
    })
    render(wrap(<BusinessReviewsListingUI {...props} />))
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the list.")
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.getPageBusinesses).toHaveBeenCalledWith(25, 2)
  })

  it('with isUseQuery the page and the size go to the URL; without it the URL is left alone', () => {
    render(wrap(<BusinessReviewsListingUI {...businessProps({ isUseQuery: true })} />))
    expect(window.location.search).toContain('page=1')
    expect(window.location.search).toContain('pageSize=25')
    expect(window.location.search).toContain('tab=business')
  })

  it('reads no ?id: the page opens the panel', () => {
    window.history.replaceState({}, '', '/intelligence/reviews?tab=business&id=1')
    const props = businessProps()
    render(wrap(<BusinessReviewsListingUI {...props} />))
    expect(props.onOpenRow).not.toHaveBeenCalled()
    expect(screen.queryByTestId('sidebar')).toBeNull()
  })

  it('the wrapper keeps the props it gave the controller of main', () => {
    // the stub controller hands every prop to the UI, so the lists of the real controller are given here
    render(wrap(<BusinessReviewList {...businessProps()} parentSearchValue='x' paginationSettings={{ pageSize: 10 }} />))
    expect(mocks.controllers.business).toMatchObject({
      noActiveStatusCondition: true,
      asDashboard: true,
      isSearchByBusinessName: true,
      isSearchByBusinessEmail: true,
      isSearchByBusinessPhone: true,
      propsToFetch: ['name', 'logo', 'address', 'reviews', 'slug'],
      paginationSettings: { pageSize: 10 }
    })
  })
})

describe('UsersReviewList', () => {
  it('changing page keeps the page size: getUsers(2, 25), not 10 (RV-12)', async () => {
    const props = usersProps()
    render(wrap(<UsersReviewListUI {...props} />))
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(props.getUsers).toHaveBeenCalledWith(2, 25)
  })

  it('a new page size asks getUsers(page, size)', async () => {
    const props = usersProps({ paginationProps: { currentPage: 2, pageSize: 25, totalPages: 3, totalItems: 60, from: 26, to: 50 } })
    render(wrap(<UsersReviewListUI {...props} />))
    await userEvent.click(screen.getByRole('button', { name: /Items per page/ }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '50' }))
    expect(props.getUsers).toHaveBeenCalledWith(1, 50)
  })

  it('the name header follows the user type: Customer (3), Professional (8), else Driver', () => {
    const titles = {}
    for (const [type, expected] of [[[3], 'Customer'], [[8], 'Professional'], [[4], 'Driver']]) {
      const { unmount } = render(wrap(<UsersReviewListUI {...usersProps({ defaultUserTypesSelected: type })} />))
      titles[expected] = screen.getAllByRole('columnheader').map(header => header.textContent)
      unmount()
    }
    expect(titles.Customer).toEqual(['Customer', 'Rating'])
    expect(titles.Professional).toEqual(['Professional', 'Rating'])
    expect(titles.Driver).toEqual(['Driver', 'Rating'])
  })

  it('draws the note with two decimals and a dash for a note of 0 (RV-03)', () => {
    const { container } = render(wrap(<UsersReviewListUI {...usersProps()} />))
    expect(within(container.querySelector('tr[data-row-id="7"]')).getByText(/^4[.,]50$/)).toHaveClass('odc-figure')
    expect(container.querySelector('tr[data-row-id="8"] td').textContent).toBe('—No data')
  })

  it('the parent search reaches onSearch', () => {
    const props = usersProps({ parentSearchValue: 'ana' })
    render(wrap(<UsersReviewListUI {...props} />))
    expect(props.onSearch).toHaveBeenCalledWith('ana')
  })

  it('a click on a row gives the row to onOpenRow, and no panel is mounted', async () => {
    const props = usersProps({ activeId: 8 })
    const { container } = render(wrap(<UsersReviewListUI {...props} />))
    expect(container.querySelector('tr[data-row-id="8"]')).toHaveAttribute('aria-current', 'true')
    await userEvent.click(within(container.querySelector('tr[data-row-id="7"]')).getByText('Ana Ruiz'))
    expect(props.onOpenRow).toHaveBeenCalledWith(ana)
    expect(screen.queryByTestId('sidebar')).toBeNull()
  })

  it('«Try again» asks the current page again with the current size', async () => {
    const props = usersProps({
      usersList: { loading: false, error: ['boom'], users: [] },
      paginationProps: { currentPage: 3, pageSize: 25, totalPages: 3, totalItems: 60 }
    })
    render(wrap(<UsersReviewListUI {...props} />))
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.getUsers).toHaveBeenCalledWith(3, 25)
  })

  // redesign reviews R1 (Q1-2): UsersList keeps the `error` of the last answer when the next one is good, so asking it again never
  // recovers. «Try again» mounts the controller again (a new key), on the page and size the list had.
  it('«Try again» mounts a new controller on the current page and size, and the new one shows its rows (Q1-2)', async () => {
    mocks.extra.users = (index) => ({ usersList: index === 0 ? { loading: false, error: ['boom'], users: [] } : { loading: false, error: null, users: [ana, marco] } })
    const props = usersProps({ paginationProps: { currentPage: 3, pageSize: 25, totalPages: 3, totalItems: 60 } })
    render(wrap(<UsersReviewList {...props} defaultUserTypesSelected={[3]} paginationSettings={{ pageSize: 10, initialPage: 1, controlType: 'pages' }} />))
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the list.")
    expect(mocks.mounts.users).toBe(1)
    expect(mocks.controllers.users.paginationSettings).toEqual({ pageSize: 10, initialPage: 1, controlType: 'pages' })

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(mocks.mounts.users).toBe(2)
    expect(mocks.controllers.users.paginationSettings).toEqual({ pageSize: 25, initialPage: 3, controlType: 'pages' })
    expect(mocks.controllers.users.defaultUserTypesSelected).toEqual([3])
    expect(props.getUsers).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument()
  })

  it('«Try again» again after another failure mounts a third controller', async () => {
    mocks.extra.users = () => ({ usersList: { loading: false, error: ['boom'], users: [] } })
    render(wrap(<UsersReviewList {...usersProps({ paginationProps: { currentPage: 2, pageSize: 50, totalPages: 3, totalItems: 60 } })} defaultUserTypesSelected={[4]} />))
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(mocks.mounts.users).toBe(3)
    expect(mocks.controllers.users.paginationSettings).toMatchObject({ pageSize: 50, initialPage: 2, controlType: 'pages' })
  })

  it('with isUseQuery the page and the size go to the URL; it reads no ?id', () => {
    window.history.replaceState({}, '', '/intelligence/reviews?tab=drivers&id=7')
    const props = usersProps({ isUseQuery: true })
    render(wrap(<UsersReviewListUI {...props} />))
    expect(window.location.search).toContain('page=1')
    expect(window.location.search).toContain('pageSize=25')
    expect(props.onOpenRow).not.toHaveBeenCalled()
  })

  it('the wrapper keeps the props it gave the controller of main', () => {
    render(wrap(<UsersReviewList {...usersProps()} defaultUserTypesSelected={[3]} paginationSettings={{ pageSize: 10 }} />))
    expect(mocks.controllers.users).toMatchObject({
      isSearchByUserEmail: true,
      isSearchByUserName: true,
      defaultUserTypesSelected: [3],
      propsToFetch: ['name', 'middle_name', 'second_lastname', 'lastname', 'email', 'photo', 'qualification', 'reviews', 'enabled']
    })
  })

  // redesign (row 8, reviews P1): the three tabs list disabled users too (UsersList is shared, so the page opts out of its
  // `enabled` condition with the prop it already has) and ask for `enabled` to draw the «Inactive» label
  it('asks for the disabled users too: disabledActiveStateCondition, and `enabled` among the fields', () => {
    for (const type of [[4], [3], [8]]) {
      const { unmount } = render(wrap(<UsersReviewList {...usersProps()} defaultUserTypesSelected={type} paginationSettings={{ pageSize: 10 }} />))
      expect(mocks.controllers.users.disabledActiveStateCondition).toBe(true)
      expect(mocks.controllers.users.propsToFetch).toContain('enabled')
      unmount()
    }
  })

  it('a disabled user of the list says Inactive', () => {
    render(wrap(<UsersReviewListUI {...usersProps({ usersList: { loading: false, error: null, users: [ana, { ...marco, enabled: false }] } })} />))
    expect(screen.getAllByText('Inactive')).toHaveLength(1)
    expect(screen.getByRole('rowheader', { name: /Marco Toss/ })).toHaveTextContent('Inactive')
  })
})

describe('ReviewProductsListing', () => {
  it('paginates in the client: ten products, then the two that are left', async () => {
    render(wrap(<ReviewProductsListingUI {...productProps()} />))
    expect(rowNames()).toHaveLength(10)
    expect(rowNames()[0]).toContain('Product 1')
    expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual(['Product', 'Rating'])
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(rowNames()).toEqual(['Product 11', 'Product 12'])
  })

  it('a page size of 25 shows all twelve, and with isUseQuery the URL follows', async () => {
    render(wrap(<ReviewProductsListingUI {...productProps({ defaultPageSize: 25, isUseQuery: true })} />))
    expect(rowNames()).toHaveLength(12)
    expect(window.location.search).toContain('pageSize=25')
    expect(window.location.search).toContain('page=1')
  })

  it('the parent search is handed to the controller; a new search goes back to page 1', async () => {
    const props = productProps({ parentSearchValue: 'bur', firstRender: false })
    const { rerender } = render(wrap(<ReviewProductsListingUI {...props} />))
    expect(props.handleChangeSearch).toHaveBeenCalledWith('bur')
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(rowNames()).toEqual(['Product 11', 'Product 12'])
    rerender(wrap(<ReviewProductsListingUI {...props} searchValue='bur' />))
    await waitFor(() => expect(rowNames()).toHaveLength(10))
  })

  it('a click on a row gives the product to onOpenRow; no panel, no ?category= read', async () => {
    window.history.replaceState({}, '', '/intelligence/reviews?tab=products&business=3&category=5&product=100')
    const props = productProps({ activeId: 101 })
    const { container } = render(wrap(<ReviewProductsListingUI {...props} />))
    expect(props.onOpenRow).not.toHaveBeenCalled()
    expect(container.querySelector('tr[data-row-id="101"]')).toHaveAttribute('aria-current', 'true')
    await userEvent.click(within(container.querySelector('tr[data-row-id="102"]')).getByText('Product 3'))
    expect(props.onOpenRow).toHaveBeenCalledWith(products[2])
    expect(screen.queryByTestId('sidebar')).toBeNull()
  })

  it('an error draws «Try again», which calls onRetry', async () => {
    const props = productProps({ productState: { loading: false, error: 'boom', products: [] } })
    render(wrap(<ReviewProductsListingUI {...props} />))
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.onRetry).toHaveBeenCalledTimes(1)
  })

  it('a note of 0 or none is a dash', () => {
    const props = productProps({ productState: { loading: false, error: null, products: [{ id: 1, name: 'Water', images: null, category: { id: 5 }, reviews: { total: 0 } }] } })
    const { container } = render(wrap(<ReviewProductsListingUI {...props} />))
    expect(container.querySelector('tr[data-row-id="1"] td').textContent).toBe('—No data')
  })

  it('the wrapper keeps the props of the controller, and «Try again» asks for the products again (the controller exposes no reload)', async () => {
    // the stub controller hands every prop to the UI, so `productState` stands for what the real controller computes
    const failed = { loading: false, error: 'boom', products: [] }
    const handleChangeSearch = vi.fn()
    render(wrap(<ReviewProductsListing businessId={3} parentSearchValue={null} productState={failed} handleChangeSearch={handleChangeSearch} />))
    expect(mocks.controllers.products).toMatchObject({ isSearchByName: true, isSearchByDescription: true, businessId: 3 })
    expect(mocks.mounts.products).toBe(1)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(mocks.mounts.products).toBe(2)
  })
})
