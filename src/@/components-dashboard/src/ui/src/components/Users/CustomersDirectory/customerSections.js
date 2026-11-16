// redesign UC-B4 (decision 1, auditor #3): the sections of the customer panel and the map from main's deep links.
// Pure: no React, no network.
import { isCashWalletOn, isPointsWalletOn } from './customerData'

// The order the SectionNav shows them in
export const CUSTOMER_SECTIONS = ['overview', 'orders', 'wallet', 'addresses', 'profile', 'push_tokens', 'school_students']

// `wallet` only with the cash or the points add-on; `school_students` only with the Schools module
// (`isSchoolsOn` comes from `isDashboardFeatureEnabled({ featureKey: 'schools', configs })`, as U/UserDetailsMenu decides it)
export const customerSectionIds = ({ configs, isSchoolsOn } = {}) => CUSTOMER_SECTIONS.filter((id) => {
  if (id === 'wallet') return isCashWalletOn(configs) || isPointsWalletOn(configs)
  if (id === 'school_students') return Boolean(isSchoolsOn)
  return true
})

// main's `?section=user_details&tab=…` tabs and the section each one became
const TAB_TO_SECTION = {
  profile: 'profile',
  saved_places: 'addresses',
  orders: 'orders',
  push_tokens: 'push_tokens',
  school_students: 'school_students'
}

// `?section=` and `?tab=` of main (or of the new panel) → `{ section, wallet, customFields }`.
// `wallet` is 'cash', 'points' or null; `customFields` says the Custom fields dialog opens (main's `metafields` section).
// A new id passes through; anything else is the overview.
export const fromLegacyQuery = ({ section, tab } = {}) => {
  const to = (id, extra = {}) => ({ section: id, wallet: null, customFields: false, ...extra })
  switch (section) {
    case 'user_details':
      return to(TAB_TO_SECTION[tab] ?? 'profile')
    case 'cash_wallet':
      return to('wallet', { wallet: 'cash' })
    case 'points_wallet':
      return to('wallet', { wallet: 'points' })
    case 'metafields':
      return to('overview', { customFields: true })
    default:
      return to(CUSTOMER_SECTIONS.includes(section) ? section : 'overview')
  }
}
