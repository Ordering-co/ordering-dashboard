import { dirname, resolve } from 'node:path'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { defineConfig, normalizePath } from 'vite'
import react from '@vitejs/plugin-react'
import { harnessPort } from './runtime.cjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const sdkEntry = resolve(root, 'src/@/components-dashboard/src/index.js')
const sharedEntry = resolve(root, 'src/@/components-dashboard/src/ui/src/components/Shared')
const require = createRequire(import.meta.url)
const phoneRequire = createRequire(require.resolve('react-phone-number-input/package.json'))
const fixtureFlagsDirectory = resolve(dirname(phoneRequire.resolve('country-flag-icons/package.json')), '3x2')
const fixtureFlagFiles = readdirSync(fixtureFlagsDirectory).filter(name => /^[A-Z]{2}\.svg$/.test(name)).sort()
// The fixture seams: which harness module a real dashboard module gets in place of an import, decided per importing file.
const redirectFixtureSeam = (source, importer) => {
  if (importer?.endsWith('/components/HelmetTags/index.js') && source === '~components') return resolve(root, 'scripts/brand-system/harness/identity-language.js')
  const profileOwners = ['ProfilePage', 'Sessions'].some(name => importer?.endsWith(`/Profile/${name}/index.js`) || importer?.endsWith(`/Shared/UI/${name}.jsx`))
  const messagesOwners = ['MessagesListing', 'ChatContactList', 'ChatBusinessesList'].some(name => importer?.endsWith(`/Messages/${name}/index.js`) || importer?.endsWith(`/Shared/UI/${name}.jsx`)) ||
    // redesign messages FASE 3 (decision 1A): the inbox that MessagesListing mounts (list, header, shared order chat) takes the same fixture SDK
    ['/Orders/Messages/Inbox.jsx', '/Orders/Messages/ConversationList.jsx', '/Orders/Messages/ConversationHeader.jsx', '/Orders/OrderDetails/ChatTab.jsx', '/Orders/OrderDetails/ActivityTab.jsx', '/Orders/OrderDetails/OrderMessages.jsx'].some(file => importer?.endsWith(file))
  const downloadOwners = ['FreeProductsList', 'PurchasedProductsList'].some(name => importer?.endsWith(`/Downloads/${name}/index.js`) || importer?.endsWith(`/Shared/UI/${name}.jsx`))
  // redesign home FC: the new Home calls Intercom from HomePage.jsx and keeps the HubSpot form in MoreServices.jsx
  const homeOwners = ['/Home/HomePage/index.js', '/Home/HomePage/HomePage.jsx', '/Home/HomePage/MoreServices.jsx', '/Home/HomePage/HomeHeader.jsx', '/Home/HomePage/TodaySummary.jsx', '/Home/HomePage/SalesTrend.jsx', '/Home/HomePage/NeedsAttention.jsx', '/Home/HomePage/SetupGuide.jsx', '/Home/HomePage/Shortcuts.jsx'].some(file => importer?.endsWith(file))
  if (homeOwners && ['~/components/Utils', resolve(root, 'src/components/Utils'), resolve(root, 'src/components/Utils/index.js'), 'react-hubspot-form'].includes(source)) return resolve(root, 'scripts/brand-system/harness/home-page-utils.js')
  const authOwners = ['LoginForm', 'ForgotPasswordForm', 'ResetPassword', 'QueryLogin'].some(name => importer?.endsWith(`/Login/${name}/index.js`) || importer?.endsWith(`/Shared/UI/${name}.jsx`))
  const authUtils = resolve(root, 'scripts/brand-system/harness/auth-forms-utils.js')
  if (authOwners && ['~/analytics/posthog', resolve(root, 'src/analytics/posthog'), resolve(root, 'src/analytics/posthog.js')].includes(source)) return authUtils
  const feedbackConsumers = resolve(root, 'scripts/brand-system/harness/feedback-consumer-seams.jsx')
  if (importer?.endsWith('/Billing/BillingPaymentOptions/Stripe/PaymentCard.js') && source === '~components') return feedbackConsumers
  if (source === 'react-phone-number-input' && (importer?.endsWith('/Shared/InputPhoneNumber/index.js') || importer?.endsWith('/Shared/UI/InputPhoneNumber.jsx'))) return resolve(root, 'scripts/brand-system/harness/phone-input-fixture-widget.jsx')
  if (importer?.endsWith('/Settings/SettingsSelectUI/index.js') && source === '~ui') return resolve(root, 'src/@/components-dashboard/src/ui/src/utils/capitalize.js')
  if (importer && source.startsWith('.')) {
    const resolved = resolve(importer.split('/').slice(0, -1).join('/'), source)
    if (profileOwners && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/profile-sessions-language.jsx')
    if (messagesOwners && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/messages-shell-language.jsx')
    // W0-E-06: since W0-12 (231eac6b) MessagesListing takes OrderNotificationSlot from Orders/OrderNotification directly, not
    // from the Orders index; that module goes to the same fixture, or its controller import lands in language.js and the page is blank.
    if (messagesOwners && [resolve(root, 'src/@/components-dashboard/src/ui/src/components/Orders'), resolve(root, 'src/@/components-dashboard/src/ui/src/components/Orders/OrderNotification'), resolve(root, 'src/@/components-dashboard/src/ui/src/utils')].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/messages-shell-dependencies.jsx')
    if (downloadOwners && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/download-products-language.jsx')
    if (homeOwners && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/home-page-language.jsx')
    if (homeOwners && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/utils')) return resolve(root, 'scripts/brand-system/harness/home-page-utils.js')
    if (importer.endsWith('/BusinessPaymentInvoiceDetail/index.js') && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/identity-payment-language.js')
    if (importer.endsWith('/Stores/BusinessPreview/index.js') && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/identity-business-preview-language.js')
    const invoiceIdentityOwners = ['/InvoiceBusinessPdf/index.js', '/InvoiceDriverPdf/index.js'].some(file => importer.endsWith(file))
    if (invoiceIdentityOwners && ([sdkEntry, sdkEntry.slice(0, -3), resolve(root, 'src/@/components-dashboard/src/ui/src/utils')].includes(resolved))) return resolve(root, 'scripts/brand-system/harness/identity-pdf-language.js')
    if (importer.endsWith('/BusinessIntelligence/invoicePdfLogo.js') && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/utils')) return resolve(root, 'src/utils/dashboardBranding.js')

    if (authOwners && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/auth-forms-language.jsx')
    if (authOwners && [resolve(root, 'src/@/components-dashboard/src/ui/src/utils'), sharedEntry].includes(resolved)) return authUtils
    if (authOwners && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    if (importer.endsWith('/Settings/SettingsImage/index.js') && ([sdkEntry, sdkEntry.slice(0, -3)].includes(resolved) || source === '../../Shared')) return resolve(root, 'scripts/brand-system/harness/media-consumer-language.jsx')
    if (importer.endsWith('/Settings/SettingsImage/index.js') && source === '../../../utils') return resolve(root, 'src/@/components-dashboard/src/ui/src/utils/bytesConverter.js')
    if (importer.endsWith('/src/components/SidebarMenu/index.js') && source.startsWith('../../contexts/')) return resolve(root, 'scripts/brand-system/harness/shell-controller-language.jsx')
    const shellLanguage = resolve(root, 'scripts/brand-system/harness/shell-navigation-language.jsx')
    // (sidebar follow-up): UpgradeOfferContext is the sidebar card's own fetch, mounted
    // alongside SidebarMenu's other shell dependencies — same fixture seam, so the scan finds its
    // `UpgradeOffer` stub below instead of the real SDK controller.
    const shellOwners = ['/SidebarMenu/index.js', '/LanguageSelector/index.js', '/LogoutButton/index.js', '/Shared/UI/SidebarMenu.jsx', '/Shared/UI/LanguageSelector.jsx', '/Shared/UI/LogoutButton.jsx', '/Shared/SideBar/AccountMenu.jsx', '/Shared/SideBar/SidebarNav.jsx', '/contexts/UpgradeOfferContext/index.js'].some(file => importer.endsWith(file))
    if (shellOwners && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return shellLanguage
    if (shellOwners && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/utils')) return resolve(root, 'scripts/brand-system/harness/shell-navigation-utils.js')
    if (importer.endsWith('/utils/navigationHelpers.js') && source === '../../../contexts/SessionContext') return shellLanguage
    const outboundConsumers = resolve(root, 'scripts/brand-system/harness/outbound-link-consumer-language.jsx')
    if (['/Shared/Personalization/index.js', '/Shared/UI/Personalization.jsx'].some(file => importer.endsWith(file))) {
      if ([sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/outbound-link-language.jsx')
      if (resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    }
    if (importer.endsWith('/CreateCustomOrder/ProductForm/index.js')) {
      if ([sdkEntry, sdkEntry.slice(0, -3)].includes(resolved) || ['../../../Shared', '../../../../utils', '../ProductIngredient', '../ProductOption', '../ProductOptionSubOption'].includes(source)) return outboundConsumers
      if (resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    }
    const technicalConsumers = resolve(root, 'scripts/brand-system/harness/technical-table-consumer-language.jsx')
    const technicalOwners = ['/Shared/IntegrationLogs/index.js', '/Shared/PushTokens/index.js', '/Shared/UI/IntegrationLogs.jsx', '/Shared/UI/PushTokens.jsx'].some(file => importer.endsWith(file))
    if (technicalOwners && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/technical-table-language.jsx')
    if (technicalOwners && source === '..') return technicalConsumers
    if (technicalOwners && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    if (importer.endsWith('/src/components/IntegrationLogs/index.js') && source.startsWith('../../contexts/')) return technicalConsumers
    if (importer.endsWith('/Users/UserDetails/index.js')) {
      if ([sdkEntry, sdkEntry.slice(0, -3)].includes(resolved) || ['../../Shared', '../../../utils', '../UserDetailsMenu', '../UserMetaFields', '../UserProfileForm', '../../Delivery', '../../Orders/OrdersManager', '../BusinessManagerBusinesses', '../../Schools/SchoolUserStudents', '../../Shared/Personalization'].includes(source)) return technicalConsumers
      if (resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    }
    const billConsumers = resolve(root, 'scripts/brand-system/harness/bill-row-consumer-language.jsx')
    const printOwners = ['/Orders/OrderToPrint/index.js', '/Orders/OrderToPrintTicket/index.js']
    if (printOwners.some(file => importer.endsWith(file)) && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/print-language.jsx')
    if (printOwners.some(file => importer.endsWith(file)) && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/utils')) return resolve(root, 'scripts/brand-system/harness/print-utils.js')
    const isBillConsumer = ['/Orders/OrderBill/index.js', '/CreateCustomOrder/CartBill/index.js', '/CartRecovery/OpenCartBill/index.js'].some(file => importer.endsWith(file))
    if (isBillConsumer && ([sdkEntry, sdkEntry.slice(0, -3)].includes(resolved) || ['../../Shared', '../../../Shared', '../../../utils', '../../../../utils', './RefundToWallet', '../CouponControl'].includes(source))) return billConsumers
    if (importer.endsWith('/CreateCustomOrder/TaxInformation/index.js') && ([sdkEntry, sdkEntry.slice(0, -3)].includes(resolved) || source === '../SingleProductCard')) return billConsumers
    if (isBillConsumer && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    if (['/Shared/TaxBillRows/index.js', '/Shared/UI/TaxBillRows.jsx'].some(file => importer.endsWith(file)) && source === '../../../utils') return resolve(root, 'src/@/components-dashboard/src/ui/src/utils/billFormatting.js')
    const sheetConsumers = resolve(root, 'scripts/brand-system/harness/spreadsheet-consumer-language.jsx')
    if (['/Settings/LanguageTransSpread/index.js', '/Stores/BusinessSpreadSheet/index.js'].some(file => importer.endsWith(file)) && ([sdkEntry, sdkEntry.slice(0, -3)].includes(resolved) || source === '../../Shared')) return sheetConsumers
    if (importer.endsWith('/src/components/LanguageTransSpread/index.js') && source.startsWith('../../contexts/')) return sheetConsumers
    if (['/Shared/SpreadSheetEditor/index.js', '/Shared/UI/SpreadSheetEditor.jsx'].some(file => importer.endsWith(file)) && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/spreadsheet-language.jsx')
    const isMediaOwner = ['/Shared/UI/ImageCrop.jsx', '/Shared/ImageCrop/index.js'].some(file => importer.endsWith(file))
    if (isMediaOwner && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/media-language.jsx')
    if (isMediaOwner && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    const editorLanguage = resolve(root, 'scripts/brand-system/harness/html-editor-language.jsx')
    const editorDialogs = ['InsertLink', 'InsertImage', 'InsertVideo']
    const isEditorDialog = editorDialogs.some(name => importer.endsWith(`/Shared/UI/HtmlEditor/${name}.jsx`) || importer.endsWith(`/Shared/HtmlEditor/${name}/index.js`))
    if (isEditorDialog && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return editorLanguage
    if (isEditorDialog && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    if (isEditorDialog && source === '../../../../utils') return resolve(root, `src/@/components-dashboard/src/ui/src/utils/${importer.includes('InsertVideo') ? 'formatUrlVideo' : 'bytesConverter'}.js`)
    if (['/Shared/UI/AutoScroll.jsx', '/Shared/AutoScroll/index.js'].some(file => importer.endsWith(file)) && source === '../../../contexts/ThemeContext') return resolve(root, 'scripts/brand-system/harness/scroll-container-language.jsx')
    if (importer.endsWith('/Users/OccupationsFilter/index.js') && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    const scheduleLanguage = resolve(root, 'scripts/brand-system/harness/schedule-language.jsx')
    const scheduleConsumers = resolve(root, 'scripts/brand-system/harness/schedule-consumer-seams.jsx')
    const scheduleOwners = ['Schedule', 'ScheduleCopyTimes']
    if (scheduleOwners.some(name => importer.endsWith(`/Shared/UI/${name}.jsx`) || importer.endsWith(`/Shared/${name}/index.js`)) && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return scheduleLanguage
    const scheduleParents = ['/Marketing/EnterprisePromotionSchedule/index.js', '/Stores/BusinessSchedule/index.js']
    if (scheduleParents.some(file => importer.endsWith(file)) && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return scheduleConsumers
    if (importer.endsWith('/src/components/BusinessSchedule/index.js') && source.startsWith('../../contexts/')) return scheduleConsumers
    if ([...scheduleParents, ...scheduleOwners.map(name => `/Shared/${name}/index.js`)].some(file => importer.endsWith(file)) && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    const treeOwners = ['SelectBusinessCategories', 'SelectBusinessProducts']
    if (treeOwners.some(name => importer.endsWith(`/Shared/UI/${name}.jsx`) || importer.endsWith(`/Shared/${name}/index.js`)) && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/selection-tree-language.jsx')
    const treeConsumers = ['/Marketing/EnterprisePromotionSpecficCategory/index.js', '/Marketing/EnterprisePromotionSpecficProducts/index.js']
    if (treeConsumers.some(file => importer.endsWith(file)) && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/selection-tree-language.jsx')
    if (treeConsumers.some(file => importer.endsWith(file)) && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    const entityOwners = ['CitySelector', 'RecipientSelect', 'SelectBusinesses', 'SelectLoyaltyLevels', 'SelectSites', 'SelectUsers']
    if (entityOwners.some(name => importer.endsWith(`/Shared/UI/${name}.jsx`) || importer.endsWith(`/Shared/${name}/index.js`)) && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/entity-selector-language.jsx')
    if (importer.endsWith('/Marketing/EnterprisePromotionDetails/index.js') && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/entity-consumer-seams.jsx')
    if (importer.endsWith('/Marketing/EnterprisePromotionDetails/index.js') && source === '../EnterprisePromotionGeneralDetails') return resolve(root, 'scripts/brand-system/harness/entity-consumer-seams.jsx')
    if (importer.endsWith('/Marketing/EnterprisePromotionRules/index.js') && source === '../EnterprisePromotionConditions') return resolve(root, 'scripts/brand-system/harness/entity-consumer-seams.jsx')
    if (['/Marketing/EnterprisePromotionDetails/index.js', '/Marketing/EnterprisePromotionRules/index.js', '/Settings/ZoneDropdownDetails/index.js', ...entityOwners.map(name => `/Shared/${name}/index.js`)].some(file => importer.endsWith(file)) && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    const feedbackProviders = ['/components/Banners/Banners.jsx', '/Shared/UI/DisabledFeatureAlert.jsx', '/Shared/UI/Toast.jsx', '/components/WebsocketConnectionBanner/WebsocketConnectionBanner.jsx', '/components/NotNetworkConnectivity/NotNetworkConnectivity.jsx', '/components/Banners/index.js', '/components/DisabledFeatureAlert/index.js', '/components/PageNotFound/index.js', '/components/PageNotFound/PageNotFound.jsx', '/styles/Toast/index.js', '/components/WebsocketConnectionBanner/index.js']
    if (feedbackProviders.some(file => importer.endsWith(file)) && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/feedback-language.js')
    if (importer.endsWith('/Users/UsersExportCSV/index.js') && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return feedbackConsumers
    if (importer.endsWith('/Users/UsersExportCSV/index.js') && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    if (importer.endsWith('/Billing/BillingPaymentOptions/Stripe/PaymentCard.js') && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/utils')) return resolve(root, 'src/@/components-dashboard/src/ui/src/utils/getIconCard.js')
    if (['/Shared/RangeCalendar/index.js', '/Shared/UI/RangeCalendar.jsx'].some(file => importer.endsWith(file)) && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolved)) return resolve(root, 'scripts/brand-system/harness/calendar-language.js')
    if (importer.endsWith('/Shared/RangeCalendar/index.js') && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/utils')) return resolve(root, 'src/@/components-dashboard/src/ui/src/utils/getLocale.js')
    if (['/Shared/RangeCalendar/index.js', '/Shared/ColumnAllowSettingPopover/index.js'].some(file => importer.endsWith(file)) && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'src/@/components-dashboard/src/ui/src/styles/Buttons/index.js')
    if (importer.endsWith('/Marketing/CampaignSignUpOption/index.js') && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    const moreBranches = resolve(root, 'scripts/brand-system/harness/more-business-branches.jsx')
    if (importer.endsWith('/Stores/BusinessDetails/index.js') && (source === '../index' || source === '../../../utils')) return moreBranches
    if (importer.endsWith('/Stores/BusinessWhiteLabel/index.js') && source === '../../MyProducts/OrderingWebsite') return moreBranches
    if (['/Stores/BusinessWhiteLabel/index.js', '/Shared/Personalization/index.js'].some(file => importer.endsWith(file)) && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    if (importer.endsWith('/Settings/AddressFieldsSetting/index.js') && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    if (importer.endsWith('/Settings/AddressFieldsSetting/index.js') && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/utils')) return resolve(root, 'src/@/components-dashboard/src/ui/src/utils/getCodeNames.js')
    if (importer.endsWith('/Shared/SideBar/index.js') && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'src/@/components-dashboard/src/ui/src/styles/Buttons/index.js')
    if (importer.endsWith('/Users/UsersDeleteButton/index.js') && resolved === sharedEntry) return resolve(root, 'scripts/brand-system/harness/admin-shared.js')
    if (importer.endsWith('/Users/UsersDeleteButton/index.js') && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    if (importer.endsWith('/Shared/ConfirmAdmin/index.js') && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/utils')) return resolve(root, 'src/@/components-dashboard/src/ui/src/utils/formatSeconds.js')
    if (importer.endsWith('/Shared/ConfirmAdmin/index.js') && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    if (importer.endsWith('/Shared/InputPhoneNumber/index.js') && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/utils')) return resolve(root, 'src/@/components-dashboard/src/ui/src/utils/findExitingCode.js')
    if (importer.endsWith('/Orders/CreateCustomOrder/ProductForm/index.js') && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/utils')) return resolve(root, 'src/@/components-dashboard/src/ui/src/utils/scrollTo.js')
    const tabsStyleConsumers = ['/Orders/CreateCustomOrder/ProductForm/index.js', '/Orders/CreateCustomOrder/PaymentOptionSquare/index.js']
    if (tabsStyleConsumers.some(file => importer.endsWith(file)) && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/styles.js')
    if (importer.endsWith('/Messages/ChatBusinessesList/index.js') && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/components/Orders')) return resolve(root, 'scripts/brand-system/harness/shared.js')
    if (importer.endsWith('/Orders/OrdersHeaderFilterGroup/index.js') && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/shared.js')
    if (importer.endsWith('/Schools/SchoolUserStudents/index.js') && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'scripts/brand-system/harness/shared.js')
    if (importer.endsWith('/Settings/SettingsSelectUI/index.js') && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/utils')) return resolve(root, 'src/@/components-dashboard/src/utils/settingsAccess.js')
    if (resolved === resolve(root, 'src/@/components-dashboard/src/components/Schools/SchoolModuleToggle')) return resolve(root, 'scripts/brand-system/harness/pilot-controller.jsx')
    const buttonOnlyStyles = ['/MyProducts/OrderingWebsite/styles.js', '/Shared/Modal/index.js', '/Shared/NotFoundSource/index.js']
    if (buttonOnlyStyles.some(file => importer.endsWith(file)) && resolved === resolve(root, 'src/@/components-dashboard/src/ui/src/styles')) return resolve(root, 'src/@/components-dashboard/src/ui/src/styles/Buttons/index.js')
  }
  if (importer && source.startsWith('.') && resolve(importer.split('/').slice(0, -1).join('/'), source) === sharedEntry) {
    return resolve(root, 'scripts/brand-system/harness/shared.js')
  }
  if (importer && source.startsWith('.') && [sdkEntry, sdkEntry.slice(0, -3)].includes(resolve(importer.split('/').slice(0, -1).join('/'), source))) {
    return resolve(root, 'scripts/brand-system/harness/language.js')
  }
}
// Vite's dependency scan memoizes each resolution by specifier and importer DIRECTORY (esbuildScanPlugin), so the
// first file of a folder fixed the seam for its neighbours (Shared/UI/CitySelector.jsx got language.js, not its own fixture), the
// scan failed on «No matching export» and every dependency was discovered at run time, reloading the page mid-test. This esbuild
// plugin runs before Vite's scan plugin and applies the same per-file seams. Dependency files are not seam owners.
// A seam that matches an aliased source must list the raw form too ('~/components/Utils' as well as resolve(root, 'src/...')):
// the server resolves the alias before this plugin, the scan does not. After changing a seam, run the suite once with a cold
// cache: the dependency cache hash does not see the seam bodies.
const scanFixtureSeams = {
  name: 'scan-fixture-seams',
  setup (build) {
    build.onResolve({ filter: /.*/ }, ({ path, importer }) => {
      if (!importer || importer.includes('/node_modules/')) return undefined
      const seam = redirectFixtureSeam(path, normalizePath(importer))
      return seam ? { path: seam } : undefined
    })
  }
}

export default defineConfig({
  root,
  configFile: false,
  envFile: false,
  cacheDir: `node_modules/.vite-brand-system-harness-${harnessPort}`,
  publicDir: 'public',
  resolve: { alias: { '~': resolve(root, 'src') } },
  plugins: [
    {
      name: 'fixture-country-flag-assets',
      configureServer (server) {
        server.middlewares.use((request, response, next) => {
          const pathname = new URL(request.url || '/', 'http://localhost').pathname
          const prefix = '/brand-fixture-flags/'
          if (!pathname.startsWith(prefix)) return next()
          const name = pathname.slice(prefix.length)
          if (request.method !== 'GET' || !fixtureFlagFiles.includes(name)) {
            response.statusCode = 404
            response.end()
            return
          }
          response.setHeader('Content-Type', 'image/svg+xml')
          response.setHeader('X-Content-Type-Options', 'nosniff')
          response.end(readFileSync(resolve(fixtureFlagsDirectory, name)))
        })
      },
      generateBundle () {
        for (const name of fixtureFlagFiles) {
          this.emitFile({ type: 'asset', fileName: `brand-fixture-flags/${name}`, source: readFileSync(resolve(fixtureFlagsDirectory, name)) })
        }
      }
    },
    {
      name: 'harness-build-boundary-evidence',
      generateBundle () {
        const modules = [...this.getModuleIds()]
        this.emitFile({
          type: 'asset',
          fileName: 'harness-module-boundary.json',
          source: JSON.stringify({
            sdkEntryPresent: modules.includes(sdkEntry),
            baseUiModules: modules.filter(id => id.includes('/@base-ui/react/')).map(id => id.slice(id.indexOf('/node_modules/') + 1)).sort()
          }, null, 2)
        })
      }
    },
    {
      name: 'fixture-language-contract',
      enforce: 'pre',
      resolveId: redirectFixtureSeam
    },
    react({ include: /\.[jt]sx?$/, babel: { babelrc: false, configFile: false, presets: [['@babel/preset-react', { runtime: 'automatic' }]], plugins: [['babel-plugin-styled-components', { displayName: true, fileName: false }]] } })
  ],
  // the scan works again (scanFixtureSeams) and crawls every harness page, so it finds and prebundles at startup what
  // the fixtures import statically. include keeps two kinds only: what a cold run still discovers at run time although the scan
  // cannot reach it from the harness pages, and the families brandSystemHarness.test.js watches (Base UI subpaths, dayjs plugins,
  // posthog-js), listed whether or not the scan finds them. «optimized dependencies changed. reloading» (DEBUG=pw:webserver) must
  // not appear in a cold run of the whole suite: if it does, add what it names below.
  optimizeDeps: {
    entries: ['scripts/brand-system/harness/*.html'],
    include: [
      // Watched by brandSystemHarness.test.js.
      '@base-ui/react/accordion',
      '@base-ui/react/alert-dialog',
      '@base-ui/react/button',
      '@base-ui/react/checkbox',
      '@base-ui/react/collapsible',
      '@base-ui/react/dialog',
      '@base-ui/react/direction-provider',
      '@base-ui/react/field',
      '@base-ui/react/input',
      '@base-ui/react/menu',
      '@base-ui/react/number-field',
      '@base-ui/react/popover',
      '@base-ui/react/radio',
      '@base-ui/react/radio-group',
      '@base-ui/react/select',
      '@base-ui/react/switch',
      '@base-ui/react/tabs',
      '@base-ui/react/toggle',
      '@base-ui/react/toggle-group',
      '@base-ui/react/tooltip',
      'dayjs/plugin/customParseFormat',
      'dayjs/plugin/isSameOrAfter',
      'dayjs/plugin/relativeTime',
      'dayjs/plugin/timezone',
      'dayjs/plugin/updateLocale',
      'dayjs/plugin/utc',
      'posthog-js',
      'posthog-js/react',
      // Discovered at run time by a cold run and out of the scan's reach from the harness pages.
      '@meronex/icons/bs/BsDot',
      '@meronex/icons/md/MdKeyboardArrowLeft',
      '@meronex/icons/md/MdKeyboardArrowRight',
      '@sentry/react',
      'chartjs-adapter-moment',
      'firebase/app',
      'firebase/messaging',
      'resize-observer-polyfill',
      'terra-draw',
      'terra-draw-google-maps-adapter',
      'web-vitals'
    ],
    esbuildOptions: { loader: { '.js': 'jsx' }, plugins: [scanFixtureSeams] }
  },
  build: {
    outDir: '/tmp/ordering-brand-system-harness-build',
    emptyOutDir: true,
    rollupOptions: { input: resolve(root, 'scripts/brand-system/harness/index.html') }
  },
  server: { host: '127.0.0.1', port: harnessPort, strictPort: true, open: false, fs: { allow: [root] } }
})
