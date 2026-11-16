// redesign DS-B3 (decisions 1, 5, 17 | M-DS13, M-DS22): the sections of the provider panel and the map from main's `?tab=` keys.
// Pure: no React, no network. The keys of `?tab=` are those of C/N/DeliveryServiceDetails (`general`, `businesses`, `schedule`,
// `paymethods`, `delivery_zones`); only the order and the name of `general` change (decision 5: «Credentials»).

export const PROVIDER_SECTION_IDS = ['general', 'businesses', 'schedule', 'paymethods', 'delivery_zones']

/**
 * The five sections of the panel (level 0 is the only level that reaches this page). With the credentials incomplete
 * (`availableModifyData` is not true) the four after Credentials are disabled and carry the reason, instead of not existing as
 * the tabs of main did (M-DS22); with them complete none carries a reason. Returns `[{ id, label, disabled?, description? }]`.
 */
export const providerSections = ({ availableModifyData, t }) => {
  const locked = availableModifyData !== true
  const reason = locked ? t('DELIVERY_SERVICES_COMPLETE_CREDENTIALS_FIRST', 'Complete the credentials first') : undefined
  const gated = (id, label) => ({ id, label, disabled: locked, description: reason })
  return [
    { id: 'general', label: t('DELIVERY_SERVICES_CREDENTIALS', 'Credentials') },
    gated('businesses', t('BUSINESSES', 'Businesses')),
    gated('schedule', t('SCHEDULE', 'Schedule')),
    gated('paymethods', t('PAYMENT_METHODS', 'Payment methods')),
    gated('delivery_zones', t('DELIVERY_ZONES_TITLE', 'Delivery zones'))
  ]
}

/**
 * `?tab=` → the section to show. A known key whose section is enabled is respected; a known one that is disabled (the
 * credentials are incomplete), an unknown one, nothing or a non-string is `general`.
 */
export const resolveSection = (tab, sections = []) => {
  if (typeof tab !== 'string') return 'general'
  const section = sections.find(item => item.id === tab)
  return section && !section.disabled ? tab : 'general'
}

/**
 * The four texts of the discard guard of RecordPanel (decision 17): the keys and texts of the drivers panel's guard
 * (Delivery/DriversGroupsDirectory/groupSections.js), not imported from there: that is another page. The panel gives the same four
 * to GroupZones (`discardTexts`) so «← All zones» with a dirty form asks the same question.
 */
export const discardTexts = (t) => ({
  discardTitle: t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?'),
  discardDescription: t('DRIVERS_DISCARD_BODY', 'What you changed here is not saved yet.'),
  discardConfirmLabel: t('DISCARD', 'Discard'),
  keepEditingLabel: t('KEEP_EDITING', 'Keep editing')
})

/**
 * The keys of the group the automatic assignment block saves on change (M-DS13). Taken from the code, not invented:
 *  - C/N/DriversGroupsLogisticsService: `orders_group_start_in_status` (the two radios, via `handleChangesState`);
 *  - C/N/DriversGroupAutoassignService: `autoassign_autoassign_driver` and `autoreject_after_expiration` (its two checkboxes, via
 *    `onChangeSave`); the time «Auto reject Order if not assign in» goes through its controller as `autoassign_autoreject_time`;
 *  - K/DriversGroupAutoassign (the controller of the block): `autoassign_autoreject_time`, `autoassign_initial_radius`,
 *    `autoassign_increment_radius`, `autoassign_max_radius`, `autoassign_amount_drivers` (`onSelectAssign`) and
 *    `autoassign_max_azimuth_diff` (`handleChangeAzimuthInput`). The block mounted here reaches the first four only; the rest are the
 *    other keys that controller writes and no other section of this panel writes.
 * `business` and `allowed_paymethods` (Businesses and Payment methods, which save with their own button) are not in it.
 */
export const AUTOSAVE_KEYS = [
  'orders_group_start_in_status',
  'autoassign_autoassign_driver',
  'autoreject_after_expiration',
  'autoassign_autoreject_time',
  'autoassign_initial_radius',
  'autoassign_increment_radius',
  'autoassign_max_radius',
  'autoassign_amount_drivers',
  'autoassign_max_azimuth_diff'
]

/** Only the autoassignment keys of `changesState`, with their values; `{}` when there are none (then nothing is sent). */
export const autosaveChanges = (changesState) => {
  const changes = {}
  if (!changesState) return changes
  for (const key of AUTOSAVE_KEYS) {
    if (key in changesState) changes[key] = changesState[key]
  }
  return changes
}
