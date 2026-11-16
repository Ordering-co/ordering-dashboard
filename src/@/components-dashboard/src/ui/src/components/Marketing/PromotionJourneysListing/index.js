import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  EnterprisePromotionList as EnterprisePromotionListController,
  ToastType,
  useConfig,
  useLanguage,
  useToast,
  useUtils
} from '../../../../../index'
import { DEFAULT_VISIBLE_DATE_FORMAT } from '../../../../../contexts/UtilsContext'
import { getDateTimeFormats } from '../../../../../utils/settingsCustomSections'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { SelectBusinessCategories } from '../../Shared'
import { X } from '../../Shared/Icon'
import {
  Button,
  Checkbox,
  ConfirmDialog,
  DatePicker,
  Field,
  IconButton,
  InlineNotice,
  NumberField,
  Pagination,
  ScheduleEditor,
  SearchField,
  SegmentedControl,
  TextArea,
  TextField,
  TimeField
} from '../../Shared/Product'
import { hasActiveDialogLayer } from '../../Shared/UI/dialog-layer'
import { FirstSelect } from '../../Shared/UI/FirstSelect'
import { SelectSurfaceContext } from '../../Shared/UI/selectPlacement'
import { PromotionSearch } from '../PromotionsDirectory/PromotionSearch'
import { PromotionsTable } from '../PromotionsDirectory/PromotionsTable'
import { JourneyProductPicker } from './JourneyProductPicker'
import { JOURNEY_TEMPLATES } from './journeyTemplates'
import {
  buildJourneyPayload,
  buildJourneySummary,
  buildJourneyUpdatePayload,
  captureJourneyEvent,
  createSummaryDateFormatter,
  getInitialJourneyForm,
  getJourneyChannelsStatus,
  getJourneyFormFromPromotion,
  getJourneyValueWithDefaultTime,
  validateJourneyForm
} from './journeyUtils'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'
import './quick-offers.css'

// redesign review r1 (R5): the builder's NumberFields take no `min`: Base UI moves a value under it to the minimum on blur, and main
// kept what was typed and said why on save (validateJourneyForm checks every range)

// redesign PE-B4 (decisions 2, 3, 4, 6, 7, 9, 10; PE-01, PE-02, PE-06): Quick offers. The catalog is eight compact one-click buttons, «Your
// promotions» is the SAME list as Advanced (PromotionsTable variant='quick', PE-B1) under the shared search, and the builder keeps its fields,
// conditions, validation, dirty tracking, payloads and events with Product controls: number fields, segmented controls, a day picker and a time
// field for each end of the promotion, a searchable store list, and a confirmation dialog for deleting and for discarding. What did not move:
// `validateJourneyForm`, `updateForm`, `chooseTemplate`, `editPromotion` (with its jump to Advanced), the requests and the 10 per page.

const BUSINESS_SEARCH_DEBOUNCE_MS = 300
const PAGE_SIZE = 10
// the store list of Buy X, get Y is the Product anatomy (trigger as wide as the field, brand rows)
const FIT_TRIGGER = { fitTrigger: true }

const FieldError = ({ message }) => message ? <p role='alert' className='odc-promo-quick-error'>{message}</p> : null

const hasExcludedRelationships = promotion => [
  ...(promotion?.products || []),
  ...(promotion?.categories || [])
].some(relationship => {
  const include = relationship?.pivot?.include ?? relationship?.include
  return include === false || Number(include) === 0
})

const getTranslatedTemplateCopy = (template, t) => {
  const copy = {
    first_order: {
      title: t('QUICK_OFFER_FIRST_PURCHASE', 'First purchase'),
      description: t('QUICK_OFFER_FIRST_PURCHASE_DESCRIPTION', 'Welcome customers who have not placed an order yet.'),
      audience: t('QUICK_OFFER_FIRST_PURCHASE_AUDIENCE', 'Customers with exactly 0 orders')
    },
    second_order: {
      title: t('QUICK_OFFER_SECOND_PURCHASE', 'Second purchase'),
      description: t('QUICK_OFFER_SECOND_PURCHASE_DESCRIPTION', 'Give first-time buyers a reason to order again.'),
      audience: t('QUICK_OFFER_SECOND_PURCHASE_AUDIENCE', 'Customers with exactly 1 order')
    },
    free_delivery: {
      title: t('QUICK_OFFER_FREE_DELIVERY', 'Free delivery'),
      description: t('QUICK_OFFER_FREE_DELIVERY_DESCRIPTION', 'Remove the delivery fee after a minimum purchase.'),
      audience: t('QUICK_OFFER_FREE_DELIVERY_AUDIENCE', 'Customers who meet the minimum purchase')
    },
    minimum_purchase: {
      title: t('QUICK_OFFER_MINIMUM_PURCHASE', 'Minimum purchase reward'),
      description: t('QUICK_OFFER_MINIMUM_PURCHASE_DESCRIPTION', 'Encourage customers to reach a higher subtotal.'),
      audience: t('QUICK_OFFER_MINIMUM_PURCHASE_AUDIENCE', 'Orders that meet the minimum subtotal')
    },
    buy_x_get_y: {
      title: t('QUICK_OFFER_BUY_X_GET_Y', 'Buy X, get Y'),
      description: t('QUICK_OFFER_BUY_X_GET_Y_PRODUCTS_DESCRIPTION', 'Make items free from the same product selection used to qualify.'),
      audience: t('QUICK_OFFER_BUY_X_GET_Y_PRODUCTS_AUDIENCE', 'Orders containing selected products')
    },
    loyalty_reward: {
      title: t('QUICK_OFFER_LOYALTY_REWARD', 'Loyalty level reward'),
      description: t('QUICK_OFFER_LOYALTY_REWARD_DESCRIPTION', 'Offer a benefit to selected loyalty levels.'),
      audience: t('QUICK_OFFER_LOYALTY_REWARD_AUDIENCE', 'Customers in selected loyalty levels')
    },
    slow_hours: {
      title: t('QUICK_OFFER_HAPPY_HOUR', 'Happy hour'),
      description: t('QUICK_OFFER_SLOW_HOURS_DESCRIPTION', 'Drive demand during selected days and hours.'),
      audience: t('QUICK_OFFER_SLOW_HOURS_AUDIENCE', 'Orders placed during the configured schedule')
    },
    winback: {
      title: t('QUICK_OFFER_WE_MISS_YOU', 'We miss you'),
      description: t('QUICK_OFFER_WINBACK_DESCRIPTION', 'Reward customers after a period without ordering.'),
      audience: t('QUICK_OFFER_WINBACK_AUDIENCE', 'Customers inactive for the configured number of days')
    }
  }
  return copy[template.key] || { title: template.title, description: template.description, audience: template.audience }
}

// ---- small helpers of the builder's controls ----

// The form keeps what a person typed as '' (nothing) or a number; a Product NumberField speaks `number | null`. An empty field stays '' in the
// form, never 0, so `validateJourneyForm` sees what it always saw.
const numberOf = value => {
  if (value === '' || value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
const formValueOf = number => (number == null ? '' : number)

const pad = value => (value < 10 ? `0${value}` : String(value))

// `form.start` / `form.end` are `YYYY-MM-DDTHH:mm` (or ''): the day goes to the day picker, the time to the time field
const splitStamp = value => (value ? { day: String(value).slice(0, 10), time: String(value).slice(11, 16) } : { day: null, time: '' })

// A new day keeps the time that is there; a first day takes today's default time rule (00:00 the start, 23:59 the end)
const stampWithDay = (current, day, type) => (current
  ? `${day}T${splitStamp(current).time}`
  : getJourneyValueWithDefaultTime({ value: day, previousValue: current, type }))

const stampWithTime = (current, time) => {
  const { day } = splitStamp(current)
  if (!day) return current
  const [hour, minute] = String(time).split(':').map(Number)
  return `${day}T${pad(hour || 0)}:${pad(minute || 0)}`
}

// The project's date format for what people read: dates_general_format, or the readable default when none is configured (decision 13)
const projectDateFormat = configs => {
  const generalFormat = configs?.dates_general_format?.value
  const configured = typeof generalFormat === 'string' && generalFormat.trim() !== ''
  return getDateTimeFormats(configured ? generalFormat : `${DEFAULT_VISIBLE_DATE_FORMAT} HH:mm`).dateFormat
}

// The words of P/DatePicker
const pickerLabels = t => ({
  title: t('SELECT_DATE', 'Select a date'),
  close: t('CLOSE', 'Close'),
  today: t('TODAY', 'Today'),
  goToToday: t('DATE_RANGE_GO_TO_TODAY', 'Go to today'),
  previousMonth: t('PREVIOUS_MONTH', 'Previous month'),
  nextMonth: t('NEXT_MONTH', 'Next month'),
  invalidDate: format => t('DATE_RANGE_INVALID', 'Enter a real date as _format_.').replace('_format_', () => format),
  outOfRange: t('CAMPAIGNS_DATE_UNAVAILABLE', 'That date is not available.')
})

// The words of P/ScheduleEditor, from keys that already exist (as the store schedule does)
const getScheduleLabels = t => ({
  days: [t('SUNDAY', 'Sunday'), t('MONDAY', 'Monday'), t('TUESDAY', 'Tuesday'), t('WEDNESDAY', 'Wednesday'), t('THURSDAY', 'Thursday'), t('FRIDAY', 'Friday'), t('SATURDAY', 'Saturday')],
  copyDays: [t('DAY7', 'Sunday'), t('DAY1', 'Monday'), t('DAY2', 'Tuesday'), t('DAY3', 'Wednesday'), t('DAY4', 'Thursday'), t('DAY5', 'Friday'), t('DAY6', 'Saturday')],
  schedule: t('SCHEDULE', 'Schedule'),
  open: t('OPEN', 'Open'),
  close: t('CLOSE', 'Close'),
  hour: t('HOUR', 'Hour'),
  minute: t('MINUTE', 'Minute'),
  am: t('AM', 'AM'),
  pm: t('PM', 'PM'),
  unavailable: t('UNAVAILABLE', 'Unavailable'),
  addHours: t('SCHEDULE_ADD_HOURS', 'Add hours'),
  copyHours: t('SCHEDULE_COPY_HOURS_TO', 'Copy hours to…'),
  copyTitle: t('COPY_TIMES_TO', 'Copy times to'),
  apply: t('APPLY', 'Apply'),
  cancel: t('CANCEL', 'Cancel'),
  delete: t('DELETE', 'Delete'),
  deleteQuestion: t('QUESTION_DELETE_ITEM', 'Are you sure to delete this _item_?').replace('_item_', t('SCHEDULE', 'Schedule')),
  accept: t('ACCEPT', 'Accept'),
  conflict: t('SCHEDULE_CONFLICT', 'There is an schedule conflict'),
  endTimeLater: t('END_TIME_LATER', 'Choose an end time later than the start time.')
})

// «Showing _from_–_to_ of _total_»: the numbers become .odc-figure nodes (decision 11), as the pager of the list writes them
const fillTemplate = (template, values, figure) => template.split(/(_[a-z]+_)/).map((part, index) => {
  const name = part.match(/^_([a-z]+)_$/)?.[1]
  return name && values[name] !== undefined ? <React.Fragment key={index}>{figure(values[name])}</React.Fragment> : part
})

const figureOf = value => <bdi dir='ltr' className='odc-figure'>{value}</bdi>

// `named('Delete "_name_"?', name)`: `$` in a name is not special for String.replace when a function gives the text
const named = (template, name) => template.replace('_name_', () => name)

// ---- one end of the promotion: its day and its time ----
const StampField = ({ t, type, label, timeLabel, value, error, dateFormat, locale, onChange }) => {
  const { day, time } = splitStamp(value)
  return (
    <div className='odc-promo-quick-when'>
      <Field label={label} error={error}>
        <DatePicker
          label={label}
          labels={pickerLabels(t)}
          dateFormat={dateFormat}
          locale={locale}
          value={day}
          // redesign (row 81, review r1 R7): picking the day that is already set changes nothing, so it must not dirty the form
          onChange={next => { if (next && next !== day) onChange(stampWithDay(value, next, type)) }}
        />
      </Field>
      {/* the time waits for the day: a time with no day has nothing to be a time of */}
      <TimeField
        mode='time'
        label={timeLabel}
        hourLabel={t('HOUR', 'Hour')}
        minuteLabel={t('MINUTE', 'Minute')}
        amLabel={t('AM', 'AM')}
        pmLabel={t('PM', 'PM')}
        value={time || '0:0'}
        disabled={!day}
        onChange={next => onChange(stampWithTime(value, next))}
      />
    </div>
  )
}

const PromotionJourneysListingUI = (props) => {
  const {
    promotionListState,
    businessesList,
    businessesPaginationProps,
    searchBusinesses,
    handleChangeBusinessPage,
    sitesState,
    getPromotions,
    paginationProps,
    searchValue,
    onSearch,
    handleSuccessDeletePromotion,
    handleSuccessUpdatePromotions,
    saveJourney,
    updateJourneyStatus,
    deleteJourney,
    loadJourneyLoyaltyLevels,
    loadAllJourneyBusinesses,
    loadPromotionSites,
    onOpenAdvancedPromotion,
    registerLeaveGuard
  } = props
  const [{ configs }] = useConfig()
  const [languageState, t] = useLanguage()
  const [{ parseDate }] = useUtils()
  const [, { showToast }] = useToast()
  const journeysContainerRef = useRef(null)
  const storeLabelId = useId()

  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [form, setForm] = useState(null)
  const [dirtyFields, setDirtyFields] = useState({})
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)
  // redesign PE-B4 (decision 6): which button was pressed, so its spinner is the one that shows
  const [savingAction, setSavingAction] = useState(null)
  const [draft, setDraft] = useState(null)
  const [validationAttempted, setValidationAttempted] = useState(false)
  const [togglingPromotionId, setTogglingPromotionId] = useState(null)
  // redesign PE-B4 (decision 9): the target is kept while the dialog closes, so its title does not lose the name mid-animation
  const [deleteConfirmation, setDeleteConfirmation] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [closeConfirmationOpen, setCloseConfirmationOpen] = useState(false)
  const [deletingPromotionId, setDeletingPromotionId] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [allBusinessesState, setAllBusinessesState] = useState({ loading: true, businesses: [], error: '' })
  const [loyaltyLevels, setLoyaltyLevels] = useState({ loading: false, values: [], error: '' })
  const [businessQuery, setBusinessQuery] = useState('')
  const [storeSearch, setStoreSearch] = useState('')
  const businessSearchTimer = useRef(null)

  const loyaltyAvailable = true
  const currencySymbol = configs?.format_number_currency?.value?.trim()
  const dateFormat = projectDateFormat(configs)
  const locale = languageState?.language?.code
  const allBusinessIds = allBusinessesState.businesses.map(business => Number(business.id)).filter(Number.isFinite)
  const translatedTemplates = useMemo(() => JOURNEY_TEMPLATES.map(template => ({
    ...template,
    copy: getTranslatedTemplateCopy(template, t)
  })), [t])
  const selectedTemplateCopy = selectedTemplate ? getTranslatedTemplateCopy(selectedTemplate, t) : null
  const submissionForm = form

  // redesign PE-B4 (decision 7; PE-02): the dates of the generated text are written the way the project writes dates, never as an ISO stamp.
  // The time is left out when it is the default one of its end (00:00 of the start, 23:59 of the end): the day says it all.
  const formatSummaryDate = createSummaryDateFormatter(parseDate)
  const generatedDescription = selectedTemplate && submissionForm
    ? buildJourneySummary({ template: selectedTemplate, form: submissionForm, translate: t, audience: selectedTemplateCopy.audience, formatDate: formatSummaryDate })
    : ''
  const payloadForm = submissionForm
    ? {
        ...submissionForm,
        description: submissionForm.descriptionEdited ? submissionForm.description : generatedDescription
      }
    : null
  const fullPayload = selectedTemplate && payloadForm
    ? buildJourneyPayload({ template: selectedTemplate, form: payloadForm, formatDate: formatSummaryDate })
    : null
  const payload = draft?.id && fullPayload
    ? buildJourneyUpdatePayload({
      payload: fullPayload,
      dirtyFields,
      descriptionEdited: form?.descriptionEdited,
      requiredPayloadKeys: selectedTemplate.key === 'buy_x_get_y' ? ['include_options'] : []
    })
    : fullPayload
  const channelsStatus = getJourneyChannelsStatus({ promotionId: draft?.id, sitesState })
  const displayedPromotions = (promotionListState?.promotions || []).slice(0, PAGE_SIZE)

  const updateForm = changes => {
    setForm(current => ({ ...current, ...changes }))
    setDirtyFields(current => ({
      ...current,
      ...Object.fromEntries(Object.keys(changes).map(key => [key, true]))
    }))
    setApiError('')
  }

  const closeBuilder = () => {
    setSelectedTemplate(null)
    setForm(null)
    setErrors({})
    setApiError('')
    setDraft(null)
    setDirtyFields({})
    setCloseConfirmationOpen(false)
    setValidationAttempted(false)
  }

  // `?template=<key>` (command palette) starts that quick offer once stores
  // and sites are loaded; unknown keys and loyalty without the addon are ignored
  useOpenFromQuery('template', key => {
    const template = JOURNEY_TEMPLATES.find(item => item.key === key)
    if (template) chooseTemplate(template)
  }, {
    ready: !allBusinessesState.loading && !sitesState?.loading,
    accept: key => JOURNEY_TEMPLATES.some(item => item.key === key)
  })

  // Owner decision 22 B (2026-10-21, T-1): the page's tabs (Quick → Advanced) leave through this guard. A dirty builder asks with its own
  // «Discard unsaved changes?»; Discard closes it and then leaves, Keep editing stays with what was typed.
  const pendingLeaveRef = useRef(null)
  const dirtyRef = useRef(false)
  dirtyRef.current = !!selectedTemplate && Object.keys(dirtyFields).length > 0
  useEffect(() => {
    if (!registerLeaveGuard) return undefined
    registerLeaveGuard(proceed => {
      if (!dirtyRef.current) return proceed()
      pendingLeaveRef.current = proceed
      setCloseConfirmationOpen(true)
    })
    return () => registerLeaveGuard(null)
  }, [registerLeaveGuard])

  const requestCloseBuilder = () => {
    if (Object.keys(dirtyFields).length) {
      setCloseConfirmationOpen(true)
      return
    }
    closeBuilder()
  }

  const chooseTemplate = template => {
    if (template.requiresLoyalty && !loyaltyAvailable) return
    const translatedName = getTranslatedTemplateCopy(template, t).title
    setSelectedTemplate(template)
    setForm({
      ...getInitialJourneyForm(template.key),
      name: translatedName,
      currencySymbol: currencySymbol || '',
      sites: (sitesState.sites || []).map(site => site.id),
      allBusinesses: allBusinessIds
    })
    setErrors({})
    setApiError('')
    setDraft(null)
    setDirtyFields({})
    setValidationAttempted(false)
    captureJourneyEvent('template_selected', { template: template.key, objective: template.objective })
  }

  const editPromotion = promotion => {
    if (hasExcludedRelationships(promotion)) {
      onOpenAdvancedPromotion?.(promotion)
      return
    }
    const { template, form: promotionForm } = getJourneyFormFromPromotion({
      promotion,
      allSiteIds: (sitesState.sites || []).map(site => site.id),
      allBusinessIds: allBusinessesState.businesses.map(business => business.id),
      formatDate: formatSummaryDate
    })
    setSelectedTemplate(template)
    setForm({ ...promotionForm, currencySymbol: currencySymbol || '' })
    setErrors({})
    setApiError('')
    setDraft(promotion)
    setDirtyFields({})
    setValidationAttempted(false)
    captureJourneyEvent('existing_promotion_opened', { template: template.key, promotion_id: promotion.id })
  }

  const runValidation = () => {
    const nextErrors = validateJourneyForm({ template: selectedTemplate, form: submissionForm, loyaltyAvailable, channelsStatus, translate: t })
    setValidationAttempted(true)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      captureJourneyEvent('preflight_failed', { template: selectedTemplate.key, fields: Object.keys(nextErrors) })
      return false
    }
    return true
  }

  const finishSuccessfulAction = async (promotion, isNewPromotion) => {
    if (!isNewPromotion && handleSuccessUpdatePromotions) {
      handleSuccessUpdatePromotions(
        promotionListState.promotions.map(item => item.id === promotion.id ? { ...item, ...promotion } : item)
      )
    }
    await getPromotions(isNewPromotion ? 1 : (paginationProps?.currentPage || 1), PAGE_SIZE)
    closeBuilder()
  }

  const handleSaveDraft = async () => {
    if (!runValidation() || saving) return
    const isNewPromotion = !draft?.id
    const enabled = isNewPromotion ? false : !!draft.enabled
    setSaving(true)
    setSavingAction('draft')
    setApiError('')
    try {
      const result = await saveJourney({
        payload,
        promotionId: draft?.id,
        enabled
      })
      setDraft(result)
      captureJourneyEvent('draft_saved', { template: selectedTemplate.key, promotion_id: result?.id })
      await finishSuccessfulAction({ ...draft, ...fullPayload, ...result, enabled }, isNewPromotion)
    } catch (error) {
      setApiError(error.message)
      captureJourneyEvent('api_error', { template: selectedTemplate.key, action: 'save_draft' })
    } finally {
      setSaving(false)
      setSavingAction(null)
    }
  }

  const handleActivate = async () => {
    if (!runValidation() || saving) return
    const isNewPromotion = !draft?.id
    setSaving(true)
    setSavingAction('activate')
    setApiError('')
    try {
      const result = await saveJourney({
        payload,
        promotionId: draft?.id,
        enabled: true
      })
      setDraft(result)
      captureJourneyEvent('activated', { template: selectedTemplate.key, promotion_id: result?.id })
      await finishSuccessfulAction({ ...draft, ...fullPayload, ...result, enabled: true }, isNewPromotion)
    } catch (error) {
      setApiError(error.message)
      captureJourneyEvent('api_error', { template: selectedTemplate.key, action: 'activate' })
    } finally {
      setSaving(false)
      setSavingAction(null)
    }
  }

  // redesign PE-B4 (decision 4; PE-03): the switch of the list asks for this and waits for `{ ok, error }`. A failure no longer lands in a banner
  // above the list: the switch (P/AsyncSwitch) goes back to its stored value and says why in its own row. The request, the refresh and the
  // scroll restore are the ones of `main`.
  const handleTogglePromotion = async (promotion, next) => {
    // redesign review r1 (R4): as main, a press while another toggle or a delete runs is ignored silently (nothing was sent, nothing failed)
    if (togglingPromotionId || deletingPromotionId) return { ok: true }
    const enabled = typeof next === 'boolean' ? next : !promotion.enabled
    const scrollElement = document.scrollingElement || document.documentElement
    const previousScrollTop = scrollElement?.scrollTop
    setTogglingPromotionId(promotion.id)
    try {
      await updateJourneyStatus({ promotionId: promotion.id, enabled })
      await getPromotions(paginationProps?.currentPage || 1, PAGE_SIZE)
      window.requestAnimationFrame(() => {
        if (scrollElement && Number.isFinite(previousScrollTop)) scrollElement.scrollTop = previousScrollTop
      })
      captureJourneyEvent('status_changed', { promotion_id: promotion.id, enabled })
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error.message }
    } finally {
      setTogglingPromotionId(null)
    }
  }

  const openDeleteConfirmation = promotion => {
    if (togglingPromotionId || deletingPromotionId) return
    setDeleteConfirmation(promotion)
    setDeleteError('')
    setDeleteOpen(true)
  }

  const closeDeleteConfirmation = () => {
    if (deletingPromotionId) return
    setDeleteOpen(false)
    setDeleteError('')
  }

  const handleDeletePromotion = async () => {
    if (!deleteConfirmation?.id || deletingPromotionId) return
    const promotion = deleteConfirmation
    const currentPage = paginationProps?.currentPage || 1
    const nextPage = currentPage > 1 && displayedPromotions.length === 1 ? currentPage - 1 : currentPage
    const scrollElement = document.scrollingElement || document.documentElement
    const previousScrollTop = scrollElement?.scrollTop
    setDeletingPromotionId(promotion.id)
    setDeleteError('')
    try {
      await deleteJourney({ promotionId: promotion.id })
      handleSuccessDeletePromotion?.(promotion.id)
      setDeleteOpen(false)
      await getPromotions(nextPage, PAGE_SIZE)
      window.requestAnimationFrame(() => {
        if (scrollElement && Number.isFinite(previousScrollTop)) scrollElement.scrollTop = previousScrollTop
      })
      showToast(ToastType.Success, t('PROMOTION_DELETED', 'Promotion deleted'))
      captureJourneyEvent('promotion_deleted', { promotion_id: promotion.id })
    } catch (error) {
      setDeleteError(error.message)
      captureJourneyEvent('api_error', { action: 'delete_promotion', promotion_id: promotion.id })
    } finally {
      setDeletingPromotionId(null)
    }
  }

  // Escape closes the builder through the guard, unless something open already took it: a confirmation, a day picker, a dialog of the
  // schedule (they close themselves, and an open layer is how they are told apart from the page)
  useEffect(() => {
    const onKeyDown = event => {
      if (event.defaultPrevented || event.key !== 'Escape') return
      if (hasActiveDialogLayer()) return
      if (selectedTemplate && !saving) requestCloseBuilder()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedTemplate, saving, dirtyFields])

  useEffect(() => {
    if (!selectedTemplate || typeof journeysContainerRef.current?.scrollIntoView !== 'function') return
    journeysContainerRef.current.scrollIntoView({ block: 'start' })
  }, [selectedTemplate?.key])

  useEffect(() => {
    if (!validationAttempted || !selectedTemplate || !form) return
    setErrors(validateJourneyForm({ template: selectedTemplate, form: submissionForm, loyaltyAvailable, channelsStatus, translate: t }))
  }, [form, validationAttempted, selectedTemplate?.key, loyaltyAvailable, draft?.id, channelsStatus])

  const loadAllBusinesses = async () => {
    setAllBusinessesState({ loading: true, businesses: [], error: '' })
    try {
      const pageSize = Math.max(Number(businessesPaginationProps?.totalItems) || 0, 100)
      const businesses = await loadAllJourneyBusinesses({ pageSize })
      setAllBusinessesState({ loading: false, businesses, error: '' })
    } catch (error) {
      setAllBusinessesState({ loading: false, businesses: [], error: error.message })
    }
  }

  useEffect(() => {
    loadAllBusinesses()
  }, [])

  useEffect(() => () => clearTimeout(businessSearchTimer.current), [])

  useEffect(() => {
    if (!form || form.scopeMode !== 'all' || !allBusinessIds.length) return
    setForm(current => ({ ...current, allBusinesses: allBusinessIds }))
  }, [allBusinessIds.join(','), form?.scopeMode])

  useEffect(() => {
    if (!form || draft?.id || !sitesState.sites?.length) return
    setForm(current => ({ ...current, sites: sitesState.sites.map(site => Number(site.id)) }))
  }, [sitesState.sites, draft?.id])

  useEffect(() => {
    if (!selectedTemplate?.requiresLoyalty || !loyaltyAvailable || loyaltyLevels.values.length || loyaltyLevels.loading) return
    setLoyaltyLevels({ loading: true, values: [], error: '' })
    loadJourneyLoyaltyLevels()
      .then(values => setLoyaltyLevels({ loading: false, values: Array.isArray(values) ? values : [], error: '' }))
      .catch(error => setLoyaltyLevels({ loading: false, values: [], error: error.message }))
  }, [selectedTemplate?.key, loyaltyAvailable])

  // redesign PE-B4 (decision 6; inventory D29): one request after the person stops typing, not one per key
  const typeBusinessQuery = value => {
    setBusinessQuery(value)
    clearTimeout(businessSearchTimer.current)
    businessSearchTimer.current = setTimeout(() => searchBusinesses(value), BUSINESS_SEARCH_DEBOUNCE_MS)
  }
  const clearBusinessQuery = () => {
    clearTimeout(businessSearchTimer.current)
    searchBusinesses('')
  }

  const apiText = message => translateApiMessage(t, message, message)

  const renderBusinessPager = () => {
    const pager = businessesPaginationProps
    if (!(pager?.totalPages > 1)) return null
    const knownTotal = pager.totalItems != null && Number.isFinite(Number(pager.totalItems))
    return (
      <Pagination
        page={pager.currentPage}
        pageSize={Number(pager.pageSize) || PAGE_SIZE}
        {...(knownTotal
          ? { total: Number(pager.totalItems) }
          : { hasMore: pager.currentPage < pager.totalPages, itemCount: businessesList.businesses.length })}
        onPageChange={page => handleChangeBusinessPage(page)}
        label={t('PAGINATION', 'Pagination')}
        previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
        nextLabel={t('NEXT_PAGE', 'Next page')}
        rangeLabel={(from, to, count, figure) => (count == null
          ? `${from}–${to}`
          : fillTemplate(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from, to, total: count }, figure))}
        pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages ?? ''))}
      />
    )
  }

  const renderScope = () => {
    const scopeError = errors.scope || errors.sites || (allBusinessesState.error ? apiText(allBusinessesState.error) : '')
    const scopeLabel = t('JOURNEY_BUSINESSES', 'Businesses')
    return (
      <section className='odc-promo-quick-box' data-invalid={scopeError ? '' : undefined}>
        <h3 className='odc-promo-quick-box-title'>{scopeLabel}</h3>
        <p className='odc-promo-quick-box-text'>{t('JOURNEY_BUSINESS_SCOPE_DESCRIPTION', 'Use every business, or choose only the locations that should receive this promotion.')}</p>
        <SegmentedControl
          label={scopeLabel}
          value={form.scopeMode}
          onValueChange={mode => (mode === 'all' ? updateForm({ scopeMode: 'all', businesses: [] }) : updateForm({ scopeMode: 'selected' }))}
          options={[
            { value: 'all', label: t('ALL_BUSINESSES', 'All businesses') },
            { value: 'selected', label: t('SELECT_BUSINESSES', 'Choose businesses') }
          ]}
        />
        {form.scopeMode === 'all' && allBusinessesState.loading && (
          <p className='odc-promo-quick-count'>{t('LOADING_BUSINESSES', 'Loading businesses...')}</p>
        )}
        {form.scopeMode === 'all' && allBusinessesState.error && (
          <Button className='odc-promo-quick-retry' onClick={loadAllBusinesses}>
            {t('RETRY', 'Retry')}
          </Button>
        )}
        {form.scopeMode === 'selected' && (
          <>
            <SearchField
              value={businessQuery}
              onChange={typeBusinessQuery}
              onClear={clearBusinessQuery}
              label={t('SEARCH_BUSINESSES', 'Search businesses')}
              placeholder={t('SEARCH_BUSINESSES', 'Search businesses')}
              clearLabel={t('CLEAR_SEARCH', 'Clear search')}
            />
            {businessesList.loading
              ? <p className='odc-promo-quick-count'>{t('LOADING', 'Loading')}...</p>
              : businessesList.businesses.length === 0
                ? <p className='odc-promo-quick-count'>{t('NO_BUSINESSES_FOUND', 'No businesses found')}</p>
                : (
                  <ul className='odc-promo-quick-grid'>
                    {businessesList.businesses.map(business => {
                      const selected = form.businesses.map(Number).includes(Number(business.id))
                      return (
                        <li key={business.id}>
                          <Checkbox
                            checked={selected}
                            onCheckedChange={checked => {
                              const businesses = checked
                                ? [...form.businesses, Number(business.id)]
                                : form.businesses.filter(id => Number(id) !== Number(business.id))
                              updateForm({
                                businesses,
                                ...(!checked && Number(form.selectedBusinessId) === Number(business.id)
                                  ? { selectedBusinessId: '', products: {}, categories: {} }
                                  : {})
                              })
                            }}
                          >
                            {business.name}
                          </Checkbox>
                        </li>
                      )
                    })}
                  </ul>
                  )}
            {renderBusinessPager()}
            <p className='odc-promo-quick-count'>{figureOf(form.businesses.length)} {t('BUSINESSES_SELECTED', 'businesses selected')}</p>
          </>
        )}
        <FieldError message={scopeError} />
      </section>
    )
  }

  const renderTemplateSpecificFields = () => {
    if (selectedTemplate.key === 'buy_x_get_y') {
      const availableBusinesses = allBusinessesState.businesses.length
        ? allBusinessesState.businesses
        : businessesList.businesses
      const selectedBusiness = availableBusinesses.find(business => Number(business.id) === Number(form.selectedBusinessId))
      const needle = storeSearch.trim().toLowerCase()
      // the empty «Select» row is the way back to no store; while searching, only the stores that match are listed
      const storeOptions = [
        ...(needle ? [] : [{ value: '', content: t('SELECT', 'Select') }]),
        ...availableBusinesses
          .filter(business => !needle || String(business.name).toLowerCase().includes(needle))
          .map(business => ({ value: business.id, content: business.name }))
      ]
      return (
        <section className='odc-promo-quick-box' data-invalid={(errors.eligibility || errors.eligibilityBusiness || errors.rate || errors.minimum) ? '' : undefined}>
          <h3 className='odc-promo-quick-box-title'>{t('QUICK_OFFER_BUY_X_RULE', 'Buy X, get Y rule')}</h3>
          <p className='odc-promo-quick-box-text'>{t('QUICK_OFFER_BUY_X_RULE_HINT', 'Choose one store and the products that can qualify. The free items will come from this same product selection.')}</p>
          {/* redesign PE-B4 (decision 6; PE-06): the store is picked in Product's list, with a search (the list of stores can be long) */}
          <div className='odc-promo-quick-field'>
            <span id={storeLabelId} className='odc-promo-quick-label'>{t('QUICK_OFFER_PROMOTION_STORE', 'Promotion store')}</span>
            <SelectSurfaceContext.Provider value={FIT_TRIGGER}>
              <FirstSelect
                ariaLabelledBy={storeLabelId}
                placeholder={t('SELECT', 'Select')}
                options={storeOptions}
                defaultValue={form.selectedBusinessId}
                isShowSearchBar
                searchValue={storeSearch}
                handleChangeSearch={setStoreSearch}
                searchBarPlaceholder={t('SEARCH_BUSINESSES', 'Search businesses')}
                onChange={value => {
                  // redesign review r1 (R3): main's native <select> only fired on a change; the same store again keeps its selection
                  if (String(value) === String(form.selectedBusinessId)) return
                  updateForm({
                    selectedBusinessId: value,
                    scopeMode: 'selected',
                    businesses: value ? [Number(value)] : [],
                    products: {},
                    categories: {}
                  })
                }}
              />
            </SelectSurfaceContext.Provider>
            <FieldError message={errors.eligibilityBusiness} />
          </div>
          {selectedBusiness && form.eligibilityKind === 'products' && (
            <JourneyProductPicker
              key={selectedBusiness.id}
              businessId={selectedBusiness.id}
              businessSlug={selectedBusiness.slug}
              selectedProductsIds={form.products}
              setSelectedProductsIds={products => updateForm({ products })}
            />
          )}
          {selectedBusiness && form.eligibilityKind === 'categories' && (
            <SelectBusinessCategories
              slug={selectedBusiness.slug}
              selectedCategoryIds={form.categories}
              setSelectedCategoryIds={categories => updateForm({ categories })}
              include
            />
          )}
          <FieldError message={errors.eligibility} />
          <div className='odc-promo-quick-pair'>
            <NumberField
              label={t('QUICK_OFFER_ELIGIBLE_ITEMS_REQUIRED', 'Eligible items required in cart')}
              hint={t('QUICK_OFFER_ELIGIBLE_ITEMS_REQUIRED_HINT', 'Total quantity the customer must add from the selected products.')}
              error={errors.minimum}
              step={1}
              value={numberOf(form.minimum)}
              onChange={value => updateForm({ minimum: formValueOf(value) })}
            />
            <NumberField
              label={t('QUICK_OFFER_ELIGIBLE_ITEMS_FREE', 'Eligible items that become free')}
              hint={t('QUICK_OFFER_ELIGIBLE_ITEMS_FREE_HINT', 'The free quantity comes from those same selected products.')}
              error={errors.rate}
              step={1}
              value={numberOf(form.rate)}
              onChange={value => updateForm({ rate: formValueOf(value) })}
            />
          </div>
          <p className='odc-promo-quick-hint'>
            {t('QUICK_OFFER_BUY_X_RULE_PREVIEW_PREFIX', 'Rule: When the cart contains')} {form.minimum || '___'} {t('QUICK_OFFER_BUY_X_RULE_PREVIEW_MIDDLE', 'eligible items,')} {form.rate || '___'} {t('QUICK_OFFER_BUY_X_RULE_PREVIEW_SUFFIX', 'of them become free.')}
          </p>
          <p className='odc-promo-quick-hint'>{t('QUICK_OFFER_BUY_X_CART_HINT', 'Customers must add every unit to the cart. The promotion discounts eligible units already in the cart.')}</p>
        </section>
      )
    }
    if (selectedTemplate.requiresLoyalty) {
      const loyaltyError = errors.loyalty || (loyaltyLevels.error ? apiText(loyaltyLevels.error) : '')
      return (
        <section className='odc-promo-quick-box' data-invalid={loyaltyError ? '' : undefined}>
          <h3 className='odc-promo-quick-box-title'>{t('LOYALTY_LEVELS', 'Loyalty Levels')}</h3>
          {loyaltyLevels.loading && <p className='odc-promo-quick-count'>{t('LOADING', 'Loading')}...</p>}
          <ul className='odc-promo-quick-grid'>
            {loyaltyLevels.values.map(level => (
              <li key={level.id}>
                <Checkbox
                  checked={form.loyaltyLevels.includes(level.id)}
                  onCheckedChange={checked => updateForm({
                    loyaltyLevels: checked
                      ? [...form.loyaltyLevels, level.id]
                      : form.loyaltyLevels.filter(id => id !== level.id)
                  })}
                >
                  {level.name}
                </Checkbox>
              </li>
            ))}
          </ul>
          <FieldError message={loyaltyError} />
        </section>
      )
    }
    if (selectedTemplate.requiresSchedule) {
      return (
        <section className='odc-promo-quick-box' data-invalid={errors.schedule ? '' : undefined}>
          <h3 className='odc-promo-quick-box-title'>{t('SCHEDULE_LIMIT', 'Schedule')}</h3>
          {/* redesign PE-B4 (decision 6): Product's schedule, the UIComponent of the same Schedule controller (same props as the legacy one) */}
          <ScheduleEditor
            scheduleList={form.schedule}
            handleChangeScheduleState={schedule => updateForm({ schedule })}
            labels={getScheduleLabels(t)}
          />
          <FieldError message={errors.schedule} />
        </section>
      )
    }
    if (selectedTemplate.requiresInactivity) {
      return (
        <NumberField
          label={t('INACTIVE_DAYS', 'Inactive days')}
          error={errors.inactivityDays}
          value={numberOf(form.inactivityDays)}
          onChange={value => updateForm({ inactivityDays: formValueOf(value) })}
        />
      )
    }
    return null
  }

  const renderConfigure = () => {
    const productOptionsLabel = t('QUICK_OFFER_PRODUCT_OPTIONS', 'Product options')
    const applicationLabel = t('QUESTION_HOW_GOING_APPLIED', "How it's going to be applied?")
    return (
      <div className='odc-promo-quick-form'>
        <div className='odc-promo-quick-full'>
          <TextField
            label={t('NAME', 'Promotion name')}
            hint={t('QUICK_OFFER_NAME_CHECKOUT_HINT', 'This will be the offer name your customers see at checkout.')}
            error={errors.name}
            value={form.name}
            onChange={value => updateForm({ name: value })}
            autoFocus
          />
        </div>
        {!selectedTemplate.fields?.hideRate && selectedTemplate.key !== 'buy_x_get_y' && (
          <NumberField
            label={Number(form.rateType) === 1
              ? t('DISCOUNT_PERCENTAGE', 'Discount (%)')
              : `${t('DISCOUNT', 'Discount')} (${currencySymbol || t('PROJECT_CURRENCY', 'project currency')})`}
            error={errors.rate}
            step={0.01}
            value={numberOf(form.rate)}
            onChange={value => updateForm({ rate: formValueOf(value) })}
          />
        )}
        {selectedTemplate.key !== 'buy_x_get_y' && (
          <NumberField
            label={t('MINIMUM_PURCHASE', 'Minimum purchase')}
            error={errors.minimum}
            step={0.01}
            value={numberOf(form.minimum)}
            onChange={value => updateForm({ minimum: formValueOf(value) })}
          />
        )}
        {!selectedTemplate.fields?.hideLimit && (
          <NumberField
            label={t('OFFER_LIMIT_TIMES_PER_USER', 'Uses per customer')}
            error={errors.limitPerUser}
            step={1}
            value={numberOf(form.limitPerUser)}
            onChange={value => updateForm({ limitPerUser: formValueOf(value) })}
          />
        )}
        {Number(form.rateType) === 1 && selectedTemplate.key !== 'buy_x_get_y' && selectedTemplate.key !== 'free_delivery' && (
          <NumberField
            label={t('MAX_AMOUNT_TO_DISCOUNT', 'Maximum discount')}
            error={errors.maxDiscount}
            step={0.01}
            value={numberOf(form.maxDiscount)}
            onChange={value => updateForm({ maxDiscount: formValueOf(value) })}
          />
        )}
        {selectedTemplate.key === 'buy_x_get_y' && (
          <div className='odc-promo-quick-field'>
            <span className='odc-promo-quick-label'>{productOptionsLabel}</span>
            <InlineNotice tone='info' role='note'>
              {t('QUICK_OFFER_BUY_X_PRODUCT_OPTIONS_UNAVAILABLE', 'Product options are not available for Buy X, get Y promotions yet. Extra option charges will not be discounted.')}
            </InlineNotice>
          </div>
        )}
        {selectedTemplate.fields?.target !== 2 && selectedTemplate.key !== 'buy_x_get_y' && (
          <div className='odc-promo-quick-field'>
            <span className='odc-promo-quick-label'>{productOptionsLabel}</span>
            <SegmentedControl
              label={productOptionsLabel}
              value={form.includeOptions ? 'include' : 'exclude'}
              onValueChange={value => updateForm({ includeOptions: value === 'include' })}
              options={[
                { value: 'exclude', label: t('QUICK_OFFER_PRODUCT_OPTIONS_EXCLUDE', 'Exclude') },
                { value: 'include', label: t('QUICK_OFFER_PRODUCT_OPTIONS_INCLUDE', 'Include') }
              ]}
            />
            <p className='odc-promo-quick-hint'>{t('QUICK_OFFER_PRODUCT_OPTIONS_HINT', 'Choose whether the discount also applies to product options.')}</p>
          </div>
        )}
        <div className='odc-promo-quick-field'>
          <span className='odc-promo-quick-label'>{applicationLabel}</span>
          <SegmentedControl
            label={applicationLabel}
            value={form.application}
            onValueChange={application => updateForm({ application, applicationEdited: true })}
            options={[
              { value: 'automatic', label: t('AUTOMATIC_OFFER', 'Automatic') },
              { value: 'coupon', label: t('COUPON', 'Coupon') }
            ]}
          />
          {form.application === 'coupon' && (
            <TextField
              label={t('COUPON_CODE', 'Coupon code')}
              error={errors.coupon}
              value={form.coupon}
              onChange={value => updateForm({ coupon: value.replace(/\s+/g, '') })}
            />
          )}
        </div>
        {/* redesign PE-B4 (decisions 6, 7; PE-06): a day picker and a time field per end, in the project's date format; the form keeps
            `YYYY-MM-DDTHH:mm`, so the payload and the default time rule are the ones of `main` */}
        <StampField
          t={t}
          type='start'
          label={t('PROMOTION_START_DATE', 'Start date')}
          timeLabel={t('QUICK_OFFER_START_TIME', 'Start time')}
          value={form.start}
          error={errors.start}
          dateFormat={dateFormat}
          locale={locale}
          onChange={start => updateForm({ start })}
        />
        <StampField
          t={t}
          type='end'
          label={t('PROMOTION_END_DATE', 'End date')}
          timeLabel={t('QUICK_OFFER_END_TIME', 'End time')}
          value={form.end}
          error={errors.end}
          dateFormat={dateFormat}
          locale={locale}
          onChange={end => updateForm({ end })}
        />
        {renderTemplateSpecificFields()}
        {selectedTemplate.key !== 'buy_x_get_y' && renderScope()}
        {errors.channels && (
          <div className='odc-promo-quick-field odc-promo-quick-full'>
            <FieldError message={errors.channels} />
            {sitesState.error && loadPromotionSites && (
              <Button className='odc-promo-quick-retry' onClick={loadPromotionSites}>
                {t('RETRY', 'Retry')}
              </Button>
            )}
          </div>
        )}
        <div className='odc-promo-quick-full'>
          <TextArea
            label={t('DESCRIPTION', 'Description')}
            hint={t('JOURNEY_DESCRIPTION_HINT', 'Generated from this configuration. You can edit it before saving.')}
            value={form.descriptionEdited ? form.description : generatedDescription}
            onChange={value => updateForm({ description: value, descriptionEdited: true })}
          />
        </div>
      </div>
    )
  }

  // redesign PE-B4 (decision 6): the bar sticks to the bottom of the builder; `busy` on the pressed button instead of «Loading...»
  const renderActions = () => (
    <div className='odc-promo-quick-actions'>
      <Button onClick={requestCloseBuilder} disabled={saving}>{t('CANCEL', 'Cancel')}</Button>
      <div className='odc-promo-quick-actions-main'>
        <Button disabled={saving} busy={savingAction === 'draft'} onClick={handleSaveDraft}>
          {draft ? t('SAVE_CHANGES', 'Save changes') : t('SAVE_DRAFT', 'Save draft')}
        </Button>
        <Button variant='primary' disabled={saving} busy={savingAction === 'activate'} onClick={handleActivate}>
          {t('ACTIVATE', 'Activate')}
        </Button>
      </div>
    </div>
  )

  const deleteName = deleteConfirmation?.name ?? ''

  return (
    <div ref={journeysContainerRef} className='odc-root odc-promo-quick' data-testid='promotion-journeys'>
      {!selectedTemplate
        ? (
          <>
            {/* redesign PE-B4 (decision 2; inventory D39): the large hero is a section heading, and each template a button of phrasing content */}
            <section className='odc-promo-quick-section'>
              <div className='odc-promo-quick-head'>
                <h2 className='odc-promo-quick-heading'>{t('PROMOTION_TEMPLATES', 'Promotion templates')}</h2>
                <p className='odc-promo-quick-lead'>{t('QUICK_OFFERS_DESCRIPTION', 'Choose a proven promotion and configure it on one screen.')}</p>
              </div>
              <div className='odc-promo-quick-templates'>
                {translatedTemplates.map(template => {
                  const Icon = template.icon
                  const disabled = template.requiresLoyalty && !loyaltyAvailable
                  const templateCopy = template.copy
                  return (
                    <button
                      key={template.key}
                      type='button'
                      className='odc-promo-quick-template'
                      disabled={disabled}
                      onClick={() => chooseTemplate(template)}
                      data-template-key={template.key}
                    >
                      <Icon className='odc-promo-quick-template-icon' aria-hidden='true' />
                      <span className='odc-promo-quick-template-text'>
                        <span className='odc-promo-quick-template-title'>{templateCopy.title}</span>
                        <span className='odc-promo-quick-template-desc'>{templateCopy.description}</span>
                        <span className='odc-promo-quick-template-audience'>{disabled ? t('REQUIRES_LOYALTY_LEVELS', 'Requires Loyalty Levels') : templateCopy.audience}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
            <section className='odc-promo-quick-list'>
              <div className='odc-promo-quick-head'>
                <h2 className='odc-promo-quick-heading'>{t('YOUR_PROMOTIONS', 'Your promotions')}</h2>
                <p className='odc-promo-quick-lead'>{t('QUICK_OFFERS_YOUR_PROMOTIONS_DESCRIPTION', 'Open any promotion to review or update it without leaving Quick Offers.')}</p>
              </div>
              {/* redesign PE-B4 (decisions 3, 4, 9; PE-01): the same list as Advanced. It shows its own loading, empty and error states, with
                  the templates still in view; 10 per page as today, no size selector */}
              <PromotionsTable
                variant='quick'
                promotions={displayedPromotions}
                loading={Boolean(promotionListState?.loading) && displayedPromotions.length === 0}
                error={promotionListState?.error}
                onRetry={() => getPromotions(paginationProps?.currentPage || 1, PAGE_SIZE)}
                onOpen={editPromotion}
                onToggle={handleTogglePromotion}
                onDelete={openDeleteConfirmation}
                busyId={togglingPromotionId ?? deletingPromotionId} // redesign (row 81, R8): main disabled that row's Delete
                pagination={{
                  page: paginationProps?.currentPage,
                  pageSize: PAGE_SIZE,
                  total: paginationProps?.totalItems,
                  onPageChange: page => { if (!promotionListState?.loading) getPromotions(page, PAGE_SIZE) }
                }}
                searchValue={searchValue}
                onClearSearch={() => onSearch?.('')}
                toolbar={<PromotionSearch search={searchValue || ''} onSearch={onSearch} />}
              />
            </section>
          </>
          )
        : (
          <section className='odc-promo-quick-builder' role='region' aria-label={`${selectedTemplateCopy.title} ${t('QUICK_OFFER_BUILDER', 'promotion builder')}`}>
            <div className='odc-promo-quick-builder-head'>
              <div>
                <h2 className='odc-promo-quick-builder-title'>{draft?.id ? t('EDIT_PROMOTION', 'Edit promotion') : selectedTemplateCopy.title}</h2>
                <p className='odc-promo-quick-builder-sub'>{selectedTemplateCopy.audience}</p>
              </div>
              <IconButton icon={X} label={t('CLOSE', 'Close')} onClick={requestCloseBuilder} disabled={saving} />
            </div>
            {renderConfigure()}
            {apiError && <InlineNotice tone='danger' role='alert'>{apiText(apiError)}</InlineNotice>}
            {renderActions()}
          </section>
          )}
      {/* redesign PE-B4 (decision 9): the confirmation names the promotion, says it cannot be undone, and keeps the reason of a failure inside */}
      <ConfirmDialog
        open={deleteOpen}
        tone='danger'
        title={named(t('PROMOTION_DELETE_TITLE', 'Delete "_name_"?'), deleteName)}
        confirmLabel={t('PROMOTION_DELETE_CONFIRM', 'Delete promotion')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={!!deletingPromotionId}
        onConfirm={handleDeletePromotion}
        onCancel={closeDeleteConfirmation}
      >
        {t('PROMOTION_DELETE_BODY', "This can't be undone.")}
        {deleteError && (
          <p role='alert' className='odc-promo-quick-error'>
            {translateApiMessage(t, deleteError, t('PROMOTION_DELETE_ERROR', "We couldn't delete this promotion. Try again."))}
          </p>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={closeConfirmationOpen}
        title={t('QUICK_OFFER_UNSAVED_CHANGES', 'Discard unsaved changes?')}
        confirmLabel={t('DISCARD', 'Discard')}
        cancelLabel={t('KEEP_EDITING', 'Keep editing')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={() => {
          const leave = pendingLeaveRef.current
          pendingLeaveRef.current = null
          closeBuilder()
          leave?.()
        }}
        onCancel={() => {
          pendingLeaveRef.current = null
          setCloseConfirmationOpen(false)
        }}
      >
        {t('QUICK_OFFER_UNSAVED_CHANGES_DESCRIPTION', 'Your promotion changes have not been saved.')}
      </ConfirmDialog>
    </div>
  )
}

export const PromotionJourneysListing = props => {
  const journeysProps = {
    ...props,
    UIComponent: PromotionJourneysListingUI,
    orderBy: '-id',
    paginationSettings: {
      initialPage: 1,
      pageSize: 10,
      controlType: 'pages'
    },
    isSearchByPromotionName: true,
    isSearchByPromotionDescription: true
  }
  return <EnterprisePromotionListController {...journeysProps} />
}

export { PromotionJourneysListingUI }
