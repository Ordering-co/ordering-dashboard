/* eslint-disable import/first */
// redesign the business selector is rebuilt on Product (P/) pieces with the same public API.
// Its consumers (S/BusinessProductsListing, Orders/Appointments) are not edited, so what they pass and what they get back is pinned here.
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const businesses = [
  { id: 1, name: 'Subway', city: { name: 'Miami' }, logo: 'subway.png' },
  { id: 2, name: 'Taco Bell', city: { name: 'Austin' }, logo: 'taco.png' }
]
const listState = vi.hoisted(() => ({
  loading: false,
  keepRows: false, // loading with the old rows still in the list (a load-more, or a new search)
  rows: null,
  total: 14,
  pageSize: 20,
  currentPage: 1,
  searchValue: '',
  onSearch: null,
  loadMoreBusinesses: null,
  controllerProps: null
}))

const sessionState = vi.hoisted(() => ({ user: { level: 0 }, configs: {} }))
const events = vi.hoisted(() => ({ emit: vi.fn() }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user: sessionState.user }],
  useConfig: () => [{ configs: sessionState.configs }],
  useEvent: () => [events],
  useUtils: () => [{ optimizeImage: (value, params) => `${value}?${params}` }],
  DashboardBusinessList: ({ UIComponent, ...props }) => {
    listState.controllerProps = props
    return (
      <UIComponent
        {...props}
        businessList={{ loading: listState.loading, businesses: listState.loading && !listState.keepRows ? [] : (listState.rows || businesses) }}
        pagination={{
          currentPage: listState.currentPage,
          pageSize: listState.pageSize,
          total: listState.total,
          from: 1,
          to: (listState.rows || businesses).length,
          totalPages: Math.ceil(listState.total / listState.pageSize)
        }}
        searchValue={listState.searchValue}
        onSearch={listState.onSearch}
        loadMoreBusinesses={listState.loadMoreBusinesses}
      />
    )
  }
}))

import { BusinessSelectHeader } from '../index'

const mount = (props = {}) => render(
  <BusinessSelectHeader close={vi.fn()} isOpen changeBusinessState={vi.fn()} {...props} />
)

const manyRows = count => Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Store ${i + 1}`, city: { name: 'Miami' }, logo: `s${i + 1}.png` }))
const again = (props = {}) => (
  <BusinessSelectHeader close={vi.fn()} isOpen changeBusinessState={vi.fn()} {...props} />
)
// jsdom has no layout: the list reports the geometry the test gives it
const geometry = (list, { scrollHeight, clientHeight, scrollTop = 0 }) => {
  Object.defineProperty(list, 'scrollHeight', { configurable: true, value: scrollHeight })
  Object.defineProperty(list, 'clientHeight', { configurable: true, value: clientHeight })
  list.scrollTop = scrollTop
}

beforeEach(() => {
  Object.assign(listState, { loading: false, keepRows: false, rows: null, total: 14, pageSize: 20, currentPage: 1, searchValue: '', controllerProps: null })
  Object.assign(sessionState, { user: { level: 0 }, configs: {} })
  listState.onSearch = vi.fn()
  listState.loadMoreBusinesses = vi.fn()
  events.emit = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('BusinessSelectHeader on Product', () => {
  it('does not import the legacy pieces any more (skeleton library, legacy Button, SearchBar, Pagination, styled panel)', () => {
    const source = readFileSync(path.resolve(__dirname, '../index.js'), 'utf8')
    const imports = [...source.matchAll(/^import[\s\S]*?from\s+'([^']+)'/gm)].map(match => match[1])
    expect(imports).not.toContain('react-loading-skeleton')
    expect(imports.some(from => from.startsWith('react-loading-skeleton'))).toBe(false)
    expect(imports).not.toContain('../../../styles') // the legacy styles/Button
    expect(imports).not.toContain('../../Shared') // the legacy SearchBar and Pagination
    expect(imports.some(from => /Shared\/(SearchBar|Pagination)/.test(from))).toBe(false)
    expect(imports).not.toContain('./styles')
    expect(imports).toContain('../../Shared/Product')
  })

  it('shows one skeleton row per page-size slot while it loads, and no option', () => {
    listState.loading = true
    listState.pageSize = 4
    const { container } = mount()
    expect(container.querySelectorAll('[data-slot="business-option-skeleton"]')).toHaveLength(4)
    expect(container.querySelectorAll('button[data-slot="business-option"]')).toHaveLength(0)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('caps the first-load skeleton to what the scroll region shows (a page of 20 does not draw 20 rows)', () => {
    listState.loading = true
    const { container } = mount()
    expect(container.querySelectorAll('[data-slot="business-option-skeleton"]')).toHaveLength(8)
  })

  it('a new search (loading with the old rows still in the list) shows the full skeleton, not the rows', () => {
    listState.loading = true
    listState.keepRows = true
    const { container } = mount()
    expect(container.querySelectorAll('[data-slot="business-option-skeleton"]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('button[data-slot="business-option"]')).toHaveLength(0)
  })

  it('draws every business as a button with its logo, name and city, and chooses it with the business', () => {
    const changeBusinessState = vi.fn()
    const { container } = mount({ changeBusinessState })
    const options = container.querySelectorAll('button[data-slot="business-option"]')
    expect(options).toHaveLength(2)
    expect(within(options[0]).getByText('Subway')).toBeTruthy()
    expect(within(options[0]).getByText('Miami')).toBeTruthy()
    expect(options[0].querySelector('img').getAttribute('src')).toBe('subway.png?h_50,c_limit')
    fireEvent.click(options[1])
    expect(changeBusinessState).toHaveBeenCalledTimes(1)
    expect(changeBusinessState).toHaveBeenCalledWith(businesses[1])
  })

  // J2 (D-18, ), the one link of the dashboard for every consumer: it closes the selector and goes to /stores/add
  it('with no business at all, "Add new store" closes the selector and goes to the store add', () => {
    listState.total = 0
    const close = vi.fn()
    mount({ close })
    fireEvent.click(screen.getByRole('button', { name: 'Add new store' }))
    expect(close).toHaveBeenCalledTimes(1)
    expect(events.emit).toHaveBeenCalledWith('go_to_page', { page: 'business_add' })
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('does not offer "Add new store" while there are businesses or while it loads', () => {
    mount()
    expect(screen.queryByRole('button', { name: 'Add new store' })).toBeNull()
    cleanup()
    listState.total = 0
    listState.loading = true
    mount()
    expect(screen.queryByRole('button', { name: 'Add new store' })).toBeNull()
  })

  // redesign bugs E (D26, ): the store selector follows the one rule of «Add new store»
  it('does not offer "Add new store" to a store owner when the project turned owner registration off', () => {
    listState.total = 0
    sessionState.user = { level: 2 }
    sessionState.configs = { allow_business_owner_register_business: { value: '0' } }
    mount()
    expect(screen.queryByRole('button', { name: 'Add new store' })).toBeNull()
    cleanup()
    sessionState.configs = { allow_business_owner_register_business: { value: true } }
    mount()
    expect(screen.getByRole('button', { name: 'Add new store' })).toBeInTheDocument()
  })

  // the selector is a search + a scrolling list, not a paginated dropdown
  it('has no pagination (no navigation, no page field, no «of 14»)', () => {
    const { container } = mount()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'Page' })).toBeNull()
    expect(container.querySelector('.odc-bsh-foot')).toBeNull()
    expect(container).not.toHaveTextContent(/of 14|Showing|Next page|Previous page/)
  })

  it('the list is a scroll region', () => {
    const { container } = mount()
    expect(container.querySelector('.odc-bsh-list')).not.toBeNull()
    const css = readFileSync(path.resolve(__dirname, '../business-select-header.css'), 'utf8')
    const rule = css.match(/\.odc-bsh-list\s*\{[^}]*\}/)[0]
    expect(rule).toMatch(/overflow-y:\s*auto/)
    expect(rule).toMatch(/max-block-size:/)
  })

  describe('incremental loading', () => {
    it('asks for the next page once when the list is scrolled near its end, and keeps the rows', () => {
      listState.rows = manyRows(20)
      listState.total = 100
      const { container } = mount()
      const list = container.querySelector('.odc-bsh-list')
      geometry(list, { scrollHeight: 960, clientHeight: 360, scrollTop: 100 })
      fireEvent.scroll(list)
      expect(listState.loadMoreBusinesses).not.toHaveBeenCalled()
      geometry(list, { scrollHeight: 960, clientHeight: 360, scrollTop: 570 })
      fireEvent.scroll(list)
      fireEvent.scroll(list)
      expect(listState.loadMoreBusinesses).toHaveBeenCalledTimes(1)
      expect(container.querySelectorAll('button[data-slot="business-option"]')).toHaveLength(20)
    })

    it('while it loads more, keeps the rows, appends skeleton rows and says Loading politely; no second call', () => {
      listState.rows = manyRows(20)
      listState.total = 100
      const view = mount()
      const list = view.container.querySelector('.odc-bsh-list')
      geometry(list, { scrollHeight: 960, clientHeight: 360, scrollTop: 600 })
      fireEvent.scroll(list)
      listState.loading = true
      listState.keepRows = true
      view.rerender(again())
      expect(view.container.querySelectorAll('button[data-slot="business-option"]')).toHaveLength(20)
      const skeletons = view.container.querySelectorAll('[data-slot="business-option-skeleton"]')
      expect(skeletons.length).toBeGreaterThanOrEqual(2)
      expect(skeletons.length).toBeLessThanOrEqual(3)
      expect(screen.getByRole('status')).toHaveTextContent('Loading')
      fireEvent.scroll(view.container.querySelector('.odc-bsh-list'))
      expect(listState.loadMoreBusinesses).toHaveBeenCalledTimes(1)
      // the page arrives: more rows, no skeleton, and the next page can be asked for again
      listState.loading = false
      listState.keepRows = false
      listState.rows = manyRows(40)
      view.rerender(again())
      expect(view.container.querySelectorAll('button[data-slot="business-option"]')).toHaveLength(40)
      expect(view.container.querySelectorAll('[data-slot="business-option-skeleton"]')).toHaveLength(0)
      expect(screen.getByRole('status')).toHaveTextContent('')
      const next = view.container.querySelector('.odc-bsh-list')
      geometry(next, { scrollHeight: 1920, clientHeight: 360, scrollTop: 1560 })
      fireEvent.scroll(next)
      expect(listState.loadMoreBusinesses).toHaveBeenCalledTimes(2)
    })

    it('does not ask for more when every business is loaded', () => {
      listState.rows = manyRows(20)
      listState.total = 20
      const { container } = mount()
      const list = container.querySelector('.odc-bsh-list')
      geometry(list, { scrollHeight: 960, clientHeight: 360, scrollTop: 600 })
      fireEvent.scroll(list)
      expect(listState.loadMoreBusinesses).not.toHaveBeenCalled()
    })

    it('does not ask for more during the first load or a search', () => {
      listState.loading = true
      listState.keepRows = true
      listState.rows = manyRows(20)
      const { container } = mount()
      const list = container.querySelector('.odc-bsh-list')
      geometry(list, { scrollHeight: 960, clientHeight: 360, scrollTop: 600 })
      fireEvent.scroll(list)
      expect(listState.loadMoreBusinesses).not.toHaveBeenCalled()
    })

    it('loads the next page by itself when the rows do not fill the region and more remain, once per page', () => {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 360 })
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 200 })
      try {
        listState.rows = manyRows(4)
        const view = mount()
        expect(listState.loadMoreBusinesses).toHaveBeenCalledTimes(1)
        // the same rows again (a failed load): no loop
        view.rerender(again())
        expect(listState.loadMoreBusinesses).toHaveBeenCalledTimes(1)
        // a page arrived and it still does not fill: the next one
        listState.rows = manyRows(8)
        view.rerender(again())
        expect(listState.loadMoreBusinesses).toHaveBeenCalledTimes(2)
      } finally {
        delete HTMLElement.prototype.clientHeight
        delete HTMLElement.prototype.scrollHeight
      }
    })

    it('does not load by itself when the region is already filled', () => {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 360 })
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 960 })
      try {
        listState.rows = manyRows(20)
        mount()
        expect(listState.loadMoreBusinesses).not.toHaveBeenCalled()
      } finally {
        delete HTMLElement.prototype.clientHeight
        delete HTMLElement.prototype.scrollHeight
      }
    })
  })

  it('a business with no logo shows the placeholder, not an <img> with an empty source', () => {
    listState.rows = [
      { id: 1, name: 'Subway', city: { name: 'Miami' } },
      { id: 2, name: 'Taco Bell', city: { name: 'Austin' }, logo: '' },
      { id: 3, name: 'Wendys', city: { name: 'Denver' }, logo: 'w.png' }
    ]
    const { container } = mount()
    const options = container.querySelectorAll('button[data-slot="business-option"]')
    expect(options[0].querySelector('img')).toBeNull()
    expect(options[1].querySelector('img')).toBeNull()
    expect(options[0].querySelector('.odc-avatar')).not.toBeNull()
    expect(options[2].querySelector('img').getAttribute('src')).toBe('w.png?h_50,c_limit')
  })

  it('searches on the server after the debounce of the old SearchBar, once, with the last text', () => {
    vi.useFakeTimers()
    mount()
    const search = screen.getByPlaceholderText('Search')
    expect(search.getAttribute('name')).toBe('search')
    fireEvent.change(search, { target: { value: 'sub' } })
    fireEvent.change(search, { target: { value: 'subway' } })
    expect(search.value).toBe('subway')
    act(() => { vi.advanceTimersByTime(700) })
    expect(listState.onSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(100) })
    expect(listState.onSearch).toHaveBeenCalledTimes(1)
    expect(listState.onSearch).toHaveBeenCalledWith('subway')
  })

  it('clearing the search sends an empty search at once', () => {
    vi.useFakeTimers()
    listState.searchValue = 'taco'
    mount()
    const search = screen.getByPlaceholderText('Search')
    expect(search.value).toBe('taco')
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(listState.onSearch).toHaveBeenCalledWith('')
    expect(search.value).toBe('')
    act(() => { vi.advanceTimersByTime(2000) })
    expect(listState.onSearch).toHaveBeenCalledTimes(1)
  })

  it('shows the search that comes from outside (searchValue) when it changes while the field is not focused, never while it is', () => {
    const { rerender } = mount()
    const search = screen.getByPlaceholderText('Search')
    const again = () => rerender(<BusinessSelectHeader close={vi.fn()} isOpen changeBusinessState={vi.fn()} />)
    // the search has the focus on open: someone is typing, so an outside value does not overwrite it
    expect(search).toHaveFocus()
    listState.searchValue = 'wendys'
    again()
    expect(search.value).toBe('')
    search.blur()
    listState.searchValue = 'taco'
    again()
    expect(search.value).toBe('taco')
  })

  it('keeps the contract with the controller (page size, server search, fetched props, noActiveStatusCondition)', () => {
    mount({ noActiveStatusCondition: true })
    expect(listState.controllerProps).toMatchObject({
      asDashboard: true,
      loadMorePageSize: 20,
      paginationSettings: { pageSize: 20 },
      isSearchByBusinessName: true,
      isSearchByBusinessEmail: true,
      isSearchByBusinessPhone: true,
      propsToFetch: ['name', 'slug', 'logo', 'city'],
      noActiveStatusCondition: true
    })
    cleanup()
    mount({ defaultPageSize: 10, defaultPropsToFetch: ['name'] })
    expect(listState.controllerProps).toMatchObject({ loadMorePageSize: 10, paginationSettings: { pageSize: 10 }, propsToFetch: ['name'] })
  })
})
