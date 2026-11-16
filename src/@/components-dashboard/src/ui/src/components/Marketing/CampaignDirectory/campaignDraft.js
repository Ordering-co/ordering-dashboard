// redesign CA-B5 (decision 3, decision 7; M-CA2, M-CA7, M-CA9, M-CA12, M-CA13; auditor #3, #5, #6): the pure side of the create form. No React,
// no context. The draft is READ from what the controller (K/CampaignDetail) holds; nothing here writes. Words go through the `t` the
// caller passes, one LITERAL `t()` call per value.
import { shiftDay, todayDay } from '../../../../../utils/dateRange'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'
import { RULE_TYPES } from './campaignData'

/** The time a scheduled campaign (and the end of a dynamic one) proposes. `main` sent 00:00 without showing it; 09:00 is a time to be
 * read (row 39, campaign P-4, D-52). A stamp that already has a time keeps it. */
export const DEFAULT_TIME = '09:00'

const present = (value) => value !== null && value !== undefined && value !== ''

const text = (value) => (typeof value === 'string' ? value : '')

/**
 * Whether an HTML or plain text holds anything to read. The email editor leaves `<p><br></p>` (or `&nbsp;`) when it is empty, which is
 * truthy: main sent it as a message. An image, a video or a frame alone is content. A number is a value.
 */
export const hasText = (value) => {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'string') return false
  if (/<(img|video|audio|iframe)\b/i.test(value)) return true
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/gi, ' ').trim() !== ''
}

// ---- dates and times ---------------------------------------------------------------------------------------------------------
// The API takes `YYYY-MM-DD HH:mm:ss` written as local wall time without a zone (auditor #2). The days that travel through the form are
// `YYYY-MM-DD` strings (what P/DatePicker gives), joined here, so there is no date format to spell out in this file.

/** The day and the time of a stored `YYYY-MM-DD HH:mm:ss` stamp, or nulls. A time off the 30-minute grid is kept as it is. */
export const splitStamp = (stamp) => {
  if (typeof stamp !== 'string' || stamp.length < 16) return { day: null, time: null }
  return { day: stamp.slice(0, 10), time: stamp.slice(11, 16) }
}

/** The stamp the API takes for a day and a `HH:mm` time. */
export const stampOf = (day, time) => `${day} ${time || DEFAULT_TIME}:00`

/** The half-hour slots of a day, `00:00` … `23:30` (decision 6). */
export const timeSlots = () => Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, '0')
  return `${hour}:${index % 2 === 0 ? '00' : '30'}`
})

/** The first day a fixed campaign can be scheduled for: tomorrow (today's `getMinDate`). */
export const minScheduleDay = () => shiftDay(todayDay(), 1)

/** The first day a dynamic campaign can end on: today (main's `minDate={new Date()}`). */
export const minEndDay = () => todayDay()

/** The project's date format and whether it writes the hours on a 12-hour clock (as `ScheduleEditor` decides), from `useConfig()`. */
export const dateSettings = (configs) => ({
  dateFormat: getDateTimeFormats(configs?.dates_general_format?.value).dateFormat,
  is12Hours: !!configs?.general_hour_format?.value?.includes('hh:mm')
})

/** One slot written for the eye: `09:30`, or `9:30 AM` on a 12-hour clock. */
export const slotLabel = (slot, is12Hours, t) => {
  if (!is12Hours) return slot
  const hour = Number(slot.slice(0, 2))
  const half = hour < 12 ? t('AM', 'AM') : t('PM', 'PM')
  return `${hour % 12 === 0 ? 12 : hour % 12}:${slot.slice(3, 5)} ${half}`
}

/** The words of P/DatePicker. `clearable` adds «Clear» (the optional end date). */
export const pickerLabels = (t, { clearable = false } = {}) => ({
  title: t('SELECT_DATE', 'Select a date'),
  close: t('CLOSE', 'Close'),
  today: t('TODAY', 'Today'),
  goToToday: t('DATE_RANGE_GO_TO_TODAY', 'Go to today'),
  previousMonth: t('PREVIOUS_MONTH', 'Previous month'),
  nextMonth: t('NEXT_MONTH', 'Next month'),
  invalidDate: (format) => t('DATE_RANGE_INVALID', 'Enter a real date as _format_.').replace('_format_', () => format),
  outOfRange: t('CAMPAIGNS_DATE_UNAVAILABLE', 'That date is not available.'),
  ...(clearable ? { clear: t('CLEAR', 'Clear') } : {})
})

// ---- rules -------------------------------------------------------------------------------------------------------------------

/**
 * Why a rule is not finished, or null: `operator` (nothing chosen), `number` (a count with no whole number from its minimum),
 * `date` (Before with no day), `range` (a range with half its days, or the end before the start), `same_day` (today's
 * MAX_DATE_AFTER_DATE check) or `unknown` (a type this form cannot edit).
 */
export const ruleProblem = (condition) => {
  const rule = RULE_TYPES.find(item => item.type === condition?.type)
  if (!rule) return 'unknown'

  if (rule.kind === 'count') {
    if (!present(condition.condition)) return 'operator'
    const value = present(condition.value) ? Number(condition.value) : NaN
    if (!Number.isFinite(value)) return 'number'
    // main clears «less than 0» (M/CampaignAmountOption:86-92); a count is never negative
    if (value < 0 || (condition.condition === '<' && value < 1)) return 'number'
    return null
  }

  if (!present(condition.date_condition)) return 'operator'
  const range = condition.date_condition === '><'
  if (!present(condition.date)) return range ? 'range' : 'date'
  if (range) {
    if (!present(condition.max_date)) return 'range'
    const from = String(condition.date).slice(0, 10)
    const to = String(condition.max_date).slice(0, 10)
    if (from === to) return 'same_day'
    if (to < from) return 'range'
  }
  return null
}

/**
 * Today's two checks of a fixed campaign (M/CampaignDetailGeneral:184-197): a date rule that is «=» or «>» (`date`), a count rule that
 * is «=» (`count`). The options that make them are not offered any more; the checks stay.
 */
export const fixedOperatorProblem = (condition) => {
  if (condition?.date_condition === '=' || condition?.date_condition === '>') return 'date'
  if (condition?.condition === '=') return 'count'
  return null
}

/**
 * The identity of a list of rules, for comparing the one that was counted with the one in the form. The controller deletes the keys
 * that are null IN PLACE before it counts (`getAudience`), so null keys and the order of the keys do not count.
 */
export const conditionsKey = (conditions) => JSON.stringify(
  (Array.isArray(conditions) ? conditions : []).map(condition => (
    Object.keys(condition || {}).sort().filter(key => present(condition[key])).map(key => [key, condition[key]])
  ))
)

// ---- the draft ---------------------------------------------------------------------------------------------------------------

/**
 * The draft of the campaign, read from the controller's state. `extra` is what only the form knows: `when` (`asap` | `later`, which
 * lives in the form so it survives a change of channel or section, M-CA12), `scheduledTime` / `endTime` (a time can be chosen before
 * its day), `conditions` (the rows of the form, the unfinished ones included) and `isConfigured` (what the channel editor reported:
 * `true`, `false`, or `null` while unknown).
 */
export const toDraft = (formState, contactState, extra = {}) => {
  const changes = formState?.changes || {}
  const contact = contactState?.changes || {}
  // the message is mirrored in two states in add mode; the form state is the one the next POST is built from
  const pick = (name) => text(changes.contact_data?.[name] ?? contact.contact_data?.[name])

  const scheduledAt = present(changes.scheduled_at) ? changes.scheduled_at : null
  const endAt = present(changes.end_at) ? changes.end_at : null
  const conditions = extra.conditions ?? changes.conditions
  const when = extra.when === 'asap' || extra.when === 'later' ? extra.when : (scheduledAt ? 'later' : 'asap')

  return {
    name: text(changes.name),
    channel: changes.contact_type || contact.contact_type || '',
    audience: changes.audience_type === 'fixed' || changes.audience_type === 'dynamic' ? changes.audience_type : '',
    conditions: Array.isArray(conditions) ? conditions : [],
    title: pick('title'),
    body: pick('body'),
    when,
    scheduledAt,
    scheduledTime: splitStamp(scheduledAt).time ?? extra.scheduledTime ?? DEFAULT_TIME,
    enabled: changes.enabled === undefined ? true : !!changes.enabled,
    endAt,
    endTime: splitStamp(endAt).time ?? extra.endTime ?? DEFAULT_TIME,
    isConfigured: extra.isConfigured === undefined ? null : extra.isConfigured
  }
}

/** The first rule of the draft that is not finished, or null. */
export const incompleteRule = (draft) => (draft?.conditions || []).find(condition => ruleProblem(condition)) || null

/**
 * What stops «Send», in the order of the form (ids; the caller writes them with `t`): `name`, `channel`, `setup`, `audience`, `title`,
 * `body`, `schedule_date`, `end_date`, `rules`, `rule_incomplete`, `rule_fixed_operator`. The API refuses a campaign without a name,
 * without a rule, or dynamic without an end date.
 */
export const missingForSend = (draft) => {
  const missing = []
  if (!hasText(draft.name)) missing.push('name')
  if (!draft.channel) missing.push('channel')
  else if (draft.isConfigured === false) missing.push('setup')
  if (!draft.audience) missing.push('audience')
  if (!hasText(draft.title)) missing.push('title')
  if (!hasText(draft.body)) missing.push('body')
  if (draft.audience === 'fixed' && draft.when === 'later' && !draft.scheduledAt) missing.push('schedule_date')
  if (draft.audience === 'dynamic' && !draft.endAt) missing.push('end_date')
  const conditions = draft.conditions || []
  if (conditions.length === 0) missing.push('rules')
  if (conditions.some(condition => ruleProblem(condition))) missing.push('rule_incomplete')
  if (conditions.some(condition => fixedOperatorProblem(condition))) missing.push('rule_fixed_operator')
  return missing
}

/**
 * What the one button does: `send` (fixed, as soon as possible: the confirmation applies), `schedule` (fixed, later) or `create`
 * (dynamic, or no audience yet).
 */
export const actionOf = (draft) => {
  if (draft.audience !== 'fixed') return 'create'
  return draft.when === 'later' ? 'schedule' : 'send'
}

/**
 * The overrides of the one POST (M-CA13): only the fields of the chosen audience, and `enabled` always (auditor #6). A key set to
 * `undefined` is dropped from the body by the controller, so a value the form still holds (a scheduled date of a campaign turned
 * dynamic, an end date of a fixed one) never travels.
 */
export const buildOverrides = (draft) => {
  if (draft.audience === 'fixed') {
    const when = draft.when === 'later'
      ? { scheduled_at: draft.scheduledAt || undefined, status: 'scheduled' }
      : { scheduled_at: undefined, status: 'pending' }
    return { end_at: undefined, enabled: true, ...when }
  }
  if (draft.audience === 'dynamic') {
    return { scheduled_at: undefined, status: 'pending', end_at: draft.endAt || undefined, enabled: draft.enabled !== false }
  }
  return {}
}

/** Whether any field holds a value (name, title, body, a rule, a date): the form is dirty. A choice alone is not typing. */
export const isDirty = (draft) => !!(
  draft && (
    text(draft.name).trim() !== '' ||
    hasText(draft.title) ||
    hasText(draft.body) ||
    (draft.conditions || []).length > 0 ||
    present(draft.scheduledAt) ||
    present(draft.endAt)
  )
)
