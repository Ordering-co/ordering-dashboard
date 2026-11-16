/* eslint-disable import/first */
// redesign SB-B2 (; decisions 1, 2, 5, 6, 7; G5-43, G5-44, G5-47, M-SB1, M-SB3, M-SB4, M-SB6, M-SB8, M-SB9): the brand list and the
// brand panel on Product. The controller (C/BusinessBrandListing) is a stand-in that keeps `openDetail` like the real one and hands over
// what each test sets in `ctl.props` (its SB-B1 contract: handleChangeState / handleDeleteBrand answer `{ ok, error }`, `getBrand`,
// `brandListState.loaded`). The three children of the panel (General, Stores, White label: SB-B3, SB-B4, SB-B5) are stubs that record what
// they receive and how often they mount. The Product wrappers (PageHeader, SearchField, DataTable, RecordCardList, AsyncSwitch,
// Pagination, SplitView, RecordPanel with its tabs, the dialogs) are the real ones.
// Covered: the table and the phone cards; a switch that fails goes back (real AsyncSwitch); delete asks first with the name, Cancel calls
// nothing, confirm deletes and clears the URL; an unknown `?id=` does not open «Add new brand»; no «Add new brand» in the foot; the White
// label tab only with the flag and expanded to full width; tabs mount when opened; the discard guard; create writes `?id=`.
import React from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const seen = vi.hoisted(() => ({ gen: null, busi: null, wl: null, mounts: { gen: 0, busi: 0, wl: 0 } }))
const ctl = vi.hoisted(() => ({ props: {}, configs: {}, project: 'acme' }))
// main, WHITE_LABEL_SITES_ENABLED hides the White label tab. The tab's cases below run with it on, so they still
// cover the tab for when it comes back; one case runs with main's value (off).
const whiteLabel = vi.hoisted(() => ({ enabled: true, projects: [] }))
vi.mock('~/config', () => ({
  default: { get dashboard_project_allowlists () { return { white_label_sites: whiteLabel.projects } } }
}))
vi.mock('../../../../../../utils/businessDetailSections', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, get WHITE_LABEL_SITES_ENABLED () { return whiteLabel.enabled } }
})

const mockModule = vi.hoisted(() => async () => {
  const ReactModule = await import('react')
  return {
    useLanguage: () => [{}, (_key, fallback) => fallback],
    useUtils: () => [{ optimizeImage: url => url }],
    useApi: () => [{ project: ctl.project, root: '/api' }],
    useConfig: () => [{ configs: ctl.configs }],
    // The controller's part: `openDetail` lives here, the rest is what the test says
    BusinessBrandListing: ({ UIComponent, ...props }) => {
      const [openDetail, setOpenDetail] = ReactModule.useState(false)
      return ReactModule.createElement(UIComponent, { ...props, openDetail, setOpenDetail, ...ctl.props })
    }
  }
})
vi.mock('../../../../../../index', mockModule)
vi.mock('~components', mockModule)
vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback]
}))

const infoShare = vi.hoisted(() => ({ isCollapse: false, handleMenuCollapse: vi.fn() }))
vi.mock('../../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: infoShare.isCollapse }, { handleMenuCollapse: infoShare.handleMenuCollapse }]
}))

vi.mock('../../BusinessBrandGENDetail', async () => {
  const ReactModule = await import('react')
  return {
    BusinessBrandGENDetail: (props) => {
      seen.gen = props
      ReactModule.useEffect(() => { seen.mounts.gen++ }, [])
      return (
        <div data-testid='general'>
          <span data-testid='general-brand'>{props.brand ? `brand ${props.brand.id}` : 'no brand'}</span>
          <button type='button' onClick={() => props.onDirtyChange?.(true)}>Make dirty</button>
          <button type='button' onClick={() => props.onDirtyChange?.(false)}>Make clean</button>
          <button type='button' onClick={() => props.onSelectedBrand({ id: 99, name: 'Fresh', slug: 'fresh', enabled: true })}>Create brand</button>
        </div>
      )
    }
  }
})
vi.mock('../../BusinessBrandBUSIDetail', async () => {
  const ReactModule = await import('react')
  return {
    BusinessBrandBUSIDetail: (props) => {
      seen.busi = props
      ReactModule.useEffect(() => { seen.mounts.busi++ }, [])
      return <div data-testid='stores'>Stores of {props.brand?.id}</div>
    }
  }
})
vi.mock('../../BrandWhiteLabel', async () => {
  const ReactModule = await import('react')
  return {
    BrandWhiteLabel: (props) => {
      seen.wl = props
      ReactModule.useEffect(() => { seen.mounts.wl++ }, [])
      return <div data-testid='white-label'>White label of {props.brand?.id}</div>
    }
  }
})

import { BusinessBrandListing } from '../index'

const brand = (id, name, extra = {}) => ({ id, name, slug: name.toLowerCase().replace(/\W+/g, '_'), logo: null, enabled: true, ...extra })
const BRANDS = [
  brand(1, 'Burger Palace'),
  brand(34, 'Vips'),
  brand(67, 'OU Certified', { enabled: false }),
  brand(100, 'Pizzeria'),
  brand(133, 'Hero')
]

const baseCtl = (overrides = {}) => ({
  searchValue: null,
  onSearch: vi.fn(),
  brandListState: { loading: false, loaded: true, brands: BRANDS, error: null },
  brandFormState: { loading: false, changes: {}, result: { error: null } },
  paginationProps: { currentPage: 1, pageSize: 10, totalItems: 5, totalPages: 1 },
  setPaginationProps: vi.fn(),
  getBrands: vi.fn(),
  getBrand: vi.fn(async () => ({ ok: false, error: ['Not found'] })),
  handleChangeState: vi.fn(async () => ({ ok: true })),
  handleDeleteBrand: vi.fn(async () => ({ ok: true })),
  handleUpdateBrandList: vi.fn(),
  ...overrides
})

const ROUTE = '/stores/brand'
let view
const renderPage = (ctlOverrides = {}, route = ROUTE) => {
  window.history.replaceState(null, '', route)
  ctl.props = baseCtl(ctlOverrides)
  const element = () => <BusinessBrandListing />
  const utils = renderWithProviders(element(), { initialEntries: [route] })
  view = {
    ...utils,
    // the controller answers with new props
    update: (changes) => {
      Object.assign(ctl.props, changes)
      utils.rerender(element())
    }
  }
  return view
}
const urlParams = () => Object.fromEntries(new URLSearchParams(window.location.search))

// jsdom answers matchMedia with `matches: false`: the split view reads (min|max)-width queries, so one is installed that evaluates them
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

let restoreViewport
beforeEach(() => {
  whiteLabel.enabled = true
  whiteLabel.projects = []
  window.history.replaceState(null, '', ROUTE)
  restoreViewport = installViewport(1440)
  infoShare.isCollapse = false
  infoShare.handleMenuCollapse.mockClear()
  ctl.configs = {}
  ctl.project = 'acme'
  seen.gen = null
  seen.busi = null
  seen.wl = null
  seen.mounts = { gen: 0, busi: 0, wl: 0 }
  window.localStorage.clear()
})

afterEach(() => {
  restoreViewport()
  window.history.replaceState(null, '', '/')
})

const rowOf = (id) => document.querySelector(`[data-row-id="${id}"]`)
const openBrand = async (name) => {
  await userEvent.click(screen.getByText(name))
  return screen.findByRole('tablist', { name: 'Brand sections' })
}
const panelRoot = () => document.querySelector('.odc-record')

describe('the list', () => {
  it('draws the header with the count, the search, the brand table and no «Add new brand» in the foot', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /^Brands/ })).toBeInTheDocument()
    expect(screen.getByText('5 brands')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add brand' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Brands' })
    expect(within(table).getByRole('columnheader', { name: 'Brand' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Enabled' })).toBeInTheDocument()
    // the slug and the id under the name, the id as a figure (decision 2)
    expect(rowOf(34).textContent).toContain('vips · #34')
    expect(rowOf(34).querySelector('.odc-figure')).toHaveTextContent('#34')
    expect(screen.queryByText('Add new brand')).toBeNull() // decision 5
    expect(screen.queryByText('Actions')).toBeNull()
  })

  it('names each switch with its brand and shows the stored value', () => {
    renderPage()
    expect(screen.getByRole('switch', { name: 'Enable Vips' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Enable OU Certified' })).toHaveAttribute('aria-checked', 'false')
  })

  it('gives the hamburger when the menu is collapsed', async () => {
    infoShare.isCollapse = true
    renderPage()
    // the opener is PageHeader's `leading`, the first child of the lead block
    const opener = screen.getByRole('button', { name: 'Open menu' })
    expect(opener.closest('.odc-pagehead-lead')?.firstElementChild).toBe(opener)
    await userEvent.click(opener)
    expect(infoShare.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  it('draws the cards on a phone, with the switch inside the card (M-SB3), and a card opens the brand', async () => {
    restoreViewport()
    restoreViewport = installViewport(390)
    renderPage()
    expect(screen.queryByRole('table')).toBeNull()
    const list = screen.getByRole('list', { name: 'Brands' })
    const card = rowOf(34)
    expect(list).toContainElement(card)
    expect(within(card).getByRole('switch', { name: 'Enable Vips' })).toBeInTheDocument()
    expect(card.textContent).toContain('vips · #34')
    await userEvent.click(within(card).getByText('Vips'))
    expect(await screen.findByRole('tablist', { name: 'Brand sections' })).toBeInTheDocument()
    expect(urlParams().id).toBe('34')
  })

  it('shows skeletons while the first answer is on its way', () => {
    renderPage({ brandListState: { loading: true, loaded: false, brands: [], error: null } })
    expect(screen.getByText('Loading brands')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Brands' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('No brands yet')).toBeNull()
  })

  it('says there are no brands yet, with «Add brand», and a search with no result in its own words', async () => {
    renderPage({ brandListState: { loading: false, loaded: true, brands: [], error: null }, paginationProps: { currentPage: 1, pageSize: 10, totalItems: 0, totalPages: 0 } })
    expect(screen.getByText('No brands yet')).toBeInTheDocument()
    await userEvent.click(within(screen.getByText('No brands yet').closest('.odc-state')).getByRole('button', { name: 'Add brand' }))
    expect(await screen.findByRole('heading', { name: 'Add new brand' })).toBeInTheDocument()
    view.unmount()
    renderPage({ searchValue: 'zzz', brandListState: { loading: false, loaded: true, brands: [], error: null }, paginationProps: { currentPage: 1, pageSize: 10, totalItems: 0, totalPages: 0 } })
    expect(screen.getByText('No brands match your search')).toBeInTheDocument()
  })

  it('says a failed load in the list (not as «Translations») with Retry that asks for the same page again (M-SB6, M-SB4)', async () => {
    renderPage({
      brandListState: { loading: false, loaded: true, brands: [], error: ['Network down'] },
      paginationProps: { currentPage: 2, pageSize: 25, totalItems: null, totalPages: null }
    })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load the brands.")
    expect(screen.queryByText('Translations')).toBeNull()
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(ctl.props.getBrands).toHaveBeenCalledWith(2, 25)
  })

  it('sends the search after the wait of the old search bar, not on every key', async () => {
    renderPage()
    const box = screen.getByRole('searchbox', { name: 'Search' })
    fireEvent.change(box, { target: { value: 'vi' } })
    expect(ctl.props.onSearch).not.toHaveBeenCalled()
    await waitFor(() => expect(ctl.props.onSearch).toHaveBeenCalledWith('vi'), { timeout: 3000 })
    expect(ctl.props.onSearch).toHaveBeenCalledTimes(1)
  })

  it('pages and resizes through getBrands with the pagination of Product', async () => {
    renderPage({ paginationProps: { currentPage: 1, pageSize: 10, totalItems: 25, totalPages: 3 } })
    const nav = screen.getByRole('navigation', { name: 'Pagination' })
    expect(nav).toHaveTextContent('Showing 1–5 of 25')
    await userEvent.click(within(nav).getByRole('button', { name: 'Next page' }))
    expect(ctl.props.getBrands).toHaveBeenCalledWith(2, 10)
  })
})

describe('the switch of a row (G5-47)', () => {
  it('saves at once through handleChangeState', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('switch', { name: 'Enable Vips' }))
    expect(ctl.props.handleChangeState).toHaveBeenCalledWith(34, 'enabled', false)
  })

  it('goes back to the stored value and says why when the save fails', async () => {
    renderPage({ handleChangeState: vi.fn(async () => ({ ok: false, error: ['Server said no'] })) })
    const toggle = screen.getByRole('switch', { name: 'Enable Vips' })
    await userEvent.click(toggle)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Server said no')
  })

  it('does not open the brand when the switch is pressed', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('switch', { name: 'Enable Vips' }))
    expect(screen.queryByRole('tablist', { name: 'Brand sections' })).toBeNull()
    expect(urlParams().id).toBeUndefined()
  })
})

describe('the panel', () => {
  it('opens on a row with the name, the id, the switch and ?id=; General is the only tab mounted and nothing else is asked for', async () => {
    renderPage()
    await openBrand('Vips')
    expect(screen.getByRole('heading', { name: 'Vips' })).toBeInTheDocument()
    expect(panelRoot().querySelector('.odc-record-subtitle')).toHaveTextContent('#34')
    expect(within(panelRoot()).getByRole('switch', { name: 'Enabled' })).toHaveAttribute('aria-checked', 'true')
    expect(urlParams()).toEqual({ id: '34' })
    expect(seen.gen.brand.id).toBe(34)
    expect(seen.mounts).toEqual({ gen: 1, busi: 0, wl: 0 }) // opening a brand asks for nothing
    expect(within(panelRoot()).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['General', 'Stores'])
    expect(ctl.props.getBrand).not.toHaveBeenCalled()
  })

  it('gives General the props of before plus the brand, onSelectedBrand and onDirtyChange', async () => {
    renderPage()
    await openBrand('Vips')
    expect(seen.gen.brandListState).toBe(ctl.props.brandListState)
    expect(seen.gen.handleUpdateBrandList).toBe(ctl.props.handleUpdateBrandList)
    expect(typeof seen.gen.onSelectedBrand).toBe('function')
    expect(typeof seen.gen.onDirtyChange).toBe('function')
  })

  it('mounts Stores when its tab is opened, writes ?tab=businesses and keeps General mounted', async () => {
    renderPage()
    await openBrand('Vips')
    await userEvent.click(screen.getByRole('tab', { name: 'Stores' }))
    expect(await screen.findByTestId('stores')).toHaveTextContent('Stores of 34')
    expect(urlParams()).toEqual({ id: '34', tab: 'businesses' })
    expect(seen.busi.brandListState).toBe(ctl.props.brandListState)
    expect(seen.mounts).toEqual({ gen: 1, busi: 1, wl: 0 })
    await userEvent.click(screen.getByRole('tab', { name: 'General' }))
    expect(screen.queryByTestId('stores')).toBeNull()
    expect(urlParams()).toEqual({ id: '34', tab: 'general' })
    expect(seen.mounts.gen).toBe(1) // General never unmounted
  })

  it('has the White label tab with an API flag or an explicit tenant opt-in', async () => {
    renderPage()
    await openBrand('Vips')
    expect(screen.queryByRole('tab', { name: 'White Label' })).toBeNull()
    view.unmount()

    ctl.configs = { whitelabel_brands_sites: { value: '1' } }
    renderPage()
    await openBrand('Vips')
    expect(screen.getByRole('tab', { name: 'White Label' })).toBeInTheDocument()
    view.unmount()

    ctl.configs = {}
    ctl.project = 'example-brand-sites'
    whiteLabel.projects = [ctl.project]
    renderPage()
    await openBrand('Vips')
    expect(screen.getByRole('tab', { name: 'White Label' })).toBeInTheDocument()
  })

  it('has no White label tab while White Label sites are hidden (main), even with the flag', async () => {
    whiteLabel.enabled = false
    whiteLabel.projects = [ctl.project]
    ctl.configs = { whitelabel_brands_sites: { value: '1' } }
    renderPage()
    await openBrand('Vips')
    expect(screen.queryByRole('tab', { name: 'White Label' })).toBeNull()
  })

  it('opens White label expanded and at full width, mounts it only then, and goes back to the width it had', async () => {
    ctl.configs = { whitelabel_brands_sites: { value: true } }
    renderPage()
    await openBrand('Vips')
    expect(panelRoot()).not.toHaveAttribute('data-expanded')
    expect(panelRoot()).not.toHaveAttribute('data-full-width')
    expect(seen.mounts.wl).toBe(0)
    await userEvent.click(screen.getByRole('tab', { name: 'White Label' }))
    expect(await screen.findByTestId('white-label')).toHaveTextContent('White label of 34')
    expect(panelRoot()).toHaveAttribute('data-expanded')
    expect(panelRoot()).toHaveAttribute('data-full-width')
    expect(urlParams().tab).toBe('white_label')
    // the update of the site goes to the selected brand and the list
    act(() => seen.wl.handleUpdateBrand({ ...BRANDS[1], site_id: 7 }))
    expect(ctl.props.handleUpdateBrandList).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 34, site_id: 7 })]))
    await userEvent.click(screen.getByRole('tab', { name: 'General' }))
    expect(screen.queryByTestId('white-label')).toBeNull()
    expect(panelRoot()).not.toHaveAttribute('data-expanded')
    expect(panelRoot()).not.toHaveAttribute('data-full-width')
  })

  it('keeps the page width the person chose when White label is left', async () => {
    ctl.configs = { whitelabel_brands_sites: { value: '1' } }
    renderPage()
    await openBrand('Vips')
    await userEvent.click(screen.getByRole('button', { name: 'Open as page' }))
    expect(panelRoot()).toHaveAttribute('data-expanded')
    await userEvent.click(screen.getByRole('tab', { name: 'White Label' }))
    await userEvent.click(screen.getByRole('tab', { name: 'General' }))
    expect(panelRoot()).toHaveAttribute('data-expanded')
    await userEvent.click(screen.getByRole('button', { name: 'Back to split view' }))
    expect(panelRoot()).not.toHaveAttribute('data-expanded')
  })

  it('opens «Add new brand» with only General and no switch; creating keeps the panel on the new brand and writes ?id= (M-SB8)', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Add brand' }))
    expect(await screen.findByRole('heading', { name: 'Add new brand' })).toBeInTheDocument()
    expect(within(panelRoot()).queryByRole('switch')).toBeNull()
    expect(within(panelRoot()).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['General'])
    expect(seen.gen.brand).toBeNull()
    expect(urlParams().id).toBeUndefined()
    await userEvent.click(screen.getByRole('button', { name: 'Create brand' }))
    expect(await screen.findByRole('heading', { name: 'Fresh' })).toBeInTheDocument()
    expect(urlParams()).toEqual({ id: '99' })
    expect(screen.getByTestId('general-brand')).toHaveTextContent('brand 99')
    expect(screen.getByRole('tab', { name: 'Stores' })).toBeInTheDocument()
    expect(seen.mounts.gen).toBe(1) // the form stays: «saved» is still on screen
  })

  it('closes with the close button and clears ?id= and ?tab=', async () => {
    renderPage()
    await openBrand('Vips')
    await userEvent.click(screen.getByRole('tab', { name: 'Stores' }))
    await userEvent.click(within(panelRoot()).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('tablist', { name: 'Brand sections' })).toBeNull())
    expect(urlParams()).toEqual({})
  })
})

describe('?id= (M-SB1)', () => {
  // redesign bugs F row 20 (M-01 of stores-brand): a brand opened by the address had no opener, and closing it left the
  // focus on <body>; it goes to the brand's row
  it('closing a brand opened by ?id= gives the focus to its row, not to <body>', async () => {
    renderPage({}, `${ROUTE}?id=34`)
    await screen.findByRole('tablist', { name: 'Brand sections' })
    await userEvent.click(within(panelRoot()).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('tablist', { name: 'Brand sections' })).toBeNull())
    await waitFor(() => expect(rowOf(34).contains(document.activeElement)).toBe(true))
  })

  it('opens the brand of the page at the tab asked for', async () => {
    renderPage({}, `${ROUTE}?id=34&tab=businesses`)
    expect(await screen.findByTestId('stores')).toHaveTextContent('Stores of 34')
    expect(screen.getByRole('heading', { name: 'Vips' })).toBeInTheDocument()
    expect(ctl.props.getBrand).not.toHaveBeenCalled()
  })

  it('asks for a brand that is not on the page and opens it', async () => {
    const far = brand(500, 'Far Away')
    renderPage({ getBrand: vi.fn(async () => ({ ok: true, brand: far })) }, `${ROUTE}?id=500`)
    expect(await screen.findByRole('heading', { name: 'Far Away' })).toBeInTheDocument()
    expect(ctl.props.getBrand).toHaveBeenCalledWith(500)
    expect(seen.gen.brand.id).toBe(500)
    expect(urlParams().id).toBe('500')
  })

  it('opens a deep link even when the list has no brands (auditor 15)', async () => {
    const far = brand(500, 'Far Away')
    renderPage({
      getBrand: vi.fn(async () => ({ ok: true, brand: far })),
      brandListState: { loading: false, loaded: true, brands: [], error: null },
      paginationProps: { currentPage: 1, pageSize: 10, totalItems: 0, totalPages: 0 }
    }, `${ROUTE}?id=500`)
    expect(await screen.findByRole('heading', { name: 'Far Away' })).toBeInTheDocument()
  })

  it('does not open «Add new brand» for an id that does not exist: it says «Brand not found» and clears the URL', async () => {
    renderPage({}, `${ROUTE}?id=999&tab=businesses`)
    expect(await screen.findByText('Brand not found')).toBeInTheDocument()
    expect(ctl.props.getBrand).toHaveBeenCalledWith(999)
    expect(screen.queryByRole('heading', { name: 'Add new brand' })).toBeNull()
    expect(screen.queryByRole('tablist', { name: 'Brand sections' })).toBeNull()
    expect(urlParams()).toEqual({})
    // the notice goes when something is opened
    await openBrand('Vips')
    expect(screen.queryByText('Brand not found')).toBeNull()
  })

  it('waits for the first answer of the list before it decides', async () => {
    renderPage({ brandListState: { loading: true, loaded: false, brands: [], error: null } }, `${ROUTE}?id=34`)
    expect(screen.queryByRole('tablist', { name: 'Brand sections' })).toBeNull()
    expect(ctl.props.getBrand).not.toHaveBeenCalled()
    view.update({ brandListState: { loading: false, loaded: true, brands: BRANDS, error: null } })
    expect(await screen.findByRole('heading', { name: 'Vips' })).toBeInTheDocument()
    expect(ctl.props.getBrand).not.toHaveBeenCalled()
  })
})

describe('delete (decision 6; G5-43, G5-44, M-SB9)', () => {
  const askToDelete = async () => {
    await openBrand('Vips')
    await userEvent.click(within(panelRoot()).getByRole('button', { name: 'More actions' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete brand' }))
    return screen.findByRole('alertdialog')
  }

  it('asks first, with the name in <bdi>, the neutral body and the focus on Cancel', async () => {
    renderPage()
    const dialog = await askToDelete()
    expect(within(dialog).getByRole('heading')).toHaveTextContent('Delete Vips?')
    expect(dialog.querySelector('bdi')).toHaveTextContent('Vips')
    // P8: DELETE /franchises/{id} unlinks its stores (franchise_id = null) and leaves its white-label site in place
    expect(dialog).toHaveTextContent("Its stores are left without a brand. Its white-label site is not deleted. This can't be undone.")
    expect(within(dialog).getByRole('button', { name: 'Delete brand' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(ctl.props.handleDeleteBrand).not.toHaveBeenCalled()
  })

  it('Cancel deletes nothing and leaves the panel and the URL as they were', async () => {
    renderPage()
    const dialog = await askToDelete()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(ctl.props.handleDeleteBrand).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Vips' })).toBeInTheDocument()
    expect(urlParams().id).toBe('34')
  })

  it('confirming deletes, closes the dialog and the panel, clears ?id= and ?tab= and sends the focus to the heading of the list', async () => {
    renderPage()
    await openBrand('Vips')
    await userEvent.click(screen.getByRole('tab', { name: 'Stores' }))
    await userEvent.click(within(panelRoot()).getByRole('button', { name: 'More actions' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete brand' }))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete brand' }))
    await waitFor(() => expect(ctl.props.handleDeleteBrand).toHaveBeenCalledWith(34))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(screen.queryByRole('tablist', { name: 'Brand sections' })).toBeNull())
    expect(urlParams()).toEqual({})
    await waitFor(() => expect(screen.getByRole('heading', { name: /^Brands/ })).toHaveFocus())
  })

  it('collapses the page width after a delete from White label (M-SB9)', async () => {
    ctl.configs = { whitelabel_brands_sites: { value: '1' } }
    renderPage()
    await openBrand('Vips')
    await userEvent.click(screen.getByRole('tab', { name: 'White Label' }))
    expect(panelRoot()).toHaveAttribute('data-expanded')
    await userEvent.click(within(panelRoot()).getByRole('button', { name: 'More actions' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete brand' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete brand' }))
    await waitFor(() => expect(panelRoot()).toBeNull())
    // the next brand opens in the split, not as a page
    await openBrand('Hero')
    expect(panelRoot()).not.toHaveAttribute('data-expanded')
  })

  it('says a failed delete in an alert with the API message, and keeps the brand open', async () => {
    renderPage({ handleDeleteBrand: vi.fn(async () => ({ ok: false, error: ['Brand has stores'] })) })
    const dialog = await askToDelete()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete brand' }))
    await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent('Brand has stores'))
    expect(screen.getByRole('heading', { name: 'Vips', hidden: true })).toBeInTheDocument() // behind the alert, still open
    expect(urlParams().id).toBe('34')
  })
})

describe('the discard guard', () => {
  it('asks before another brand opens when General has changes; Keep editing stays, Discard goes', async () => {
    renderPage()
    await openBrand('Vips')
    await userEvent.click(screen.getByRole('button', { name: 'Make dirty' }))
    await userEvent.click(screen.getByText('Hero'))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Discard your changes?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByRole('heading', { name: 'Vips' })).toBeInTheDocument()
    expect(urlParams().id).toBe('34')
    await userEvent.click(screen.getByText('Hero'))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard' }))
    expect(await screen.findByRole('heading', { name: 'Hero' })).toBeInTheDocument()
    expect(urlParams().id).toBe('133')
  })

  it('asks before «Add brand» replaces a brand with changes, and when the panel is closed', async () => {
    renderPage()
    await openBrand('Vips')
    await userEvent.click(screen.getByRole('button', { name: 'Make dirty' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add brand' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await userEvent.click(within(panelRoot()).getByRole('button', { name: 'Close' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Discard your changes?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.queryByRole('tablist', { name: 'Brand sections' })).toBeNull())
    expect(urlParams()).toEqual({})
  })

  it('does not ask when changing tab: General stays mounted with its draft', async () => {
    renderPage()
    await openBrand('Vips')
    await userEvent.click(screen.getByRole('button', { name: 'Make dirty' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Stores' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(await screen.findByTestId('stores')).toBeInTheDocument()
  })

  it('does not ask after the changes are gone', async () => {
    renderPage()
    await openBrand('Vips')
    await userEvent.click(screen.getByRole('button', { name: 'Make dirty' }))
    await userEvent.click(screen.getByRole('button', { name: 'Make clean' }))
    await userEvent.click(screen.getByText('Hero'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(await screen.findByRole('heading', { name: 'Hero' })).toBeInTheDocument()
  })
})
