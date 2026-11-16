import React from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'styled-components'
import theme from '../../../src/theme.json'
import personalization from '../../../src/assets/images/personalization.svg'
import notFound from '../../../src/assets/images/not-found.svg'
import storeDummy from '../../../src/assets/images/dummies/store.png'
import productDummy from '../../../src/assets/images/dummies/product.png'
import { SpinnerLoader } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/SpinnerLoader'
import { createDashboardTheme, createOrderingTheme } from '../../../src/brand/adapter'
import { ThemeProvider as DashboardThemeProvider, useTheme as useDashboardTheme } from '../../../src/@/components-dashboard/src/ui/src/contexts/ThemeContext'
import { Button } from '../../../src/@/components-dashboard/src/ui/src/styles/Buttons'
import { mergeThemePrimary } from '../../../src/utils/bootTheme'
import { Search, X } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Icon'
import { ButtonsFixture, ActionProbesFixture } from './buttons'
import { FieldsFixture } from './fields'
import { SelectsFixture } from './selects'
import { SelectConsumersFixture } from './select-consumers'
import { TransitionFixture } from './transition'
import { SearchBar } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/SearchBar'
import { useDashboardBootReveal } from '../../../src/utils/useDashboardBootReveal'
import '../../../src/brand/ordering.tokens.generated.css'
import { AppBootLoader, resolveBootDensity } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/AppBootLoader'
import { PageNotFound } from '../../../src/@/components-dashboard/src/ui/src/components/PageNotFound'
import { FeedbackFixtureProvider } from './feedback-language'

const query = new URLSearchParams(window.location.search)
// Swiper's global variables belong only to this specialized consumer fixture.
const ProductFieldConsumerFixture = query.get('surface') === 'product-field-consumer'
  ? (await import('./product-field-consumer')).ProductFieldConsumerFixture
  : null
const StandardFieldConsumersFixture = query.get('surface') === 'standard-field-consumers'
  ? (await import('./standard-field-consumers')).StandardFieldConsumersFixture
  : null
const SearchBarConsumerFixture = query.get('surface') === 'search-bar-consumer'
  ? (await import('./search-bar-consumer')).SearchBarConsumerFixture
  : null
const PaginationButtonConsumerFixture = query.get('surface') === 'pagination-button-consumer'
  ? (await import('./pagination-button-consumer')).PaginationButtonConsumerFixture
  : null
const TabsConsumersFixture = query.get('surface') === 'tabs-consumers'
  ? (await import('./tabs-consumers')).TabsConsumersFixture
  : null
const ScrollTabsConsumersFixture = query.get('surface') === 'scroll-tabs-consumers'
  ? (await import('./scroll-tabs-consumers')).ScrollTabsConsumersFixture
  : null
const DialogConsumersFixture = query.get('surface') === 'dialog-consumers'
  ? (await import('./dialog-consumers')).DialogConsumersFixture
  : null
const LegacyConfirmConsumersFixture = query.get('surface') === 'legacy-confirm-consumers'
  ? (await import('./legacy-confirm-consumers')).LegacyConfirmConsumersFixture
  : null
const PhoneInputConsumersFixture = query.get('surface') === 'phone-input-consumers'
  ? (await import('./phone-input-consumers')).PhoneInputConsumersFixture
  : null
const ConfirmAdminConsumersFixture = query.get('surface') === 'confirm-admin-consumers'
  ? (await import('./confirm-admin-consumers')).ConfirmAdminConsumersFixture
  : null
const AdminCallerFixture = query.get('surface') === 'admin-caller'
  ? (await import('./admin-caller')).AdminCallerFixture
  : null
const SidebarConsumersFixture = query.get('surface') === 'sidebar-consumers'
  ? (await import('./sidebar-consumers')).SidebarConsumersFixture
  : null
const AddressSidebarConsumerFixture = query.get('surface') === 'address-sidebar-consumer'
  ? (await import('./address-sidebar-consumer')).AddressSidebarConsumerFixture
  : null
const FloatingSelectorsFixture = query.get('surface') === 'floating-selectors'
  ? (await import('./floating-selectors')).FloatingSelectorsFixture
  : null
const C4LinkedConsumersFixture = query.get('surface') === 'c4-linked-consumers'
  ? (await import('./c4-linked-consumers')).C4LinkedConsumersFixture
  : null
const FeedbackFixture = query.get('surface') === 'feedback'
  ? (await import('./feedback')).FeedbackFixture
  : null
const FeedbackConsumersFixture = query.get('surface') === 'feedback-consumers'
  ? (await import('./feedback-consumers')).FeedbackConsumersFixture
  : null
const EntitySelectorsFixture = query.get('surface') === 'entity-selectors'
  ? (await import('./entity-selectors')).EntitySelectorsFixture
  : null
const EntityConsumersFixture = query.get('surface') === 'entity-consumers'
  ? (await import('./entity-consumers')).EntityConsumersFixture
  : null
const SelectionTreesFixture = query.get('surface') === 'selection-trees'
  ? (await import('./selection-trees')).SelectionTreesFixture
  : null
const TreeConsumersFixture = query.get('surface') === 'tree-consumers'
  ? (await import('./tree-consumers')).TreeConsumersFixture
  : null
// Match the app's eagerly imported editor stylesheet for this cluster without changing historical pilot fixtures.
const SchedulesFixture = query.get('surface') === 'schedules'
  ? (await import('./schedules')).SchedulesFixture
  : null
const ScheduleConsumersFixture = query.get('surface') === 'schedule-consumers'
  ? (await import('./schedule-consumers')).ScheduleConsumersFixture
  : null

const ScrollContainersFixture = query.get('surface') === 'scroll-containers'
  ? (await import('./scroll-containers')).ScrollContainersFixture
  : null
const ScrollConsumersFixture = query.get('surface') === 'scroll-consumers'
  ? (await import('./scroll-consumers')).ScrollConsumersFixture
  : null

const IdentityBusinessPreviewFixture = query.get('surface') === 'identity-business-preview'
  ? (await import('./identity-business-preview')).IdentityBusinessPreviewFixture
  : null
const ProfileSessionsFixture = query.get('surface') === 'profile-sessions'
  ? (await import('./profile-sessions')).ProfileSessionsFixture
  : null
const MessagesShellFixture = query.get('surface') === 'messages-shell'
  ? (await import('./messages-shell')).MessagesShellFixture
  : null
const DownloadProductsFixture = query.get('surface') === 'download-products'
  ? (await import('./download-products')).DownloadProductsFixture
  : null
const HomePageFixture = query.get('surface') === 'home-page'
  ? (await import('./home-page')).HomePageFixture
  : null
const IdentityFixture = query.get('surface') === 'identity'
  ? (await import('./identity')).IdentityFixture
  : null
const IdentityPaymentFixture = query.get('surface') === 'identity-payment'
  ? (await import('./identity-payment')).IdentityPaymentFixture
  : null
const IdentityPdfFixture = query.get('surface') === 'identity-pdf'
  ? (await import('./identity-pdf')).IdentityPdfFixture
  : null

const AuthFormsFixture = query.get('surface') === 'auth-forms'
  ? (await import('./auth-forms')).AuthFormsFixture
  : null

const ShellControllerFixture = query.get('surface') === 'shell-controller'
  ? (await import('./shell-controller')).ShellControllerFixture
  : null
const ShellNavigationFixture = query.get('surface') === 'shell-navigation'
  ? (await import('./shell-navigation')).ShellNavigationFixture
  : null
const OutboundLinksFixture = query.get('surface') === 'outbound-links'
  ? (await import('./outbound-links')).OutboundLinksFixture
  : null
const OutboundLinkConsumersFixture = query.get('surface') === 'outbound-link-consumers'
  ? (await import('./outbound-link-consumers')).OutboundLinkConsumersFixture
  : null
const TechnicalTablesFixture = query.get('surface') === 'technical-tables'
  ? (await import('./technical-tables')).TechnicalTablesFixture
  : null
const TechnicalTableConsumersFixture = query.get('surface') === 'technical-table-consumers'
  ? (await import('./technical-table-consumers')).TechnicalTableConsumersFixture
  : null
const BillRowsFixture = query.get('surface') === 'bill-rows'
  ? (await import('./bill-rows')).BillRowsFixture
  : null
const BillRowConsumersFixture = query.get('surface') === 'bill-row-consumers'
  ? (await import('./bill-row-consumers')).BillRowConsumersFixture
  : null
const SpreadsheetFixture = query.get('surface') === 'spreadsheet'
  ? (await import('./spreadsheet')).SpreadsheetFixture
  : null
const SpreadsheetConsumersFixture = query.get('surface') === 'spreadsheet-consumers'
  ? (await import('./spreadsheet-consumers')).SpreadsheetConsumersFixture
  : null
const MediaConsumersFixture = query.get('surface') === 'media-consumers'
  ? (await import('./media-consumers')).MediaConsumersFixture
  : null
const MediaFixture = query.get('surface') === 'media'
  ? (await import('./media')).MediaFixture
  : null
const HtmlEditorFixture = query.get('surface') === 'html-editor'
  ? (await import('./html-editor')).HtmlEditorFixture
  : null
const OrdersListStylesFixture = query.get('surface') === 'orders-list-styles'
  ? (await import('./orders-list-styles')).OrdersListStylesFixture
  : null
const OrderDetailsD1StylesFixture = query.get('surface') === 'order-details-d1-styles'
  ? (await import('./order-details-d1-styles')).OrderDetailsD1StylesFixture
  : null
const OrderDetailsD2StylesFixture = query.get('surface') === 'order-details-d2-styles'
  ? (await import('./order-details-d2-styles')).OrderDetailsD2StylesFixture
  : null
const DetailsD3StylesFixture = query.get('surface') === 'details-d3-styles'
  ? (await import('./details-d3-styles')).DetailsD3StylesFixture
  : null
const OrdersDeliveryMapsStylesFixture = query.get('surface') === 'orders-delivery-maps-styles'
  ? (await import('./orders-delivery-maps-styles')).OrdersDeliveryMapsStylesFixture
  : null
const Delivery1StylesFixture = query.get('surface') === 'delivery-1-styles'
  ? (await import('./delivery-1-styles')).Delivery1StylesFixture
  : null
const Delivery2StylesFixture = query.get('surface') === 'delivery-2-styles'
  ? (await import('./delivery-2-styles')).Delivery2StylesFixture
  : null
const Delivery3StylesFixture = query.get('surface') === 'delivery-3-styles'
  ? (await import('./delivery-3-styles')).Delivery3StylesFixture
  : null
const CreateCustomOrder1StylesFixture = query.get('surface') === 'create-custom-order-1-styles'
  ? (await import('./create-custom-order-1-styles')).CreateCustomOrder1StylesFixture
  : null
const CreateCustomOrder2StylesFixture = query.get('surface') === 'create-custom-order-2-styles'
  ? (await import('./create-custom-order-2-styles')).CreateCustomOrder2StylesFixture
  : null
const AllInOneAppointmentsStylesFixture = query.get('surface') === 'all-in-one-appointments-styles'
  ? (await import('./all-in-one-appointments-styles')).AllInOneAppointmentsStylesFixture
  : null
const PrintOrderDocumentsFixture = query.get('surface') === 'print-order-documents'
  ? (await import('./print-order-documents')).PrintOrderDocumentsFixture
  : null

if (query.get('bootstrap') === 'true' || ['selects', 'select-consumers', 'standard-field-consumers', 'search-bar-consumer', 'pagination-button-consumer', 'tabs-consumers', 'scroll-tabs-consumers', 'dialog-consumers', 'legacy-confirm-consumers', 'phone-input-consumers', 'confirm-admin-consumers', 'admin-caller', 'sidebar-consumers', 'address-sidebar-consumer', 'floating-selectors', 'c4-linked-consumers', 'feedback-consumers', 'feedback', 'entity-selectors', 'entity-consumers', 'selection-trees', 'tree-consumers', 'schedules', 'schedule-consumers', 'scroll-containers', 'scroll-consumers', 'html-editor', 'media', 'media-consumers', 'spreadsheet', 'spreadsheet-consumers', 'bill-rows', 'bill-row-consumers', 'technical-tables', 'technical-table-consumers', 'outbound-links', 'outbound-link-consumers', 'shell-navigation', 'home-page', 'download-products', 'messages-shell', 'profile-sessions', 'auth-forms', 'orders-list-styles', 'order-details-d1-styles', 'order-details-d2-styles', 'details-d3-styles', 'orders-delivery-maps-styles', 'delivery-1-styles', 'delivery-2-styles', 'delivery-3-styles', 'create-custom-order-1-styles', 'all-in-one-appointments-styles', 'print-order-documents', 'action-probes', 'transition'].includes(query.get('surface'))) await import('bootstrap/dist/css/bootstrap.css')
const rtl = query.get('rtl') === 'true'
document.documentElement.dir = rtl ? 'rtl' : 'ltr'
document.documentElement.lang = query.get('locale') || (rtl ? 'ar' : 'en')
const mode = query.get('pilot')
const density = query.get('density') || resolveBootDensity(query.get('auth') === 'true' ? true : query.get('auth') === 'false' ? false : undefined, query.get('persisted') === 'true' ? 'synthetic-session' : null)
const fixtureTheme = { ...theme, rtl, images: { ...(query.get('surface') === 'shell-navigation' ? { logos: { logotype: `${import.meta.env.BASE_URL}brand/ordering/1.3.0/assets/logos/ordering-lockup-color${query.get('mode') === 'dark' ? '-on-dark' : ''}.svg` } } : {}), ...(['entity-selectors', 'entity-consumers', 'selection-trees', 'tree-consumers'].includes(query.get('surface')) ? { dummies: { businessLogo: storeDummy, product: productDummy } } : {}), general: { ...(query.get('surface')?.startsWith('feedback') ? { notFound, logotype: `${import.meta.env.BASE_URL}brand/ordering/1.3.0/assets/logos/ordering-lockup-color${query.get('mode') === 'dark' ? '-on-dark' : ''}.svg` } : {}), ...(['outbound-links', 'outbound-link-consumers'].includes(query.get('surface')) ? { personalization } : {}) } } }

const FoundationControls = () => {
  const [currentTheme, { update, merge }] = useDashboardTheme()
  return (
    <main data-testid='foundations'>
      <h1>Ordering.co theme integration</h1>
      <p>Local fonts and existing theme operations.</p>
      <code>order_id: 123</code>
      <Button color='primary' onClick={() => update(mergeThemePrimary(currentTheme, '#123456'))}>Apply fixture tenant</Button>
      <Button onClick={() => merge({ rtl: !currentTheme.rtl })}>Toggle fixture direction</Button>
      <Button onClick={() => merge({ fonts: { ...currentTheme.fonts, primary: { name: 'Fixture Tenant One', weights: [400, 600] } } })}>Apply first fixture font</Button>
      <Button onClick={() => merge({ fonts: { ...currentTheme.fonts, primary: { name: 'Fixture Tenant Two', weights: [400, 700] } } })}>Apply second fixture font</Button>
      <Button onClick={() => merge({ fonts: createDashboardTheme(theme).fonts })}>Restore local fixture fonts</Button>
      <input aria-label='Fixture field' defaultValue='Preserved value' />
      <output data-testid='tenant-primary'>{currentTheme.colors.primary}</output>
    </main>
  )
}

const IconsFixture = () => {
  const [search, setSearch] = React.useState('')
  return (
    <main>
      <h1>Ordering.co icon specimen</h1>
      <span data-testid='decorative-icon'><Search /></span>
      <X title='Close preview' data-testid='labelled-icon' />
      <button aria-label='Search orders'><Search /></button>
      <div data-testid='search-consumer' style={{ width: 260 }}>
        <SearchBar search={search} onSearch={setSearch} placeholder='Search test records' />
      </div>
      <output data-testid='search-value'>{JSON.stringify(search)}</output>
    </main>
  )
}

const FixtureLanguageDirection = () => {
  const [, { merge }] = useDashboardTheme()
  React.useEffect(() => { merge({ rtl: true }) }, [])
  return null
}

const CoordinatedThemeFixture = () => {
  const [current, { update }] = useDashboardTheme()
  const ready = useDashboardBootReveal({
    sessionLoading: false,
    orderLoading: false,
    auth: false,
    configLoading: false,
    configs: { dashboard_buttons_colors: { value: '#123456' } },
    theme: current,
    update
  })
  return (
    <main>
      <FixtureLanguageDirection />
      <output data-testid='coordinated-ready'>{String(ready)}</output>
      <Button color='primary'>Coordinated appearance</Button>
    </main>
  )
}

const fixtureSurfaces = { transition: TransitionFixture, foundations: FoundationControls, icons: IconsFixture, buttons: ButtonsFixture, 'action-probes': ActionProbesFixture, fields: FieldsFixture, selects: SelectsFixture, 'select-consumers': SelectConsumersFixture, 'standard-field-consumers': StandardFieldConsumersFixture, 'search-bar-consumer': SearchBarConsumerFixture, 'pagination-button-consumer': PaginationButtonConsumerFixture, 'tabs-consumers': TabsConsumersFixture, 'scroll-tabs-consumers': ScrollTabsConsumersFixture, 'dialog-consumers': DialogConsumersFixture, 'legacy-confirm-consumers': LegacyConfirmConsumersFixture, 'phone-input-consumers': PhoneInputConsumersFixture, 'confirm-admin-consumers': ConfirmAdminConsumersFixture, 'admin-caller': AdminCallerFixture, 'sidebar-consumers': SidebarConsumersFixture, 'address-sidebar-consumer': AddressSidebarConsumerFixture, 'floating-selectors': FloatingSelectorsFixture, 'c4-linked-consumers': C4LinkedConsumersFixture, 'feedback-consumers': FeedbackConsumersFixture, feedback: FeedbackFixture, 'entity-selectors': EntitySelectorsFixture, 'entity-consumers': EntityConsumersFixture, 'selection-trees': SelectionTreesFixture, 'tree-consumers': TreeConsumersFixture, schedules: SchedulesFixture, 'schedule-consumers': ScheduleConsumersFixture, 'scroll-containers': ScrollContainersFixture, 'scroll-consumers': ScrollConsumersFixture, 'identity-business-preview': IdentityBusinessPreviewFixture, 'home-page': HomePageFixture, 'download-products': DownloadProductsFixture, 'messages-shell': MessagesShellFixture, 'profile-sessions': ProfileSessionsFixture, identity: IdentityFixture, 'identity-payment': IdentityPaymentFixture, 'identity-pdf': IdentityPdfFixture, 'auth-forms': AuthFormsFixture, 'shell-controller': ShellControllerFixture, 'shell-navigation': ShellNavigationFixture, 'outbound-links': OutboundLinksFixture, 'outbound-link-consumers': OutboundLinkConsumersFixture, 'technical-tables': TechnicalTablesFixture, 'technical-table-consumers': TechnicalTableConsumersFixture, 'bill-rows': BillRowsFixture, 'bill-row-consumers': BillRowConsumersFixture, spreadsheet: SpreadsheetFixture, 'spreadsheet-consumers': SpreadsheetConsumersFixture, media: MediaFixture, 'media-consumers': MediaConsumersFixture, 'html-editor': HtmlEditorFixture, 'orders-list-styles': OrdersListStylesFixture, 'order-details-d1-styles': OrderDetailsD1StylesFixture, 'order-details-d2-styles': OrderDetailsD2StylesFixture, 'details-d3-styles': DetailsD3StylesFixture, 'orders-delivery-maps-styles': OrdersDeliveryMapsStylesFixture, 'delivery-1-styles': Delivery1StylesFixture, 'delivery-2-styles': Delivery2StylesFixture, 'delivery-3-styles': Delivery3StylesFixture, 'create-custom-order-1-styles': CreateCustomOrder1StylesFixture, 'create-custom-order-2-styles': CreateCustomOrder2StylesFixture, 'all-in-one-appointments-styles': AllInOneAppointmentsStylesFixture, 'print-order-documents': PrintOrderDocumentsFixture, 'product-field-consumer': ProductFieldConsumerFixture, coordination: CoordinatedThemeFixture }
const FixtureSurface = fixtureSurfaces[query.get('surface')]
let dashboardFixtureTheme = FixtureSurface && createDashboardTheme(fixtureTheme, { mode: query.get('mode') || 'light' })
if (dashboardFixtureTheme && query.has('tenant')) dashboardFixtureTheme = mergeThemePrimary(dashboardFixtureTheme, query.get('tenant'))

// redesign Q2-09 (386740ca): the boot loader draws Home's content only on Home and reads the route from the address
// bar; the harness is served under a base path (/pilot/), so it says which screen it stands for: the Home boot.
const BOOT_ROUTE = '/home'

const Pilot = ({ mode }) => (
  <ThemeProvider theme={createOrderingTheme(fixtureTheme, { mode })}>
    <div data-ordering-brand data-od-theme={mode}>
      <AppBootLoader variant='home' density={density} route={BOOT_ROUTE} />
    </div>
  </ThemeProvider>
)

createRoot(document.getElementById('root')).render(
  <ThemeProvider theme={fixtureTheme}>
    {FixtureSurface
      ? <DashboardThemeProvider theme={dashboardFixtureTheme}><FixtureSurface /></DashboardThemeProvider>
      : query.get('surface') === 'control'
        ? <div id='control'><FeedbackFixtureProvider><PageNotFound /></FeedbackFixtureProvider><SpinnerLoader content='Loading dashboard' /></div>
        : mode ? <Pilot mode={mode} /> : <AppBootLoader variant={query.get('variant') || 'home'} density={density} route={BOOT_ROUTE} content='Loading dashboard' />}
  </ThemeProvider>
)

if (query.get('mounted')) {
  const sibling = document.createElement('div')
  sibling.id = 'brand-sibling'
  document.body.appendChild(sibling)
  createRoot(sibling).render(<Pilot mode={query.get('mounted')} />)
}
