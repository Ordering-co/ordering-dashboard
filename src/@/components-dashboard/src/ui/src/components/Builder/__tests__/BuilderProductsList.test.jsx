import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
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
vi.mock('../../../styles', () => ({
  Button: ({ color, borderRadius, ...props }) => <button {...props} />,
  IconButton: ({ color, ...props }) => <button {...props} />,
  Input: (props) => <input {...props} />
}))
vi.mock('../../Shared', () => ({
  Pagination: () => <div data-testid='pagination' />,
  SearchBar: ({ placeholder, onSearch }) => (
    <input aria-label={placeholder} onChange={(e) => onSearch(e.target.value)} />
  )
}))
vi.mock('../../Shared/SideBar', () => ({
  SideBar: ({ children, onClose }) => (
    <div data-testid='side-panel'>
      <button type='button' onClick={onClose}>close panel</button>
      {children}
    </div>
  )
}))

import { BuilderProducts } from '../BuilderProductsList'

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
    const android = screen.getByRole('img', { name: 'Android: Failed' })
    expect(android.getAttribute('tabindex')).toBe('0')
    await act(async () => { fireEvent.mouseOver(android) })
    expect((await screen.findByRole('tooltip')).textContent).toBe('Android: Failed')
    await act(async () => { fireEvent.mouseOut(android) })
    await act(async () => { fireEvent.focus(screen.getByRole('img', { name: 'iOS: Not built yet' })) })
    expect((await screen.findByRole('tooltip')).textContent).toBe('iOS: Not built yet')
  })

  it('opens the detail from the row', () => {
    renderList()
    fireEvent.click(screen.getByText('a8k2m'))
    expect(state.emit).toHaveBeenCalledWith('go_to_page', { page: 'builder_app', params: { productId: 41 } })
  })

  it('sends search, type and status changes to the controller', () => {
    const props = baseProps()
    renderList(props)
    fireEvent.change(screen.getByRole('textbox', { name: 'Search by name' }), { target: { value: 'rep' } })
    expect(props.handleChangeSearch).toHaveBeenCalledWith('rep')
    fireEvent.click(screen.getByRole('button', { name: 'Type: All' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Driver app' }))
    expect(props.handleChangeType).toHaveBeenCalledWith(['driver_app'])
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
    expect(screen.queryByTestId('pagination')).toBeNull()
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
    expect(screen.queryByRole('textbox', { name: 'Search by name' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull()
  })

  it('validates the create panel, then creates and opens the new app', async () => {
    const props = baseProps()
    renderList(props)
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    const panel = screen.getByTestId('side-panel')

    await act(async () => { fireEvent.click(within(panel).getByRole('button', { name: 'Create app' })) })
    expect(within(panel).getByText('Enter a name.')).toBeTruthy()
    expect(within(panel).getByText('Choose what you want to create.')).toBeTruthy()
    expect(props.createProduct).not.toHaveBeenCalled()

    // Bases follow the product order: Marketplace before Driver. Only apps: no switch
    expect(within(panel).queryByRole('group', { name: 'What do you want to create?' })).toBeNull()
    const radios = within(panel).getAllByRole('radio')
    expect(radios.map(radio => radio.value)).toEqual(['app-11', 'app-14'])
    expect(within(panel).getByText('0/30')).toBeTruthy()

    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: '  Repartidores  ' } })
    fireEvent.click(radios[1])
    await act(async () => { fireEvent.click(within(panel).getByRole('button', { name: 'Create app' })) })

    expect(props.createProduct).toHaveBeenCalledWith({ builderBaseId: 14, name: 'Repartidores' })
    expect(state.emit).toHaveBeenCalledWith('go_to_page', { page: 'builder_app', params: { productId: 99 } })
    expect(screen.queryByTestId('side-panel')).toBeNull()
  })

  it('asks for another option when the base was withdrawn', async () => {
    const props = baseProps()
    props.createProduct = vi.fn(async () => ({ product: null, errorCodes: ['builder_base.not_offered'] }))
    renderList(props)
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    const panel = screen.getByTestId('side-panel')
    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Repartidores' } })
    fireEvent.click(within(panel).getAllByRole('radio')[1])
    await act(async () => { fireEvent.click(within(panel).getByRole('button', { name: 'Create app' })) })

    expect(within(panel).getByText('Driver 26 is no longer available. Choose another option.')).toBeTruthy()
    expect(within(panel).getAllByRole('radio').every(radio => !radio.checked)).toBe(true)
    expect(state.emit).not.toHaveBeenCalled()
  })

  it('opens the panel from ⌘K only when Create is offered', () => {
    renderList({}, { initialEntries: ['/builder?add=1'] })
    expect(screen.getByTestId('side-panel')).toBeTruthy()
  })

  it('ignores ⌘K Create when the catalog is unavailable', () => {
    renderList({ catalogState: { loading: false, bases: [], canCreate: false, unavailableReason: 'not_enabled' } }, { initialEntries: ['/builder?add=1'] })
    expect(screen.queryByTestId('side-panel')).toBeNull()
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

    it('filters by type from a menu grouped in apps and websites', () => {
      const props = baseProps()
      const { rerender } = renderList(props)
      fireEvent.click(screen.getByRole('button', { name: 'Type: All' }))
      const websites = screen.getByRole('group', { name: /Websites/ })
      fireEvent.click(within(websites).getByRole('button', { name: 'Select all' }))
      expect(props.handleChangeType).toHaveBeenCalledWith(['marketplace_website', 'franchise_website', 'dashboard'])

      state.props = { ...props, filters: { search: '', productTypes: ['marketplace_website', 'franchise_website', 'dashboard'], productStatus: 'all' } }
      rerender(<BuilderProducts />)
      expect(screen.getByRole('button', { name: 'Type: Websites' })).toBeTruthy()
      fireEvent.click(within(screen.getByRole('group', { name: /Websites/ })).getByRole('button', { name: 'Clear' }))
      expect(props.handleChangeType).toHaveBeenLastCalledWith([])
      fireEvent.keyDown(screen.getByRole('button', { name: 'Type: Websites' }), { key: 'Escape' })
      expect(screen.queryByRole('group', { name: /Websites/ })).toBeNull()
    })

    it('creates a website from its type, without a base', async () => {
      const props = baseProps()
      props.catalogState = { loading: false, bases: catalog, canCreate: true, unavailableReason: null }
      props.createProduct = vi.fn(async () => ({ product: { id: 43 }, errorCodes: [] }))
      renderList(props)
      fireEvent.click(screen.getByRole('button', { name: 'Create' }))
      const panel = screen.getByTestId('side-panel')
      expect(within(panel).getByRole('heading', { name: 'New app or website' })).toBeTruthy()
      // Apps first: only their types
      const kinds = within(panel).getByRole('group', { name: 'What do you want to create?' })
      expect(within(kinds).getByRole('radio', { name: 'Apps' }).checked).toBe(true)
      expect(within(within(panel).getByRole('group', { name: 'Type of app' })).getAllByRole('radio').map(radio => radio.value))
        .toEqual(['app-11', 'app-14'])
      expect(within(panel).queryByText(/Websites go online right away/)).toBeNull()

      fireEvent.click(within(kinds).getByRole('radio', { name: 'Websites' }))
      expect(within(panel).queryByRole('group', { name: 'Type of app' })).toBeNull()
      const websites = within(panel).getByRole('group', { name: /Type of website/ })
      expect(within(websites).getAllByRole('radio').map(radio => radio.value))
        .toEqual(['web-marketplace_website', 'web-franchise_website', 'web-dashboard'])
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
      const panel = screen.getByTestId('side-panel')
      const kinds = within(panel).getByRole('group', { name: 'What do you want to create?' })
      fireEvent.click(within(kinds).getByRole('radio', { name: 'Websites' }))
      const longName = 'Burger Town online ordering for Downtown'
      fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: longName } })
      fireEvent.click(within(panel).getByRole('radio', { name: /Dashboard/ }))

      fireEvent.click(within(kinds).getByRole('radio', { name: 'Apps' }))
      expect(within(panel).getByLabelText('Name').value).toBe(longName)
      expect(within(panel).getByText('App names use 30 characters or fewer. Shorten it, or switch back to Websites.')).toBeTruthy()
      expect(within(panel).getByText('40/30')).toBeTruthy()
      // The website type picked doesn't belong to apps
      expect(within(within(panel).getByRole('group', { name: 'Type of app' })).getAllByRole('radio').every(radio => !radio.checked)).toBe(true)

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
