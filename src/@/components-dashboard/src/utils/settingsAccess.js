import { isDashboardFeatureEnabled } from './dashboardFeatureAccess'
import { SETTINGS_PARENT_CATEGORY_KEYS, SETTINGS_STANDALONE_CATEGORY_KEYS } from './settingsIa'

/**
 * Settings visual access. Plan configs (plan_pro / plan_enterprise) are
 * intentionally ignored: every settings tab, order type and category is
 * available on every project.
 */
export const getSettingsOrderTypeValues = () => ([
  'delivery',
  'pickup',
  'eatin',
  'curbside',
  'drivethru',
  'seatdelivery',
  'catering_delivery',
  'catering_pickup',
  'reservation'
])

export const getSettingsGuestOrderTypeValues = () => ([
  '1', '2', '3', '4', '5', '6', '7', '8', '9'
])

export const shouldHideUpsellingConfig = ({ configs } = {}) =>
  !isDashboardFeatureEnabled({ featureKey: 'upselling', configs })

export const getSettingsSitesWhere = () => null

/**
 * Parent keys whose children are fetched for the Settings hub. Every project
 * fetches every key: there is no plan gating.
 */
export const getSettingsCategoryKeysToFetch = () =>
  SETTINGS_PARENT_CATEGORY_KEYS.map(key => ({ key, enabled: true }))

/**
 * Categories fetched by key because they are not children of a parent key.
 */
export const getSettingsStandaloneCategoryKeys = () => [...SETTINGS_STANDALONE_CATEGORY_KEYS]
