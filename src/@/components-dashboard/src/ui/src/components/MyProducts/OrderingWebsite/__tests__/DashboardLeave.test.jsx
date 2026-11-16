/* eslint-disable import/first */
// redesign D-81 part B (owner, 2026-10-19): /my-products/dashboard as src/pages/Dashboard wires it: the REAL `Dashboard`
// controller with the legacy editor (`OrderingWebsiteUI`, `isDashboard`). Typing the brand's name or description and leaving the page
// (a route change to another pathname, ⌘K and Mia) asks «Keep editing · Save and continue · Discard»:
//  - Keep editing stays, with what was typed, and writes nothing;
//  - Discard puts the saved values back, writes nothing and leaves;
//  - Save and continue POSTs the pending fields to the brand site only, and leaves when it worked;
//  - a Save the API refuses (or that fails) keeps the person here, with the changes;
//  - an editor with nothing typed never asks.
// The "Dashboard settings" block of the same page (FilterSettings: Title, button colors, logos, order alerts) has its OWN Save and
// registers in the same host, so a change there counts the same way (R-3 of the D-81 review):
//  - a changed Title asks before leaving, Discard drops it, Save runs the block's own save (one PUT per changed config);
//  - a block Save that fails keeps the person here, and an untouched block never asks.
// Only the network and the heavy children are stand-ins; the controllers, the editor and FilterSettings/SettingsList are the real ones.
import React from 'react'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useHistory, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  refreshConfigs: vi.fn(),
  saveConfig: vi.fn(),
  history: null
}))

const translate = (_key, text) => text

vi.mock('../../../../../../index', async () => ({
  useLanguage: () => [{}, translate],
  useConfig: () => [{ configs: {} }],
  useApi: () => [{ project: 'demo' }, { configurations: { subdomain: 'orderingplus' } }],
  useSite: () => [{ sites: [] }],
  useSession: () => [{ user: { level: 0 } }],
  useUtils: () => [{ optimizeImage: (src) => src }],
  useEvent: () => [{ emit: vi.fn() }],
  ExamineClick: ({ children }) => <>{children}</>,
  DragAndDrop: ({ children }) => <>{children}</>,
  OrderingWebsite: () => null,
  // the block's controllers are the real ones (they only need the network and the contexts mocked here)
  Settings: (await vi.importActual('../../../../../../components/Settings')).Settings,
  SettingsList: (await vi.importActual('../../../../../../components/SettingsList')).SettingsList
}))
vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'test-token', user: { id: 1, level: 0 } }] }))
vi.mock('../../../../../../contexts/ApiContext', () => ({
  useApi: () => [{
    root: 'https://api.test',
    project: 'demo',
    setAccessToken: () => ({ configs: (id) => ({ save: (params) => mocks.saveConfig(id, params) }) })
  }, {}]
}))
vi.mock('../../../../../../contexts/ConfigContext', () => ({ useConfig: () => [{ configs: {} }, { refreshConfigs: mocks.refreshConfigs }] }))
vi.mock('../../../../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: mocks.showToast }],
  ToastType: { Info: 'info', Success: 'success', Error: 'error' }
}))
vi.mock('../../../../../../contexts/LanguageContext', () => ({ useLanguage: () => [{}, translate] }))
vi.mock('../../ContentForm', () => ({ ContentForm: () => null }))
vi.mock('../../AdvancedSettings', () => ({ AdvancedSettings: () => null }))
vi.mock('../../OrderingWidgets', () => ({ OrderingWidgets: () => null }))
vi.mock('../../WhiteLabelCustomDomain', () => ({ WhiteLabelCustomDomain: () => null }))
vi.mock('../../WhiteLabelCustomDomain/WhiteLabelCustomDomainBlock', () => ({ WhiteLabelCustomDomainBlock: () => null }))
vi.mock('../../CustomDomain', () => ({ CustomDomain: () => null }))
vi.mock('../../../Connect', () => ({ DriversGroupsLogisticsService: () => null }))
vi.mock('../../../Settings/SettingsDetail', () => ({ SettingsDetail: () => null }))
vi.mock('../../../Settings', async () => ({ FilterSettings: (await vi.importActual('../../../Settings/FilterSettings')).FilterSettings }))

import { requestRouteLeave } from '../../../../utils/routeLeaveGuard'
import { InfoShareContext } from '../../../../contexts/InfoShareContext'
import { ProjectContext } from '../../../../contexts/ProjectContext'
import { Dashboard } from '../../../../../../components/Dashboard'
import { OrderingWebsiteUI } from '../index'

const theme = {
  ...defaultTheme,
  images: {
    preview: { marketplace: 'marketplace.png', franchise: 'franchise.png', singleStore: 'single.png' },
    myProducts: { orderingWebsite: 'ordering-website.png' }
  }
}

const ROOT = 'https://api.test'
const ROUTE = '/my-products/dashboard'
const OTHER = '/orders'
const BRAND = { id: 166, code: 'web_dashboard_x', type: 'dashboardweb', name: 'Ordering Dashboard', description: '', domain: null }
// the «Dashboard settings» category as the API returns it for `dashboard_theme`
const CATEGORY = {
  id: 90,
  key: 'dashboard_theme',
  configs: [
    { id: 301, key: 'dashboard_title', name: 'Title', type: 1, value: 'Acme Admin', rank: 1 },
    { id: 302, key: 'dashboard_buttons_colors', name: 'Button colors', type: 1, value: '#ff0000', rank: 2 }
  ]
}
const WEBSITE = { id: 34, code: 'website', type: null, name: 'Marketplace Website' }
const clone = (value) => JSON.parse(JSON.stringify(value))
const answer = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

let routes
let calls
let configWrites

const writes = () => calls.filter((call) => call.method !== 'GET')

const LocationProbe = () => {
  const location = useLocation()
  mocks.history = useHistory()
  return <output data-testid='location'>{`${location.pathname}${location.search}`}</output>
}

// what src/pages/Dashboard passes to the controller
const page = (
  <>
    <Dashboard UIComponent={OrderingWebsiteUI} appId='web_dashboard_x' type='dashboardweb' isDashboard />
    <LocationProbe />
  </>
)

const Wrapper = ({ children }) => (
  <ProjectContext.Provider value={[{ websiteProduct: 'web_marketplace_26' }, {}]}>
    <InfoShareContext.Provider value={[{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]}>
      {children}
    </InfoShareContext.Provider>
  </ProjectContext.Provider>
)

const titleInput = () => screen.queryByPlaceholderText('Title')
const nameInput = () => document.querySelector('input[name="name"]')
const descriptionInput = () => document.querySelector('textarea[name="description"]')
const dialog = () => screen.queryByRole('alertdialog')
const location = () => screen.getByTestId('location').textContent
const leaveTo = (path) => act(() => mocks.history.push(path))
const press = async (user, name) => user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name }))

const loaded = async () => {
  renderWithProviders(page, { initialEntries: [ROUTE], theme, wrapper: Wrapper })
  await waitFor(() => expect(nameInput()).toHaveValue(BRAND.name))
}

const typeName = async (user, text = ' admin') => user.type(nameInput(), text)

beforeEach(() => {
  calls = []
  configWrites = []
  mocks.history = null
  mocks.showToast.mockClear()
  mocks.refreshConfigs.mockClear()
  mocks.saveConfig.mockReset()
  mocks.saveConfig.mockImplementation(async (id, params) => {
    configWrites.push({ id, ...params })
    return { content: { error: false, result: { id, ...params } } }
  })
  routes = {
    'GET /sites': () => answer({ error: false, result: [clone(WEBSITE), clone(BRAND)] }),
    'GET /config_categories': () => answer({ error: false, result: [clone(CATEGORY)] }),
    'POST /sites/166': (options) => answer({ error: false, result: { ...clone(BRAND), ...JSON.parse(options.body) } })
  }
  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    const method = options.method || 'GET'
    const path = url.split('?')[0].replace(ROOT, '')
    calls.push({ method, path, body: options.body ? JSON.parse(options.body) : null })
    const handler = routes[`${method} ${path}`]
    return handler ? handler(options) : answer({ error: false, result: [] })
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('/my-products/dashboard · leaving with unsaved changes (D-81, part B)', () => {
  it('a route change after typing asks, and the address does not move', async () => {
    const user = userEvent.setup()
    await loaded()
    await typeName(user)
    leaveTo(OTHER)
    const asking = await screen.findByRole('alertdialog')
    expect(within(asking).getByText('Save your changes?')).toBeInTheDocument()
    expect(within(asking).getByText(/You have unsaved changes in Dashboard settings\./)).toBeInTheDocument()
    expect(location()).toBe(ROUTE)
  })

  it('an editor with nothing typed never asks', async () => {
    await loaded()
    leaveTo(OTHER)
    expect(dialog()).toBeNull()
    expect(location()).toBe(OTHER)
  })

  it('typing the saved value back is no change: it does not ask', async () => {
    const user = userEvent.setup()
    await loaded()
    await typeName(user, 'x')
    await user.type(nameInput(), '{Backspace}')
    expect(nameInput()).toHaveValue(BRAND.name)
    leaveTo(OTHER)
    expect(dialog()).toBeNull()
    expect(location()).toBe(OTHER)
  })

  it('Keep editing stays with what was typed and writes nothing', async () => {
    const user = userEvent.setup()
    await loaded()
    await typeName(user)
    leaveTo(OTHER)
    await press(user, 'Keep editing')
    await waitFor(() => expect(dialog()).toBeNull())
    expect(location()).toBe(ROUTE)
    expect(nameInput()).toHaveValue('Ordering Dashboard admin')
    expect(writes()).toEqual([])
  })

  it('Discard puts the saved values back, writes nothing and leaves', async () => {
    const user = userEvent.setup()
    await loaded()
    await typeName(user)
    await user.type(descriptionInput(), 'Draft')
    leaveTo(OTHER)
    await press(user, 'Discard')
    await waitFor(() => expect(location()).toBe(OTHER))
    expect(writes()).toEqual([])
    expect(nameInput()).toHaveValue(BRAND.name)
    expect(descriptionInput()).toHaveValue('')
    expect(document.querySelector('button.save-site-settings')).toBeNull()
  })

  it('Save and continue POSTs the pending fields to the brand site only, and leaves', async () => {
    const user = userEvent.setup()
    await loaded()
    await typeName(user)
    leaveTo(OTHER)
    await press(user, 'Save and continue')
    await waitFor(() => expect(location()).toBe(OTHER))
    expect(writes()).toEqual([{ method: 'POST', path: '/sites/166', body: { name: 'Ordering Dashboard admin' } }])
  })

  it('a Save the API refuses keeps the person here, with what was typed', async () => {
    const user = userEvent.setup()
    routes['POST /sites/166'] = () => answer({ error: true, result: ['Name taken'] })
    await loaded()
    await typeName(user)
    leaveTo(OTHER)
    await press(user, 'Save and continue')
    await waitFor(() => expect(dialog()).toBeNull())
    expect(writes()).toHaveLength(1)
    expect(location()).toBe(ROUTE)
    expect(nameInput()).toHaveValue('Ordering Dashboard admin')
    expect(document.querySelector('button.save-site-settings')).not.toBeNull()
    expect(mocks.showToast).toHaveBeenCalledWith('error', ['Name taken'])
  })

  it('a Save that fails on the network keeps the person here too', async () => {
    const user = userEvent.setup()
    routes['POST /sites/166'] = () => Promise.reject(new Error('Network down'))
    await loaded()
    await typeName(user)
    leaveTo(OTHER)
    await press(user, 'Save and continue')
    await waitFor(() => expect(dialog()).toBeNull())
    expect(location()).toBe(ROUTE)
    expect(nameInput()).toHaveValue('Ordering Dashboard admin')
  })

  it('after a Save from the page itself the editor is clean again: no question', async () => {
    const user = userEvent.setup()
    await loaded()
    await typeName(user)
    await user.click(document.querySelector('button.save-site-settings'))
    await waitFor(() => expect(document.querySelector('button.save-site-settings')).toBeNull())
    leaveTo(OTHER)
    expect(dialog()).toBeNull()
    expect(location()).toBe(OTHER)
  })

  it('⌘K and Mia ask first: the navigation runs only after Discard', async () => {
    const user = userEvent.setup()
    await loaded()
    await typeName(user)
    const go = vi.fn(() => mocks.history.push(OTHER))
    act(() => requestRouteLeave(go))
    expect(go).not.toHaveBeenCalled()
    await press(user, 'Discard')
    expect(go).toHaveBeenCalledTimes(1)
    expect(location()).toBe(OTHER)
  })
})

describe('/my-products/dashboard · the «Dashboard settings» block counts too (D-81, R-3)', () => {
  const loadedWithBlock = async () => {
    await loaded()
    await waitFor(() => expect(titleInput()).toHaveValue('Acme Admin'))
  }

  it('a changed Title asks before leaving, and the address does not move', async () => {
    const user = userEvent.setup()
    await loadedWithBlock()
    await user.type(titleInput(), '-EU')
    leaveTo(OTHER)
    const asking = await screen.findByRole('alertdialog')
    expect(within(asking).getByText(/You have unsaved changes in Dashboard settings\./)).toBeInTheDocument()
    expect(location()).toBe(ROUTE)
  })

  it('a block with nothing changed never asks', async () => {
    await loadedWithBlock()
    leaveTo(OTHER)
    expect(dialog()).toBeNull()
    expect(location()).toBe(OTHER)
  })

  it('typing the saved Title back is no change: it does not ask', async () => {
    const user = userEvent.setup()
    await loadedWithBlock()
    await user.type(titleInput(), 'x')
    await user.type(titleInput(), '{Backspace}')
    leaveTo(OTHER)
    expect(dialog()).toBeNull()
    expect(location()).toBe(OTHER)
  })

  it('Keep editing stays with the typed Title and writes nothing', async () => {
    const user = userEvent.setup()
    await loadedWithBlock()
    await user.type(titleInput(), '-EU')
    leaveTo(OTHER)
    await press(user, 'Keep editing')
    await waitFor(() => expect(dialog()).toBeNull())
    expect(location()).toBe(ROUTE)
    expect(titleInput()).toHaveValue('Acme Admin-EU')
    expect(configWrites).toEqual([])
    expect(writes()).toEqual([])
  })

  it('Discard drops the Title, writes nothing and leaves', async () => {
    const user = userEvent.setup()
    await loadedWithBlock()
    await user.type(titleInput(), '-EU')
    leaveTo(OTHER)
    await press(user, 'Discard')
    await waitFor(() => expect(location()).toBe(OTHER))
    expect(configWrites).toEqual([])
    expect(writes()).toEqual([])
  })

  it('Save and continue runs the block save (one PUT per changed config), leaves, and does not touch the site', async () => {
    const user = userEvent.setup()
    await loadedWithBlock()
    await user.type(titleInput(), '-EU')
    leaveTo(OTHER)
    await press(user, 'Save and continue')
    await waitFor(() => expect(location()).toBe(OTHER))
    expect(configWrites).toEqual([{ id: 301, key: 'dashboard_title', value: 'Acme Admin-EU' }])
    expect(writes()).toEqual([])
  })

  it('with the site name and the Title both changed, Save and continue saves both', async () => {
    const user = userEvent.setup()
    await loadedWithBlock()
    await typeName(user)
    await user.type(titleInput(), '-EU')
    leaveTo(OTHER)
    await press(user, 'Save and continue')
    await waitFor(() => expect(location()).toBe(OTHER))
    expect(configWrites).toEqual([{ id: 301, key: 'dashboard_title', value: 'Acme Admin-EU' }])
    expect(writes()).toEqual([{ method: 'POST', path: '/sites/166', body: { name: 'Ordering Dashboard admin' } }])
  })

  it('a block Save the API refuses keeps the person here, with the typed Title', async () => {
    const user = userEvent.setup()
    mocks.saveConfig.mockImplementation(async () => ({ content: { error: true, result: ['Title taken'] } }))
    await loadedWithBlock()
    await user.type(titleInput(), '-EU')
    leaveTo(OTHER)
    await press(user, 'Save and continue')
    // the leave question is gone; the block shows its own Alert with what the API said
    await waitFor(() => expect(screen.queryByText('Save your changes?')).toBeNull())
    expect(await screen.findByText('Title taken')).toBeInTheDocument()
    expect(mocks.saveConfig).toHaveBeenCalledTimes(1)
    expect(location()).toBe(ROUTE)
    expect(titleInput()).toHaveValue('Acme Admin-EU')
  })

  it('a block Save that throws keeps the person here too', async () => {
    const user = userEvent.setup()
    mocks.saveConfig.mockImplementation(() => Promise.reject(new Error('Network down')))
    await loadedWithBlock()
    await user.type(titleInput(), '-EU')
    leaveTo(OTHER)
    await press(user, 'Save and continue')
    await waitFor(() => expect(screen.queryByText('Save your changes?')).toBeNull())
    expect(location()).toBe(ROUTE)
    expect(titleInput()).toHaveValue('Acme Admin-EU')
  })

  it('after the block\'s own Save the block is clean again: no question', async () => {
    const user = userEvent.setup()
    await loadedWithBlock()
    await user.type(titleInput(), '-EU')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(configWrites).toHaveLength(1))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull())
    leaveTo(OTHER)
    expect(dialog()).toBeNull()
    expect(location()).toBe(OTHER)
  })

  it('⌘K and Mia ask for the block too', async () => {
    const user = userEvent.setup()
    await loadedWithBlock()
    await user.type(titleInput(), '-EU')
    const go = vi.fn(() => mocks.history.push(OTHER))
    act(() => requestRouteLeave(go))
    expect(go).not.toHaveBeenCalled()
    await press(user, 'Discard')
    expect(go).toHaveBeenCalledTimes(1)
    expect(location()).toBe(OTHER)
  })
})
