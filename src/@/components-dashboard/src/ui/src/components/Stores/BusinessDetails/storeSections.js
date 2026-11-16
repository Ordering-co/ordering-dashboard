import { useLanguage, useConfig, useApi } from '~components'
import { useSelectedAccessRole } from '../../../hooks/useUserSelectedAccess'
import { useGoogleActionsVisibility } from '../../../hooks/useGoogleActionsVisibility'
import { getBusinessConfigSections } from '../../../../../utils/businessConfigSections'
import { STORE_SECTION_DEFS, STORE_SECTION_GROUPS, isStoreSectionInMenu } from '../../../../../utils/businessDetailSections'

// redesign SL-F2 (B1)
// Sections map of the store editor (`/stores/list?id=&section=`). Same sections and enable rules as `businessConfigs` in
// `Stores/BusinessSummary` (:128-254), grouped (stores 4.A, decision 2). BusinessSummary is left untouched (dead code,
// ).

export const STORE_OVERVIEW_ID = 'overview'

/**
 * Query keys the editor clears when the open section changes or closes. Same
 * list, in the same order, as `handleCloseExtraOpen` in BusinessDetails (:167).
 * `product` (BusinessSharedMenuProducts) and `place_group`
 * (BusinessPlaceGroupList) are read by components inside the menu and places
 * sections but are not cleared today, so they are not listed here.
 */
export const STORE_SECTION_QUERY_KEYS = [
  'section',
  'tab',
  'business_type',
  'paymethod',
  'paymethod_tab',
  'setting_tab',
  'menu',
  'zone',
  'zone_tab',
  'wallet'
]

/**
 * Pure builder. `ctx`:
 * - `isAdmin`: `user.level === 0`.
 * - `isSelectedAccessRole`: `useSelectedAccessRole()`.
 * - `project`: `ordering.project` (`useApi`).
 * - `configs`: `useConfig()` configs map (`configs.<key>.value`).
 * - `spoonityConfig`: the business config `spoonity_integration_api_key`, if any.
 * - `businessConfigs`: `business.configs` (array), for the integrations section.
 * - `googleActionsVisible`: the project shows Order with Google (`useGoogleActionsVisibility`, ).
 *
 * Returns `[{ id, label, group, enabled }]` in navigation order, `overview` first, with the 25 sections of BusinessSummary
 * in five groups (decision 2). `group` is the group's id (`STORE_SECTION_GROUPS`).
 *
 * redesign stores 4.A: the rules are not repeated here any more; they live in `businessDetailSections.js`
 * (`isStoreSectionInMenu`), which the body and the palette read too.
 */
export const buildStoreSections = (ctx = {}, t) => {
  const {
    isAdmin = false,
    isSelectedAccessRole = false,
    project,
    configs,
    spoonityConfig,
    businessConfigs,
    googleActionsVisible = false
  } = ctx

  const access = { isAdmin, isSelectedAccessRole, project }
  const menu = {
    configs,
    hasSpoonity: !!spoonityConfig,
    hasBusinessConfigSections: getBusinessConfigSections(businessConfigs).length > 0,
    googleActionsVisible
  }

  return STORE_SECTION_DEFS.map(({ key, group, labelKey, label }) => ({
    id: key,
    label: t(labelKey, label),
    group,
    enabled: isStoreSectionInMenu(key, access, menu)
  }))
}

/** The groups of the navigation (`STORE_SECTION_GROUPS`), translated: `[{ id, label }]` */
export const buildStoreSectionGroups = (t) => {
  const labels = {
    store: t('STORE_SECTION_GROUP_STORE', 'Store'),
    orders: t('STORE_SECTION_GROUP_ORDERS', 'Orders & delivery'),
    payments: t('STORE_SECTION_GROUP_PAYMENTS', 'Payments & fees'),
    channels: t('STORE_SECTION_GROUP_CHANNELS', 'Channels'),
    integrations: t('STORE_SECTION_GROUP_INTEGRATIONS', 'Integrations & activity')
  }
  return STORE_SECTION_GROUPS.map(id => ({ id, label: labels[id] }))
}

export const useStoreSections = ({ business, spoonityConfig, isAdmin } = {}) => {
  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [ordering] = useApi()
  const isSelectedAccessRole = useSelectedAccessRole()
  const { visible: googleActionsVisible } = useGoogleActionsVisibility()

  return buildStoreSections({
    isAdmin,
    isSelectedAccessRole,
    project: ordering?.project,
    configs,
    spoonityConfig,
    businessConfigs: business?.configs,
    googleActionsVisible
  }, t)
}
