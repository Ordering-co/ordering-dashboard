import posthog from 'posthog-js'
import settings from '../config'
import { isOfficialOrderingDashboardHost } from '../utils/dashboardBranding'

export const DASHBOARD_APP_SURFACE = 'ordering_dashboard'
const DASHBOARD_LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])
const DASHBOARD_PREVIEW_SUFFIXES = ['.workers.dev', '.pages.dev']

const DASHBOARD_SDK_PROPERTIES_TO_REMOVE = new Set([
  '$browser',
  '$browser_version',
  '$current_url',
  '$device',
  '$device_type',
  '$host',
  '$os',
  '$os_version',
  '$pathname',
  '$raw_user_agent',
  '$referrer',
  '$referring_domain',
  '$screen_height',
  '$screen_width',
  '$viewport_height',
  '$viewport_width',
  'cellphone',
  'email',
  'lastname',
  'name',
  'phone'
])

const SAFE_PROPERTY_NAMES = new Set([
  'action',
  'actor_type',
  'cancel_reason',
  'capability',
  'context_state',
  'duration_ms',
  'operation_kind',
  'schema_version',
  'trigger',
  'validation_code',
  'app_surface',
  'enabled',
  'environment',
  'error_signature',
  'failure_type',
  'fields',
  'module',
  'metric',
  'objective',
  'plan_id',
  'promotion_id',
  'project_code',
  'project_id',
  'route',
  'rating',
  'status',
  'template',
  'user_role',
  'value'
])

const SAFE_PERSON_PROPERTY_NAMES = new Set([
  ...SAFE_PROPERTY_NAMES,
  'billing_user_id',
  'cellphone',
  'created_at',
  'dashboard_user_id',
  'email',
  'email_verified',
  'is_billing_user',
  'language_id',
  'lastname',
  'level',
  'name',
  'phone',
  'user_id',
  'user_level'
])

const SAFE_GROUP_PROPERTY_NAMES = new Set([
  'project_addons',
  'project_code',
  'project_current_status',
  'project_current_status_until',
  'project_owner_id',
  'project_plan'
])

const ROUTE_MODULE_OVERRIDES = {
  onboarding: 'stores',
  login: 'authentication',
  password: 'authentication',
  reset_password: 'authentication',
  deliveries: 'orders',
  'all-in-one': 'orders',
  appointments: 'operations',
  schools: 'operations',
  catering: 'operations',
  'multi-business-checkout': 'operations',
  reservations: 'operations',
  'drivers-dashboard': 'delivery',
  'driver-store-status': 'delivery',
  'gift-cards-settings': 'loyalty',
  'gift-cards': 'loyalty',
  'stripe-connect': 'connect',
  purchase: 'billing',
  'ordering-products': 'my_products',
  builder: 'my_products',
  'free-downloads': 'my_products',
  'open-source-code': 'my_products',
  'all-settings': 'settings',
  settings: 'settings'
}

// Keep this set in sync with new top-level routes in App.js. Unknown routes
// intentionally report `other` to keep the analytics module cardinality bounded.
const DASHBOARD_MODULES = new Set([
  'assistant',
  'authentication',
  'billing',
  'cart_recovery',
  'connect',
  'delivery',
  'home',
  'intelligence',
  'loyalty',
  'marketing',
  'messages',
  'my_products',
  'operations',
  'orders',
  'profile',
  'settings',
  'stores',
  'support',
  'users'
])

const isLocalOrPreviewHost = (hostname) => {
  const normalizedHostname = String(hostname || '').toLowerCase()
  return DASHBOARD_LOCAL_HOSTS.has(normalizedHostname) ||
    DASHBOARD_PREVIEW_SUFFIXES.some(suffix => normalizedHostname.endsWith(suffix))
}

export const getDashboardAnalyticsContext = (config = settings, hostname = globalThis?.location?.hostname) => {
  if (config?.posthog_analytics_enabled !== true) return { enabled: false }
  const normalizedHostname = String(hostname || '').toLowerCase()
  const isProductionDashboard = isOfficialOrderingDashboardHost(normalizedHostname) ||
    (config?.use_project_domain === true && normalizedHostname && !isLocalOrPreviewHost(normalizedHostname))

  if (isProductionDashboard) return { enabled: true, environment: 'production' }
  return { enabled: false }
}

export const shouldCaptureDashboardAnalytics = (config = settings, hostname = globalThis?.location?.hostname) => {
  return getDashboardAnalyticsContext(config, hostname).enabled
}

const sanitizeProperties = (properties, allowedPropertyNames) => {
  return Object.fromEntries(
    Object.entries(properties).flatMap(([key, value]) => {
      if (!allowedPropertyNames.has(key) || value === null || value === undefined) return []
      if (Array.isArray(value)) {
        const safeValues = value.filter(item => typeof item === 'string').slice(0, 20)
        return safeValues.length ? [[key, safeValues]] : []
      }
      if (!['string', 'number', 'boolean'].includes(typeof value)) return []
      return [[key, value]]
    })
  )
}

// The login emitter is the first v2 consumer; legacy emitters retain their schema.
const LOGIN_V2_ENUMS = {
  schema_version: [2],
  capability: ['login'],
  actor_type: ['unknown'],
  context_state: ['pre_auth'],
  operation_kind: ['technical'],
  trigger: ['user'],
  cancel_reason: ['user_cancel', 'superseded'],
  validation_code: ['form_invalid', 'phone_invalid', 'captcha_required']
}

export const sanitizeAnalyticsProperties = (properties = {}) => Object.fromEntries(
  Object.entries(sanitizeProperties(properties, SAFE_PROPERTY_NAMES)).filter(([key, value]) => {
    if (LOGIN_V2_ENUMS[key]) return LOGIN_V2_ENUMS[key].includes(value)
    if (key === 'duration_ms') return typeof value === 'number' && Number.isFinite(value) && value >= 0
    return true
  })
)

const isPreAuthLogin = (properties) => properties?.schema_version === 2 &&
  properties?.module === 'authentication' && properties?.capability === 'login' &&
  properties?.context_state === 'pre_auth'

const PRE_AUTH_PROPERTIES_TO_REMOVE = new Set([
  '$groups', 'project_id', 'project_name', 'plan_id', 'user_role', 'user_role_name'
])

export const sanitizePersonProperties = (properties = {}) => sanitizeProperties(properties, SAFE_PERSON_PROPERTY_NAMES)

export const sanitizeGroupProperties = (properties = {}) => sanitizeProperties(properties, SAFE_GROUP_PROPERTY_NAMES)

export const sanitizeDashboardEventForSending = (event) => {
  const isDashboardEvent = event?.event?.startsWith?.('dashboard_') ||
    event?.properties?.app_surface === DASHBOARD_APP_SURFACE
  if (!isDashboardEvent) return event
  return {
    ...event,
    properties: Object.fromEntries(
      Object.entries(event.properties || {}).filter(([key, value]) => {
        if (DASHBOARD_SDK_PROPERTIES_TO_REMOVE.has(key)) return false
        if (!isPreAuthLogin(event.properties)) return true
        // Registered context may still describe the previous signed-in tenant.
        if (PRE_AUTH_PROPERTIES_TO_REMOVE.has(key)) return false
        return key !== 'project_code' || (typeof value === 'string' && value.length > 0)
      })
    )
  }
}

export const preparePostHogEventForSending = (event, config = settings, hostname = globalThis?.location?.hostname) => {
  if (event?.event?.startsWith?.('$')) return isLocalOrPreviewHost(hostname) ? null : event
  if (!shouldCaptureDashboardAnalytics(config, hostname)) return null
  return sanitizeDashboardEventForSending(event)
}

export const getDashboardRoute = (pathname = '/') => {
  if (pathname === '/') return { route: '/', module: 'root' }
  const segment = String(pathname).split('/').filter(Boolean)[0]
  if (!segment || !/^[a-z0-9_-]{1,64}$/i.test(segment)) return { route: '/unknown', module: 'other' }
  const module = ROUTE_MODULE_OVERRIDES[segment] ?? segment.replaceAll('-', '_')
  return {
    route: `/${segment}`,
    module: DASHBOARD_MODULES.has(module) ? module : 'other'
  }
}

export const captureDashboardEvent = (event, properties = {}, client = posthog) => {
  const analyticsContext = getDashboardAnalyticsContext()
  if (!analyticsContext.enabled) return false
  const safeProperties = sanitizeAnalyticsProperties({
    app_surface: DASHBOARD_APP_SURFACE,
    environment: analyticsContext.environment,
    ...properties
  })
  // Explicit null overrides SDK-registered tenant code before before_send drops it.
  if (isPreAuthLogin(safeProperties)) safeProperties.project_code = typeof safeProperties.project_code === 'string' ? safeProperties.project_code : null
  client?.capture?.(event, safeProperties)
  return true
}

export const captureDashboardOperation = ({ status, module, action, failureType }, client = posthog) => {
  return captureDashboardEvent(`dashboard_operation_${status}`, {
    module,
    action,
    status,
    ...(failureType && { failure_type: failureType })
  }, client)
}

export const getLoginAnalyticsAction = (loginTab) => (
  `login_${['email', 'cellphone', 'otp'].includes(loginTab) ? loginTab : 'email'}`
)

const captureLoginEvent = (event, { action, projectCode, ...properties }, client) => {
  if (!['login_email', 'login_cellphone', 'login_otp'].includes(action)) return false
  try {
    return captureDashboardEvent(event, {
      schema_version: 2,
      module: 'authentication',
      capability: 'login',
      route: '/login',
      action,
      context_state: 'pre_auth',
      actor_type: 'unknown',
      project_code: typeof projectCode === 'string' ? projectCode : null,
      ...properties
    }, client)
  } catch {
    // Optional analytics must never prevent authentication or session persistence.
    return false
  }
}

export const captureDashboardLoginOperation = ({ status, action, projectCode, durationMs, failureType, cancelReason }, client = posthog) => {
  if (!['started', 'succeeded', 'failed', 'cancelled'].includes(status)) return false
  return captureLoginEvent(`dashboard_operation_${status}`, {
    action,
    projectCode,
    status,
    operation_kind: 'technical',
    trigger: 'user',
    ...(status !== 'started' && { duration_ms: durationMs }),
    ...(status === 'failed' && { failure_type: ['api', 'network', 'permission', 'timeout', 'unknown'].includes(failureType) ? failureType : 'unknown' }),
    ...(status === 'cancelled' && { cancel_reason: cancelReason })
  }, client)
}

export const captureDashboardLoginValidation = ({ action, projectCode, validationCode }, client = posthog) => {
  if (!LOGIN_V2_ENUMS.validation_code.includes(validationCode)) return false
  return captureLoginEvent('dashboard_validation_failed', {
    action, projectCode, validation_code: validationCode
  }, client)
}

export const captureDashboardWebVital = (metric, client = posthog) => {
  if (!metric?.name || typeof metric?.value !== 'number') return false
  return captureDashboardEvent('dashboard_web_vital', {
    metric: metric.name,
    value: Number(metric.value.toFixed(3)),
    ...(metric.rating && { rating: metric.rating })
  }, client)
}

export const registerDashboardWebVitals = ({
  client,
  config = settings,
  hostname = globalThis?.location?.hostname,
  reportWebVitals
} = {}) => {
  if (!client || typeof reportWebVitals !== 'function' || !shouldCaptureDashboardAnalytics(config, hostname)) {
    return false
  }
  reportWebVitals(metric => captureDashboardWebVital(metric, client))
  return true
}

export const getDashboardErrorSignature = ({ failureType, message, source } = {}) => {
  const input = `${failureType ?? 'runtime_error'}:${message ?? ''}:${source ?? ''}`
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export const shouldCaptureDashboardRuntimeError = (seenSignatures, signature, limit = 20) => {
  if (!seenSignatures || !signature || seenSignatures.has(signature) || seenSignatures.size >= limit) return false
  seenSignatures.add(signature)
  return true
}

export const getDashboardCommonProperties = ({ project, plan, user, config = settings } = {}) => {
  const analyticsContext = getDashboardAnalyticsContext(config)
  const baseProperties = {
    app_surface: DASHBOARD_APP_SURFACE,
    environment: analyticsContext.environment || 'production'
  }

  return {
    ...baseProperties,
    ...(project?.id && { project_id: String(project.id) }),
    ...(project?.code && { project_code: project.code }),
    ...(user?.level !== null && user?.level !== undefined && { user_role: String(user.level) }),
    ...(plan?.id && { plan_id: String(plan.id) })
  }
}

export const getDashboardUserProperties = (user = {}) => {
  const firstName = user?.name ?? user?.first_name
  const lastName = user?.lastname ?? user?.last_name
  const phoneCountryCode = user?.country_phone_code ?? user?.phone_country_code
  const cellphone = user?.cellphone ? String(user.cellphone) : null
  const normalizedPhoneCountryCode = phoneCountryCode
    ? `${String(phoneCountryCode).startsWith('+') ? '' : '+'}${phoneCountryCode}`
    : null
  const phone = phoneCountryCode || cellphone
    ? `${normalizedPhoneCountryCode ?? ''}${cellphone ? `${normalizedPhoneCountryCode ? ' ' : ''}${cellphone}` : ''}`
    : null

  return {
    ...(user?.user_system_id && {
      billing_user_id: user.user_system_id,
      is_billing_user: true
    }),
    ...(cellphone && { cellphone }),
    ...(user?.created_at && { created_at: user.created_at }),
    ...(user?.id !== null && user?.id !== undefined && { dashboard_user_id: user.id }),
    ...(user?.email && { email: user.email }),
    ...(user?.email_verified !== null && user?.email_verified !== undefined && { email_verified: user.email_verified }),
    ...(user?.language_id !== null && user?.language_id !== undefined && { language_id: user.language_id }),
    ...(lastName && { lastname: lastName }),
    ...(user?.level !== null && user?.level !== undefined && {
      level: user.level,
      user_level: user.level
    }),
    ...(firstName && { name: firstName }),
    ...(phone && { phone }),
    ...(user?.email && { user_id: user.email })
  }
}

export const getDashboardGroupProperties = ({ project = {}, planId, projectOwnerId, addons = [] } = {}) => ({
  ...(addons.length && { project_addons: [...new Set(addons)].sort() }),
  ...(project?.code && { project_code: project.code }),
  ...(project?.current_status && { project_current_status: project.current_status }),
  ...(project?.project_current_status_until && { project_current_status_until: project.project_current_status_until }),
  ...(projectOwnerId && { project_owner_id: projectOwnerId }),
  ...(planId && { project_plan: planId })
})
