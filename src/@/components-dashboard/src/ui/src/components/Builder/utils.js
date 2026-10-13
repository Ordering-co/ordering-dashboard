/**
 * Builder section helpers. Pure: labels, build states and the
 * per-platform values an app inherits.
 */

const defaultT = (_key, fallback) => fallback

export const BUILDER_TYPE_OPTIONS = [
  {
    value: 'marketplace_app',
    kind: 'app',
    label: (t) => t('BUILDER_TYPE_MARKETPLACE_APP', 'Marketplace app'),
    short: (t) => t('BUILDER_FILTER_MARKETPLACE', 'Marketplace'),
    description: (t) => t('BUILDER_TYPE_MARKETPLACE_APP_DESCRIPTION', 'All the stores in your marketplace in one app')
  },
  {
    value: 'franchise_app',
    kind: 'app',
    label: (t) => t('BUILDER_TYPE_FRANCHISE_APP', 'Franchise app'),
    short: (t) => t('BUILDER_FILTER_FRANCHISE', 'Franchise'),
    description: (t) => t('BUILDER_TYPE_FRANCHISE_APP_DESCRIPTION', 'One brand with several locations')
  },
  {
    value: 'store_app',
    kind: 'app',
    label: (t) => t('BUILDER_TYPE_STORE_APP', 'Store app'),
    short: (t) => t('BUILDER_FILTER_STORE', 'Store'),
    description: (t) => t('BUILDER_TYPE_STORE_APP_DESCRIPTION', 'One store and its customers')
  },
  {
    value: 'driver_app',
    kind: 'app',
    label: (t) => t('BUILDER_TYPE_DRIVER_APP', 'Driver app'),
    short: (t) => t('BUILDER_FILTER_DRIVER', 'Driver'),
    description: (t) => t('BUILDER_TYPE_DRIVER_APP_DESCRIPTION', 'For your delivery drivers')
  },
  {
    value: 'kiosk_app',
    kind: 'app',
    label: (t) => t('BUILDER_TYPE_KIOSK_APP', 'Kiosk app'),
    short: (t) => t('BUILDER_FILTER_KIOSK', 'Kiosk'),
    description: (t) => t('BUILDER_TYPE_KIOSK_APP_DESCRIPTION', 'Self-service ordering in your stores')
  },
  {
    value: 'marketplace_website',
    kind: 'web',
    label: (t) => t('BUILDER_TYPE_MARKETPLACE_WEBSITE', 'Marketplace website'),
    short: (t) => t('BUILDER_TYPE_MARKETPLACE_WEBSITE', 'Marketplace website'),
    description: (t) => t('BUILDER_TYPE_MARKETPLACE_WEBSITE_DESCRIPTION', 'All the stores in your marketplace on the web')
  },
  {
    value: 'franchise_website',
    kind: 'web',
    label: (t) => t('BUILDER_TYPE_FRANCHISE_WEBSITE', 'Franchise website'),
    short: (t) => t('BUILDER_TYPE_FRANCHISE_WEBSITE', 'Franchise website'),
    description: (t) => t('BUILDER_TYPE_FRANCHISE_WEBSITE_DESCRIPTION', 'One brand with several locations, on the web')
  },
  {
    value: 'dashboard',
    kind: 'web',
    label: (t) => t('BUILDER_TYPE_DASHBOARD', 'Dashboard'),
    short: (t) => t('BUILDER_TYPE_DASHBOARD', 'Dashboard'),
    description: (t) => t('BUILDER_TYPE_DASHBOARD_DESCRIPTION', 'Another Ordering Dashboard, on your own domain')
  }
]

/** The two groups of the catalog and of the type filter. */
export const BUILDER_KINDS = [
  { value: 'app', label: (t) => t('BUILDER_KIND_APPS', 'Apps') },
  { value: 'web', label: (t) => t('BUILDER_KIND_WEBSITES', 'Websites') }
]

/** The longest name in Ordering, by kind: 30 for an app, 100 for a website. */
export const BUILDER_NAME_MAX_LENGTH = { app: 30, web: 100 }

export const getNameMaxLength = (kind) => BUILDER_NAME_MAX_LENGTH[kind] ?? BUILDER_NAME_MAX_LENGTH.app

export const getNameTooLongMessage = (kind, t = defaultT) =>
  t('BUILDER_ERROR_NAME_MAX', 'Use _max_ characters or fewer.').replace('_max_', getNameMaxLength(kind))

/** What stands for a name left empty, like a website classified by hand. */
export const getUntitledName = (kind, t = defaultT) => kind === 'web'
  ? t('BUILDER_UNTITLED_WEBSITE', 'Untitled website')
  : t('BUILDER_UNTITLED_APP', 'Untitled app')

/** `app` or `web`: the product's `kind`, else what its type says. */
export const getProductKind = (product) => {
  if (product?.kind === 'app' || product?.kind === 'web') return product.kind
  return BUILDER_TYPE_OPTIONS.find(option => option.value === product?.product_type)?.kind ?? 'app'
}

/**
 * A website's domains: its own (`domain`) when set, and its temporary one,
 * which it is always online at. `[{ domain, temporary }]`.
 */
export const getProductDomains = (product) => [
  product?.domain && { domain: product.domain, temporary: false },
  product?.temporal_domain && { domain: product.temporal_domain, temporary: true }
].filter(Boolean)

/** An `https://` link for a domain the API gives without scheme. */
export const getDomainUrl = (domain) => /^https?:\/\//i.test(domain) ? domain : `https://${domain}`

/**
 * The type filter's button text: "All", one type's name, one whole group
 * ("Websites"), or how many types are on.
 */
export const getTypeFilterLabel = (types = [], t = defaultT) => {
  if (!types.length) return t('BUILDER_FILTER_ALL', 'All')
  if (types.length === 1) return getTypeLabel(types[0], t)
  const kind = BUILDER_KINDS.find(item => {
    const values = BUILDER_TYPE_OPTIONS.filter(option => option.kind === item.value).map(option => option.value)
    return values.length === types.length && values.every(value => types.includes(value))
  })
  return kind ? kind.label(t) : t('BUILDER_TYPES_SELECTED', '_count_ types').replace('_count_', types.length)
}

export const BUILDER_STATUS_OPTIONS = [
  { value: 'draft', label: (t) => t('BUILDER_STATUS_DRAFT', 'Draft') },
  { value: 'active', label: (t) => t('BUILDER_STATUS_ACTIVE', 'Active') },
  { value: 'archived', label: (t) => t('BUILDER_STATUS_ARCHIVED', 'Archived') }
]

/** Catalog bases in product order (Marketplace, Franchise, Store, Driver, Kiosk). */
export const sortCatalogBases = (bases = []) => {
  const order = BUILDER_TYPE_OPTIONS.map(option => option.value)
  const rank = (type) => {
    const index = order.indexOf(type)
    return index === -1 ? order.length : index
  }
  return [...bases].sort((a, b) => rank(a.product_type) - rank(b.product_type))
}

export const getTypeLabel = (type, t = defaultT) => {
  const option = BUILDER_TYPE_OPTIONS.find(item => item.value === type)
  return option ? option.label(t) : (type || '')
}

export const getStatusLabel = (status, t = defaultT) => {
  const option = BUILDER_STATUS_OPTIONS.find(item => item.value === status)
  return option ? option.label(t) : (status || '')
}

export const getPlatformLabel = (platform) => {
  if (platform === 'ios') return 'iOS'
  if (platform === 'android') return 'Android'
  return platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : ''
}

/** Build status → the look used by the list icons and the detail badge. */
export const getBuildKind = (status) => {
  if (!status || status === 'cancelled') return 'never'
  if (status === 'successful') return 'success'
  if (status === 'failed') return 'failed'
  return 'progress'
}

/** Statuses of an attempt that hasn't finished. */
export const RUNNING_BUILD_STATUSES = ['pending', 'queued', 'building', 'finishing']

/** In `finishing` Jenkins is done and only the file is checked: no cancel. */
export const CANCELLABLE_BUILD_STATUSES = ['pending', 'queued', 'building']

export const isBuildRunning = (build) => RUNNING_BUILD_STATUSES.includes(build?.status)

export const isBuildCancellable = (build) => CANCELLABLE_BUILD_STATUSES.includes(build?.status)

/** The status filter of the history, grouped as the customer reads them. */
export const BUILD_STATUS_FILTERS = [
  { value: 'waiting', statuses: ['pending', 'queued'], label: (t) => t('BUILDER_BUILD_FILTER_WAITING', 'Waiting') },
  { value: 'in_progress', statuses: ['building', 'finishing'], label: (t) => t('BUILDER_BUILD_FILTER_IN_PROGRESS', 'In progress') },
  { value: 'successful', statuses: ['successful'], label: (t) => t('BUILDER_BUILD_SUCCESSFUL', 'Successful') },
  { value: 'failed', statuses: ['failed'], label: (t) => t('BUILDER_BUILD_FAILED', 'Failed') },
  { value: 'cancelled', statuses: ['cancelled'], label: (t) => t('BUILDER_BUILD_CANCELLED', 'Cancelled') }
]

/** The store modes the section builds; debug stays in My Products. */
export const BUILD_MODE_OPTIONS = {
  ios: [
    {
      value: 'app-store',
      mode: 'app-store',
      type: null,
      guide: 'ios_app_store',
      label: (t) => t('BUILDER_BUILD_MODE_APP_STORE', 'App Store'),
      description: (t) => t('BUILDER_BUILD_MODE_APP_STORE_HELP', 'Signed for App Store Connect. Upload it with Transporter or Xcode.')
    },
    {
      value: 'ad-hoc',
      mode: 'ad-hoc',
      type: null,
      guide: 'ios_ad_hoc',
      label: (t) => t('BUILDER_BUILD_MODE_AD_HOC', 'Ad hoc'),
      description: (t) => t('BUILDER_BUILD_MODE_AD_HOC_HELP', 'Install on registered iPhones, by link or MDM.')
    }
  ],
  android: [
    {
      value: 'bundle',
      mode: 'release',
      type: 'bundle',
      guide: 'android_aab',
      label: () => 'AAB',
      description: (t) => t('BUILDER_BUILD_MODE_AAB_HELP', 'For Google Play. Upload it in Play Console.')
    },
    {
      value: 'assemble',
      mode: 'release',
      type: 'assemble',
      guide: null,
      label: () => 'APK',
      description: (t) => t('BUILDER_BUILD_MODE_APK_HELP', 'Install directly on Android devices.')
    }
  ]
}

/** The option of an attempt: its mode, or for Android its type. */
export const getBuildOptionValue = (build) => build?.platform === 'android' ? build?.type : build?.mode

/**
 * The option the Build dialog starts on: the latest attempt's, else the
 * store one for an active app and the one to try for a draft.
 */
export const getDefaultBuildOption = (platform, latest, productStatus) => {
  const options = BUILD_MODE_OPTIONS[platform] || []
  const previous = options.find(option => option.value === getBuildOptionValue(latest))
  if (previous) return previous.value
  if (!options.length) return null
  return productStatus === 'active' ? options[0].value : options[options.length - 1].value
}

/** "App Store", "Ad hoc", "AAB", "APK"; an old debug build of My Products, "Debug". */
export const getBuildModeLabel = (build, t = defaultT) => {
  if (!build) return ''
  if (build.mode === 'debug') return t('BUILDER_BUILD_DEBUG', 'Debug')
  const option = (BUILD_MODE_OPTIONS[build.platform] || []).find(item => item.value === getBuildOptionValue(build))
  if (option) return option.label(t)
  return build.mode === 'release' ? t('BUILDER_BUILD_RELEASE', 'Release') : (build.mode || '')
}

/** The file a successful attempt leaves: IPA, APK or AAB. */
export const getBuildFileLabel = (build) => {
  if (build?.platform === 'ios') return 'IPA'
  return build?.type === 'bundle' ? 'AAB' : 'APK'
}

/** Who asked for the attempt. */
export const getRequesterLabel = (type, t = defaultT) => {
  if (type === 'staff') return 'Ordering'
  if (type === 'server' || type === 'system') return t('BUILDER_REQUESTED_BY_AUTOMATIC', 'Automatic')
  return t('BUILDER_REQUESTED_BY_TEAM', 'Your team')
}

/**
 * Successful attempts whose file a newer successful attempt of the same
 * platform, mode and type replaced, among `builds` (newest first). Only
 * the newest of each can be downloaded.
 */
export const getReplacedBuildIds = (builds = []) => {
  const seen = new Set()
  const replaced = new Set()
  builds.filter(build => build.status === 'successful').forEach(build => {
    const key = `${build.platform}|${build.mode}|${build.type ?? ''}`
    if (seen.has(key)) replaced.add(build.id)
    else seen.add(key)
  })
  return replaced
}

export const getBuildStatusLabel = (status, t = defaultT) => {
  switch (status) {
    case 'successful': return t('BUILDER_BUILD_SUCCESSFUL', 'Successful')
    case 'failed': return t('BUILDER_BUILD_FAILED', 'Failed')
    case 'pending': return t('BUILDER_BUILD_PENDING', 'Pending')
    case 'queued': return t('BUILDER_BUILD_QUEUED', 'Queued')
    case 'building': return t('BUILDER_BUILD_BUILDING', 'Building')
    case 'finishing': return t('BUILDER_BUILD_FINISHING', 'Finishing')
    case 'cancelled': return t('BUILDER_BUILD_CANCELLED', 'Cancelled')
    default: return t('BUILDER_BUILD_NEVER', 'Not built yet')
  }
}

const KNOWN_BUILD_ERROR_CODES = [
  'invalid_local_certificates', 'maximum_local_portal_certificates', 'invalid_distribution_certificate',
  'connection_error', 'request_error', 'request_general_error', 'unknown_error', 'bootstrap_error',
  'build_file_not_found', 'build_finish_failed', 'build_timed_out', 'build_stuck_in_pending_status',
  'build_aborted', 'build_cancelled', 'retry_source_missing', 'missing_credentials'
]

/**
 * Why an attempt failed: our text for a known `error_code`, else the API's
 * `error_description`, else the generic one.
 */
export const getBuildFailureText = (build, t = defaultT) => {
  const code = build?.error_code
  if (KNOWN_BUILD_ERROR_CODES.includes(code) || !build?.error_description) return getBuildErrorMessage(code, t)
  return build.error_description
}

/**
 * Text for a failed build. Known codes get their own message; any other
 * code, or none, gets the generic one.
 */
export const getBuildErrorMessage = (code, t = defaultT) => {
  switch (code) {
    case 'invalid_local_certificates':
      return t('BUILDER_BUILD_ERROR_INVALID_LOCAL_CERTIFICATES', 'The iOS certificates saved for this app are no longer valid.')
    case 'maximum_local_portal_certificates':
      return t('BUILDER_BUILD_ERROR_MAXIMUM_PORTAL_CERTIFICATES', 'Apple won’t create another distribution certificate. Remove one in the Apple Developer portal.')
    case 'invalid_distribution_certificate':
      return t('BUILDER_BUILD_ERROR_INVALID_DISTRIBUTION_CERTIFICATE', 'Delete the distribution certificate in the Apple Developer portal and build again.')
    case 'connection_error':
    case 'request_error':
    case 'request_general_error':
    case 'unknown_error':
      return t('BUILDER_BUILD_ERROR_SERVICE', 'The build service didn’t respond. Try again later.')
    case 'bootstrap_error':
      return t('BUILDER_BUILD_ERROR_BOOTSTRAP', 'The build couldn’t be prepared.')
    case 'missing_credentials':
      return t('BUILDER_BUILD_ERROR_MISSING_CREDENTIALS', 'A credentials file is missing (the App Store Connect .p8 key, the .jks keystore or the Play Store JSON). Upload it again in Credentials and build again.')
    case 'build_file_not_found':
    case 'build_finish_failed':
      return t('BUILDER_BUILD_ERROR_FINISH', 'The build finished but its file couldn’t be saved.')
    case 'build_timed_out':
      return t('BUILDER_BUILD_ERROR_TIMED_OUT', 'The build took too long and was stopped.')
    case 'build_stuck_in_pending_status':
      return t('BUILDER_BUILD_ERROR_STUCK_PENDING', 'The build never started.')
    case 'build_aborted':
      return t('BUILDER_BUILD_ERROR_ABORTED', 'The build was aborted.')
    case 'build_cancelled':
      return t('BUILDER_BUILD_ERROR_CANCELLED', 'The build was cancelled.')
    case 'retry_source_missing':
      return t('BUILDER_BUILD_ERROR_RETRY_SOURCE_MISSING', 'The previous build is no longer available to retry.')
    default:
      return t('BUILDER_BUILD_ERROR_GENERIC', 'Build failed. Check the logs.')
  }
}

/** The first app of a product (products carry one app). */
export const getProductApp = (product) => product?.apps?.[0] ?? null

/**
 * One row per platform of the app's base. A platform the customer hasn't
 * edited, or a field left empty, takes the app's value (`platform.x ?? app.x`).
 */
export const getPlatformRows = (app) => {
  if (!app) return []
  const basePlatforms = app.base?.platforms?.length
    ? app.base.platforms
    : (app.platforms || []).map(item => item.platform)
  return basePlatforms.map(platform => {
    const own = (app.platforms || []).find(item => item.platform === platform) || null
    const pick = (field) => own?.[field] ?? app[field] ?? null
    return {
      platform,
      // A platform row whose fields were all set back to null uses the app's values
      customized: ['name', 'description', 'version', 'package'].some(field => own?.[field] != null),
      ownFields: Object.fromEntries(['name', 'description', 'version', 'package'].map(field => [field, own?.[field] != null])),
      name: pick('name'),
      description: pick('description'),
      version: pick('version'),
      package: pick('package'),
      lastBuild: (app.builds || []).find(build => build.platform === platform) || null
    }
  })
}

/** Platforms of the list row with their last build status. */
export const getPlatformBuilds = (app) => getPlatformRows(app).map(row => ({
  platform: row.platform,
  status: row.lastBuild?.status ?? null
}))

/** Tabs of the app detail. */
export const BUILDER_DETAIL_TABS = [
  { value: 'general', label: (t) => t('BUILDER_TAB_GENERAL', 'General') },
  { value: 'appearance', label: (t) => t('BUILDER_TAB_APPEARANCE', 'Appearance') },
  { value: 'files', label: (t) => t('BUILDER_TAB_FILES', 'Images and files') },
  { value: 'constants', label: (t) => t('BUILDER_TAB_CONSTANTS', 'Constants') },
  { value: 'credentials', label: (t) => t('BUILDER_TAB_CREDENTIALS', 'Credentials') },
  { value: 'push', label: (t) => t('BUILDER_TAB_PUSH', 'Push notifications') },
  { value: 'builds', label: (t) => t('BUILDER_TAB_BUILDS', 'Builds') }
]

export const getDetailTab = (value) =>
  BUILDER_DETAIL_TABS.some(tab => tab.value === value) ? value : 'general'

/** Setting groups in the order the Images and files tab shows them. */
export const BUILDER_SETTING_GROUPS = [
  { value: 'resources_icons', label: (t) => t('BUILDER_GROUP_ICONS', 'Icons') },
  { value: 'resources_notifications', label: (t) => t('BUILDER_GROUP_NOTIFICATIONS', 'Notifications') },
  { value: 'resources_splashes_ios', label: (t) => t('BUILDER_GROUP_SPLASHES_IOS', 'Splash iOS') },
  { value: 'resources_splashes_portrait_android', label: (t) => t('BUILDER_GROUP_SPLASHES_PORTRAIT_ANDROID', 'Splash Android portrait') },
  { value: 'resources_splashes_landscape_android', label: (t) => t('BUILDER_GROUP_SPLASHES_LANDSCAPE_ANDROID', 'Splash Android landscape') },
  { value: 'general_images', label: (t) => t('BUILDER_GROUP_GENERAL_IMAGES', 'General images') },
  { value: 'files', label: (t) => t('BUILDER_GROUP_FILES', 'Google files') }
]

/** The group the Appearance tab shows; every other group goes to Images and files. */
export const BUILDER_COLORS_GROUP = 'colors'

const humanize = (value) => {
  const text = String(value || '').replace(/[_-]+/g, ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : ''
}

export const getSettingGroupLabel = (group, t = defaultT) => {
  const option = BUILDER_SETTING_GROUPS.find(item => item.value === group)
  return option ? option.label(t) : humanize(group)
}

/** Groups present in the settings, known ones first in their order. */
export const getFileGroups = (settings = []) => {
  const present = [...new Set(settings.map(item => item.group).filter(group => group && group !== BUILDER_COLORS_GROUP))]
  const order = BUILDER_SETTING_GROUPS.map(item => item.value)
  const rank = (group) => {
    const index = order.indexOf(group)
    return index === -1 ? order.length : index
  }
  return present.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

const ruleList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).map(String)
  if (typeof value === 'string') return value.split(',').map(item => item.trim()).filter(Boolean)
  return []
}

/** The API never takes less than 3 MB for a setting file. */
const MIN_MAX_SIZE_KB = 3072

const formatSize = (kb) => kb >= 1024 ? `${Math.round((kb / 1024) * 10) / 10} MB` : `${kb} KB`

/** File rules as one line, like "PNG · 1024 × 1024 px · up to 3 MB". */
export const formatFileRules = (rules, t = defaultT) => {
  if (!rules) return ''
  const parts = []
  const extensions = ruleList(rules.extension ?? rules.mimes)
  if (extensions.length) parts.push(extensions.map(item => item.replace(/^\./, '').toUpperCase()).join(', '))
  if (rules.width && rules.height) parts.push(`${rules.width} × ${rules.height} px`)
  else if (rules.width) parts.push(t('BUILDER_FILE_WIDTH', '_width_ px wide').replace('_width_', rules.width))
  else if (rules.height) parts.push(t('BUILDER_FILE_HEIGHT', '_height_ px high').replace('_height_', rules.height))
  const maxSize = Number(rules.max_size ?? rules.size)
  if (maxSize) parts.push(t('BUILDER_FILE_MAX_SIZE', 'up to _size_').replace('_size_', formatSize(Math.max(maxSize, MIN_MAX_SIZE_KB))))
  return parts.join(' · ')
}

/** Message for a failed file upload, from its error codes and rules. */
export const getFileErrorMessage = (codes = [], rules, t = defaultT) => {
  const has = (suffix) => codes.some(code => code.endsWith(suffix))
  if (has('.dimensions') && rules?.width && rules?.height) {
    return t('BUILDER_FILE_ERROR_DIMENSIONS', 'The image must be _width_ × _height_ px.')
      .replace('_width_', rules.width).replace('_height_', rules.height)
  }
  if (has('.dimensions')) return t('BUILDER_FILE_ERROR_DIMENSIONS_GENERIC', 'The image doesn’t have the right size.')
  if (has('.extensions') || has('.mimetypes') || has('.mimes')) {
    const extensions = ruleList(rules?.extension ?? rules?.mimes).map(item => item.replace(/^\./, '').toUpperCase())
    return extensions.length
      ? t('BUILDER_FILE_ERROR_TYPE', 'Upload a _types_ file.').replace('_types_', extensions.join(', '))
      : t('BUILDER_FILE_ERROR_TYPE_GENERIC', 'This type of file isn’t accepted.')
  }
  if (has('.max')) {
    const maxSize = Number(rules?.max_size ?? rules?.size)
    return maxSize
      ? t('BUILDER_FILE_ERROR_SIZE', 'The file must be _size_ or smaller.').replace('_size_', formatSize(Math.max(maxSize, MIN_MAX_SIZE_KB)))
      : t('BUILDER_FILE_ERROR_SIZE_GENERIC', 'The file is too big.')
  }
  return t('BUILDER_FILE_ERROR', 'We couldn’t save the file. Try again.')
}

/**
 * Message for a rejected field of the app or a platform (`field.rule`),
 * or null when the codes don't concern it.
 */
export const getAppFieldError = (field, codes = [], t = defaultT) => {
  const mine = codes.filter(code => code.startsWith(`${field}.`))
  if (!mine.length) return null
  switch (field) {
    case 'name':
      return mine.includes('name.max')
        ? t('BUILDER_ERROR_MAX_255', 'Use 255 characters or fewer.')
        : t('BUILDER_ERROR_NAME_REQUIRED', 'Enter a name.')
    case 'description':
      return t('BUILDER_ERROR_MAX_500', 'Use 500 characters or fewer.')
    case 'version':
      return t('BUILDER_ERROR_VERSION', 'Use a version like 1.2.0.')
    case 'package':
      return mine.includes('package.max')
        ? t('BUILDER_ERROR_MAX_255', 'Use 255 characters or fewer.')
        : t('BUILDER_ERROR_PACKAGE', 'Use a reverse domain like com.brand.app.')
    default:
      return t('BUILDER_ERROR_FIELD', 'Check this value.')
  }
}

/** Client checks that match the API's version and package rules. */
export const VERSION_PATTERN = /^\d{1,4}\.\d{1,2}\.\d{1,2}$/
export const PACKAGE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/
export const COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

/** Message for a rejected setting or constant value. */
export const getValueErrorMessage = (codes = [], type, t = defaultT) => {
  if (codes.includes('value.regex') || type === 'color') return t('BUILDER_ERROR_COLOR', 'Use a hex color like #1E6BD6.')
  if (codes.includes('value.integer')) return t('BUILDER_ERROR_INTEGER', 'Enter a whole number.')
  if (codes.includes('value.numeric')) return t('BUILDER_ERROR_NUMBER', 'Enter a number.')
  if (codes.includes('value.json')) return t('BUILDER_ERROR_JSON', 'Enter valid JSON.')
  if (codes.includes('value.max')) return t('BUILDER_ERROR_MAX_255', 'Use 255 characters or fewer.')
  if (codes.includes('value.required') || codes.includes('value.min')) return t('BUILDER_ERROR_VALUE_REQUIRED', 'Enter a value.')
  return t('BUILDER_SAVE_ERROR', 'We couldn’t save it. Try again.')
}

export const BUILDER_CREDENTIAL_FIELDS = {
  ios: [
    { name: 'team_id', kind: 'text', label: (t) => t('BUILDER_CREDENTIAL_TEAM_ID', 'Team ID') },
    { name: 'itc_team_id', kind: 'text', optional: true, label: (t) => t('BUILDER_CREDENTIAL_ITC_TEAM_ID', 'App Store Connect team ID') },
    { name: 'api_key_id', kind: 'text', label: (t) => t('BUILDER_CREDENTIAL_API_KEY_ID', 'API key ID') },
    { name: 'api_key_issuer_id', kind: 'text', label: (t) => t('BUILDER_CREDENTIAL_API_KEY_ISSUER_ID', 'API key issuer ID') },
    { name: 'api_key_file', kind: 'file', has: 'has_api_key_file', accept: '.p8', label: (t) => t('BUILDER_CREDENTIAL_API_KEY_FILE', 'API key file (.p8)') }
  ],
  android: [
    { name: 'key_alias', kind: 'text', label: (t) => t('BUILDER_CREDENTIAL_KEY_ALIAS', 'Key alias') },
    { name: 'key_password', kind: 'secret', has: 'has_key_password', label: (t) => t('BUILDER_CREDENTIAL_KEY_PASSWORD', 'Key password') },
    { name: 'store_password', kind: 'secret', has: 'has_store_password', label: (t) => t('BUILDER_CREDENTIAL_STORE_PASSWORD', 'Store password') },
    { name: 'store_file', kind: 'file', has: 'has_store_file', accept: '.jks,.keystore', label: (t) => t('BUILDER_CREDENTIAL_STORE_FILE', 'Keystore file (.jks or .keystore)') },
    { name: 'playstore_credential_file', kind: 'file', has: 'has_playstore_credential_file', optional: true, accept: '.json', label: (t) => t('BUILDER_CREDENTIAL_PLAYSTORE_FILE', 'Play Store credentials (.json)') }
  ]
}

export const getCredentialFieldLabel = (platform, name, t = defaultT) => {
  const field = (BUILDER_CREDENTIAL_FIELDS[platform] || []).find(item => item.name === name)
  return field ? field.label(t) : humanize(name)
}

/** Message for a rejected credentials save. */
export const getCredentialsErrorMessage = (platform, codes = [], t = defaultT) => {
  const fieldCode = codes.find(code => code.includes('.') && (BUILDER_CREDENTIAL_FIELDS[platform] || []).some(item => code.startsWith(`${item.name}.`)))
  if (fieldCode) {
    const [name, rule] = fieldCode.split('.')
    const label = getCredentialFieldLabel(platform, name, t)
    if (rule === 'extensions') return t('BUILDER_CREDENTIAL_ERROR_TYPE', '_field_: this type of file isn’t accepted.').replace('_field_', label)
    if (rule === 'max') return t('BUILDER_CREDENTIAL_ERROR_SIZE', '_field_ is too big.').replace('_field_', label)
    return t('BUILDER_CREDENTIAL_ERROR_FIELD', 'Check _field_.').replace('_field_', label)
  }
  return t('BUILDER_SAVE_ERROR', 'We couldn’t save it. Try again.')
}

/**
 * Text for a `missing_credentials` check. File fields are listed apart: the
 * API also reports a file that was uploaded but is no longer in storage,
 * while the credentials view may still say it is there, so it asks to
 * upload it (again), not to fill it in.
 */
export const getMissingCredentialsText = (platform, names = [], t = defaultT) => {
  const isFile = (name) => (BUILDER_CREDENTIAL_FIELDS[platform] || []).some(item => item.name === name && item.kind === 'file')
  const labels = (list) => list.map(name => getCredentialFieldLabel(platform, name, t)).join(', ')
  const values = (names || []).filter(name => !isFile(name))
  const files = (names || []).filter(isFile)
  const complete = platform === 'ios'
    ? t('BUILDER_CHECK_CREDENTIALS_IOS', 'Complete the App Store Connect credentials')
    : t('BUILDER_CHECK_CREDENTIALS_ANDROID', 'Complete the Android signing credentials')
  const upload = files.length
    ? t('BUILDER_CHECK_CREDENTIALS_FILE', 'Upload _files_. If you already uploaded it, upload it again.').replace('_files_', labels(files))
    : null
  if (!values.length) return upload || complete
  const text = `${complete}: ${labels(values)}`
  return upload ? `${text}. ${upload}` : text
}

const APP_FIELD_PROBLEMS = {
  name: (t) => t('BUILDER_CHECK_APP_NAME', 'Add the app’s name in the stores'),
  version: (t) => t('BUILDER_CHECK_APP_VERSION', 'Add the app’s version'),
  package: (t) => t('BUILDER_CHECK_APP_PACKAGE', 'Add the app’s package')
}

/**
 * What the next build would get wrong, one row per problem to show.
 * `info` problems are left out. Warnings are for the customer and point to
 * the tab that fixes them; errors are the base's and only Ordering fixes them.
 */
export const getCheckProblems = (checks, t = defaultT) => {
  const platforms = checks?.platforms || {}
  return Object.keys(platforms).flatMap(platform => (platforms[platform]?.problems || [])
    .filter(problem => problem.level === 'warning' || problem.level === 'error')
    .map((problem, index) => {
      const key = `${platform}-${problem.code}-${index}`
      if (problem.level === 'error') {
        return {
          key,
          platform,
          owner: 'ordering',
          text: t('BUILDER_CHECK_ORDERING_REVIEW', 'Ordering is reviewing an issue in the base. It doesn’t stop your builds.'),
          tab: null
        }
      }
      const subject = problem.subject || {}
      switch (problem.code) {
        case 'missing_app_field': {
          const label = APP_FIELD_PROBLEMS[subject.name]
          return { key, platform, owner: 'customer', tab: 'general', text: label ? label(t) : problem.message }
        }
        case 'missing_file':
          return { key, platform, owner: 'customer', tab: 'files', group: subject.group, text: t('BUILDER_CHECK_MISSING_FILE', 'Upload _name_').replace('_name_', subject.name || '') }
        case 'empty_constant':
          return { key, platform, owner: 'customer', tab: 'constants', text: t('BUILDER_CHECK_EMPTY_CONSTANT', 'Set a value for _name_').replace('_name_', subject.name || '') }
        case 'missing_credentials':
          return { key, platform, owner: 'customer', tab: 'credentials', text: getMissingCredentialsText(platform, problem.fields, t) }
        default:
          return { key, platform, owner: 'customer', tab: null, text: problem.message || problem.code }
      }
    }))
}

/**
 * The checks of a refused build (`build.blocked`, a list of problems) in
 * the shape of `GET …/checks`, so `getCheckProblems` reads both.
 */
export const toPlatformChecks = (checks, platform) => {
  if (!Array.isArray(checks)) return checks || null
  const platforms = {}
  checks.forEach(problem => {
    const key = problem.platform || platform
    platforms[key] = platforms[key] || { problems: [] }
    platforms[key].problems.push(problem)
  })
  return { platforms }
}

/** Rejections of the build actions → their message. `_platform_` and `_mode_` are filled by the caller. */
const BUILD_REJECTIONS = {
  'product.archived': (t) => t('BUILDER_BUILD_REJECTED_ARCHIVED', 'Archived apps don’t build. Move it to draft or activate it first.'),
  'app.disabled': (t) => t('BUILDER_BUILD_REJECTED_APP_DISABLED', 'This app is turned off, so it can’t build. Contact Ordering support.'),
  'platform.unsupported': (t) => t('BUILDER_BUILD_REJECTED_PLATFORM', 'This app’s base doesn’t build for _platform_.'),
  'base.not_cloned': (t) => t('BUILDER_BUILD_REJECTED_BASE_NOT_READY', 'This app’s base isn’t ready to build yet. Try again later or contact Ordering support.'),
  'build.in_progress': (t) => t('BUILDER_BUILD_REJECTED_IN_PROGRESS', '_platform_ is already building. Wait for it to finish or cancel it.'),
  'build.action_locked': (t) => t('BUILDER_BUILD_REJECTED_LOCKED', 'We’re on it. Wait a few seconds before trying again.'),
  'build.not_found': (t) => t('BUILDER_BUILD_NOT_FOUND', 'This build doesn’t exist anymore.'),
  'build.no_log': (t) => t('BUILDER_LOG_NOT_STARTED', 'There’s no log yet. It appears once the build starts.'),
  'build.log_unavailable': (t) => t('BUILDER_LOG_UNAVAILABLE', 'The build service isn’t responding. Try again in a few minutes.'),
  'build.not_successful': (t) => t('BUILDER_DOWNLOAD_NOT_SUCCESSFUL', 'Only successful builds can be downloaded.'),
  'build.artifact_replaced': (t) => t('BUILDER_DOWNLOAD_REPLACED', 'A newer _mode_ build replaced this file. Download that one instead.'),
  'build.artifact_missing': (t) => t('BUILDER_DOWNLOAD_MISSING', 'This build’s file is no longer available. Build again to get a new one.'),
  'build.not_retryable': (t) => t('BUILDER_RETRY_NOT_RETRYABLE', 'This build can’t be retried. Start a new build instead.'),
  'build.source_missing': (t) => t('BUILDER_RETRY_SOURCE_MISSING', 'This attempt’s files are no longer kept. Start a new build to use the current settings.'),
  'build.not_running': (t) => t('BUILDER_CANCEL_NOT_RUNNING', 'This build already finished. There’s nothing to cancel.')
}

/** `build.not_latest` reads differently for each action. */
const NOT_LATEST = {
  retry: (t) => t('BUILDER_RETRY_NOT_LATEST', 'Only the latest build of each platform can be retried.'),
  cancel: (t) => t('BUILDER_CANCEL_NOT_LATEST', 'Only the latest build of each platform can be cancelled.')
}

const ACTION_ERRORS = {
  build: (t) => t('BUILDER_BUILD_REJECTED', 'We couldn’t start the build. Try again.'),
  retry: (t) => t('BUILDER_RETRY_ERROR', 'We couldn’t retry the build. Try again.'),
  cancel: (t) => t('BUILDER_CANCEL_ERROR', 'We couldn’t cancel the build. Try again.'),
  log: (t) => t('BUILDER_LOG_ERROR', 'We couldn’t load the log. Try again.'),
  download: (t) => t('BUILDER_DOWNLOAD_ERROR', 'We couldn’t download the file. Try again.')
}

/**
 * Message for a refused build action (`build`, `retry`, `cancel`, `log`,
 * `download`), from its error codes, with the platform and the mode filled in.
 */
export const getBuildActionError = (action, codes = [], { platform, mode } = {}, t = defaultT) => {
  let text = null
  if (codes.includes('build.not_latest') && NOT_LATEST[action]) text = NOT_LATEST[action](t)
  const known = codes.find(code => BUILD_REJECTIONS[code])
  if (!text && known) text = BUILD_REJECTIONS[known](t)
  if (!text) text = (ACTION_ERRORS[action] || ACTION_ERRORS.build)(t)
  return text.replace('_platform_', getPlatformLabel(platform)).replace('_mode_', mode || '')
}

/** The API takes a service account of up to 20 000 characters. */
export const SERVICE_ACCOUNT_MAX_LENGTH = 20000

/**
 * Reads a Firebase service account the way the API checks it: JSON with
 * `type: service_account` and non-empty `project_id`, `client_email` and
 * `private_key`. Answers `{ account: { projectId, clientEmail } }` or
 * `{ errorCode }` with the code the API would answer.
 */
export const parseServiceAccount = (text) => {
  const value = String(text ?? '').trim()
  if (!value) return { errorCode: 'service_account.required' }
  if (value.length > SERVICE_ACCOUNT_MAX_LENGTH) return { errorCode: 'service_account.max' }
  let account
  try {
    account = JSON.parse(value)
  } catch (err) {
    return { errorCode: 'service_account.invalid' }
  }
  const filled = (field) => typeof account?.[field] === 'string' && account[field].trim() !== ''
  if (account?.type !== 'service_account' || !['project_id', 'client_email', 'private_key'].every(filled)) {
    return { errorCode: 'service_account.invalid' }
  }
  return { account: { projectId: account.project_id, clientEmail: account.client_email } }
}

/** Message for a refused service account, or for a file the browser couldn't read (`file.unreadable`). */
export const getPushErrorMessage = (codes = [], action = 'save', t = defaultT) => {
  const has = (code) => codes.includes(code)
  if (has('push.unavailable')) return t('BUILDER_PUSH_ERROR_UNAVAILABLE', 'Push notifications aren’t set up for this project. Contact Ordering support.')
  if (has('file.unreadable')) return t('BUILDER_PUSH_ERROR_FILE', 'We couldn’t read this file. Choose the .json file Firebase downloaded.')
  // A value that isn't text can also bring `max`: it is still not an account
  if (has('service_account.invalid') || has('service_account.string')) {
    return t('BUILDER_PUSH_ERROR_INVALID', 'This isn’t a Firebase service account. Download it again from Project settings → Service accounts → Generate new private key.')
  }
  if (has('service_account.max')) return t('BUILDER_PUSH_ERROR_TOO_LONG', 'This file is too long for a service account. Check that it’s the right one.')
  if (has('service_account.required')) return t('BUILDER_PUSH_ERROR_REQUIRED', 'Choose the .json file or paste its content.')
  return action === 'remove'
    ? t('BUILDER_PUSH_REMOVE_ERROR', 'We couldn’t remove the account. Try again.')
    : t('BUILDER_PUSH_SAVE_ERROR', 'We couldn’t save the account. Try again.')
}

/* Own domain of a website */

/** Second levels of country domains (com.mx, co.uk): their registrable domain has three labels. */
const SECOND_LEVEL_LABELS = ['ac', 'co', 'com', 'edu', 'go', 'gob', 'gov', 'ne', 'net', 'or', 'org']

/** A domain as the API keeps it, from a host or a URL: no scheme, path, port or final dot, in lower case. */
export const normalizeDomain = (value) => String(value ?? '')
  .trim()
  .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
  .split(/[/?#]/)[0]
  .replace(/:\d+$/, '')
  .replace(/\.$/, '')
  .toLowerCase()

const getLabels = (domain) => normalizeDomain(domain).split('.').filter(Boolean)

/** How many labels the registrable domain takes: `brand.com` 2, `brand.com.mx` 3. */
const getRegistrableLength = (labels) => labels.length >= 3 &&
  labels[labels.length - 1].length === 2 &&
  SECOND_LEVEL_LABELS.includes(labels[labels.length - 2])
  ? 3
  : 2

/**
 * Whether the domain is a root one, which can't have a CNAME record. A
 * guess from its labels: the API decides, this only explains its refusal.
 */
export const isRootDomain = (domain) => {
  const labels = getLabels(domain)
  return labels.length >= 2 && labels.length <= getRegistrableLength(labels)
}

/** The Name of the domain's CNAME record in most DNS providers: `shop` for shop.brand.com. */
export const getRecordName = (domain) => {
  const labels = getLabels(domain)
  return labels.slice(0, Math.max(0, labels.length - getRegistrableLength(labels))).join('.')
}

/** Codes shown under the domain field; the rest go in a banner. */
const DOMAIN_FIELD_CODES = ['domain.required', 'domain.invalid', 'domain.max', 'domain.string', 'domain.restricted', 'domain.taken', 'domain.cname_missing']

/**
 * Message for a refused domain: `{ message, inField }`. `domain` is the
 * one that was sent, normalized.
 */
export const getDomainErrorMessage = (codes = [], domain = '', t = defaultT) => {
  const has = (code) => codes.includes(code)
  const inField = codes.some(code => DOMAIN_FIELD_CODES.includes(code))
  let message
  if (has('domain.required')) message = t('BUILDER_DOMAIN_ERROR_REQUIRED', 'Enter a domain.')
  else if (has('domain.invalid') || has('domain.max') || has('domain.string')) message = t('BUILDER_DOMAIN_ERROR_INVALID', 'Enter a valid domain, like www.yourbrand.com.')
  else if (has('domain.restricted')) message = t('BUILDER_DOMAIN_ERROR_RESTRICTED', 'This domain can’t be used. Enter a domain of your own.')
  else if (has('domain.taken')) message = t('BUILDER_DOMAIN_ERROR_TAKEN', 'This domain is already used by another website.')
  else if (has('domain.cname_missing')) {
    message = (isRootDomain(domain)
      ? t('BUILDER_DOMAIN_ERROR_ROOT', '_domain_ is a root domain, and a root domain can’t have a CNAME record.')
      : t('BUILDER_DOMAIN_ERROR_CNAME', 'We couldn’t find a CNAME record for _domain_.')).replace('_domain_', domain)
  } else if (has('domain.unsupported')) message = t('BUILDER_DOMAIN_ERROR_UNSUPPORTED', 'This website’s domain is managed by support. Contact support to change it.')
  else message = t('BUILDER_DOMAIN_SAVE_ERROR', 'We couldn’t save the domain. Try again.')
  return { message, inField }
}

/** Title and text of an own domain in `error`, by its `error_code`. */
export const getOwnDomainError = (errorCode, domain, t = defaultT) => {
  if (errorCode === 'create_failed') {
    return {
      title: t('BUILDER_DOMAIN_CREATE_FAILED', '_domain_ wasn’t accepted').replace('_domain_', domain),
      text: t('BUILDER_DOMAIN_CREATE_FAILED_HELP', 'Check that the domain is spelled right and that its CNAME record points to _target_, then verify again. If it keeps failing, contact support.')
    }
  }
  if (errorCode === 'hostname_not_found') {
    return {
      title: t('BUILDER_DOMAIN_LOST', 'The setup of _domain_ was lost').replace('_domain_', domain),
      text: t('BUILDER_DOMAIN_LOST_HELP', 'Verify again to set it up again. Check first that its CNAME record still points to _target_.')
    }
  }
  return {
    title: t('BUILDER_DOMAIN_TIMEOUT', 'We couldn’t verify _domain_ in time').replace('_domain_', domain),
    text: t('BUILDER_DOMAIN_TIMEOUT_HELP', 'The CNAME record wasn’t found, or it was removed. Check that it points to _target_, then verify again.')
  }
}
