/* eslint-disable import/first */
// redesign franchises-website (; D2, D3, D4): the legacy editor as /my-products/franchises-website draws it (`isFranchise`,
// no `layout`, P-OW3). Covered: the site selector shows the site being edited (FW-01), «Default domain › Visit» opens the franchise
// site's own temporal domain when it has one (FW-02), and the name placeholder per surface (FW-03; the brand's own text came with
// D4). The controller is a stand-in: its props are simulated; the heavy children the Basic tab never needs are stubbed.
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useHistory, useLocation } from 'react-router-dom'

import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'

const mockState = vi.hoisted(() => ({ sites: [], history: null }))

const translate = (_key, text) => text

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, translate],
  useConfig: () => [{ configs: {} }],
  useApi: () => [{ project: 'demo' }, { configurations: { subdomain: 'orderingplus' } }],
  useSite: () => [{ sites: mockState.sites }],
  useSession: () => [{ user: { level: 0 } }],
  useUtils: () => [{ optimizeImage: (src) => src }],
  ExamineClick: ({ children }) => <>{children}</>,
  DragAndDrop: ({ children }) => <>{children}</>,
  OrderingWebsite: () => null
}))
vi.mock('../../ContentForm', () => ({ ContentForm: () => null }))
vi.mock('../../AdvancedSettings', () => ({ AdvancedSettings: () => null }))
vi.mock('../../OrderingWidgets', () => ({ OrderingWidgets: () => null }))
vi.mock('../../WhiteLabelCustomDomain', () => ({ WhiteLabelCustomDomain: () => null }))
vi.mock('../../WhiteLabelCustomDomain/WhiteLabelCustomDomainBlock', () => ({ WhiteLabelCustomDomainBlock: () => null }))
vi.mock('../../CustomDomain', () => ({ CustomDomain: () => null }))
vi.mock('../../../Settings', () => ({ FilterSettings: () => null }))

import { InfoShareContext } from '../../../../contexts/InfoShareContext'
import { ProjectContext } from '../../../../contexts/ProjectContext'
import { OrderingWebsiteUI } from '../index'

const theme = {
  ...defaultTheme,
  images: {
    preview: { marketplace: 'marketplace.png', franchise: 'franchise.png', singleStore: 'single.png' },
    myProducts: { orderingWebsite: 'ordering-website.png' }
  }
}

const MAIN = { id: 199, code: 'web_franchises_x', type: 'franchiseweb', name: 'Franchise website', temporal_domain: null }
const BRAND = { id: 166, code: 'web_dashboard_x', type: 'dashboardweb', name: 'Ordering Dashboard' }
const OTHER = { id: 397, code: 'other-franchise', type: 'franchiseweb', name: 'Other franchise', temporal_domain: 'other-franchise-stores.my-sites.app' }

const makeProps = (overrides = {}) => ({
  orderingTheme: { loading: false, themes: [{ theme_id: 1, site_id: MAIN.id }], error: null },
  themeValues: {
    website_theme: { components: { type: 'franchise', franchise_slug: null } },
    images: { components: { homepage_image_fullscreen: false } },
    theme_settings: { components: { style: { background_page: '#FFFFFF' }, values: { homepage_content: '', footer_content: '' } } }
  },
  setThemeValues: vi.fn(),
  advancedValues: {},
  setAdvancedValues: vi.fn(),
  themesList: { loading: false, themes: [], error: null },
  site: MAIN,
  setSite: vi.fn(),
  businessesList: { loading: false, businesses: [], error: null },
  franchisesList: { loading: false, franchises: [], error: null },
  handleChangeInput: vi.fn(),
  formState: { loading: false, changes: {}, error: null },
  handleUpdateSite: vi.fn(),
  handleUpdateSiteTheme: vi.fn(),
  // what src/pages/FranchisesWebsite passes
  appId: 'web_franchises_x',
  type: 'franchiseweb',
  name: 'Franchise website',
  isFranchise: true,
  disableReplaceCode: true,
  setAppIdState: vi.fn(),
  ...overrides
})

const LocationProbe = () => {
  const location = useLocation()
  mockState.history = useHistory()
  return <output data-testid='location'>{`${location.pathname}${location.search}`}</output>
}

const tree = (props) => (
  <>
    <OrderingWebsiteUI {...props} />
    <LocationProbe />
  </>
)

const render = (props, { route = '/my-products/franchises-website', websiteProduct = 'web_franchises_x' } = {}) => {
  const Wrapper = ({ children }) => (
    <ProjectContext.Provider value={[{ websiteProduct }, {}]}>
      <InfoShareContext.Provider value={[{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]}>
        {children}
      </InfoShareContext.Provider>
    </ProjectContext.Provider>
  )
  const result = renderWithProviders(tree(props), { initialEntries: [route], theme, wrapper: Wrapper })
  // what the controller does when its state changes: the same editor with new props
  return { ...result, update: (next) => result.rerender(tree(next)) }
}

const visitLink = () => screen.getByText('Visit', { exact: false }).closest('div')?.querySelector('a')

beforeEach(() => {
  mockState.sites = [MAIN, OTHER]
  mockState.history = null
})

describe('franchises website · legacy editor', () => {
  it('FW-01 · the site selector shows the site being edited, also when it is not web_franchises_x (?appId=)', () => {
    render(makeProps({ appId: OTHER.code, site: OTHER }))
    expect(screen.getAllByText('Other franchise').length).toBeGreaterThan(0)
  })

  it('FW-01 · with the main franchise site the selector shows it', () => {
    render(makeProps())
    expect(screen.getAllByText('Franchise website').length).toBeGreaterThan(0)
    expect(screen.queryByText('Other franchise')).toBeNull()
  })

  it('FW-01 · with one franchise site there is no selector', () => {
    mockState.sites = [MAIN]
    render(makeProps())
    expect(screen.queryByText('Select site')).toBeNull()
  })

  it('FW-02 · «Visit» opens the franchise site\'s own temporal domain when it has one', () => {
    render(makeProps({ appId: OTHER.code, site: OTHER }))
    expect(visitLink()).toHaveAttribute('href', 'https://other-franchise-stores.my-sites.app')
  })

  it('FW-02 · without a temporal domain «Visit» is the project\'s franchises website, as in main', () => {
    render(makeProps())
    expect(visitLink()).toHaveAttribute('href', 'https://demo.franchises.orderingplus.com')
  })

  it('FW-03 · the franchise name placeholder is «Source demo franchise website»', () => {
    render(makeProps())
    expect(document.querySelector('input[name="name"]')).toHaveAttribute('placeholder', 'Source demo franchise website')
  })

  // redesign my-products-dashboard (D4 / DB-03): the brand gets the text main's ternary meant (an existing key)
  it('FW-03 · the brand (isDashboard) name placeholder is «Source demo dashboard»', () => {
    mockState.sites = []
    render(makeProps({ isFranchise: false, isDashboard: true, appId: 'web_dashboard_x', site: BRAND }), { route: '/my-products/dashboard' })
    expect(document.querySelector('input[name="name"]')).toHaveAttribute('placeholder', 'Source demo dashboard')
  })

  it('FW-03 · the ordering website keeps «Source demo website»', () => {
    mockState.sites = []
    render(makeProps({ isFranchise: false, disableReplaceCode: undefined, type: undefined, appId: 'website', site: { id: 34, code: 'website', type: null, name: 'Marketplace Website' } }), { route: '/my-products/ordering-website', websiteProduct: 'web_marketplace_26' })
    expect(document.querySelector('input[name="name"]')).toHaveAttribute('placeholder', 'Source demo website')
  })
})

// redesign my-products-dashboard (D3 / DB-02): what src/pages/Dashboard passes; the brand's Save is off while it saves
describe('brand (/my-products/dashboard) · legacy editor', () => {
  const brandProps = (formState) => makeProps({
    isFranchise: false,
    disableReplaceCode: undefined,
    isDashboard: true,
    appId: 'web_dashboard_x',
    type: 'dashboardweb',
    site: BRAND,
    formState
  })
  const saveButton = () => document.querySelector('button.save-site-settings')

  it('DB-02 · Save shows with pending changes and stays enabled while idle', () => {
    mockState.sites = []
    render(brandProps({ loading: false, changes: { name: 'New name' }, error: null }), { route: '/my-products/dashboard' })
    expect(saveButton()).not.toBeNull()
    expect(saveButton()).not.toBeDisabled()
  })

  it('DB-02 · Save is disabled while the site save is in flight (no second POST)', () => {
    mockState.sites = []
    render(brandProps({ loading: true, changes: { name: 'New name' }, error: null }), { route: '/my-products/dashboard' })
    expect(saveButton()).toBeDisabled()
  })
})

// redesign D-81 part B (owner, 2026-10-19): the legacy editor of /my-products/franchises-website and /my-products/dashboard
// asks «Keep editing · Save and continue · Discard» before a way out with unsaved changes. Dirty = the pending site fields
// (`formState.changes`) or the theme drafts (`themeValues`, `advancedValues`) against what the controller has saved.
describe('leaving the legacy editor with unsaved changes (D-81, part B)', () => {
  const OTHER_PAGE = '/my-products/dashboard'
  const SAVED_THEME = { website_theme: { components: { type: 'franchise', franchise_slug: null } } }
  const saved = (overrides = {}) => ({
    savedSite: MAIN,
    savedValues: { my_products: { components: SAVED_THEME }, general: { components: { favicon: 'a.png' } } },
    themeValues: SAVED_THEME,
    advancedValues: { my_products: { components: SAVED_THEME }, general: { components: { favicon: 'a.png' } } },
    handleUpdateSiteTheme: vi.fn().mockResolvedValue({ ok: true }),
    discardChanges: vi.fn(),
    ...overrides
  })
  const clean = (overrides = {}) => makeProps(saved(overrides))
  const dirty = (overrides = {}) => clean({
    site: { ...MAIN, name: 'New name' },
    formState: { loading: false, changes: { name: 'New name' }, error: null },
    ...overrides
  })
  const dialog = () => screen.queryByRole('alertdialog')
  const location = () => screen.getByTestId('location').textContent
  const leaveTo = (path) => act(() => mockState.history.push(path))
  const press = async (user, name) => user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name }))

  it('a route change with a pending site field asks, and the address does not move', async () => {
    render(dirty())
    leaveTo(OTHER_PAGE)
    const asking = await screen.findByRole('alertdialog')
    expect(within(asking).getByText('Save your changes?')).toBeInTheDocument()
    expect(within(asking).getByText(/You have unsaved changes in Franchise website\./)).toBeInTheDocument()
    expect(within(asking).getByRole('button', { name: 'Keep editing' })).toBeInTheDocument()
    expect(within(asking).getByRole('button', { name: 'Save and continue' })).toBeInTheDocument()
    expect(within(asking).getByRole('button', { name: 'Discard' })).toBeInTheDocument()
    expect(location()).toBe('/my-products/franchises-website')
  })

  it('a clean editor never asks: it navigates at once', () => {
    render(clean())
    leaveTo(OTHER_PAGE)
    expect(dialog()).toBeNull()
    expect(location()).toBe(OTHER_PAGE)
  })

  it('a site field typed back to its saved value is no change', () => {
    render(clean({ formState: { loading: false, changes: { name: MAIN.name }, error: null } }))
    leaveTo(OTHER_PAGE)
    expect(dialog()).toBeNull()
    expect(location()).toBe(OTHER_PAGE)
  })

  it('Keep editing stays: nothing saved, nothing discarded', async () => {
    const user = userEvent.setup()
    const props = dirty()
    render(props)
    leaveTo(OTHER_PAGE)
    await press(user, 'Keep editing')
    await waitFor(() => expect(dialog()).toBeNull())
    expect(location()).toBe('/my-products/franchises-website')
    expect(props.handleUpdateSiteTheme).not.toHaveBeenCalled()
    expect(props.discardChanges).not.toHaveBeenCalled()
  })

  it('Discard drops the pending changes and leaves', async () => {
    const user = userEvent.setup()
    const props = dirty()
    render(props)
    leaveTo(OTHER_PAGE)
    await press(user, 'Discard')
    expect(props.discardChanges).toHaveBeenCalledTimes(1)
    expect(props.handleUpdateSiteTheme).not.toHaveBeenCalled()
    expect(location()).toBe(OTHER_PAGE)
  })

  it('Save and continue runs the editor\'s own Save and, when it worked, leaves', async () => {
    const user = userEvent.setup()
    const props = dirty()
    render(props)
    leaveTo(OTHER_PAGE)
    await press(user, 'Save and continue')
    await waitFor(() => expect(location()).toBe(OTHER_PAGE))
    expect(props.handleUpdateSiteTheme).toHaveBeenCalledTimes(1)
    expect(props.handleUpdateSiteTheme).toHaveBeenCalledWith()
    expect(props.discardChanges).not.toHaveBeenCalled()
  })

  it('a Save that fails keeps the person on the page, with the changes', async () => {
    const user = userEvent.setup()
    const props = dirty({ handleUpdateSiteTheme: vi.fn().mockResolvedValue({ ok: false, error: 'Site not found' }) })
    render(props)
    leaveTo(OTHER_PAGE)
    await press(user, 'Save and continue')
    await waitFor(() => expect(dialog()).toBeNull())
    expect(props.handleUpdateSiteTheme).toHaveBeenCalledTimes(1)
    expect(location()).toBe('/my-products/franchises-website')
    expect(props.discardChanges).not.toHaveBeenCalled()
  })

  it('a Save that throws keeps the person on the page too', async () => {
    const user = userEvent.setup()
    const props = dirty({ handleUpdateSiteTheme: vi.fn().mockRejectedValue(new Error('Network down')) })
    render(props)
    leaveTo(OTHER_PAGE)
    await press(user, 'Save and continue')
    await waitFor(() => expect(dialog()).toBeNull())
    expect(location()).toBe('/my-products/franchises-website')
  })

  it('a changed theme draft (Basic) asks, and Save runs the Basic save', async () => {
    const user = userEvent.setup()
    const props = clean({ themeValues: { ...SAVED_THEME, website_theme: { components: { type: 'franchise', franchise_slug: 'brand-a' } } } })
    render(props)
    leaveTo(OTHER_PAGE)
    await press(user, 'Save and continue')
    await waitFor(() => expect(location()).toBe(OTHER_PAGE))
    expect(props.handleUpdateSiteTheme).toHaveBeenCalledTimes(1)
    expect(props.handleUpdateSiteTheme).toHaveBeenCalledWith()
  })

  it('a changed Advanced draft asks, and Save runs the Advanced save with that draft', async () => {
    const user = userEvent.setup()
    const advancedValues = { my_products: { components: SAVED_THEME }, general: { components: { favicon: 'b.png' } } }
    const props = clean({ advancedValues })
    render(props)
    leaveTo(OTHER_PAGE)
    await press(user, 'Save and continue')
    await waitFor(() => expect(location()).toBe(OTHER_PAGE))
    expect(props.handleUpdateSiteTheme).toHaveBeenCalledTimes(1)
    expect(props.handleUpdateSiteTheme).toHaveBeenCalledWith(advancedValues)
  })

  it('Basic and Advanced both changed: both saves run, Basic first; if Basic fails Advanced is not sent', async () => {
    const user = userEvent.setup()
    const advancedValues = { my_products: { components: SAVED_THEME }, general: { components: { favicon: 'b.png' } } }
    const handleUpdateSiteTheme = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true })
    const props = dirty({ advancedValues, handleUpdateSiteTheme })
    render(props)
    leaveTo(OTHER_PAGE)
    await press(user, 'Save and continue')
    await waitFor(() => expect(dialog()).toBeNull())
    expect(handleUpdateSiteTheme).toHaveBeenCalledTimes(1)
    expect(location()).toBe('/my-products/franchises-website')
    leaveTo(OTHER_PAGE)
    await press(user, 'Save and continue')
    await waitFor(() => expect(location()).toBe(OTHER_PAGE))
    expect(handleUpdateSiteTheme.mock.calls).toEqual([[], [], [advancedValues]])
  })

  it('closing the tab is guarded only while there are unsaved changes', () => {
    const props = clean()
    const { update } = render(props)
    const clear = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(clear)
    expect(clear.defaultPrevented).toBe(false)
    update(dirty())
    const held = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(held)
    expect(held.defaultPrevented).toBe(true)
  })

  describe('the site switch', () => {
    const chooseOther = async (user) => {
      await user.click(screen.getByRole('button', { name: /Franchise website/ }))
      await user.click(await screen.findByRole('option', { name: 'Other franchise' }))
    }
    const selector = () => document.querySelector('.od-first-select-trigger')

    it('with a clean editor the switch goes at once', async () => {
      const user = userEvent.setup()
      const props = clean()
      render(props)
      await chooseOther(user)
      expect(props.setAppIdState).toHaveBeenCalledWith('other-franchise')
      expect(dialog()).toBeNull()
    })

    it('with unsaved changes it asks first and does not switch yet', async () => {
      const user = userEvent.setup()
      const props = dirty()
      render(props)
      await chooseOther(user)
      expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
      expect(props.setAppIdState).not.toHaveBeenCalled()
    })

    it('Keep editing keeps the site, and the selector shows the old one again', async () => {
      const user = userEvent.setup()
      const props = dirty()
      render(props)
      expect(selector()).toHaveTextContent('Franchise website')
      await chooseOther(user)
      await press(user, 'Keep editing')
      await waitFor(() => expect(dialog()).toBeNull())
      expect(props.setAppIdState).not.toHaveBeenCalled()
      expect(props.discardChanges).not.toHaveBeenCalled()
      expect(selector()).toHaveTextContent('Franchise website')
      expect(selector()).not.toHaveTextContent('Other franchise')
    })

    it('Discard drops the changes and switches', async () => {
      const user = userEvent.setup()
      const props = dirty()
      render(props)
      await chooseOther(user)
      await press(user, 'Discard')
      expect(props.discardChanges).toHaveBeenCalledTimes(1)
      expect(props.setAppIdState).toHaveBeenCalledWith('other-franchise')
    })

    it('Save and continue saves and, when it worked, switches', async () => {
      const user = userEvent.setup()
      const props = dirty()
      render(props)
      await chooseOther(user)
      await press(user, 'Save and continue')
      await waitFor(() => expect(props.setAppIdState).toHaveBeenCalledWith('other-franchise'))
      expect(props.handleUpdateSiteTheme).toHaveBeenCalledTimes(1)
    })

    it('a Save that fails keeps the site and the selector shows the old one again', async () => {
      const user = userEvent.setup()
      const props = dirty({ handleUpdateSiteTheme: vi.fn().mockResolvedValue({ ok: false }) })
      render(props)
      await chooseOther(user)
      await press(user, 'Save and continue')
      await waitFor(() => expect(dialog()).toBeNull())
      expect(props.setAppIdState).not.toHaveBeenCalled()
      expect(selector()).toHaveTextContent('Franchise website')
    })
  })
})
