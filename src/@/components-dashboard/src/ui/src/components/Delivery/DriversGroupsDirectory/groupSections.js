// redesign DG-B4 (decision 1 | M-DG13): the sections of the group panel and the map from main's `?tab=` keys.
// Pure: no React, no network. The conditions and the order are those of D/DriversGroupDetails:65-96.

// Every `?tab=` key main knew, in the order of its `sort` numbers (general 1, businesses 2, paymethods 3, delivery_zones 4,
// schedule 4.5, advanced_logistics 5, logs 6)
export const GROUP_SECTION_IDS = ['general', 'businesses', 'paymethods', 'delivery_zones', 'schedule', 'advanced_logistics', 'logs']

// Owner decision 35: a vertical SectionNav for an editor with MORE than four sections; four or fewer are Tabs
const SECTION_NAV_FROM = 5

// the sections a level never has, kept beside each list `groupSections` returns (no field on the list itself)
const LEVEL_5_HIDDEN = ['paymethods', 'delivery_zones', 'logs']
const hiddenForLevel = new WeakMap()

/**
 * The sections of the panel of a group, as main's tab bar listed them: General and Businesses always; with a group (not the add
 * form) Schedule, and, unless the session is level 5, Payment methods, Delivery zones and Logs; and Advanced logistics when the
 * project's autoassign type is not `basic` and the group does not have both autoassign drivers and group orders at 0.
 * `autoassignType` is `configs.autoassign_type.value`; unset (the config has not loaded) is not `basic`, as in main.
 * Returns `[{ id, label }]`.
 */
export const groupSections = ({ group, level, autoassignType, t }) => {
  const list = [
    { id: 'general', label: t('GENERAL', 'General') },
    { id: 'businesses', label: t('BUSINESSES', 'Businesses') }
  ]
  if (group) {
    const hideAdvancedLogistics = group.autoassign_amount_drivers === 0 && group.orders_group_max_orders === 0
    if (level !== 5) list.push({ id: 'paymethods', label: t('PAYMENT_METHODS', 'Payment methods') })
    if (level !== 5) list.push({ id: 'delivery_zones', label: t('DELIVERY_ZONES_TITLE', 'Delivery zones') })
    list.push({ id: 'schedule', label: t('SCHEDULE', 'Schedule') })
    if (autoassignType !== 'basic' && !hideAdvancedLogistics) {
      list.push({ id: 'advanced_logistics', label: t('ADVANCED_LOGISTICS', 'Advanced logistics') })
    }
    if (level !== 5) list.push({ id: 'logs', label: t('LOGS', 'Logs') })
  }
  hiddenForLevel.set(list, level === 5 ? LEVEL_5_HIDDEN : [])
  return list
}

/** The vertical SectionNav for more than four sections, Tabs for four or fewer (level 5, the add form, a basic autoassign type…). */
export const usesSectionNav = (sections) => sections.length >= SECTION_NAV_FROM

/**
 * `?tab=` → the section to show. A key main knew is respected even when the list lacks it (Schedule while the group loads,
 * Advanced logistics with a basic autoassign type), except a section the level never has: (owner decision D-69,
 * P-3, M-DG13) closes main's Logs, Payment methods and Delivery zones at level 5 for a link to `?tab=logs`, as Stores 11.
 * That, nothing, an unknown key or a non-string is General.
 */
export const resolveSection = (tab, sections = []) => {
  if (typeof tab !== 'string') return 'general'
  if ((hiddenForLevel.get(sections) || []).includes(tab)) return 'general'
  if (GROUP_SECTION_IDS.includes(tab) || sections.some(section => section.id === tab)) return tab
  return 'general'
}

/**
 * The four texts of the discard guard of RecordPanel (decision 17), the keys of the drivers panel's guard. GroupPanel gives the same
 * four to GroupZones (`discardTexts`) so «← All zones» with a dirty form asks the same question.
 */
export const discardTexts = (t) => ({
  discardTitle: t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?'),
  discardDescription: t('DRIVERS_DISCARD_BODY', 'What you changed here is not saved yet.'),
  discardConfirmLabel: t('DISCARD', 'Discard'),
  keepEditingLabel: t('KEEP_EDITING', 'Keep editing')
})
