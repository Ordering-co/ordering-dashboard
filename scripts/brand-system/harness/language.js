// Fixture seam: no SDK, account, API, storage, or provider side effects.
import React from 'react'
import translations from '../../../i18n/translations.json'

const dictionaries = new Map()
const languageStates = new Map()
const fallbackLanguage = [{ loading: false }, (key, fallback) => fallback || key]
const sessions = new Map()
const configState = [{ configs: {}, loading: false }]
export const useLanguage = () => {
  const locale = new URLSearchParams(window.location.search).get('locale')
  if (!locale) return fallbackLanguage
  if (!dictionaries.has(locale)) dictionaries.set(locale, Object.fromEntries(Object.entries(translations).map(([key, values]) => [key, values[locale]])))
  const dictionary = dictionaries.get(locale)
  if (!languageStates.has(locale)) languageStates.set(locale, [{ loading: false, dictionary }, (key, fallback) => dictionary[key] || fallback || key])
  return languageStates.get(locale)
}
export const useSession = () => {
  if (globalThis.__OD_PHONE_FIXTURE_SESSION__) return globalThis.__OD_PHONE_FIXTURE_SESSION__
  const level = new URLSearchParams(window.location.search).get('fixtureUserLevel')
  if (!sessions.has(level)) sessions.set(level, [{ auth: level !== null, loading: false, user: level === null ? null : { level: Number(level) } }])
  return sessions.get(level)
}
export const useConfig = () => globalThis.__OD_PHONE_FIXTURE_CONFIG__ ?? globalThis.__OD_SEARCH_BAR_CONSUMER_CONFIG__ ?? configState
// The real school form uses an in-memory API fixture; no provider or credentials.
export const useApi = () => globalThis.__OD_MORE_BUSINESS_API__ ?? [globalThis.__OD_SCHOOL_STANDARD_FIELD_FIXTURE__?.ordering]
export const useToast = () => [null, { showToast: (...args) => globalThis.__OD_SCHOOL_STANDARD_FIELD_FIXTURE__?.showToast?.(...args) }]
export const ToastType = { Error: 'error', Success: 'success' }
// Synthetic formatting seam for the real product preview field consumer.
// `useWebsiteUrl` (from `main`) reads the project's sites. No fixture publishes a
// site, so the hook resolves to its no-website branch.
export { CODES } from '../../../src/@/components-dashboard/src/constants/code-numbers'
export const useSite = () => [{ sites: [], loading: false }]
export const useUtils = () => [{ parsePrice: value => String(value ?? 0), optimizeImage: value => value }]
// The sidebar of `main` mounts the real ⌘K trigger. The palette's controller only
// renders once the palette opens, which no fixture does.
export const CommandPalette = ({ UIComponent, ...props }) => React.createElement(UIComponent, props)
export const DriversList = ({ UIComponent, ...props }) => React.createElement(UIComponent, props)
export const OccupationSelector = ({ UIComponent, ...props }) => React.createElement(UIComponent, props)
export const UsersList = ({ UIComponent, ...props }) => React.createElement(UIComponent, props)
export const DashboardBusinessList = ({ UIComponent, ...props }) => React.createElement(UIComponent, props)
export const CustomerFees = ({ UIComponent, ...props }) => React.createElement(UIComponent, props)
export const useOrder = () => [{ loading: false, options: { address_id: 1 }, carts: {} }]
export const ProductForm = ({ UIComponent, ...props }) => React.createElement(UIComponent, {
  ...props,
  productObject: { product: props.product, loading: false, error: null },
  productCart: props.productCart,
  errors: {},
  editMode: false,
  isSoldOut: false,
  actionStatus: { loading: false, error: null },
  maxProductQuantity: 100,
  increment: () => {},
  decrement: () => {},
  handleChangeProductCartQuantity: () => {},
  handleSave: () => {},
  showOption: option => option?.suboptions?.length > 0,
  handleFavoriteProduct: () => {},
  handleChangeIngredientState: () => {},
  handleChangeSuboptionState: () => {},
  handleChangeCommentState: () => {}
})
export const ProductIngredient = ({ UIComponent, ...props }) => React.createElement(UIComponent, { ...props, toggleSelect: () => {} })
export const ProductOption = ({ UIComponent, ...props }) => React.createElement(UIComponent, props)
export const ProductOptionSuboption = ({ UIComponent, ...props }) => React.createElement(UIComponent, props)
export const PaymentOptionSquare = ({ UIComponent, ...props }) => React.createElement(UIComponent, { ...props, ...globalThis.__OD_SCROLL_TABS_PAYMENT_FIXTURE__ })
// Synthetic controller contract for the actual OrdersHeaderFilterGroup UI.
export const OrdersFilter = ({ UIComponent, filterValues, setFilterValues, handleChangeFilterValues, ...props }) => React.createElement(UIComponent, {
  ...props,
  filterValues,
  handleChangeFilterValues,
  handleChangeExternalId: event => setFilterValues({ ...filterValues, externalId: event?.target?.value })
})
export { Popup } from '../../../src/@/components-dashboard/src/components/Popup'

// Stable in-memory controller for the real administrator confirmation UI.
export const CheckPassword = props => {
  if (!globalThis.__OD_CONFIRM_ADMIN_CONTROLLER__) throw new Error('ConfirmAdmin fixture controller missing')
  return React.createElement(globalThis.__OD_CONFIRM_ADMIN_CONTROLLER__, { onSyntheticRequest: globalThis.__OD_CONFIRM_ADMIN_REQUEST__, ...props })
}

export const AddressFieldsSetting = props => {
  const Controller = globalThis.__OD_ADDRESS_FIELDS_CONTROLLER__
  if (!Controller) throw new Error('AddressFieldsSetting fixture controller missing')
  return React.createElement(Controller, props)
}

export const BusinessDetails = () => { throw new Error('Unexpected BusinessDetails controller in fixture') }
// main, the Stripe Connect payouts controllers. Imported by pages the fixtures reach (the driver detail, the
// store payment methods), never drawn by a fixture: the dependency scan needs the names, a render is a fixture error
export const PayoutRules = () => { throw new Error('Unexpected PayoutRules controller in fixture') }
export const PayoutsList = () => { throw new Error('Unexpected PayoutsList controller in fixture') }
export const StripeConnectAccount = () => { throw new Error('Unexpected StripeConnectAccount controller in fixture') }
export const BusinessWhiteLabel = props => {
  const Controller = globalThis.__OD_BUSINESS_WHITE_LABEL_CONTROLLER__
  if (!Controller) throw new Error('BusinessWhiteLabel fixture controller missing')
  return React.createElement(Controller, props)
}
const fixtureEvents = { emit: () => {} }
export const useEvent = () => [fixtureEvents]

export const CampaignSignUpOption = props => {
  const Controller = globalThis.__OD_CAMPAIGN_SIGN_UP_CONTROLLER__
  if (!Controller) throw new Error('CampaignSignUpOption fixture controller missing')
  return React.createElement(Controller, props)
}
