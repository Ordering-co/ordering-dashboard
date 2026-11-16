import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const state = vi.hoisted(() => ({ props: {}, emit: vi.fn() }))

vi.mock('../../../../../index', () => ({
  BuilderProductsList: ({ UIComponent, ...props }) => <UIComponent {...props} {...state.props} />,
  useEvent: () => [{ emit: state.emit }],
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ parseDate: (value) => `date:${value}` }]
}))
vi.mock('../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]
}))

import { BuilderProducts } from '../BuilderProductsList'
import { TypeFilterMenu } from '../BuilderProductsList/TypeFilterMenu'

const product = {
  id: 41,
  code: 'a8k2m',
  name: 'Repartidores',
  product_type: 'driver_app',
  product_status: 'draft',
  created_at: '2026-10-07 17:02:11',
  apps: [{
    id: 310,
    name: 'Repartidores',
    base: { id: 14, name: 'Driver 26', platforms: ['ios', 'android'] },
    platforms: [],
    builds: [{ platform: 'android', status: 'failed', error_code: null }]
  }]
}

const bases = [
  { id: 14, code: 'app_driver_26', name: 'Driver 26', product_type: 'driver_app', platforms: ['ios', 'android'] },
  { id: 11, code: 'app_marketplace_26', name: 'Marketplace 26', product_type: 'marketplace_app', platforms: ['ios', 'android'] }
]

const baseProps = () => ({
  productsState: { loading: false, products: [product], errorKind: null },
  pagination: { currentPage: 1, pageSize: 10, totalPages: 1, total: 1 },
  filters: { search: '', productTypes: [], productStatus: 'all' },
  catalogState: { loading: false, bases, canCreate: true, unavailableReason: null },
  reloadCatalog: vi.fn(),
  createState: { loading: false, errorCodes: [], error: null },
  reloadProducts: vi.fn(),
  handleChangeSearch: vi.fn(),
  handleChangeType: vi.fn(),
  handleChangeStatus: vi.fn(),
  handleClearFilters: vi.fn(),
  handleChangePage: vi.fn(),
  handleChangePageSize: vi.fn(),
  createProduct: vi.fn(async () => ({ product: { id: 99 }, errorCodes: [] })),
  resetCreateState: vi.fn()
})

// The visible name of a P/RadioGroup option (its accessible name may add the description)
const nameOf = (radio) => document.getElementById(radio.getAttribute('aria-labelledby')).textContent

const renderList = (overrides = {}, options = {}) => {
  state.props = { ...baseProps(), ...overrides }
  return renderWithProviders(<BuilderProducts />, options)
}

describe('BuilderProducts list', () => {
  beforeEach(() => {
    state.emit.mockReset()
  })

  it('shows each app with platform icons only, without a Base column', () => {
    renderList()
    const table = screen.getByRole('table')
    expect(within(table).queryByText('Base')).toBeNull()
    expect(within(table).getByRole('columnheader', { name: 'Platforms' })).toBeTruthy()
    expect(within(table).getByRole('link', { name: 'Repartidores' }).getAttribute('href')).toBe('/builder/41')
    expect(within(table).getByRole('img', { name: 'iOS: Not built yet' })).toBeTruthy()
    expect(within(table).getByRole('img', { name: 'Android: Failed' })).toBeTruthy()
    expect(within(table).queryByText('Failed')).toBeNull()
    expect(within(table).getByText('Driver app')).toBeTruthy()
    expect(within(table).getByText('Draft')).toBeTruthy()
  })

  it('shows the build status in a tooltip on hover and focus', async () => {
    renderList()
    // redesign B1: P/Tooltip (Base UI) opens on real pointer and keyboard events
    const user = userEvent.setup()
    const android = screen.getByRole('img', { name: 'Android: Failed' })
    expect(android.getAttribute('tabindex')).toBe('0')
    await user.hover(android)
    expect((await screen.findByRole('tooltip')).textContent).toBe('Android: Failed')
    await user.unhover(android)
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
    const ios = screen.getByRole('img', { name: 'iOS: Not built yet' })
    for (let i = 0; i < 20 && document.activeElement !== ios; i++) await user.tab()
    expect((await screen.findByRole('tooltip')).textContent).toBe('iOS: Not built yet')
  })

  it('opens the detail from the row', () => {
    renderList()
    fireEvent.click(screen.getByText('a8k2m'))
    expect(state.emit).toHaveBeenCalledWith('go_to_page', { page: 'builder_app', params: { productId: 41 } })
  })

  it('sends search and status changes to the controller, with no type filter while only Marketplace websites are listed', () => {
    const props = baseProps()
    renderList(props)
    // redesign B1: P/SearchField (a searchbox); the search still waits 750 ms after the last key, as main's SearchBar
    vi.useFakeTimers()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search by name' }), { target: { value: 'rep' } })
    act(() => { vi.advanceTimersByTime(700) })
    expect(props.handleChangeSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(100) })
    vi.useRealTimers()
    expect(props.handleChangeSearch).toHaveBeenCalledWith('rep')
    expect(screen.queryByRole('button', { name: /^Type:/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Archived' }))
    expect(props.handleChangeStatus).toHaveBeenCalledWith('archived')
  })

  it('says Create isn’t turned on when the project has no self-service', () => {
    renderList({ catalogState: { loading: false, bases: [], canCreate: false, unavailableReason: 'not_enabled' } })
    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull()
    expect(screen.getByText(/isn’t turned on for this project yet/)).toBeTruthy()
    expect(screen.queryByText(/nothing to create right now/)).toBeNull()
  })

  it('says there is nothing to create when the catalog is empty', () => {
    renderList({ catalogState: { loading: false, bases: [], canCreate: false, unavailableReason: 'empty' } })
    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull()
    expect(screen.getByText(/There’s nothing to create right now/)).toBeTruthy()
    expect(screen.queryByText(/isn’t turned on/)).toBeNull()
  })

  it('offers a retry when the catalog fails', () => {
    const props = baseProps()
    renderList({ ...props, catalogState: { loading: false, bases: [], canCreate: false, unavailableReason: 'error' } })
    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull()
    expect(screen.getByText('We couldn’t check what you can create.')).toBeTruthy()
    expect(screen.queryByText(/isn’t turned on/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.reloadCatalog).toHaveBeenCalled()
  })

  it('invites to create the first app in an empty project', () => {
    renderList({ productsState: { loading: false, products: [], errorKind: null } })
    expect(screen.getByText('Nothing here yet')).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Create' })).toHaveLength(2)
  })

  it('offers to clear a search with no matches', () => {
    const props = baseProps()
    renderList({ ...props, productsState: { loading: false, products: [], errorKind: null }, filters: { search: 'zzz', productTypes: [], productStatus: 'all' } })
    expect(screen.getByText('Nothing matches your search')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search and filters' }))
    expect(props.handleClearFilters).toHaveBeenCalled()
  })

  it('offers a retry when the list fails', () => {
    const props = baseProps()
    renderList({ ...props, productsState: { loading: false, products: [], errorKind: 'error' } })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.reloadProducts).toHaveBeenCalled()
  })

  it('blocks the page when the module is off', () => {
    renderList({ productsState: { loading: false, products: [], errorKind: 'disabled' } })
    expect(screen.getByText('Builder isn’t available here')).toBeTruthy()
    expect(screen.queryByRole('searchbox', { name: 'Search by name' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull()
  })

  it('validates the create panel, then creates and opens the new app', async () => {
    const props = baseProps()
    renderList(props)
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    const panel = screen.getByRole('dialog', { name: 'New app or website' })

    await act(async () => { fireEvent.click(within(panel).getByRole('button', { name: 'Create app' })) })
    expect(within(panel).getByText('Enter a name.')).toBeTruthy()
    expect(within(panel).getByText('Choose what you want to create.')).toBeTruthy()
    expect(props.createProduct).not.toHaveBeenCalled()

    // Bases follow the product order: Marketplace before Driver. Only apps: no switch
    // redesign B1: P/RadioGroup (cards): radios are buttons named by their label, checked by aria-checked
    expect(within(panel).queryByRole('radiogroup', { name: 'What do you want to create?' })).toBeNull()
    const radios = within(panel).getAllByRole('radio')
    expect(radios.map(nameOf)).toEqual(['Marketplace app', 'Driver app'])
    expect(within(panel).getByText('0/30')).toBeTruthy()

    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: '  Repartidores  ' } })
    fireEvent.click(radios[1])
    await act(async () => { fireEvent.click(within(panel).getByRole('button', { name: 'Create app' })) })

    expect(props.createProduct).toHaveBeenCalledWith({ builderBaseId: 14, name: 'Repartidores' })
    expect(state.emit).toHaveBeenCalledWith('go_to_page', { page: 'builder_app', params: { productId: 99 } })
    expect(screen.queryByRole('dialog', { name: 'New app or website' })).toBeNull()
  })

  it('asks for another option when the base was withdrawn', async () => {
    const props = baseProps()
    props.createProduct = vi.fn(async () => ({ product: null, errorCodes: ['builder_base.not_offered'] }))
    renderList(props)
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    const panel = screen.getByRole('dialog', { name: 'New app or website' })
    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Repartidores' } })
    fireEvent.click(within(panel).getAllByRole('radio')[1])
    await act(async () => { fireEvent.click(within(panel).getByRole('button', { name: 'Create app' })) })

    expect(within(panel).getByText('Driver 26 is no longer available. Choose another option.')).toBeTruthy()
    expect(within(panel).getAllByRole('radio').every(radio => radio.getAttribute('aria-checked') !== 'true')).toBe(true)
    expect(state.emit).not.toHaveBeenCalled()
  })

  it('opens the panel from ⌘K only when Create is offered', () => {
    renderList({}, { initialEntries: ['/builder?add=1'] })
    expect(screen.getByRole('dialog', { name: 'New app or website' })).toBeTruthy()
  })

  it('ignores ⌘K Create when the catalog is unavailable', () => {
    renderList({ catalogState: { loading: false, bases: [], canCreate: false, unavailableReason: 'not_enabled' } }, { initialEntries: ['/builder?add=1'] })
    expect(screen.queryByRole('dialog', { name: 'New app or website' })).toBeNull()
  })

  // redesign B1: the list is drawn with the Product pieces
  it('is drawn with the Product pieces', () => {
    const props = baseProps()
    renderList({ ...props, pagination: { currentPage: 1, pageSize: 10, totalPages: 3, total: 25 } })
    expect(screen.getByRole('heading', { level: 1, name: 'Builder' }).closest('.odc-pagehead')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Create' })).toHaveClass('odc-btn')
    expect(screen.getByRole('table').closest('.odc-table-wrap, .odc-table')).not.toBeNull()
    expect(screen.getByRole('group', { name: 'Status' }).closest('.odc-seg')).not.toBeNull()
    const pages = screen.getByRole('navigation', { name: 'Pagination' })
    fireEvent.click(within(pages).getByRole('button', { name: 'Next page' }))
    expect(props.handleChangePage).toHaveBeenCalledWith(2)
  })

  it('shows loading rows while the list loads', () => {
    const { container } = renderList({ productsState: { loading: true, products: [], errorKind: null } })
    expect(container.querySelector('.react-loading-skeleton')).toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  it('keeps the search the controller clears', async () => {
    const props = baseProps()
    const view = renderList({ ...props, filters: { search: 'zzz', productTypes: [], productStatus: 'all' } })
    expect(screen.getByRole('searchbox', { name: 'Search by name' }).value).toBe('zzz')
    state.props = { ...props, filters: { search: '', productTypes: [], productStatus: 'all' } }
    view.rerender(<BuilderProducts />)
    await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Search by name' }).value).toBe(''))
  })

  // redesign B1, parity review: what main did that the first Product version lost or never checked
  it('creates once when Create is pressed twice while it is creating', async () => {
    const props = baseProps()
    let finish
    props.createProduct = vi.fn(() => new Promise(resolve => { finish = resolve }))
    renderList(props)
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    const panel = screen.getByRole('dialog', { name: 'New app or website' })
    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Repartidores' } })
    fireEvent.click(within(panel).getAllByRole('radio')[1])
    const submit = within(panel).getByRole('button', { name: 'Create app' })
    await act(async () => { fireEvent.click(submit) })
    await act(async () => { fireEvent.click(submit) })
    expect(props.createProduct).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ product: { id: 99 }, errorCodes: [] }) })
  })

  it('reads the name counter as part of the field', () => {
    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    const name = screen.getByLabelText('Name')
    const described = (name.getAttribute('aria-describedby') || '').split(' ').map(id => document.getElementById(id)?.textContent)
    expect(described).toContain('0/30')
  })

  it('searches at once when the search is cleared', () => {
    const props = baseProps()
    renderList({ ...props, filters: { search: 'rep', productTypes: [], productStatus: 'all' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(props.handleChangeSearch).toHaveBeenCalledWith('')
  })

  it('pages by the pages the API counts when its total does not match them', () => {
    const props = baseProps()
    renderList({ ...props, pagination: { currentPage: 1, pageSize: 10, totalPages: 3, total: 1 } })
    const pages = screen.getByRole('navigation', { name: 'Pagination' })
    fireEvent.click(within(pages).getByRole('button', { name: 'Next page' }))
    expect(props.handleChangePage).toHaveBeenCalledWith(2)
  })

  // redesign B1, coordinator review: main's SideBar never closed on an outside click (and Escape only from 1000px), so a
  // typed name was never lost by accident. The sheet asks before it drops one.
  describe('closing the create panel with a name typed', () => {
    const openWithName = () => {
      renderList()
      fireEvent.click(screen.getByRole('button', { name: 'Create' }))
      const panel = screen.getByRole('dialog', { name: 'New app or website' })
      fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Repartidores' } })
      return panel
    }

    it('asks on Escape, and «Keep editing» keeps the name', async () => {
      const panel = openWithName()
      fireEvent.keyDown(within(panel).getByLabelText('Name'), { key: 'Escape' })
      const ask = await screen.findByRole('alertdialog', { name: 'Discard your changes?' })
      fireEvent.click(within(ask).getByRole('button', { name: 'Keep editing' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      expect(within(screen.getByRole('dialog', { name: 'New app or website' })).getByLabelText('Name').value).toBe('Repartidores')
    })

    it('asks on a click on the scrim and on Cancel, and «Discard» closes', async () => {
      const panel = openWithName()
      fireEvent.click(document.querySelector('.odc-overlay-backdrop'))
      expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
      fireEvent.click(within(panel).getByRole('button', { name: 'Cancel' }))
      fireEvent.click(within(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).getByRole('button', { name: 'Discard' }))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New app or website' })).toBeNull())
    })

    it('closes at once when nothing is typed', async () => {
      renderList()
      fireEvent.click(screen.getByRole('button', { name: 'Create' }))
      fireEvent.click(within(screen.getByRole('dialog', { name: 'New app or website' })).getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New app or website' })).toBeNull())
      expect(screen.queryByRole('alertdialog')).toBeNull()
    })
  })

  describe('websites', () => {
    const web = {
      id: 43,
      code: 'fleet-mountain-7zoeit',
      name: 'Prueba web',
      kind: 'web',
      product_type: 'marketplace_website',
      product_status: 'draft',
      domain: null,
      temporal_domain: 'fleet-mountain-7zoeit-stores.my-sites.app',
      created_at: '2026-10-08 17:40:00',
      apps: []
    }
    const catalog = [
      ...bases,
      { id: null, product_type: 'marketplace_website', kind: 'web' },
      { id: null, product_type: 'franchise_website', kind: 'web' },
      { id: null, product_type: 'dashboard', kind: 'web' }
    ]

    it('shows a website with its domain instead of platforms', () => {
      renderList({ productsState: { loading: false, products: [web, product], errorKind: null } })
      const [, webRow] = screen.getAllByRole('row')
      expect(within(webRow).getByText('Marketplace website')).toBeTruthy()
      const link = within(webRow).getByRole('link', { name: /fleet-mountain-7zoeit-stores\.my-sites\.app/ })
      expect(link.getAttribute('href')).toBe('https://fleet-mountain-7zoeit-stores.my-sites.app')
      expect(link.getAttribute('target')).toBe('_blank')
      fireEvent.click(link)
      expect(state.emit).not.toHaveBeenCalled()
    })

    // redesign B4: the type filter is a Product filter pill (P/FilterPopover) with Product checkboxes: the pill is
    // named «Type» plus what it holds, the popup is named by it, and Escape closes it with the focus back on the pill
    it('filters by type from a pill grouped in apps and websites', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      const { rerender } = renderWithProviders(<TypeFilterMenu value={[]} onChange={onChange} />)
      const pill = screen.getByRole('button', { name: 'Type' })
      expect(pill).toHaveClass('odc-pill')
      expect(pill).toHaveAttribute('aria-haspopup', 'dialog')
      await user.click(pill)
      const popup = await screen.findByRole('dialog', { name: 'Type' })
      fireEvent.click(within(popup).getByRole('checkbox', { name: 'Driver app' }))
      expect(onChange).toHaveBeenCalledWith(['driver_app'])
      const websites = within(popup).getByRole('group', { name: /Websites/ })
      fireEvent.click(within(websites).getByRole('button', { name: 'Select all' }))
      expect(onChange).toHaveBeenCalledWith(['marketplace_website', 'franchise_website', 'dashboard'])

      rerender(<TypeFilterMenu value={['marketplace_website', 'franchise_website', 'dashboard']} onChange={onChange} />)
      expect(screen.getByRole('button', { name: /^Type\s*Websites$/ })).toHaveAttribute('data-active')
      expect(within(screen.getByRole('group', { name: /Websites/ })).getByRole('checkbox', { name: 'Dashboard' })).toHaveAttribute('aria-checked', 'true')
      fireEvent.click(within(screen.getByRole('group', { name: /Websites/ })).getByRole('button', { name: 'Clear' }))
      expect(onChange).toHaveBeenLastCalledWith([])
      fireEvent.click(screen.getByRole('button', { name: 'All types' }))
      expect(onChange).toHaveBeenLastCalledWith([])
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Type' })).toBeNull())
      expect(screen.getByRole('button', { name: /^Type\s*Websites$/ })).toHaveFocus()
    })

    it('creates a website from its type, without a base', async () => {
      const props = baseProps()
      props.catalogState = { loading: false, bases: catalog, canCreate: true, unavailableReason: null }
      props.createProduct = vi.fn(async () => ({ product: { id: 43 }, errorCodes: [] }))
      renderList(props)
      fireEvent.click(screen.getByRole('button', { name: 'Create' }))
      const panel = screen.getByRole('dialog', { name: 'New app or website' })
      expect(within(panel).getByRole('heading', { name: 'New app or website' })).toBeTruthy()
      // Apps first: only their types
      const kinds = within(panel).getByRole('radiogroup', { name: 'What do you want to create?' })
      expect(within(kinds).getByRole('radio', { name: 'Apps' })).toHaveAttribute('aria-checked', 'true')
      expect(within(within(panel).getByRole('radiogroup', { name: 'Type of app' })).getAllByRole('radio').map(nameOf))
        .toEqual(['Marketplace app', 'Driver app'])
      expect(within(panel).queryByText(/Websites go online right away/)).toBeNull()

      fireEvent.click(within(kinds).getByRole('radio', { name: 'Websites' }))
      expect(within(panel).queryByRole('radiogroup', { name: 'Type of app' })).toBeNull()
      const websites = within(panel).getByRole('radiogroup', { name: /Type of website/ })
      expect(within(websites).getAllByRole('radio').map(nameOf))
        .toEqual(['Marketplace website', 'Franchise website', 'Dashboard'])
      expect(within(panel).getByText(/Websites go online right away at a temporary address/)).toBeTruthy()
      expect(within(panel).getByText('0/100')).toBeTruthy()

      fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Ops' } })
      fireEvent.click(within(websites).getByRole('radio', { name: /Dashboard/ }))
      await act(async () => { fireEvent.click(within(panel).getByRole('button', { name: 'Create website' })) })
      expect(props.createProduct).toHaveBeenCalledWith({ productType: 'dashboard', name: 'Ops' })
      expect(state.emit).toHaveBeenCalledWith('go_to_page', { page: 'builder_app', params: { productId: 43 } })
    })

    it('flags a website name too long for an app, without cutting it', async () => {
      const props = baseProps()
      props.catalogState = { loading: false, bases: catalog, canCreate: true, unavailableReason: null }
      renderList(props)
      fireEvent.click(screen.getByRole('button', { name: 'Create' }))
      const panel = screen.getByRole('dialog', { name: 'New app or website' })
      const kinds = within(panel).getByRole('radiogroup', { name: 'What do you want to create?' })
      fireEvent.click(within(kinds).getByRole('radio', { name: 'Websites' }))
      const longName = 'Burger Town online ordering for Downtown'
      fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: longName } })
      fireEvent.click(within(panel).getByRole('radio', { name: /Dashboard/ }))

      fireEvent.click(within(kinds).getByRole('radio', { name: 'Apps' }))
      expect(within(panel).getByLabelText('Name').value).toBe(longName)
      expect(within(panel).getByText('App names use 30 characters or fewer. Shorten it, or switch back to Websites.')).toBeTruthy()
      expect(within(panel).getByText('40/30')).toBeTruthy()
      // The website type picked doesn't belong to apps
      expect(within(within(panel).getByRole('radiogroup', { name: 'Type of app' })).getAllByRole('radio').every(radio => radio.getAttribute('aria-checked') !== 'true')).toBe(true)

      fireEvent.click(within(panel).getByRole('radio', { name: /Driver app/ }))
      await act(async () => { fireEvent.click(within(panel).getByRole('button', { name: 'Create app' })) })
      expect(props.createProduct).not.toHaveBeenCalled()
    })

    it('says when a type can’t be created', () => {
      const props = baseProps()
      props.catalogState = { loading: false, bases: catalog, canCreate: true, unavailableReason: null }
      props.createState = { loading: false, errorCodes: ['product_type.in'], error: 'error' }
      renderList(props)
      fireEvent.click(screen.getByRole('button', { name: 'Create' }))
      expect(screen.getByText('This type can’t be created here. Choose another one.')).toBeTruthy()
      expect(screen.queryByText('We couldn’t create it. Try again.')).toBeNull()
    })
  })
})
