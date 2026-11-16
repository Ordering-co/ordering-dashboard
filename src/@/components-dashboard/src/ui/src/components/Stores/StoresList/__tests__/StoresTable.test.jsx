/* eslint-disable import/first */
// redesign SL-F1 (A2): the list of /stores/list. A Product DataTable over the state of the DashboardBusinessList controller, the same
// data as RecordCards under 768px, and the cards of today in the card view. Parity with BusinessesList and SingleBusiness (inventory
// 1.7, 1.9): the page's select-all, the row that opens the editor (not the controls), the EatStreet and restricted-session columns, the
// Disabled reason of the Inactive tab, `?page=&pageSize=`, 10 / 25 / 50 and the infinite scroll. The BusinessDetails controller of the
// switches is a stand-in; the language, the website URL and the phone flag are simulated; everything else is the real thing.
import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  restricted: false,
  phone: false,
  storeUrl: null,
  emit: vi.fn(),
  formatTime: '24',
  language: undefined,
  user: undefined,
  saves: [] // redesign stores 3.B: what the page's saver sent, `{ id, changes }`
}))

vi.mock('../../../../../../index', async () => {
  const react = await import('react')
  return {
    useLanguage: () => [{ dictionary: {}, language: mockState.language }, (_key, text) => text],
    useUtils: () => [{ optimizeImage: (src) => src }],
    useEvent: () => [{ emit: (...args) => mockState.emit(...args) }],
    useConfig: () => [{ configs: { format_time: { value: mockState.formatTime } } }],
    // redesign stores 3.B, G1-23: the switches of the list save through one saver for the page (StoreRowControllers)
    useApi: () => [{
      setAccessToken: () => ({
        businesses: (id) => ({
          save: async (changes) => {
            mockState.saves.push({ id, changes })
            return { content: { error: false, result: { id, ...changes } } }
          }
        })
      })
    }],
    useSession: () => [{ token: 'token', user: mockState.user }],
    useToast: () => [null, { showToast: () => {} }],
    ToastType: { Info: 'info', Success: 'success' },
    useAssistantRecordChanges: () => {},
    // the BusinessDetails controller of a switch: it keeps businessState and updates it on a save
    BusinessDetails: ({ UIComponent, ...props }) => {
      const { business } = props
      const [state, setState] = react.useState({ business, loading: false })
      const handleChangeActiveBusiness = async (value, isFeatured = false) => {
        setState(current => ({ ...current, business: { ...current.business, [isFeatured ? 'featured' : 'enabled']: value } }))
      }
      return <UIComponent {...props} businessState={state} handleChangeActiveBusiness={handleChangeActiveBusiness} />
    }
  }
})
vi.mock('../../../../hooks/useFeaturedRestriction', () => ({
  useFeaturedRestriction: () => mockState.restricted
}))
vi.mock('../../../../hooks/useWebsiteUrl', () => ({
  useStoreWebsiteUrl: (slug) => (mockState.storeUrl && slug ? `${mockState.storeUrl}/store/${slug}` : null)
}))
vi.mock('../../../Shared/Product/useIsPhone', () => ({ useIsPhone: () => mockState.phone }))
// the real addQueryToUrl (it writes the address bar), watched
vi.mock('../../../../utils', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, addQueryToUrl: vi.fn(actual.addQueryToUrl) }
})

import { addQueryToUrl } from '../../../../utils'
import { StoresTable } from '../StoresTable'
import { selectAllTarget } from '../StoresBulkBar'
import { StoresColumnsTool, useStoresColumns } from '../useStoresColumns'

const STORES = [
  { id: 2, name: 'Fast Bite', slug: 'fast-bite', city_id: 10, enabled: true, featured: true, reviews: { total: 4.94 }, logo: 'fast.png', header: 'fast-header.png' },
  { id: 4, name: 'KCF', slug: 'kcf', city_id: 10, enabled: true, featured: false, reviews: { total: 0 } },
  { id: 6, name: "Dono's Pizza", slug: 'donos-pizza', city_id: 11, enabled: false, featured: false, disabled_reason: 'No orders in 30 days', reviews: { total: 5 } }
]
const CITIES = [{ id: 10, name: 'Miami' }, { id: 11, name: 'Austin' }]
const PAGINATION = { currentPage: 1, pageSize: 10, total: 34, from: 1, to: 3 }

const LocationProbe = () => <output data-testid='router-search'>{useLocation().search}</output>

// redesign stores 3.B: the page (BusinessesListing) holds the columns and hands them to the filter bar's manager and to
// the table; `withTool` draws that manager beside the table, as the bar does
const WithColumnsTool = ({ isEatstreetProject, children }) => {
  const { columns, setColumns } = useStoresColumns()
  return (
    <>
      <StoresColumnsTool columns={columns} setColumns={setColumns} isEatstreetProject={isEatstreetProject} />
      {children(columns)}
    </>
  )
}

const draw = (props = {}) => {
  const handlers = {
    getPageBusinesses: vi.fn(),
    loadMoreBusinesses: vi.fn(),
    handleChangeBusinessIds: vi.fn(),
    setBusinessIds: vi.fn(),
    handleOpenBusinessDetails: vi.fn(business => addQueryToUrl({ id: business.id })),
    handleSucessUpdateBusiness: vi.fn(),
    handleSucessRemoveBusiness: vi.fn(),
    loadBusinesses: vi.fn(),
    handleOpenAddBusiness: vi.fn()
  }
  const { withTool, ...rest } = props
  const table = (columns) => (
    <StoresTable
      businessList={{ loading: false, error: null, businesses: STORES }}
      pagination={PAGINATION}
      businessIds={[]}
      selectedBusinessActiveState
      viewMethod='list'
      citiesList={CITIES}
      isUseQuery={false}
      isEatstreetProject={false}
      allowBusinessRegister={false}
      {...handlers}
      {...rest}
      {...(columns ? { columns } : {})}
    />
  )
  const utils = render(
    <MemoryRouter>
      {withTool
        ? <WithColumnsTool isEatstreetProject={rest.isEatstreetProject}>{table}</WithColumnsTool>
        : table()}
      <LocationProbe />
    </MemoryRouter>
  )
  return { ...utils, ...handlers }
}

const rowOf = (name) => screen.getByRole('row', { name: new RegExp(name) })
const headers = () => screen.getAllByRole('columnheader').map(header => header.textContent.trim())

beforeEach(() => {
  mockState.restricted = false
  mockState.phone = false
  mockState.storeUrl = null
  mockState.emit.mockClear()
  mockState.formatTime = '24'
  mockState.language = undefined
  mockState.saves = []
  addQueryToUrl.mockClear()
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('StoresTable — columns and cells', () => {
  it('draws a Store, Today, Featured, Rating, Enabled, ID and actions column, with a selection column in front', () => {
    draw()
    const table = screen.getByRole('table', { name: 'Stores list' })
    expect(headers()).toEqual(['Select all', 'Store', 'Today', 'Featured', 'Ratings', 'Enabled', 'ID', 'Actions'].map(text => (text === 'Select all' ? '' : text)))
    expect(within(table).getAllByRole('row')).toHaveLength(1 + STORES.length)
  })

  it('shows the name and the city under it, the rating only when reviews.total is more than 0, and the ID as a figure', () => {
    draw()
    const fast = rowOf('Fast Bite')
    expect(within(fast).getByText('Miami')).toBeInTheDocument()
    expect(within(fast).getByText('4.94')).toHaveClass('odc-figure')
    expect(within(fast).getByText('2')).toHaveClass('odc-figure')
    const kcf = rowOf('KCF')
    expect(within(kcf).queryByText('0')).toBeNull() // no rating, nothing drawn for it
    expect(within(kcf).getByText('4')).toHaveClass('odc-figure')
    expect(within(rowOf('Dono')).getByText('Austin')).toBeInTheDocument()
  })

  it('draws the logo through optimizeImage, and initials when a store has none', () => {
    draw()
    expect(rowOf('Fast Bite').querySelector('img')).toHaveAttribute('src', 'fast.png')
    expect(within(rowOf('KCF')).getByText('K')).toBeInTheDocument() // KCF → one word, one initial
  })

  it('EatStreet: no city and no Ratings column', () => {
    draw({ isEatstreetProject: true })
    expect(screen.queryByText('Miami')).toBeNull()
    expect(headers()).not.toContain('Ratings')
    expect(headers()).toContain('Featured')
  })

  it('a restricted session (EatStreet, not level 0) has no Featured column and no switch for it', () => {
    mockState.restricted = true
    draw()
    expect(headers()).not.toContain('Featured')
    expect(screen.queryByRole('switch', { name: /^Featured / })).toBeNull()
  })

  it('the Disabled reason column is only on the Inactive tab, and says why a store is disabled', () => {
    const { unmount } = draw()
    expect(headers()).not.toContain('Disabled reason')
    unmount()
    draw({ selectedBusinessActiveState: false })
    expect(headers()).toContain('Disabled reason')
    expect(within(rowOf('Dono')).getByText('No orders in 30 days')).toBeInTheDocument()
  })

  it('the Enabled and Featured switches hold the record values and are named by the store', () => {
    draw()
    expect(screen.getByRole('switch', { name: 'Enable Fast Bite' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Enable Dono\'s Pizza' })).not.toBeChecked()
    expect(screen.getByRole('switch', { name: 'Featured Fast Bite' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Featured KCF' })).not.toBeChecked()
  })
})

// (T10, review): beside the docked editor the table narrows; the Store column keeps a floor so a name is never cut to
// a letter per line («F / a. / D / e..» at 1440 with the Overview open), and the table scrolls sideways instead
describe('StoresTable — the Store column keeps its floor beside the editor', () => {
  it('carries the store floor token on its header and its cells', () => {
    draw()
    const header = screen.getByRole('columnheader', { name: /^Store/ })
    expect(header).toHaveAttribute('data-floor')
    expect(header.style.getPropertyValue('--odc-col-floor')).toBe('var(--od-x-col-floor-store)')
    const cell = screen.getAllByRole('rowheader')[0]
    expect(cell.style.getPropertyValue('--odc-col-floor')).toBe('var(--od-x-col-floor-store)')
  })
})

describe('StoresTable — columns the person chooses', () => {
  // redesign stores 3.B: no row only for the icon; the manager is a tool of the filter bar
  it('draws no column manager of its own', () => {
    draw()
    expect(screen.queryByRole('button', { name: 'Manage columns' })).toBeNull()
    expect(document.querySelector('.odc-sl-tools')).toBeNull()
  })

  it('draws the columns it is given, in their order', () => {
    draw({ columns: [{ id: 'ratings', visible: true }, { id: 'business', visible: true }, { id: 'featured', visible: false }, { id: 'today', visible: false }] })
    expect(headers().filter(Boolean)).toEqual(['Ratings', 'Store', 'Enabled', 'ID', 'Actions'])
  })

  it('offers Store, Today, Featured and Ratings and hides one', async () => {
    const user = userEvent.setup()
    draw({ withTool: true })
    await user.click(screen.getByRole('button', { name: 'Manage columns' }))
    const dialog = await screen.findByRole('dialog', { name: 'Manage columns' })
    ;['Store', 'Today', 'Featured', 'Ratings'].forEach(name => expect(within(dialog).getByRole('checkbox', { name })).toBeChecked())
    expect(within(dialog).queryByRole('checkbox', { name: 'Enabled' })).toBeNull()
    await user.click(within(dialog).getByRole('checkbox', { name: 'Ratings' }))
    expect(headers()).not.toContain('Ratings')
    expect(within(rowOf('Fast Bite')).queryByText('4.94')).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Reset' }))
    expect(headers()).toContain('Ratings')
  })

  it('does not offer Featured to a restricted session nor Ratings on EatStreet', async () => {
    mockState.restricted = true
    const user = userEvent.setup()
    draw({ isEatstreetProject: true, withTool: true })
    await user.click(screen.getByRole('button', { name: 'Manage columns' }))
    const dialog = await screen.findByRole('dialog', { name: 'Manage columns' })
    expect(within(dialog).getAllByRole('checkbox').map(box => box.getAttribute('aria-label') || box.textContent.trim())).toEqual(['Store', 'Today'])
  })
})

describe('StoresTable — selection', () => {
  it('a row checkbox toggles the id in the controller and never opens the editor', async () => {
    const user = userEvent.setup()
    const { handleChangeBusinessIds, handleOpenBusinessDetails } = draw()
    await user.click(screen.getByRole('checkbox', { name: 'Select KCF' }))
    expect(handleChangeBusinessIds).toHaveBeenCalledWith(4)
    expect(handleOpenBusinessDetails).not.toHaveBeenCalled()
  })

  it('the selected rows are the controller\'s businessIds', () => {
    draw({ businessIds: [4, 99] })
    expect(screen.getByRole('checkbox', { name: 'Select KCF' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select Fast Bite' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute('aria-checked', 'mixed')
  })

  it('select-all adds the ids of the page and keeps those of other pages', async () => {
    const user = userEvent.setup()
    const { setBusinessIds } = draw({ businessIds: [99] })
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(setBusinessIds).toHaveBeenCalledWith([99, 2, 4, 6])
  })

  it('select-all with the whole page selected removes only the ids of the page', async () => {
    const user = userEvent.setup()
    const { setBusinessIds } = draw({ businessIds: [99, 2, 4, 6] })
    const all = screen.getByRole('checkbox', { name: 'Select all' })
    expect(all).toBeChecked()
    await user.click(all)
    expect(setBusinessIds).toHaveBeenCalledWith([99])
  })

  it('Esc inside a row clears the selection', async () => {
    const user = userEvent.setup()
    const { setBusinessIds } = draw({ businessIds: [4] })
    act(() => screen.getByRole('checkbox', { name: 'Select KCF' }).focus())
    await user.keyboard('{Escape}')
    expect(setBusinessIds).toHaveBeenCalledWith([])
  })
})

describe('StoresTable — the row opens the editor', () => {
  it('a click on the row opens the store', async () => {
    const user = userEvent.setup()
    const { handleOpenBusinessDetails } = draw()
    await user.click(within(rowOf('KCF')).getByText('KCF'))
    expect(handleOpenBusinessDetails).toHaveBeenCalledWith(STORES[1])
  })

  it('Enter on a focused row opens it', async () => {
    const user = userEvent.setup()
    const { handleOpenBusinessDetails } = draw()
    act(() => rowOf('KCF').focus())
    await user.keyboard('{Enter}')
    expect(handleOpenBusinessDetails).toHaveBeenCalledWith(STORES[1])
  })

  it('a click on a switch, or on the menu, is theirs: the row does not open', async () => {
    const user = userEvent.setup()
    const { handleOpenBusinessDetails } = draw()
    await user.click(screen.getByRole('switch', { name: 'Enable KCF' }))
    // redesign (owner decision 31 A): switching a store off asks first
    await user.click(within(await screen.findByRole('alertdialog', { name: 'Deactivate KCF?' })).getByRole('button', { name: 'Deactivate store' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await user.click(screen.getByRole('switch', { name: 'Featured KCF' }))
    await user.click(screen.getByRole('button', { name: 'Actions for KCF' }))
    expect(handleOpenBusinessDetails).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Enable KCF' })).not.toBeChecked())
  })

  it('the open store is the active row, whether its id arrives as a number or as the string of ?id=', () => {
    const { unmount } = draw({ detailsBusinessId: '4' })
    expect(rowOf('KCF')).toHaveAttribute('aria-current', 'true')
    expect(rowOf('Fast Bite')).not.toHaveAttribute('aria-current')
    unmount()
    draw({ detailsBusinessId: 6 })
    expect(rowOf('Dono')).toHaveAttribute('aria-current', 'true')
  })
})

describe('StoresTable — the ⋯ menu', () => {
  const openMenu = async (user, name) => {
    await user.click(screen.getByRole('button', { name: `Actions for ${name}` }))
    return screen.findByRole('menu')
  }

  it('Open opens the store', async () => {
    const user = userEvent.setup()
    const { handleOpenBusinessDetails } = draw()
    const menu = await openMenu(user, 'KCF')
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Open', 'Schedule', 'Categories & products'])
    await user.click(within(menu).getByRole('menuitem', { name: 'Open' }))
    expect(handleOpenBusinessDetails).toHaveBeenCalledTimes(1)
    expect(handleOpenBusinessDetails).toHaveBeenCalledWith(STORES[1])
  })

  // redesign bugs C (review): the editor no longer opens Schedule by address for a role whose menu lacks it, so the row
  // does not offer it either (it used to land on the Overview with the «can't open» notice)
  it('Schedule is not offered to the selected access role, whose editor menu has no Schedule', async () => {
    const user = userEvent.setup()
    mockState.user = { level: 2, selected_access: true }
    draw()
    const menu = await openMenu(user, 'KCF')
    expect(within(menu).getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Open', 'Categories & products'])
    mockState.user = undefined
  })

  it('Schedule opens the store with ?section=schedule, written where the editor reads it', async () => {
    const user = userEvent.setup()
    const { handleOpenBusinessDetails } = draw()
    const menu = await openMenu(user, 'KCF')
    await user.click(within(menu).getByRole('menuitem', { name: 'Schedule' }))
    expect(handleOpenBusinessDetails).toHaveBeenCalledWith(STORES[1])
    expect(addQueryToUrl).toHaveBeenLastCalledWith({ section: 'schedule' })
    // the address bar...
    expect(new URLSearchParams(window.location.search).get('id')).toBe('4')
    expect(new URLSearchParams(window.location.search).get('section')).toBe('schedule')
    // ...and the router's location, which is what BusinessDetails reads (`useLocation().search`) when the store has loaded
    const routed = new URLSearchParams(screen.getByTestId('router-search').textContent)
    expect(routed.get('id')).toBe('4')
    expect(routed.get('section')).toBe('schedule')
  })

  it('Categories & products goes to the store catalog by its slug, and the row does not open', async () => {
    const user = userEvent.setup()
    const { handleOpenBusinessDetails } = draw()
    const menu = await openMenu(user, 'Fast Bite')
    await user.click(within(menu).getByRole('menuitem', { name: 'Categories & products' }))
    expect(mockState.emit).toHaveBeenCalledWith('go_to_page', { page: 'store', params: { store: 'fast-bite' } })
    expect(handleOpenBusinessDetails).not.toHaveBeenCalled()
  })

  // main had a real link to /stores/products/<slug>; the entry keeps it, so a new tab works
  describe('Categories & products as a link', () => {
    // `fireEvent.click` returns false when the handler called preventDefault. A click the component leaves alone would make jsdom log
    // «navigation not implemented», so the console is quiet for these.
    beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })
    const catalogItem = async (user) => within(await openMenu(user, 'Fast Bite')).getByRole('menuitem', { name: 'Categories & products' })

    it('is an <a> to /stores/products/<slug> that keeps the menuitem role', async () => {
      const user = userEvent.setup()
      draw()
      const menu = await openMenu(user, 'Fast Bite')
      const item = within(menu).getByRole('menuitem', { name: 'Categories & products' })
      expect(item.tagName).toBe('A')
      expect(item).toHaveAttribute('href', '/stores/products/fast-bite')
      expect(within(menu).getByRole('menuitem', { name: 'Open' }).tagName).not.toBe('A')
    })

    it('a plain click goes through the router (default prevented) and does not open the row', async () => {
      const user = userEvent.setup()
      const { handleOpenBusinessDetails } = draw()
      const item = await catalogItem(user)
      expect(fireEvent.click(item)).toBe(false) // preventDefault was called
      expect(mockState.emit).toHaveBeenCalledTimes(1)
      expect(mockState.emit).toHaveBeenCalledWith('go_to_page', { page: 'store', params: { store: 'fast-bite' } })
      expect(handleOpenBusinessDetails).not.toHaveBeenCalled()
    })

    it.each([['ctrlKey'], ['metaKey'], ['shiftKey'], ['altKey']])('%s + click is left to the browser: no preventDefault, no internal navigation', async (modifier) => {
      const user = userEvent.setup()
      const { handleOpenBusinessDetails } = draw()
      const item = await catalogItem(user)
      expect(fireEvent.click(item, { [modifier]: true })).toBe(true) // preventDefault was not called
      expect(mockState.emit).not.toHaveBeenCalled()
      expect(handleOpenBusinessDetails).not.toHaveBeenCalled()
    })

    it('a middle click is left to the browser too', async () => {
      const user = userEvent.setup()
      draw()
      const item = await catalogItem(user)
      expect(fireEvent.click(item, { button: 1 })).toBe(true)
      expect(mockState.emit).not.toHaveBeenCalled()
    })

    it('Enter on the focused entry navigates once', async () => {
      const user = userEvent.setup()
      draw()
      const item = await catalogItem(user)
      item.focus()
      await user.keyboard('{Enter}')
      expect(mockState.emit).toHaveBeenCalledTimes(1)
    })
  })

  it('Preview is there only when the store has a website URL, and opens it without an opener', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    mockState.storeUrl = 'https://shop.example.com'
    draw()
    const menu = await openMenu(user, 'Fast Bite')
    await user.click(within(menu).getByRole('menuitem', { name: 'Preview' }))
    expect(open).toHaveBeenCalledWith('https://shop.example.com/store/fast-bite', '_blank', 'noopener,noreferrer')
  })

  it('has no Preview without a URL', async () => {
    const user = userEvent.setup()
    draw()
    const menu = await openMenu(user, 'Fast Bite')
    expect(within(menu).queryByRole('menuitem', { name: 'Preview' })).toBeNull()
  })
})

describe('StoresTable — pages', () => {
  it('shows the range and the 10 / 25 / 50 choices, and a page change asks the controller for it with the same page size', async () => {
    const user = userEvent.setup()
    // a full page of ten rows (the range ends at the last row on screen)
    const page = Array.from({ length: 10 }, (_, index) => ({ ...STORES[1], id: 20 + index, name: `Store ${20 + index}` }))
    const { getPageBusinesses } = draw({ businessList: { loading: false, error: null, businesses: page } })
    const foot = screen.getByRole('navigation', { name: 'Pagination' })
    expect(within(foot).getByText(/Showing/)).toHaveTextContent('Showing 1–10 of 34')
    await user.click(within(foot).getByRole('button', { name: 'Next page' }))
    expect(getPageBusinesses).toHaveBeenCalledWith(10, 2)

    await user.click(within(foot).getByRole('button', { name: /Items per page/ }))
    const sizes = (await screen.findAllByRole('menuitemradio')).map(item => item.textContent)
    expect(sizes).toEqual(['10', '25', '50'])
  })

  // after a Disable the rows leave the page and the total drops, but the page is not asked again
  it('says the range of the rows on screen when the page holds fewer than the page size says', () => {
    draw({ businessList: { loading: false, error: null, businesses: [...STORES, ...STORES.map(store => ({ ...store, id: store.id + 100 })), ...STORES.slice(0, 2).map(store => ({ ...store, id: store.id + 200 }))] }, pagination: { currentPage: 1, pageSize: 10, total: 33, from: 1, to: 10 } })
    expect(document.querySelectorAll('tbody tr')).toHaveLength(8)
    expect(within(screen.getByRole('navigation', { name: 'Pagination' })).getByText(/Showing/)).toHaveTextContent('Showing 1–8 of 33')
  })

  it('keeps the range a full page gives, and the one of the last page', () => {
    const rows = (count, from) => Array.from({ length: count }, (_, index) => ({ ...STORES[1], id: from + index, name: `Store ${from + index}` }))
    const { unmount } = draw({ businessList: { loading: false, error: null, businesses: rows(10, 1) }, pagination: { currentPage: 1, pageSize: 10, total: 33, from: 1, to: 10 } })
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1–10 of 33')
    unmount()
    draw({ businessList: { loading: false, error: null, businesses: rows(3, 31) }, pagination: { currentPage: 4, pageSize: 10, total: 33, from: 31, to: 33 } })
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 31–33 of 33')
  })

  it('a new page size keeps the first store of the page in view (ceil(from / size))', async () => {
    const user = userEvent.setup()
    const { getPageBusinesses } = draw({ pagination: { currentPage: 3, pageSize: 10, total: 34, from: 21, to: 30 } })
    await user.click(screen.getByRole('button', { name: /Items per page/ }))
    await user.click(await screen.findByRole('menuitemradio', { name: '25' }))
    expect(getPageBusinesses).toHaveBeenCalledWith(25, 1) // ceil(21 / 25)
  })

  it('writes ?page= and ?pageSize= when the page changes, as the list did, only with isUseQuery in the list view', () => {
    const { unmount } = draw({ isUseQuery: true, pagination: { ...PAGINATION, currentPage: 2 } })
    expect(addQueryToUrl).toHaveBeenCalledWith({ page: 2, pageSize: 10 })
    unmount()
    addQueryToUrl.mockClear()
    draw({ isUseQuery: false })
    expect(addQueryToUrl).not.toHaveBeenCalled()
  })

  it('does not write them in the card view', () => {
    draw({ isUseQuery: true, viewMethod: 'card' })
    expect(addQueryToUrl).not.toHaveBeenCalled()
  })

  it('paints no foot without results', () => {
    draw({ businessList: { loading: false, error: null, businesses: [] }, pagination: { currentPage: 0, pageSize: 10, total: 0 } })
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  // redesign stores 3.A, P-3: the header button and the empty state have «Add new store»; the foot kept a third copy
  it('the foot has no «Add new store» link, with or without allowBusinessRegister; the pages stay', () => {
    const { unmount } = draw({ allowBusinessRegister: true })
    expect(screen.queryByRole('button', { name: 'Add new store' })).toBeNull()
    expect(screen.queryByText('Add new store')).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
    unmount()
    draw({ allowBusinessRegister: false })
    expect(screen.queryByRole('button', { name: 'Add new store' })).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
  })
})

describe('StoresTable — loading, empty and error', () => {
  it('draws skeleton rows while loading: busy, no store, no row controls', () => {
    draw({ businessList: { loading: true, error: null, businesses: STORES } })
    expect(screen.getByRole('table', { name: 'Stores list' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('Fast Bite')).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.getByText('Loading stores')).toBeInTheDocument()
    expect(document.querySelectorAll('tr[data-skeleton]')).toHaveLength(10)
  })

  it('says there are no stores to show', () => {
    draw({ businessList: { loading: false, error: null, businesses: [] }, pagination: { total: 0 } })
    expect(screen.getByText('No stores to show')).toBeInTheDocument()
  })

  it('tutorial mode with no stores offers «Add your first store»', async () => {
    const user = userEvent.setup()
    const { handleOpenAddBusiness } = draw({
      businessList: { loading: false, error: null, businesses: [] },
      pagination: { total: 0 },
      isTutorialMode: true,
      allowBusinessRegister: true
    })
    await user.click(screen.getByRole('button', { name: 'Add your first store' }))
    expect(handleOpenAddBusiness).toHaveBeenCalledTimes(1)
  })

  it('SL-04: a load that failed with nothing to show is an error in the place of the list, with Retry', async () => {
    const user = userEvent.setup()
    const { loadBusinesses } = draw({ businessList: { loading: false, error: ['Internal error'], businesses: [] }, pagination: { total: 0 } })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load the stores.")
    expect(alert).toHaveTextContent('Internal error')
    expect(screen.queryByRole('table')).toBeNull()
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(loadBusinesses).toHaveBeenCalledTimes(1)
  })

  // redesign bugs C: what the controller now gives for a request that never got an answer
  it('a request that failed on the network says so, with Retry, instead of «No stores to show»', () => {
    draw({ businessList: { loading: false, error: ['NETWORK_ERROR'], businesses: [] }, pagination: { total: 0 } })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load the stores.")
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByText('No stores to show')).toBeNull()
  })

  // «Network error, please reload the page» next to a Retry button is wrong for a 500 the server answered
  it('a failed request says «We couldn\'t load the stores.», not the network message, and keeps Retry', async () => {
    const user = userEvent.setup()
    const { loadBusinesses } = draw({ businessList: { loading: false, error: ['NETWORK_ERROR'], businesses: [] }, pagination: { total: 0 } })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load the stores.")
    expect(alert).not.toHaveTextContent('NETWORK_ERROR')
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(loadBusinesses).toHaveBeenCalledTimes(1)
  })

  // a search or filters with no result is not a project without stores
  it('with a search or filters on and no result, says nothing matches and offers «Clear filters»', async () => {
    const user = userEvent.setup()
    const onClearFilters = vi.fn()
    draw({ businessList: { loading: false, error: null, businesses: [] }, pagination: { total: 0 }, filtered: true, onClearFilters })
    expect(screen.getByText('No stores match your search or filters')).toBeInTheDocument()
    expect(screen.queryByText('No stores to show')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(onClearFilters).toHaveBeenCalledTimes(1)
  })

  it('the filtered empty state is also there on the phone and in the card view', () => {
    mockState.phone = true
    const { unmount } = draw({ businessList: { loading: false, error: null, businesses: [] }, pagination: { total: 0 }, filtered: true, onClearFilters: vi.fn() })
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
    unmount()
    draw({ viewMethod: 'card', businessList: { loading: false, error: null, businesses: [] }, pagination: { total: 0 }, filtered: true, onClearFilters: vi.fn() })
    expect(screen.getByText('No stores match your search or filters')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })

  it('without a search or filters, an empty list stays «No stores to show» with no button', () => {
    draw({ businessList: { loading: false, error: null, businesses: [] }, pagination: { total: 0 }, filtered: false, onClearFilters: vi.fn() })
    expect(screen.getByText('No stores to show')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
  })

  it('a page change that failed keeps the stores and says so above them, with Retry', async () => {
    const user = userEvent.setup()
    const { loadBusinesses } = draw({ businessList: { loading: false, error: ['Boom'], businesses: STORES } })
    expect(screen.getByRole('table')).toBeInTheDocument()
    const notice = screen.getByText("We couldn't load the stores.").closest('[role="status"]')
    await user.click(within(notice).getByRole('button', { name: 'Retry' }))
    expect(loadBusinesses).toHaveBeenCalledTimes(1)
  })
})

describe('StoresTable — under 768px', () => {
  beforeEach(() => { mockState.phone = true })

  it('draws a card per store: name, city, ID, rating, Featured, Enabled and the checkbox', () => {
    draw()
    expect(screen.queryByRole('table')).toBeNull()
    const list = screen.getByRole('list', { name: 'Stores list' })
    const cards = within(list).getAllByRole('listitem')
    expect(cards).toHaveLength(3)
    const fast = cards[0]
    expect(within(fast).getByRole('link', { name: 'Open Fast Bite' })).toHaveTextContent('Fast Bite')
    expect(fast).toHaveTextContent('Miami')
    expect(within(fast).getByText('2')).toHaveClass('odc-figure')
    expect(within(fast).getByText('4.94')).toHaveClass('odc-figure')
    expect(within(fast).getByRole('switch', { name: 'Featured Fast Bite' })).toBeChecked()
    expect(within(fast).getByRole('switch', { name: 'Enable Fast Bite' })).toBeChecked()
    expect(within(fast).getByRole('checkbox', { name: 'Select Fast Bite' })).not.toBeChecked()
    expect(within(cards[1]).queryByText('4.94')).toBeNull()
  })

  // main drew the reason at every width; the column does on a desktop, so the card does under 768px
  it('draws the disabled reason on the card of a disabled store that has one, on any tab', () => {
    const { unmount } = draw()
    const dono = screen.getAllByRole('listitem')[2]
    expect(dono).toHaveTextContent('Disabled reason: No orders in 30 days')
    expect(within(screen.getAllByRole('listitem')[0]).queryByText(/Disabled reason/)).toBeNull()
    unmount()
    draw({ selectedBusinessActiveState: false })
    expect(screen.getAllByRole('listitem')[2]).toHaveTextContent('Disabled reason: No orders in 30 days')
  })

  it('draws no reason line for a disabled store without one, nor for an enabled store that still carries one', () => {
    draw({ businessList: { loading: false, error: null, businesses: [{ ...STORES[2], disabled_reason: '' }, { ...STORES[1], disabled_reason: 'Old reason' }] } })
    expect(screen.queryByText(/Disabled reason/)).toBeNull()
    expect(screen.queryByText(/Old reason/)).toBeNull()
  })

  it('EatStreet: no rating on the card, as in the table', () => {
    draw({ isEatstreetProject: true })
    expect(screen.queryByText('4.94')).toBeNull()
    expect(screen.queryByText('Ratings')).toBeNull()
  })

  it('shows the rating on the card outside EatStreet', () => {
    draw()
    expect(screen.getByText('4.94')).toHaveClass('odc-figure')
  })

  it('the checkbox selects, the card opens, and neither does the other', async () => {
    const user = userEvent.setup()
    const { handleChangeBusinessIds, handleOpenBusinessDetails } = draw()
    const kcf = screen.getAllByRole('listitem')[1]
    await user.click(within(kcf).getByRole('checkbox', { name: 'Select KCF' }))
    expect(handleChangeBusinessIds).toHaveBeenCalledWith(4)
    expect(handleOpenBusinessDetails).not.toHaveBeenCalled()
    await user.click(within(kcf).getByRole('switch', { name: 'Enable KCF' }))
    // redesign (owner decision 31 A): switching a store off asks first; Cancel leaves it on
    await user.click(within(await screen.findByRole('alertdialog', { name: 'Deactivate KCF?' })).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(handleOpenBusinessDetails).not.toHaveBeenCalled()
    await user.click(within(kcf).getByRole('link', { name: 'Open KCF' }))
    expect(handleOpenBusinessDetails).toHaveBeenCalledWith(STORES[1])
  })

  it('keeps the select-all of the page', async () => {
    const user = userEvent.setup()
    const { setBusinessIds } = draw({ businessIds: [99] })
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }))
    expect(setBusinessIds).toHaveBeenCalledWith([99, 2, 4, 6])
  })

  it('has no Featured on a restricted session, and no city on EatStreet', () => {
    mockState.restricted = true
    draw({ isEatstreetProject: true })
    expect(screen.queryByRole('switch', { name: /^Featured / })).toBeNull()
    expect(screen.queryByText('Miami')).toBeNull()
  })

  it('keeps the ⋯ menu of every row', () => {
    draw({ allowBusinessRegister: true })
    expect(screen.getAllByRole('button', { name: /^Actions for / })).toHaveLength(3)
  })

  it('draws skeleton cards while loading', () => {
    draw({ businessList: { loading: true, error: null, businesses: [] } })
    expect(document.querySelectorAll('li[data-skeleton]')).toHaveLength(10)
  })
})

describe('StoresTable — card view', () => {
  const drawCards = (props = {}) => draw({ viewMethod: 'card', ...props })

  it('draws the cards of today: header image, logo, name, city, ID and Enable; no checkbox, no Featured, no Ratings, no foot', () => {
    drawCards()
    expect(screen.queryByRole('table')).toBeNull()
    const cards = within(screen.getByRole('list', { name: 'Stores list' })).getAllByRole('listitem')
    expect(cards).toHaveLength(3)
    const fast = cards[0]
    expect(fast.querySelector('.odc-sl-card-header img')).toHaveAttribute('src', 'fast-header.png')
    expect(fast.querySelector('.odc-avatar img')).toHaveAttribute('src', 'fast.png')
    expect(within(fast).getByRole('link', { name: 'Fast Bite' })).toBeInTheDocument()
    expect(fast).toHaveTextContent('Miami')
    expect(fast).toHaveTextContent('ID 2')
    expect(within(fast).getByRole('switch', { name: 'Enable Fast Bite' })).toBeChecked()
    expect(within(fast).getByRole('switch', { name: 'Enable Fast Bite' })).toHaveTextContent('Enable')
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('switch', { name: /^Featured / })).toBeNull()
    expect(screen.queryByText('4.94')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
  })

  it('EatStreet: no city', () => {
    drawCards({ isEatstreetProject: true })
    expect(screen.queryByText('Miami')).toBeNull()
  })

  it('a click on the card opens the store; the Enable switch does not', async () => {
    const user = userEvent.setup()
    const { handleOpenBusinessDetails } = drawCards()
    const kcf = screen.getAllByRole('listitem')[1]
    await user.click(within(kcf).getByRole('switch', { name: 'Enable KCF' }))
    expect(handleOpenBusinessDetails).not.toHaveBeenCalled()
    await user.click(within(kcf).getByText('KCF'))
    expect(handleOpenBusinessDetails).toHaveBeenCalledWith(STORES[1])
  })

  it('loads the next stores when the window scrolls to the foot and there are more', () => {
    const { loadMoreBusinesses } = drawCards()
    act(() => { fireEvent.scroll(window) })
    expect(loadMoreBusinesses).toHaveBeenCalledTimes(1)
  })

  it('does not load more while loading, or when the last store is already there', () => {
    const { loadMoreBusinesses, unmount } = drawCards({ pagination: { ...PAGINATION, to: 34, total: 34 } })
    act(() => { fireEvent.scroll(window) })
    expect(loadMoreBusinesses).not.toHaveBeenCalled()
    unmount()
    const loading = drawCards({ businessList: { loading: true, error: null, businesses: STORES } })
    act(() => { fireEvent.scroll(window) })
    expect(loading.loadMoreBusinesses).not.toHaveBeenCalled()
    expect(document.querySelectorAll('li[data-skeleton]')).toHaveLength(30)
  })

  it('stops listening when it unmounts', () => {
    const { loadMoreBusinesses, unmount } = drawCards()
    unmount()
    act(() => { fireEvent.scroll(window) })
    expect(loadMoreBusinesses).not.toHaveBeenCalled()
  })

  it('shows an error with Retry in the place of the cards when nothing loaded', async () => {
    const user = userEvent.setup()
    const { loadBusinesses } = drawCards({ businessList: { loading: false, error: ['Internal error'], businesses: [] } })
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Retry' }))
    expect(loadBusinesses).toHaveBeenCalledTimes(1)
  })
})

// redesign stores 3.B, P-2: open now, from the server's `open` and today's lapses at the store's own clock
describe('StoresTable — open now (P-2)', () => {
  // 2026-10-10 19:30 UTC = 15:30 in New York
  const NOW = new Date(Date.UTC(2026, 9, 10, 19, 30))
  const DAY = { enabled: true, lapses: [{ open: { hour: 9, minute: 0 }, close: { hour: 23, minute: 59 } }] }
  const OPEN_NOW = [
    { ...STORES[0], open: true, today: DAY, timezone: 'America/New_York' },
    { ...STORES[1], open: false, today: { enabled: true, lapses: [{ open: { hour: 17, minute: 30 }, close: { hour: 22, minute: 0 } }] }, timezone: 'America/New_York' },
    { ...STORES[2] } // no `open`: the list did not bring it
  ]
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('says open and when it closes, closed and when it opens, and nothing without data', () => {
    draw({ businessList: { loading: false, error: null, businesses: OPEN_NOW } })
    expect(within(rowOf('Fast Bite')).getByText('Open · closes 23:59')).toBeInTheDocument()
    expect(within(rowOf('KCF')).getByText('Closed · opens 17:30')).toBeInTheDocument()
    const reasonRow = rowOf("Dono's Pizza")
    expect(within(reasonRow).queryByText(/Open|Closed/)).toBeNull()
  })

  it('writes the times in 12 hours when the project does', () => {
    mockState.formatTime = '12'
    draw({ businessList: { loading: false, error: null, businesses: OPEN_NOW } })
    expect(within(rowOf('Fast Bite')).getByText('Open · closes 11:59 PM')).toBeInTheDocument()
    expect(within(rowOf('KCF')).getByText('Closed · opens 5:30 PM')).toBeInTheDocument()
  })

  // review r1 #4: in 12 hours the AM / PM mark is the language's, with Latin digits
  it('writes the 12-hour mark in the language of the dashboard', () => {
    mockState.formatTime = '12'
    mockState.language = { code: 'es' }
    draw({ businessList: { loading: false, error: null, businesses: OPEN_NOW } })
    expect(within(rowOf('Fast Bite')).getByText(/^Open · closes 11:59\sp\.\s?m\.$/)).toBeInTheDocument()
  })

  it('says it on the phone card too, and leaves the row out when there is no data', () => {
    mockState.phone = true
    draw({ businessList: { loading: false, error: null, businesses: OPEN_NOW } })
    expect(screen.getByText('Open · closes 23:59')).toBeInTheDocument()
    expect(screen.getByText('Closed · opens 17:30')).toBeInTheDocument()
    expect(screen.getAllByText(/^(Open|Closed)/)).toHaveLength(2)
  })

  // review r1 #1: the server says `open` from the schedule alone; a disabled store takes no orders
  it('says nothing for a disabled store, even when the server says open', () => {
    const disabled = [{ ...OPEN_NOW[0], enabled: false }]
    draw({ selectedBusinessActiveState: false, businessList: { loading: false, error: null, businesses: disabled } })
    expect(within(rowOf('Fast Bite')).queryByText(/Open|Closed/)).toBeNull()
  })

  // review r1 #2: a lapse from 00:00 to 23:59 is the schedule's way of saying 24 hours
  it('says open 24 hours for a lapse of the whole day', () => {
    const allDay = [{ ...OPEN_NOW[0], today: { enabled: true, lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }] } }]
    draw({ businessList: { loading: false, error: null, businesses: allDay } })
    expect(within(rowOf('Fast Bite')).getByText('Open 24 hours')).toBeInTheDocument()
  })

  it('says it on each card of the card view', () => {
    draw({ viewMethod: 'card', businessList: { loading: false, error: null, businesses: OPEN_NOW } })
    expect(screen.getByText('Open · closes 23:59')).toBeInTheDocument()
    expect(screen.getByText('Closed · opens 17:30')).toBeInTheDocument()
  })
})

// redesign stores 3.B: Featured is the second switch of a row; it keeps its cell and its one click, in ink
describe('StoresTable — Featured with less weight', () => {
  it('draws Featured in the neutral tone and Enabled as it was, on the table and on the phone', async () => {
    draw()
    expect(screen.getByRole('switch', { name: 'Featured Fast Bite' })).toHaveAttribute('data-tone', 'neutral')
    expect(screen.getByRole('switch', { name: 'Enable Fast Bite' })).not.toHaveAttribute('data-tone')
  })

  it('still features a store with one click in its cell', async () => {
    const user = userEvent.setup()
    const { handleSucessUpdateBusiness } = draw()
    await user.click(screen.getByRole('switch', { name: 'Featured KCF' }))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Featured KCF' })).toBeChecked())
    expect(mockState.saves).toEqual([{ id: 4, changes: { featured: true } }])
    expect(handleSucessUpdateBusiness).toHaveBeenCalledWith(expect.objectContaining({ id: 4, featured: true }))
  })
})

// redesign bugs F row 20, live check L-1: when the selection bar goes away the focus goes to the list's «Select all».
// At 390 the stores cards draw theirs in `.odc-sl-tools`, which the target missed: the focus fell to <body>.
describe('StoresTable · the «Select all» the selection bar hands the focus to (row 20)', () => {
  afterEach(() => { mockState.phone = false })

  it('is the table header checkbox at a desktop width', () => {
    const { container } = draw()
    expect(selectAllTarget(container)).toBe(within(screen.getByRole('table')).getAllByRole('checkbox')[0])
  })

  it('is the cards\' «Select all» under 768px', () => {
    mockState.phone = true
    const { container } = draw()
    expect(selectAllTarget(container)).toBe(screen.getByRole('checkbox', { name: 'Select all' }))
  })
})

// redesign tanda AB (S-3 and S-4a)
describe('StoresTable · tanda AB (S-3, S-4a)', () => {
  afterEach(() => { mockState.phone = false })

  it('S-3: the ID column (header and cells) is aligned to the end, like the figures of the other lists', () => {
    draw()
    const header = screen.getByRole('columnheader', { name: 'ID' })
    expect(header).toHaveAttribute('data-align', 'end')
    const cell = within(rowOf('Fast Bite')).getByText('2').closest('td')
    expect(cell).toHaveAttribute('data-align', 'end')
  })

  it('S-4a: the switch of a card says «Enabled» (the state, as the table header), never the verb «Enable»', () => {
    draw({ viewMethod: 'card' })
    const fast = screen.getAllByRole('listitem')[0]
    const toggle = within(fast).getByRole('switch', { name: 'Enable Fast Bite' })
    expect(within(toggle).getByText('Enabled')).toBeInTheDocument()
    expect(within(toggle).queryByText('Enable')).toBeNull()
  })

  it('S-4a: the same on the phone cards', () => {
    mockState.phone = true
    draw()
    const fast = screen.getAllByRole('listitem')[0]
    const toggle = within(fast).getByRole('switch', { name: 'Enable Fast Bite' })
    expect(within(toggle).getByText('Enabled')).toBeInTheDocument()
    expect(within(toggle).queryByText('Enable')).toBeNull()
  })
})
