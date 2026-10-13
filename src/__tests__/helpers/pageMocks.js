/**
 * Shared Vitest mocks for thin page wrappers.
 * Used inside vi.mock factories (dynamic import) so hoisting stays valid.
 */
import { vi } from 'vitest'

const UI_EXPORT_NAMES = [
  'AdBannersListing',
  'AllInOne',
  'AllSettings',
  'Appointments',
  'BusinessAdd',
  'BusinessAnalytics',
  'BusinessBrandListing',
  'BusinessDeviceListing',
  'BusinessPaymentReports',
  'BusinessProductsListing',
  'BusinessesListing',
  'CallCenterApp',
  'CampaignListing',
  'Cms',
  'ConnectOverview',
  'CustomProject',
  'CustomersListing',
  'DeliveriesManager',
  'DeliveryServices',
  'DeliveryUsersListing',
  'DriversCompaniesListing',
  'DriversGroupsListing',
  'DriversManager',
  'DriversTimeDisplay',
  'DriverAnalytics',
  'DriverStoreStatus',
  'EcommerceReports',
  'EnterprisePromotionListing',
  'ForgotPasswordForm',
  'FreeProductsList',
  'GiftCardsListing',
  'HomePage',
  'Importers',
  'IntegrationListing',
  'InvoiceManager',
  'KioskApp',
  'LanguageManager',
  'LoginForm',
  'Markups',
  'MessagesListing',
  'OpenCartListing',
  'OrderingProductsListing',
  'OrderingWebsite',
  'OrderingWebsiteUI',
  'OrderingWidgets',
  'OrdersManager',
  'PageNotFound',
  'PlaceListing',
  'PosApp',
  'PosMenu',
  'ProductsBuilderList',
  'ProfilePage',
  'ProfessionalListing',
  'PurchaseAddons',
  'PurchasedProductsList',
  'RecoveryActionListing',
  'Reports',
  'ResetPassword',
  'ReviewsListing',
  'SalesChannels',
  'SchoolsManagement',
  'SettingsLogs',
  'Support',
  'UsersListing'
]

export const createUiPageMocks = async () => {
  const React = await import('react')
  const UIStub = () => React.createElement('div', { 'data-testid': 'page-ui' })
  return {
    ...Object.fromEntries(UI_EXPORT_NAMES.map((name) => [name, UIStub])),
    addQueryToUrl: vi.fn(),
    removeQueryToUrl: vi.fn(),
    useFilterValues: () => [[]],
    learnOptionsValues: () => [],
    capitalize: (value) => value
  }
}

export const createComponentsPageMocks = async () => {
  const React = await import('react')
  const ControllerStub = () => React.createElement('div', { 'data-testid': 'page-ui' })
  return {
    useLanguage: () => [undefined, (key, fallback) => fallback || key],
    useEvent: () => [{ emit: vi.fn() }],
    useApi: () => [{}],
    OrderingWebsite: ControllerStub,
    Dashboard: ControllerStub
  }
}
