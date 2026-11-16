// redesign DC-B3 (decision 3 | M-DC9, M-DC10): what the company's panel and its add form check before a save, and the names of
// what is pending. Pure: no React, no network.
//
// main validated each tab on its own (the former General tab, the former Webhooks tab,
// the former add form): the fields of the tab in view had to hold a value (react-hook-form `required` on the shown
// value: the change, else the company's), and the time zone (the change, else the company's) was checked on General and on
// Webhooks. Schedule checked nothing. The panel now has ONE save for the three sections (the controller already sent every
// pending change, whatever the tab): the section in view is checked as main checked its tab, and any required field the person
// emptied is checked too, wherever it is (main sent it and the API refused, or stored an empty name).

export const COMPANY_SECTIONS = ['general', 'schedule', 'webhooks']

export const REQUIRED_FIELDS = {
  general: ['name', 'address'],
  webhooks: ['webhook_new_order', 'webhook_cancel_request']
}

// The order of the fields on screen: the first error is the one that gets the focus
export const FIELD_ORDER = [
  'name', 'limit', 'priority', 'timezone', 'address',
  'schedule',
  'webhook_new_order', 'webhook_cancel_request', 'webhook_order_status_changed'
]

export const sectionOf = (field) => {
  if (field === 'schedule') return 'schedule'
  if (String(field).startsWith('webhook_')) return 'webhooks'
  return 'general'
}

const has = (changes, field) => Boolean(changes) && Object.prototype.hasOwnProperty.call(changes, field)

/** The value on screen: the pending change, else the company's (main's `changesState?.x ?? company?.x`). */
export const valueOf = (field, changes, company) => (has(changes, field) ? changes[field] : company?.[field])

const isBlank = (value) => value === null || value === undefined || String(value).trim() === ''

export const fieldLabel = (field, t) => ({
  name: t('NAME', 'Name'),
  limit: t('LIMIT', 'Limit'),
  priority: t('PRIORITY', 'Priority'),
  timezone: t('TIMEZONE', 'Timezone'),
  address: t('ADDRESS', 'Address'),
  schedule: t('SCHEDULE', 'Schedule'),
  webhook_new_order: t('WEBHOOK_NEW_ORDER', 'Webhook new order'),
  webhook_cancel_request: t('WEBHOOK_CANCEL_REQUEST', 'Webhook cancel request'),
  webhook_order_status_changed: t('WEBHOOK_ORDER_STATUS_CHANGED', 'Webhook order status changed')
}[field] ?? field)

// The key main used, with the repo catalog's text («Value is required»): under its field it needs no name. A project whose
// translation names the field (`_attribute_`) still gets it filled in, as main did.
const requiredText = (field, t) => t('VALIDATION_ERROR_REQUIRED', 'Value is required').replace('_attribute_', fieldLabel(field, t))

/**
 * The errors of a save, `{ field: message }` in screen order (empty: it may be sent).
 *  - mode 'add': every required field and the time zone, as main's add form (it had all three sections on one page).
 *  - mode 'edit': the required fields of `section` (the one in view) and any required field the person emptied; the time zone
 *    when the section is General or Webhooks.
 *  - `integration`: the webhooks are not required.
 */
export const validate = ({ section = 'general', changes = {}, company = null, mode = 'edit', integration = false, t }) => {
  const errors = {}
  // an integration company (owner_type system) has no webhooks to fill
  const allRequired = integration ? REQUIRED_FIELDS.general : [...REQUIRED_FIELDS.general, ...REQUIRED_FIELDS.webhooks]
  const checked = mode === 'add' ? allRequired : (REQUIRED_FIELDS[section] ?? [])
  const checkTimezone = mode === 'add' || section === 'general' || section === 'webhooks'
  for (const field of FIELD_ORDER) {
    if (field === 'timezone') {
      if (checkTimezone && isBlank(valueOf('timezone', changes, company))) errors.timezone = requiredText('timezone', t)
      continue
    }
    if (!allRequired.includes(field)) continue
    const inScope = checked.includes(field) || has(changes, field)
    if (inScope && isBlank(valueOf(field, changes, company))) errors[field] = requiredText(field, t)
  }
  return errors
}

/** The section of the first error, to show it (null: no error). */
export const firstErrorSection = (errors) => {
  const first = FIELD_ORDER.find(field => errors?.[field])
  return first ? sectionOf(first) : null
}

/** The pending fields in screen order (what the save bar lists), with a change the controller holds but the screen does not draw last. */
export const changedFields = (changes) => {
  const keys = Object.keys(changes ?? {})
  return [...FIELD_ORDER.filter(field => keys.includes(field)), ...keys.filter(key => !FIELD_ORDER.includes(key))]
}
