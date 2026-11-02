import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from 'styled-components'

const theme = {
  colors: {
    primary: '#2C7BE5',
    headingColor: '#344050',
    backgroundPage: '#ffffff'
  },
  images: {
    general: {},
    categories: {},
    dummies: {},
    logos: { logotype: '/logo.png' }
  }
}

vi.mock('~components', () => ({
  useSession: () => [{ auth: false, loading: false, user: null, token: '' }, {}],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useConfig: () => [{ configs: {}, loading: false }, {}],
  useEvent: () => [events],
  useApi: () => [{ project: 'demo' }, {}],
  useSite: () => [{ sites: [], loading: false }],
  ASSISTANT_ALLOWED_LEVELS: []
}))

vi.mock('~ui', () => ({
  NotNetworkConnectivity: () => null,
  useOnlineStatus: () => true,
  useWindowSize: () => ({ width: 1200, height: 800 }),
  useProjectState: () => [{ project: null, loading: false }],
  SidebarMenu: () => null,
  Layout: ({ children }) => <div>{children}</div>,
  Banners: () => null,
  BannerStack: ({ children }) => <div>{children}</div>,
  WebsocketConnectionBanner: () => null,
  TrialExtensionProvider: ({ children }) => <>{children}</>,
  TrialExtensionBanner: () => null,
  TrialExtensionModal: () => null,
  AppBootLoader: () => <div data-testid='boot-spinner' role='status'>Loading</div>,
  resolveBootDensity: () => 'comfortable',
  resolveBootVariant: () => 'signed-out',
  ProtectedRoute: ({ children }) => children,
  QueryLogin: () => null,
  Modal: () => null,
  BillingPaymentOptions: () => null,
  getConnectAllowedLevels: () => [],
  getConnectVisualAccess: () => ({}),
  useTheme: () => [theme, { update: updateTheme }],
  getUserType: () => false,
  SCHOOLS_ALLOWED_LEVELS: [],
  CommandPaletteProvider: ({ children }) => <>{children}</>,
  CommandPalette: () => null,
  AssistantPanel: () => null,
  DashboardDestinationsProvider: ({ children }) => <>{children}</>,
  CommandPaletteRouteBoundary: ({ children }) => <>{children}</>
}))

vi.mock('../pages/Login', () => ({
  Login: ({ elementLinkToForgotPassword }) => <div>{elementLinkToForgotPassword}</div>
}))

const { quietPage, events, updateTheme } = vi.hoisted(() => {
  return {
    quietPage: () => null,
    events: { emit: () => {}, on: () => {}, off: () => {} },
    updateTheme: () => {}
  }
})
vi.mock('../pages/PageNotFound', () => ({ PageNotFound: quietPage }))
vi.mock('../pages/Assistant', () => ({ Assistant: quietPage }))
vi.mock('../pages/Home', () => ({ Home: quietPage }))
vi.mock('../pages/Settings', () => ({ Settings: quietPage }))
vi.mock('../pages/Settings/LegacyRedirect', () => ({ SettingsLegacyRedirect: quietPage }))
vi.mock('../pages/ForgotPassword', () => ({ ForgotPassword: quietPage }))
vi.mock('../pages/OrdersList', () => ({ OrdersList: quietPage }))
vi.mock('../pages/DeliveriesManager', () => ({ DeliveriesManager: quietPage }))
vi.mock('../pages/DriversList', () => ({ DriversList: quietPage }))
vi.mock('../pages/AllInOne', () => ({ AllInOne: quietPage }))
vi.mock('../pages/CustomersList', () => ({ CustomersList: quietPage }))
vi.mock('../pages/BusinessOwnersList', () => ({ BusinessOwnersList: quietPage }))
vi.mock('../pages/CallcenterAgentsList', () => ({ CallcenterAgentsList: quietPage }))
vi.mock('../pages/ManagersList', () => ({ ManagersList: quietPage }))
vi.mock('../pages/BusinessesList', () => ({ BusinessesList: quietPage }))
vi.mock('../pages/BrandManager', () => ({ BrandManager: quietPage }))
vi.mock('../pages/BusinessProductsList', () => ({ BusinessProductsList: quietPage }))
vi.mock('../pages/BusinessAnalytics', () => ({ BusinessAnalytics: quietPage }))
vi.mock('../pages/MessagesList', () => ({ MessagesList: quietPage }))
vi.mock('../pages/DriverAnalytics', () => ({ DriverAnalytics: quietPage }))
vi.mock('../pages/DriverStoreStatus', () => ({ DriverStoreStatus: quietPage }))
vi.mock('../pages/InvoiceManager', () => ({ InvoiceManager: quietPage }))
vi.mock('../pages/ReviewsList', () => ({ ReviewsList: quietPage }))
vi.mock('../pages/DeliveryDriversList', () => ({ DeliveryDriversList: quietPage }))
vi.mock('../pages/DriversManagersList', () => ({ DriversManagersList: quietPage }))
vi.mock('../pages/DriversCompaniesList', () => ({ DriversCompaniesList: quietPage }))
vi.mock('../pages/DriversGroupsList', () => ({ DriversGroupsList: quietPage }))
vi.mock('../pages/Support', () => ({ Support: quietPage }))
vi.mock('../pages/AdvancedReports', () => ({ AdvancedReports: quietPage }))
vi.mock('../pages/EnterprisePromotionList', () => ({ EnterprisePromotionList: quietPage }))
vi.mock('../pages/CampaignListing', () => ({ CampaignListing: quietPage }))
vi.mock('../pages/OpenCarts', () => ({ OpenCarts: quietPage }))
vi.mock('../pages/RecoveryActionListing', () => ({ RecoveryActionListing: quietPage }))
vi.mock('../pages/OrderingProducts', () => ({ OrderingProducts: quietPage }))
vi.mock('../pages/Professionals', () => ({ Professionals: quietPage }))
vi.mock('../pages/Appointments', () => ({ Appointments: quietPage }))
vi.mock('../pages/Schools', () => ({ Schools: quietPage }))
vi.mock('../pages/Builder', () => ({ Builder: quietPage }))
vi.mock('../pages/BuilderProduct', () => ({ BuilderProduct: quietPage }))
vi.mock('../pages/GiftCardsList', () => ({ GiftCardsList: quietPage }))
vi.mock('../pages/Markups', () => ({ Markups: quietPage }))
vi.mock('../pages/ResetPassword', () => ({ ResetPassword: quietPage }))
vi.mock('../pages/Profile', () => ({ Profile: quietPage }))
vi.mock('../pages/OrderingWebsite', () => ({ OrderingWebsite: quietPage }))
vi.mock('../pages/FranchisesWebsite', () => ({ FranchisesWebsite: quietPage }))
vi.mock('../pages/Dashboard', () => ({ Dashboard: quietPage }))
vi.mock('../pages/ProductsList', () => ({ ProductsBuilderList: quietPage }))
vi.mock('../pages/BusinessAdd', () => ({ BusinessAdd: quietPage }))
vi.mock('../pages/AdBannersList', () => ({ AdBannersList: quietPage }))
vi.mock('../pages/BusinessDevicesList', () => ({ BusinessDevicesList: quietPage }))
vi.mock('../pages/DeliveryServices', () => ({ DeliveryServices: quietPage }))
vi.mock('../pages/Importers', () => ({ Importers: quietPage }))
vi.mock('../pages/PosMenu', () => ({ PosMenu: quietPage }))
vi.mock('../pages/SalesChannels', () => ({ SalesChannels: quietPage }))
vi.mock('../pages/WhatsAppBots', () => ({ WhatsAppBots: quietPage }))
vi.mock('../pages/SettingsLogs', () => ({ SettingsLogs: quietPage }))
vi.mock('../pages/FreeProductsList', () => ({ FreeProductsList: quietPage }))
vi.mock('../pages/OpenSourceCode', () => ({ OpenSourceCode: quietPage }))
vi.mock('../pages/DriverTimeDisplay', () => ({ DriversTimeDisplay: quietPage }))
vi.mock('../pages/EcommerceReports', () => ({ EcommerceReports: quietPage }))
vi.mock('../pages/BusinessPaymentReports', () => ({ BusinessPaymentReports: quietPage }))
vi.mock('../components/ScrollToTop', () => ({ ScrollToTop: ({ children }) => <>{children}</> }))
vi.mock('../components/ListenPageChanges', () => ({ ListenPageChanges: quietPage }))
vi.mock('../components/HelmetTags', () => ({ HelmetTags: quietPage }))
vi.mock('../components/StoreOnboardingGate', () => ({ StoreOnboardingGate: ({ children }) => <>{children}</> }))
vi.mock('../components/IntercomWrapper', () => ({ IntercomWrapper: ({ children }) => <>{children}</> }))
vi.mock('~components/components/DocsConnection', () => ({ DocsConnection: quietPage, docsConnectMode: { active: false } }))
vi.mock('~ui/src/components/DocsConnectionConsent', () => ({ DocsConnectionConsent: quietPage }))

vi.mock('../config', () => ({
  default: { project: 'demo', notification_app: 'dashboard' }
}))

import { App } from '../App'

describe('dashboard launch', () => {
  it('shows the reset password link after the splash', async () => {
    document.body.innerHTML = '<div id="root"><div id="od-boot" role="status">Loading</div></div>'
    const { findByRole, queryByTestId } = render(
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      </ThemeProvider>,
      { container: document.getElementById('root') }
    )

    expect(await findByRole('link', { name: 'Reset password' })).toHaveAttribute('href', '/password/forgot')
    expect(queryByTestId('boot-spinner')).not.toBeInTheDocument()
    expect(document.getElementById('od-boot')).toBeNull()
    expect(document.body.textContent.trim().length).toBeGreaterThan(0)
  })
})
