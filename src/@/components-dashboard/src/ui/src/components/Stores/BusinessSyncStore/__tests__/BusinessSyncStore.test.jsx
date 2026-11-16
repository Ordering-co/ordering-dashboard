/* eslint-disable import/first */
// redesign stores 3.D, encargo 2.2: the store picker of the integration-sync panel as a Product list. The
// DashboardBusinessList controller is replaced by a stand-in that hands over `businessList`, `pagination`, `onSearch` and
// `getPageBusinesses`; the rest is the real thing. D5: the detail lives INSIDE the panel (no SideBar, no Modal): side by side at
// 1100px and above, replacing the list (with «Back») below.
import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import themeJson from '~/theme.json'

const state = vi.hoisted(() => ({
  width: 1200,
  controller: {}
}))

vi.mock('../../../../../../index', async () => {
  return {
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useUtils: () => [{ optimizeImage: (src) => src }],
    // the controller: it gives its UI the list, the page and the two actions
    DashboardBusinessList: ({ UIComponent, ...props }) => <UIComponent {...props} {...state.controller} />
  }
})
vi.mock('../../../../hooks/useWindowSize', () => ({ useWindowSize: () => ({ width: state.width }) }))

import { BusinessSyncStore } from '../index'

const STORES = [
  { id: 2, name: 'Fast Bite', logo: 'fast.png' },
  { id: 4, name: 'KCF' },
  { id: 6, name: "Dono's Pizza", logo: 'donos.png' }
]
const PAGINATION = { currentPage: 1, pageSize: 10, total: 34, from: 1, to: 3 }

const setController = (overrides = {}) => {
  state.controller = {
    searchValue: null,
    businessList: { loading: false, businesses: STORES, error: null },
    pagination: PAGINATION,
    onSearch: vi.fn(),
    getPageBusinesses: vi.fn(),
    ...overrides
  }
  return state.controller
}

const mount = (props = {}) => {
  const handlers = { handleParentSidebarMove: vi.fn(), onDetailChange: vi.fn(), ...props }
  const view = render(
    <ThemeProvider theme={themeJson}>
      <BusinessSyncStore {...handlers} />
    </ThemeProvider>
  )
  return { ...handlers, ...view }
}

const store = (name) => screen.getByRole('button', { name })

beforeEach(() => {
  state.width = 1200
  setController()
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BusinessSyncStore · the list', () => {
  it('lists the stores as native buttons, none of them selected', () => {
    mount()
    STORES.forEach(({ name }) => {
      expect(store(name).tagName).toBe('BUTTON')
      expect(store(name)).not.toHaveAttribute('aria-current')
    })
  })

  it('shows a skeleton while it loads, with no stores', () => {
    setController({ businessList: { loading: true, businesses: [], error: null } })
    const { container } = mount()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(container.querySelectorAll('.odc-skeleton').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Fast Bite' })).toBeNull()
  })

  it('shows an empty state when nothing matches', () => {
    setController({ businessList: { loading: false, businesses: [], error: null }, pagination: { ...PAGINATION, total: 0 } })
    mount()
    expect(screen.getByText('No results found')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })
})

describe('BusinessSyncStore · search', () => {
  it('sends the search after the wait of today (750 ms), once', () => {
    vi.useFakeTimers()
    const { onSearch } = setController()
    mount()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: 'fast' } })
    expect(onSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(749) })
    expect(onSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(2) })
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('fast')
  })

  it('sends at once on Enter and when it is cleared', () => {
    vi.useFakeTimers()
    const { onSearch } = setController()
    mount()
    const input = screen.getByRole('searchbox', { name: 'Search' })
    fireEvent.change(input, { target: { value: 'kcf' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSearch).toHaveBeenLastCalledWith('kcf')
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onSearch).toHaveBeenLastCalledWith('')
  })
})

describe('BusinessSyncStore · pages', () => {
  it('asks the controller for the next page with the same page size', () => {
    const { getPageBusinesses } = setController()
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(getPageBusinesses).toHaveBeenCalledWith(10, 2)
  })

  it('changes the page size keeping the first store of the page in view, as today (ceil(from / size))', async () => {
    const { getPageBusinesses } = setController({ pagination: { currentPage: 3, pageSize: 10, total: 120, from: 21, to: 30 } })
    mount()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Items per page/ }))
    await user.click(await screen.findByRole('menuitemradio', { name: '25' }))
    expect(getPageBusinesses).toHaveBeenCalledWith(25, 1)
  })
})

describe('BusinessSyncStore · the detail, wide (1100px and above)', () => {
  it('opens the detail in the same tree, beside the list: no dialog, no second panel', () => {
    const { onDetailChange, handleParentSidebarMove } = mount()
    fireEvent.click(store('Fast Bite'))
    expect(screen.getByRole('heading', { level: 3, name: 'Fast Bite' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    // the list stays: the other stores are still there
    expect(store('KCF')).toBeInTheDocument()
    expect(store('Fast Bite')).toHaveAttribute('aria-current', 'true')
    expect(store('KCF')).not.toHaveAttribute('aria-current')
    expect(onDetailChange).toHaveBeenCalledTimes(1)
    expect(onDetailChange).toHaveBeenCalledWith(true)
    expect(handleParentSidebarMove).toHaveBeenCalledWith(550)
    // no Back on a wide window: the list is already there
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
  })

  it('changes the detail with one click on another store', () => {
    const { onDetailChange } = mount()
    fireEvent.click(store('Fast Bite'))
    fireEvent.click(store('KCF'))
    expect(screen.getByRole('heading', { level: 3, name: 'KCF' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3, name: 'Fast Bite' })).toBeNull()
    expect(store('KCF')).toHaveAttribute('aria-current', 'true')
    expect(onDetailChange).toHaveBeenCalledTimes(1)
  })

  it('closes the detail with a named button, tells the parent and keeps the focus on the store', () => {
    const { onDetailChange, handleParentSidebarMove } = mount()
    fireEvent.click(store('Fast Bite'))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
    expect(onDetailChange).toHaveBeenLastCalledWith(false)
    expect(handleParentSidebarMove).toHaveBeenLastCalledWith(0)
    expect(store('Fast Bite')).toHaveFocus()
    expect(store('Fast Bite')).not.toHaveAttribute('aria-current')
  })

  it('copies a URL from the detail and says «Copied»', async () => {
    mount()
    fireEvent.click(store('Fast Bite'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy URL: Receive menus' })) })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://integrator.com/menuUpdate')
    // the pagination has a status of its own («Page 1 of 4»): the one of the copy is the one that says «Copied»
    const copyStatus = screen.getAllByRole('status').find(node => node.textContent === 'Copied')
    expect(copyStatus).toBeDefined()
    expect(within(copyStatus).getByText('Copied')).toBeInTheDocument()
  })

  it('keeps the five URLs of today, exactly', () => {
    mount()
    fireEvent.click(store('Fast Bite'))
    expect(screen.getAllByRole('link').map(link => link.getAttribute('href'))).toEqual([
      'https://integrator.com/orderstatusUpdate',
      'https://integrator.com/menuUpdate',
      'https://integrator.com/snoozeUnsnooze',
      'https://integrator.com/busyMode',
      'https://integrator.com/updatePrepTimeURL'
    ])
  })
})

describe('BusinessSyncStore · the detail, narrow (below 1100px)', () => {
  beforeEach(() => { state.width = 800 })

  it('replaces the list with the detail and a «Back» button, in the same tree', () => {
    const { onDetailChange, handleParentSidebarMove } = mount()
    fireEvent.click(store('Fast Bite'))
    expect(screen.getByRole('heading', { level: 3, name: 'Fast Bite' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: 'KCF' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    // review r1 #2: the panel only doubles for the side-by-side layout, decided by the same width (the assistant
    // docked included) as the layout itself
    expect(onDetailChange).not.toHaveBeenCalledWith(true)
    // the parent panel only widens for the side-by-side layout
    expect(handleParentSidebarMove).not.toHaveBeenCalledWith(550)
  })

  it('moves the focus to «Back» when it opens', () => {
    mount()
    fireEvent.click(store('Fast Bite'))
    expect(screen.getByRole('button', { name: 'Back' })).toHaveFocus()
  })

  it('«Back» returns to the list with the focus on the store that was open', () => {
    const { onDetailChange, handleParentSidebarMove } = mount()
    fireEvent.click(store('KCF'))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
    expect(STORES.every(({ name }) => screen.queryByRole('button', { name }))).toBe(true)
    expect(store('KCF')).toHaveFocus()
    expect(onDetailChange).not.toHaveBeenCalledWith(true)
    expect(handleParentSidebarMove).toHaveBeenLastCalledWith(0)
  })

  it('widens the panel when the window grows past the split with a detail open, and narrows it back', () => {
    const { onDetailChange, handleParentSidebarMove, rerender } = mount()
    const again = () => rerender(
      <ThemeProvider theme={themeJson}>
        <BusinessSyncStore handleParentSidebarMove={handleParentSidebarMove} onDetailChange={onDetailChange} />
      </ThemeProvider>
    )
    fireEvent.click(store('Fast Bite'))
    expect(onDetailChange).not.toHaveBeenCalled()
    state.width = 1440
    again()
    expect(onDetailChange).toHaveBeenLastCalledWith(true)
    state.width = 800
    again()
    expect(onDetailChange).toHaveBeenLastCalledWith(false)
  })
})
