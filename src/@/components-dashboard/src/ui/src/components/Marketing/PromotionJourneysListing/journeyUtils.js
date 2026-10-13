import { getJourneyTemplate } from './journeyTemplates'
import { captureDashboardEvent } from '~/analytics/posthog'

export const JOURNEY_VIEWS = {
  JOURNEYS: 'journeys',
  ADVANCED: 'advanced_offers'
}

export const getPromotionWorkspaceView = (search = '') => {
  const query = new URLSearchParams(search)
  const requestedView = query.get('view')
  if (requestedView === JOURNEY_VIEWS.JOURNEYS || requestedView === JOURNEY_VIEWS.ADVANCED) {
    return requestedView
  }
  return query.get('id') || query.has('page') || query.has('pageSize')
    ? JOURNEY_VIEWS.ADVANCED
    : JOURNEY_VIEWS.JOURNEYS
}

export const setPromotionWorkspaceView = (search, view, promotionId) => {
  const query = new URLSearchParams(search || '')
  query.set('view', view)
  if (view === JOURNEY_VIEWS.JOURNEYS) {
    query.delete('id')
    query.delete('page')
    query.delete('pageSize')
  } else if (promotionId) {
    query.set('id', promotionId)
  }
  const nextSearch = query.toString()
  return nextSearch ? `?${nextSearch}` : ''
}

export const getInitialJourneyForm = (templateKey) => {
  const template = getJourneyTemplate(templateKey)
  const emptySchedule = Array.from({ length: 7 }, () => ({
    enabled: false,
    lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }]
  }))
  return {
    name: template?.title || '',
    description: '',
    descriptionEdited: false,
    application: 'automatic',
    applicationEdited: true,
    originalAuto: undefined,
    originalType: undefined,
    coupon: '',
    rate: template?.fields?.rate || '',
    rateType: template?.fields?.rateType || 1,
    conditionType: template?.fields?.conditionType || 1,
    target: template?.fields?.target || 1,
    minimum: template?.fields?.minimum || '',
    maxDiscount: '',
    includeOptions: false,
    limitPerUser: template?.fields?.limitPerUser || 1,
    start: '',
    end: '',
    scopeMode: 'all',
    businesses: [],
    allBusinesses: [],
    sites: [],
    loyaltyLevels: [],
    selectedBusinessId: '',
    eligibilityKind: 'products',
    products: {},
    categories: {},
    schedule: template?.requiresSchedule ? emptySchedule : null,
    inactivityDays: '',
    public: true,
    stackable: false,
    currencySymbol: ''
  }
}

const relationshipIds = values => (values || []).map(value => Number(value?.id ?? value)).filter(Number.isFinite)

const selectionFromRelationship = values => (values || []).reduce((selection, value) => {
  const id = Number(value?.id ?? value)
  if (!Number.isFinite(id)) return selection
  const include = value?.pivot?.include ?? value?.include
  selection[id] = {
    id,
    include: include !== false && Number(include) !== 0,
    ...(value?.name ? { name: value.name } : {})
  }
  return selection
}, {})

const fromApiDate = value => value ? String(value).replace(' ', 'T').slice(0, 16) : ''

export const getJourneyValueWithDefaultTime = ({ value, previousValue, type }) => {
  if (!value || previousValue || String(value).includes('T')) return value
  const date = String(value)
  return `${date}T${type === 'end' ? '23:59' : '00:00'}`
}

export const getJourneyChannelsStatus = ({ promotionId, sitesState = {} }) => {
  if (promotionId) return 'ready'
  if (sitesState.loading) return 'loading'
  const hasError = Array.isArray(sitesState.error) ? sitesState.error.length > 0 : !!sitesState.error
  if (hasError) return 'error'
  return 'ready'
}

export const getJourneyTemplateForPromotion = promotion => {
  if (promotion?.valid_from_after_user_last_order_minutes) return getJourneyTemplate('winback')
  if (promotion?.schedule) return getJourneyTemplate('slow_hours')
  if (promotion?.loyalty_levels?.length) return getJourneyTemplate('loyalty_reward')
  const hasOrderCount = promotion?.user_order_count !== null && promotion?.user_order_count !== undefined && promotion?.user_order_count !== ''
  if (hasOrderCount && Number(promotion.user_order_count) === 0 && promotion?.user_order_count_condition === '=') return getJourneyTemplate('first_order')
  if (hasOrderCount && Number(promotion.user_order_count) === 1 && promotion?.user_order_count_condition === '=') return getJourneyTemplate('second_order')
  if (Number(promotion?.condition_type) === 1 && Number(promotion?.target) === 2 && Number(promotion?.rate_type) === 1 && Number(promotion?.rate) === 100) return getJourneyTemplate('free_delivery')
  if ((Number(promotion?.condition_type) === 2 && promotion?.products?.length) ||
    (Number(promotion?.condition_type) === 3 && promotion?.categories?.length)) return getJourneyTemplate('buy_x_get_y')
  return getJourneyTemplate('minimum_purchase')
}

export const getJourneyFormFromPromotion = ({ promotion, allSiteIds = [], allBusinessIds = [] }) => {
  const template = getJourneyTemplateForPromotion(promotion)
  const businesses = relationshipIds(promotion?.businesses)
  const sites = relationshipIds(promotion?.sites)
  const normalizedAllBusinessIds = allBusinessIds.map(Number)
  const appliesToAllBusinesses = normalizedAllBusinessIds.length > 0 &&
    businesses.length === normalizedAllBusinessIds.length &&
    normalizedAllBusinessIds.every(id => businesses.includes(id))
  const rawSchedule = promotion?.schedule
  let schedule = getInitialJourneyForm(template.key).schedule
  if (rawSchedule) {
    try {
      schedule = typeof rawSchedule === 'string' ? JSON.parse(rawSchedule) : rawSchedule
    } catch {
      schedule = getInitialJourneyForm(template.key).schedule
    }
  }
  return {
    template,
    form: {
      ...getInitialJourneyForm(template.key),
      name: promotion?.name?.trim() || template.title,
      description: promotion?.description || '',
      descriptionEdited: !!promotion?.description,
      application: Number(promotion?.type) === 2 ? 'coupon' : 'automatic',
      applicationEdited: false,
      originalAuto: promotion?.auto,
      originalType: promotion?.type,
      coupon: promotion?.coupon || '',
      rate: promotion?.rate ?? template.fields?.rate ?? '',
      rateType: Number(promotion?.rate_type ?? template.fields?.rateType ?? 1),
      conditionType: Number(promotion?.condition_type ?? template.fields?.conditionType ?? 1),
      target: Number(promotion?.target ?? template.fields?.target ?? 1),
      minimum: promotion?.minimum ?? '',
      maxDiscount: promotion?.max_discount ?? '',
      includeOptions: promotion?.include_options === true || Number(promotion?.include_options) === 1,
      limitPerUser: promotion?.limit_per_user ?? template.fields?.limitPerUser ?? 1,
      start: fromApiDate(promotion?.start),
      end: fromApiDate(promotion?.end),
      scopeMode: appliesToAllBusinesses || !businesses.length ? 'all' : 'selected',
      businesses,
      allBusinesses: normalizedAllBusinessIds,
      sites: sites.length ? sites : allSiteIds.map(Number),
      loyaltyLevels: relationshipIds(promotion?.loyalty_levels),
      selectedBusinessId: template.key === 'buy_x_get_y'
        ? Number(promotion?.products?.[0]?.business_id ?? promotion?.categories?.[0]?.business_id ?? businesses[0]) || ''
        : '',
      products: selectionFromRelationship(promotion?.products),
      categories: selectionFromRelationship(promotion?.categories),
      eligibilityKind: promotion?.categories?.length ? 'categories' : 'products',
      schedule,
      inactivityDays: promotion?.valid_from_after_user_last_order_minutes
        ? String(Number(promotion.valid_from_after_user_last_order_minutes) / (24 * 60))
        : '',
      public: promotion?.public !== false,
      stackable: promotion?.stackable === true || Number(promotion?.stackable) === 1
    }
  }
}

const positiveNumber = value => Number(value) > 0
const positiveInteger = value => Number.isInteger(Number(value)) && Number(value) > 0

const fallbackTranslate = (key, fallback) => fallback || key

export const validateJourneyForm = ({ template, form, loyaltyAvailable = true, channelsStatus = 'ready', translate = fallbackTranslate }) => {
  const errors = {}
  if (!form.name?.trim()) errors.name = translate('QUICK_OFFER_ERROR_NAME', 'Add a promotion name.')
  if (!positiveNumber(form.rate)) {
    errors.rate = template?.key === 'buy_x_get_y'
      ? translate('QUICK_OFFER_ERROR_FREE_ITEMS', 'Enter the number of free items.')
      : translate('QUICK_OFFER_ERROR_BENEFIT', 'Enter a benefit greater than 0.')
  }
  if (Number(form.rateType) === 1 && Number(form.rate) > 100) errors.rate = translate('QUICK_OFFER_ERROR_PERCENTAGE', 'Percentage benefits cannot be greater than 100.')
  if (template?.fields?.requiredRate && Number(form.rate) !== template.fields.requiredRate) {
    errors.rate = `${translate('QUICK_OFFER_ERROR_REQUIRED_RATE_PREFIX', 'This template requires')} ${template.fields.requiredRate}% ${translate('QUICK_OFFER_ERROR_REQUIRED_RATE_SUFFIX', 'to provide free delivery.')}`
  }
  if (!positiveNumber(form.minimum)) {
    errors.minimum = template?.key === 'buy_x_get_y'
      ? translate('QUICK_OFFER_ERROR_MINIMUM_ITEMS', 'Enter the minimum number of items.')
      : translate('QUICK_OFFER_ERROR_MINIMUM_PURCHASE', 'Enter a minimum purchase greater than 0.')
  }
  if (!positiveNumber(form.limitPerUser)) errors.limitPerUser = translate('QUICK_OFFER_ERROR_USAGE_LIMIT', 'Enter a per-customer usage limit.')
  if (!form.start) errors.start = translate('QUICK_OFFER_ERROR_START_DATE', 'Select a start date.')
  if (!form.end) errors.end = translate('QUICK_OFFER_ERROR_END_DATE', 'Select an end date.')
  if (form.start && form.end && new Date(form.start).getTime() >= new Date(form.end).getTime()) errors.end = translate('QUICK_OFFER_ERROR_DATE_ORDER', 'End date must be after start date.')
  if (form.scopeMode === 'selected' && !form.businesses.length) errors.scope = translate('QUICK_OFFER_ERROR_BUSINESS_SCOPE', 'Choose at least one business or use all businesses.')
  if (form.scopeMode === 'all' && !form.allBusinesses?.length) errors.scope = translate('QUICK_OFFER_ERROR_BUSINESSES_LOADING', 'Businesses are still loading. Please try again.')
  if (channelsStatus === 'loading') errors.channels = translate('QUICK_OFFER_ERROR_CHANNELS_LOADING', 'Sales channels are still loading. Please try again.')
  if (channelsStatus === 'error') errors.channels = translate('QUICK_OFFER_ERROR_CHANNELS_UNAVAILABLE', 'Sales channels could not be loaded. Retry before saving.')
  if (form.application === 'coupon' && !form.coupon?.trim()) errors.coupon = translate('QUICK_OFFER_ERROR_COUPON', 'Add a coupon code.')
  if (form.rateType === 1 && template?.key !== 'free_delivery' && !positiveNumber(form.maxDiscount)) errors.maxDiscount = translate('QUICK_OFFER_ERROR_MAX_DISCOUNT', 'Set a maximum discount for percentage offers.')
  if (template?.requiresLoyalty) {
    if (!loyaltyAvailable) errors.loyalty = translate('QUICK_OFFER_ERROR_LOYALTY_DISABLED', 'Loyalty Levels is not enabled for this project.')
    else if (!form.loyaltyLevels.length) errors.loyalty = translate('QUICK_OFFER_ERROR_LOYALTY_LEVEL', 'Select at least one loyalty level.')
  }
  if (template?.key === 'buy_x_get_y') {
    if (!positiveInteger(form.minimum) || Number(form.minimum) < 2) {
      errors.minimum = translate('QUICK_OFFER_ERROR_REQUIRED_ITEMS_INTEGER', 'Enter at least 2 eligible items.')
    }
    if (!positiveInteger(form.rate)) {
      errors.rate = translate('QUICK_OFFER_ERROR_FREE_ITEMS_INTEGER', 'Enter a whole number of free items.')
    } else if (positiveInteger(form.minimum) && Number(form.rate) >= Number(form.minimum)) {
      errors.rate = translate('QUICK_OFFER_ERROR_FREE_ITEMS_LESS_THAN_REQUIRED', 'Free items must be fewer than the eligible items required in the cart.')
    }
    const selected = form.eligibilityKind === 'products' ? form.products : form.categories
    if (!Object.keys(selected || {}).length) {
      errors.eligibility = form.eligibilityKind === 'products'
        ? translate('QUICK_OFFER_ERROR_PRODUCT', 'Select at least one product.')
        : translate('QUICK_OFFER_ERROR_CATEGORY', 'Select at least one category.')
    }
    if (!positiveNumber(form.selectedBusinessId)) errors.eligibilityBusiness = translate('QUICK_OFFER_ERROR_ELIGIBILITY_BUSINESS', 'Select the business where this promotion will apply.')
  }
  if (template?.requiresSchedule) {
    const hasEnabledLapse = Array.isArray(form.schedule) && form.schedule.some(day => day?.enabled && day?.lapses?.length)
    if (!hasEnabledLapse) errors.schedule = translate('QUICK_OFFER_ERROR_SCHEDULE', 'Configure at least one active schedule.')
  }
  if (template?.requiresInactivity && !positiveNumber(form.inactivityDays)) errors.inactivityDays = translate('QUICK_OFFER_ERROR_INACTIVE_DAYS', 'Enter the number of inactive days.')
  return errors
}

const toApiDate = (value, type) => value
  ? value.replace('T', ' ') + (value.length === 16 ? (type === 'end' ? ':59' : ':00') : '')
  : undefined

const selectionToArray = selection => Object.values(selection || {}).map(item => ({
  id: Number(item.id),
  include: item.include !== false,
  is_condition: true
}))

export const buildJourneyPayload = ({ template, form }) => {
  const isBuyXGetY = template.key === 'buy_x_get_y'
  const preserveApplication = form.applicationEdited === false
  const conditionType = isBuyXGetY
    ? (form.eligibilityKind === 'categories' ? 3 : 2)
    : Number(form.conditionType ?? template.fields?.conditionType ?? 1)
  const businesses = isBuyXGetY
    ? (form.businesses?.length ? form.businesses : [form.selectedBusinessId])
    : (form.scopeMode === 'selected' ? form.businesses : form.allBusinesses)
  const payload = {
    name: form.name.trim(),
    description: form.description?.trim() || buildJourneySummary({ template, form }),
    enabled: false,
    auto: preserveApplication && typeof form.originalAuto === 'boolean'
      ? form.originalAuto
      : form.application === 'automatic',
    public: !!form.public,
    type: preserveApplication && Number.isFinite(Number(form.originalType))
      ? Number(form.originalType)
      : form.application === 'coupon' ? 2 : 1,
    condition_type: conditionType,
    target: Number(form.target ?? template.fields?.target ?? 1),
    rate_type: isBuyXGetY ? 2 : Number(form.rateType),
    rate: Number(form.rate),
    minimum: Number(form.minimum),
    limit_per_user: Number(form.limitPerUser),
    include_options: isBuyXGetY ? false : !!form.includeOptions,
    stackable: !!form.stackable,
    start: toApiDate(form.start, 'start'),
    end: toApiDate(form.end, 'end'),
    businesses: businesses.map(Number)
  }

  if (form.sites?.length) payload.sites = form.sites.map(Number)

  if (form.application === 'coupon') payload.coupon = form.coupon.trim().replace(/\s+/g, '')
  if (Number(form.rateType) === 1 && !isBuyXGetY && positiveNumber(form.maxDiscount)) payload.max_discount = Number(form.maxDiscount)
  if (template.fields?.orderCount !== undefined) {
    payload.user_order_count = template.fields.orderCount
    payload.user_order_count_condition = template.fields.orderCountCondition
  }
  if (template.requiresLoyalty) payload.loyalty_levels = form.loyaltyLevels.map(Number)
  if (template.requiresSchedule) payload.schedule = JSON.stringify(form.schedule)
  if (template.requiresInactivity) payload.valid_from_after_user_last_order_minutes = Number(form.inactivityDays) * 24 * 60
  if (isBuyXGetY) {
    if (form.eligibilityKind === 'products') payload.products = selectionToArray(form.products)
    else payload.categories = selectionToArray(form.categories)
  }
  return payload
}

export const buildJourneySummary = ({ template, form, translate = fallbackTranslate, audience: translatedAudience }) => {
  if (template.key === 'buy_x_get_y') {
    const selectedItems = form.eligibilityKind === 'categories' ? form.categories : form.products
    const selectedCount = Object.keys(selectedItems || {}).length || '___'
    const scope = form.selectedBusinessId
      ? translate('QUICK_OFFER_SUMMARY_SELECTED_STORE', 'the selected store')
      : translate('QUICK_OFFER_SUMMARY_STORE_PLACEHOLDER', 'the selected store')
    return `${translate('QUICK_OFFER_BUY_X_SUMMARY_WHEN', 'When the cart contains')} ${form.minimum || '___'} ${translate('QUICK_OFFER_BUY_X_SUMMARY_ELIGIBLE_FROM', 'eligible items from')} ${selectedCount} ${translate('QUICK_OFFER_BUY_X_SUMMARY_SELECTED_PRODUCTS', 'selected product(s)')}, ${form.rate || '___'} ${translate('QUICK_OFFER_BUY_X_SUMMARY_BECOME_FREE', 'of those eligible items become free at')} ${scope}, ${translate('QUICK_OFFER_SUMMARY_FROM', 'from')} ${form.start || '___'} ${translate('QUICK_OFFER_SUMMARY_TO', 'to')} ${form.end || '___'}.`
  }
  const scope = form.scopeMode === 'selected'
    ? `${form.businesses.length || '___'} ${form.businesses.length === 1 ? translate('QUICK_OFFER_SUMMARY_SELECTED_BUSINESS', 'selected business') : translate('QUICK_OFFER_SUMMARY_SELECTED_BUSINESSES', 'selected businesses')} ${translate('QUICK_OFFER_SUMMARY_AND_CHANNELS', 'and all sales channels')}`
    : translate('QUICK_OFFER_SUMMARY_ALL_SCOPE', 'all businesses and sales channels')
  const target = Number(form.target)
  const targetLabel = target === 2
    ? ` ${translate('DELIVERY_FEE', 'delivery fee')}`
    : target === 3
      ? ` ${translate('BUSINESS_SERVICE_FEE', 'service fee')}`
      : ''
  const benefit = `${form.rate || '___'}${Number(form.rateType) === 1 ? '%' : ` ${form.currencySymbol || translate('QUICK_OFFER_SUMMARY_CURRENCY_UNITS', 'currency units')}`} ${translate('QUICK_OFFER_SUMMARY_OFF', 'off')}${targetLabel}`
  const minimum = `${form.currencySymbol || ''}${form.minimum || '___'} ${translate('QUICK_OFFER_SUMMARY_MINIMUM_PURCHASE', 'minimum purchase')}`
  const audience = template.requiresInactivity
    ? `${translate('QUICK_OFFER_SUMMARY_INACTIVE_CUSTOMERS', 'Customers with previous orders who have been inactive for')} ${form.inactivityDays || '___'} ${translate('QUICK_OFFER_SUMMARY_DAYS', 'days')}`
    : template.fields?.orderCount !== undefined
      ? `${translate('QUICK_OFFER_SUMMARY_EXACT_ORDERS', 'Customers with exactly')} ${template.fields.orderCount} ${template.fields.orderCount === 1 ? translate('QUICK_OFFER_SUMMARY_ORDER', 'order') : translate('QUICK_OFFER_SUMMARY_ORDERS', 'orders')}`
      : translatedAudience || template.audience
  return `${audience} ${translate('QUICK_OFFER_SUMMARY_RECEIVE', 'receive')} ${benefit} ${translate('QUICK_OFFER_SUMMARY_ACROSS', 'across')} ${scope}, ${translate('QUICK_OFFER_SUMMARY_WITH', 'with')} ${minimum}, ${translate('QUICK_OFFER_SUMMARY_FROM', 'from')} ${form.start || '___'} ${translate('QUICK_OFFER_SUMMARY_TO', 'to')} ${form.end || '___'}.`
}

const FORM_PAYLOAD_KEYS = {
  name: ['name'],
  description: ['description'],
  descriptionEdited: ['description'],
  application: ['auto', 'type', 'coupon'],
  applicationEdited: ['auto', 'type', 'coupon'],
  coupon: ['coupon'],
  rate: ['rate'],
  rateType: ['rate_type'],
  conditionType: ['condition_type'],
  target: ['target'],
  minimum: ['minimum'],
  maxDiscount: ['max_discount'],
  includeOptions: ['include_options'],
  limitPerUser: ['limit_per_user'],
  start: ['start'],
  end: ['end'],
  scopeMode: ['businesses'],
  businesses: ['businesses'],
  allBusinesses: ['businesses'],
  selectedBusinessId: ['businesses'],
  loyaltyLevels: ['loyalty_levels'],
  eligibilityKind: ['condition_type', 'products', 'categories'],
  products: ['condition_type', 'products', 'categories'],
  categories: ['condition_type', 'products', 'categories'],
  schedule: ['schedule'],
  inactivityDays: ['valid_from_after_user_last_order_minutes'],
  public: ['public'],
  stackable: ['stackable']
}

const SUMMARY_FORM_KEYS = new Set([
  'rate', 'rateType', 'target', 'minimum', 'start', 'end', 'scopeMode', 'businesses',
  'allBusinesses', 'selectedBusinessId', 'products', 'categories', 'eligibilityKind',
  'inactivityDays'
])

export const buildJourneyUpdatePayload = ({
  payload,
  dirtyFields = {},
  descriptionEdited = false,
  requiredPayloadKeys = []
}) => {
  const payloadKeys = new Set(requiredPayloadKeys)
  Object.keys(dirtyFields).forEach(field => {
    ;(FORM_PAYLOAD_KEYS[field] || []).forEach(key => payloadKeys.add(key))
  })
  if (!descriptionEdited && Object.keys(dirtyFields).some(field => SUMMARY_FORM_KEYS.has(field))) {
    payloadKeys.add('description')
  }
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => payloadKeys.has(key))
  )
}

export const captureJourneyEvent = (event, properties = {}) => {
  captureDashboardEvent(`promotion_journey_${event}`, properties)
}
