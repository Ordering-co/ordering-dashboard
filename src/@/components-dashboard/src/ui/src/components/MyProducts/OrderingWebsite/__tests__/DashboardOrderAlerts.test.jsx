/* eslint-disable import/first */
// redesign (n.º 9, P-DB1; owner, 2026-10-20): the dashboard order alerts (`notification_toast`) stay in Settings. On
// /my-products/dashboard the toggle is gone and a link takes the person to the hub field. The block's other configs stay, and the
// hub keeps its own control (SettingsCustomBlocksProduct.test.jsx › order alerts).
// Same stand-ins as DashboardLeave.test.jsx: only the network and the heavy children; the controllers, the editor, FilterSettings
// and SettingsList are the real ones.
import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders, defaultTheme } from '~/__tests__/helpers/testUtils'

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
  Settings: (await vi.importActual('../../../../../../components/Settings')).Settings,
  SettingsList: (await vi.importActual('../../../../../../components/SettingsList')).SettingsList
}))
vi.mock('../../../../../../contexts/SessionContext', () => ({ useSession: () => [{ token: 'test-token', user: { id: 1, level: 0 } }] }))
vi.mock('../../../../../../contexts/ApiContext', () => ({
  useApi: () => [{
    root: 'https://api.test',
    project: 'demo',
    setAccessToken: () => ({ configs: () => ({ save: async () => ({ content: { error: false, result: {} } }) }) })
  }, {}]
}))
vi.mock('../../../../../../contexts/ConfigContext', () => ({ useConfig: () => [{ configs: {} }, { refreshConfigs: vi.fn() }] }))
vi.mock('../../../../../../contexts/ToastContext', () => ({
  useToast: () => [{}, { showToast: vi.fn() }],
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
const BRAND = { id: 166, code: 'web_dashboard_x', type: 'dashboardweb', name: 'Ordering Dashboard', description: '', domain: null }
// the «Dashboard settings» category as the API returns it for `dashboard_theme`, with the toast the API still keeps in it
const CATEGORY = {
  id: 90,
  key: 'dashboard_theme',
  configs: [
    { id: 301, key: 'dashboard_title', name: 'Title', type: 1, value: 'Acme Admin', rank: 1 },
    { id: 303, key: 'notification_toast', name: 'Show a toast when a new order arrives', type: 1, value: '1', rank: 3 }
  ]
}
const WEBSITE = { id: 34, code: 'website', type: null, name: 'Marketplace Website' }
const answer = (body) => Promise.resolve({ json: () => Promise.resolve(body) })

const page = <Dashboard UIComponent={OrderingWebsiteUI} appId='web_dashboard_x' type='dashboardweb' isDashboard />

const Wrapper = ({ children }) => (
  <ProjectContext.Provider value={[{ websiteProduct: 'web_marketplace_26' }, {}]}>
    <InfoShareContext.Provider value={[{ isCollapse: false }, { handleMenuCollapse: vi.fn() }]}>
      {children}
    </InfoShareContext.Provider>
  </ProjectContext.Provider>
)

beforeEach(() => {
  const routes = {
    'GET /sites': () => answer({ error: false, result: [WEBSITE, BRAND] }),
    'GET /config_categories': () => answer({ error: false, result: [CATEGORY] })
  }
  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    const path = url.split('?')[0].replace(ROOT, '')
    const handler = routes[`${options.method || 'GET'} ${path}`]
    return handler ? handler(options) : answer({ error: false, result: [] })
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('/my-products/dashboard · order alerts live in Settings (n.º 9, P-DB1)', () => {
  it('has no toast toggle and links to the Settings field instead', async () => {
    renderWithProviders(page, { initialEntries: ['/my-products/dashboard'], theme, wrapper: Wrapper })
    await waitFor(() => expect(screen.queryByPlaceholderText('Title')).toHaveValue('Acme Admin'))

    expect(screen.queryByText('Show a toast when a new order arrives')).toBeNull()
    expect(screen.queryByRole('checkbox', { name: /toast/i })).toBeNull()
    expect(screen.getByText('Dashboard order alerts')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit in Settings' }))
      .toHaveAttribute('href', '/settings?group=notifications&category=notification&focus=notification_toast')
  })

  // redesign AH: the settings Save is sticky (`top: 100%`, SettingsList › SubmitBtnWrapper), so it slides to the
  // bottom of the card that holds it. With the order alerts in the same card it was drawn over their help text and their link.
  it('keeps the settings Save out of the order alerts card, before it', async () => {
    renderWithProviders(page, { initialEntries: ['/my-products/dashboard'], theme, wrapper: Wrapper })
    await waitFor(() => expect(screen.queryByPlaceholderText('Title')).toHaveValue('Acme Admin'))
    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Acme Admin 2' } })
    const save = await screen.findByRole('button', { name: 'Save' })

    const alertsCard = screen.getByText('Dashboard order alerts').parentElement.parentElement
    expect(alertsCard).toContainElement(screen.getByRole('link', { name: 'Edit in Settings' }))
    expect(alertsCard).not.toContainElement(save)
    expect(alertsCard.contains(screen.getByPlaceholderText('Title'))).toBe(false)
    // same order as before: the theme fields and their Save, then the order alerts
    expect(save.compareDocumentPosition(alertsCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
