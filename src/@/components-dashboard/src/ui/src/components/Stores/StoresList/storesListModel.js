// redesign SL-F1 (A1): the pure model of the stores list. No React, no DOM, no requests: what a bulk action is, the words of its
// confirmation (C8), and the shape of the `filterValues` object the list controller (DashboardBusinessList) reads.

// ---- Bulk actions ----------------------------------------------------------------------------------------------------------------
// The five actions of the selection bar and what each one calls on the controller. Enable, disable, feature and unfeature are all
// `handleEnableAllBusiness(value, isFeatured)` (DashboardBusinessList:426-459: PUT /business `{ businesses_id, enabled | featured }`);
// delete is `handleDeleteMultiBusinesses()` (DELETE /business `{ businesses_id }`). `confirm` says what asks for the yes:
// a Product ConfirmDialog (`dialog`) or the password / OTP check of ConfirmAdmin (`admin`).

export const BULK_ACTION_IDS = Object.freeze(['enable', 'disable', 'feature', 'unfeature', 'delete'])

export const BULK_ACTIONS = Object.freeze({
  enable: Object.freeze({ id: 'enable', handler: 'handleEnableAllBusiness', args: Object.freeze([true, false]), confirm: 'dialog' }),
  disable: Object.freeze({ id: 'disable', handler: 'handleEnableAllBusiness', args: Object.freeze([false, false]), confirm: 'dialog' }),
  feature: Object.freeze({ id: 'feature', handler: 'handleEnableAllBusiness', args: Object.freeze([true, true]), confirm: 'dialog' }),
  unfeature: Object.freeze({ id: 'unfeature', handler: 'handleEnableAllBusiness', args: Object.freeze([false, true]), confirm: 'dialog' }),
  delete: Object.freeze({ id: 'delete', handler: 'handleDeleteMultiBusinesses', args: Object.freeze([]), confirm: 'admin' })
})

/**
 * The actions the bar offers. Feature and Unfeature need the Featured column, which only an administrator sees (main * `useFeaturedRestriction`), so they are left out for every other level.
 */
export const availableBulkActions = ({ isRestricted = false } = {}) => (
  BULK_ACTION_IDS.filter(id => !(isRestricted && (id === 'feature' || id === 'unfeature')))
)

/**
 * Runs `actionId` on the controller's handlers (`{ handleEnableAllBusiness, handleDeleteMultiBusinesses }`), with the arguments
 * of `BULK_ACTIONS`, and returns what the handler returns. An unknown action, or a handler that is not there, throws.
 */
export const runBulkAction = (actionId, handlers) => {
  const action = BULK_ACTIONS[actionId]
  if (!action) throw new Error(`Unknown bulk action: ${actionId}`)
  const handler = handlers?.[action.handler]
  if (typeof handler !== 'function') throw new Error(`Bulk action ${actionId} needs ${action.handler}`)
  return handler(...action.args)
}

// ---- The words of a confirmation (C8) --------------------------------------------------------------------------------------------
// «Disable 2 stores?» · «Sample Burgers, Demo Bakery, Test Wok +4 more will be disabled.» · [Disable 2 stores]
// The title and the button say the verb and the count; the description names up to three stores and the rest as «+N more».
// Every t() call is a literal one so the i18n scanner sees it (playbook §5, i18n 5).

const NAMED_STORES = 3

const copyOf = (action, one, t) => {
  switch (action) {
    case 'enable':
      return one
        ? {
            title: t('STORES_BULK_ENABLE_TITLE_ONE', 'Enable 1 store?'),
            description: t('STORES_BULK_ENABLE_DESCRIPTION', '_stores_ will be enabled.'),
            confirmLabel: t('STORES_BULK_ENABLE_CONFIRM_ONE', 'Enable 1 store')
          }
        : {
            title: t('STORES_BULK_ENABLE_TITLE_OTHER', 'Enable _count_ stores?'),
            description: t('STORES_BULK_ENABLE_DESCRIPTION', '_stores_ will be enabled.'),
            confirmLabel: t('STORES_BULK_ENABLE_CONFIRM_OTHER', 'Enable _count_ stores')
          }
    case 'disable':
      return one
        ? {
            title: t('STORES_BULK_DISABLE_TITLE_ONE', 'Disable 1 store?'),
            description: t('STORES_BULK_DISABLE_DESCRIPTION', '_stores_ will be disabled.'),
            confirmLabel: t('STORES_BULK_DISABLE_CONFIRM_ONE', 'Disable 1 store')
          }
        : {
            title: t('STORES_BULK_DISABLE_TITLE_OTHER', 'Disable _count_ stores?'),
            description: t('STORES_BULK_DISABLE_DESCRIPTION', '_stores_ will be disabled.'),
            confirmLabel: t('STORES_BULK_DISABLE_CONFIRM_OTHER', 'Disable _count_ stores')
          }
    case 'feature':
      return one
        ? {
            title: t('STORES_BULK_FEATURE_TITLE_ONE', 'Feature 1 store?'),
            description: t('STORES_BULK_FEATURE_DESCRIPTION', '_stores_ will be featured.'),
            confirmLabel: t('STORES_BULK_FEATURE_CONFIRM_ONE', 'Feature 1 store')
          }
        : {
            title: t('STORES_BULK_FEATURE_TITLE_OTHER', 'Feature _count_ stores?'),
            description: t('STORES_BULK_FEATURE_DESCRIPTION', '_stores_ will be featured.'),
            confirmLabel: t('STORES_BULK_FEATURE_CONFIRM_OTHER', 'Feature _count_ stores')
          }
    case 'unfeature':
      return one
        ? {
            title: t('STORES_BULK_UNFEATURE_TITLE_ONE', 'Unfeature 1 store?'),
            description: t('STORES_BULK_UNFEATURE_DESCRIPTION', '_stores_ will no longer be featured.'),
            confirmLabel: t('STORES_BULK_UNFEATURE_CONFIRM_ONE', 'Unfeature 1 store')
          }
        : {
            title: t('STORES_BULK_UNFEATURE_TITLE_OTHER', 'Unfeature _count_ stores?'),
            description: t('STORES_BULK_UNFEATURE_DESCRIPTION', '_stores_ will no longer be featured.'),
            confirmLabel: t('STORES_BULK_UNFEATURE_CONFIRM_OTHER', 'Unfeature _count_ stores')
          }
    case 'delete':
      return one
        ? {
            title: t('STORES_BULK_DELETE_TITLE_ONE', 'Delete 1 store?'),
            description: t('STORES_BULK_DELETE_DESCRIPTION', '_stores_ will be deleted.'),
            confirmLabel: t('STORES_BULK_DELETE_CONFIRM_ONE', 'Delete 1 store')
          }
        : {
            title: t('STORES_BULK_DELETE_TITLE_OTHER', 'Delete _count_ stores?'),
            description: t('STORES_BULK_DELETE_DESCRIPTION', '_stores_ will be deleted.'),
            confirmLabel: t('STORES_BULK_DELETE_CONFIRM_OTHER', 'Delete _count_ stores')
          }
    default:
      throw new Error(`Unknown bulk action: ${action}`)
  }
}

/**
 * The copy of the confirmation of a bulk action: `{ title, description, confirmLabel }`.
 *
 * - `names` are the names of the selected stores the caller knows (the selection lives in the controller and survives page
 *   changes, so it may know fewer names than `total`).
 * - `total` is how many stores the action touches; it defaults to `names.length`. The «+N more» is `total` minus the names shown,
 *   so a store whose name is not known is still counted.
 * - `t` is the `useLanguage()` translator.
 */
export const bulkConfirmCopy = (action, names, t, total) => {
  const list = (Array.isArray(names) ? names : []).map(name => String(name ?? '').trim()).filter(Boolean)
  const count = Number.isFinite(total) ? total : list.length
  const shown = list.slice(0, NAMED_STORES)
  const rest = Math.max(0, count - shown.length)
  const fill = text => text.replace('_count_', String(count))

  const more = rest > 0 ? t('STORES_BULK_MORE', '+_count_ more').replace('_count_', String(rest)) : ''
  // with no name at all the description says how many, so it never reads «+4 more will be disabled»
  const named = shown.length > 0
    ? [shown.join(', '), more].filter(Boolean).join(' ')
    : (count === 1 ? t('STORES_COUNT_ONE', '1 store') : fill(t('STORES_COUNT_OTHER', '_count_ stores')))

  const copy = copyOf(action, count === 1, t)
  return {
    title: fill(copy.title),
    description: copy.description.replace('_stores_', named),
    confirmLabel: fill(copy.confirmLabel)
  }
}

// ---- The filter values the list reads --------------------------------------------------------------------------------------------
// The object `handleChangeFilterValues` hands to the controller. It is the state of the BusinessFilter controller
// (C/components/BusinessFilter of main, replayed in __tests__/legacyBusinessFilter.js) as the old filter modal sent it on «Accept»: every key is there, the ones not in use hold their
// empty value, and «Clear» is `{}`. DashboardBusinessList:166-240 builds the AND group from it, one condition per key in use.

export const initialFilterValues = () => ({
  name: null,
  cityIds: [],
  availableMenus: { value: '', condition: '=' },
  menus: { value: '', condition: '=' },
  enabled: null,
  featured: null,
  externalId: null
})

const hasText = value => typeof value === 'string' && value.trim() !== ''
const isSet = value => value !== null && value !== undefined

/** True when `values` holds at least one filter that narrows the list. `{}` and the empty shape hold none. */
export const hasActiveFilters = (values) => {
  if (!values) return false
  return hasText(values.name) ||
    hasText(values.externalId) ||
    (Array.isArray(values.cityIds) && values.cityIds.length > 0) ||
    isSet(values.featured) ||
    isSet(values.enabled) ||
    hasText(values.availableMenus?.value) ||
    hasText(values.menus?.value)
}

/** The current values completed with the empty shape: what the old modal held in its local state before the user touched a field. */
export const readFilterValues = (current) => ({ ...initialFilterValues(), ...(current || {}) })

/**
 * The object to hand to `handleChangeFilterValues` after a change: the current values with `patch` applied, in the full shape.
 * When nothing narrows the list any more it is `{}` (what «Clear» sends), so the list and the header agree that no filter is on.
 * A text that is empty or only spaces is stored as `null`, the empty value of the shape.
 */
export const nextFilterValues = (current, patch) => {
  const next = { ...readFilterValues(current), ...patch }
  if ('name' in patch && !hasText(next.name)) next.name = null
  if ('externalId' in patch && !hasText(next.externalId)) next.externalId = null
  return hasActiveFilters(next) ? next : {}
}

/**
 * redesign stores 1.C, G1-06: true when `a` and `b` narrow the list the same way, so handing `a` over would only be a
 * new object and a request with the same answer. With no filter on either side (`{}`, the empty shape) they are the same.
 */
export const sameFilterValues = (a, b) => {
  const activeA = hasActiveFilters(a)
  const activeB = hasActiveFilters(b)
  if (!activeA || !activeB) return activeA === activeB
  return JSON.stringify(readFilterValues(a)) === JSON.stringify(readFilterValues(b))
}

/** Adds `cityId` to `cityIds` if it is not there and removes it if it is: `handleChangeCity` of the BusinessFilter controller. */
export const toggleCityId = (cityIds, cityId) => {
  const ids = Array.isArray(cityIds) ? cityIds : []
  return ids.includes(cityId) ? ids.filter(id => id !== cityId) : [...ids, cityId]
}
