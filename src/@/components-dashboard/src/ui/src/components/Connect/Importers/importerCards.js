import { getMenuImportUseFixture } from './menuImportConfig'

const DOORDASH_URL_PATTERN = /doordash\.com/i
const UBER_EATS_URL_PATTERN = /ubereats\.com/i

const validateDoorDashUrl = (url) => {
  const trimmed = (url || '').trim()
  if (!trimmed) return { valid: false, error: 'IMPORTER_VALIDATION_URL_REQUIRED' }
  if (!DOORDASH_URL_PATTERN.test(trimmed)) {
    return { valid: false, error: 'IMPORTER_VALIDATION_INVALID_URL_DOORDASH' }
  }
  return { valid: true }
}

const validateUberEatsUrl = (url) => {
  const trimmed = (url || '').trim()
  if (!trimmed) return { valid: false, error: 'IMPORTER_VALIDATION_URL_REQUIRED' }
  if (!UBER_EATS_URL_PATTERN.test(trimmed)) {
    return { valid: false, error: 'IMPORTER_VALIDATION_INVALID_URL_UBEREATS' }
  }
  return { valid: true }
}

const validateDoorDashForm = (form) => validateDoorDashUrl(form.url)
const validateUberEatsForm = (form) => validateUberEatsUrl(form.url)

const validateOrderingBusinessUrl = (rawUrl) => {
  const trimmed = (rawUrl || '').trim()
  if (!trimmed) return { valid: false, error: 'IMPORTER_VALIDATION_URL_REQUIRED' }
  try {
    const u = new URL(trimmed)
    const marker = '/business/'
    const idx = u.pathname.indexOf(marker)
    if (idx === -1) {
      return { valid: false, error: 'IMPORTER_VALIDATION_ORDERING_INVALID_URL' }
    }
    const after = u.pathname.slice(idx + marker.length).replace(/\/$/, '')
    const segment = after.split('/').filter(Boolean)[0]
    if (!segment) {
      return { valid: false, error: 'IMPORTER_VALIDATION_ORDERING_INVALID_URL' }
    }
    return { valid: true }
  } catch {
    return { valid: false, error: 'IMPORTER_VALIDATION_ORDERING_INVALID_URL' }
  }
}

const validateOrderingForm = (form) => {
  const url = (form.url || '').trim()
  const projectId = (form.orderingPlusProjectId || '').trim()
  const segment = (form.orderingBusinessSegment || '').trim()

  if (url) return validateOrderingBusinessUrl(url)
  if (projectId && segment) return { valid: true }
  if (projectId || segment) {
    return { valid: false, error: 'IMPORTER_VALIDATION_ORDERING_INCOMPLETE_STRUCTURED' }
  }
  return { valid: false, error: 'IMPORTER_VALIDATION_ORDERING_SOURCE_REQUIRED' }
}

const buildDoorDashImportParams = (
  form,
  businessIds,
  project,
  orderingApiBaseUrl,
  includeAllMenuVariants = true,
  userEmail = null
) => ({
  doordashUrl: (form.url || '').trim(),
  businessIds,
  project,
  orderingApiBaseUrl,
  includeAllMenuVariants,
  userEmail: userEmail || undefined,
  useFixture: getMenuImportUseFixture()
})

const buildUberEatsImportParams = (
  form,
  businessIds,
  project,
  orderingApiBaseUrl,
  includeAllMenuVariants = true,
  userEmail = null
) => ({
  url: (form.url || '').trim(),
  businessIds,
  project,
  orderingApiBaseUrl,
  includeAllMenuVariants,
  userEmail: userEmail || undefined,
  useFixture: getMenuImportUseFixture()
})

const buildOrderingImportParams = (
  form,
  businessIds,
  project,
  orderingApiBaseUrl,
  _includeAllMenuVariants,
  userEmail = null
) => {
  const url = (form.url || '').trim()
  const base = {
    businessIds,
    project,
    orderingApiBaseUrl,
    userEmail: userEmail || undefined,
    useFixture: getMenuImportUseFixture()
  }
  if (url) {
    return { ...base, url }
  }
  return {
    ...base,
    orderingPlusProjectId: (form.orderingPlusProjectId || '').trim() || (project || '').trim(),
    orderingBusinessSegment: (form.orderingBusinessSegment || '').trim()
  }
}

export const IMPORTER_CARDS = [
  {
    id: 'doordash',
    searchTerms: ['doordash'],
    titleKey: 'IMPORTER_DOORDASH_TITLE',
    titleDefault: 'DoorDash',
    descriptionKey: 'IMPORTER_DOORDASH_DESCRIPTION',
    descriptionDefault: 'Import menu from a DoorDash store URL',
    importButtonKey: 'IMPORTER_IMPORT_MENU',
    importButtonDefault: 'Import Menu',
    logoColor: '#FF3008',
    logoLabel: 'DD',
    modalConfig: {
      titleKey: 'IMPORTER_MODAL_DOORDASH_TITLE',
      titleDefault: 'Import from DoorDash',
      subtitleKey: 'IMPORTER_MODAL_DOORDASH_SUBTITLE',
      subtitleDefault: 'Paste the DoorDash store URL for this business',
      urlLabelKey: 'IMPORTER_MODAL_DOORDASH_URL_LABEL',
      urlLabelDefault: 'DoorDash store URL',
      urlPlaceholderKey: 'IMPORTER_MODAL_DOORDASH_URL_PLACEHOLDER',
      urlPlaceholderDefault: 'https://www.doordash.com/store/...',
      urlHelperKey: 'IMPORTER_MODAL_DOORDASH_URL_HELPER',
      urlHelperDefault: 'Paste the full URL of the DoorDash store whose menu you want to import',
      statusImportingKey: 'IMPORTER_STATUS_IMPORTING_DOORDASH',
      statusImportingDefault: 'Importing menu from DoorDash... This may take a few minutes.',
      includeAllMenuVariantsKey: 'IMPORTER_MODAL_INCLUDE_ALL_MENU_VARIANTS',
      includeAllMenuVariantsDefault: 'Include all menu variants',
      validateForm: validateDoorDashForm,
      buildImportParams: buildDoorDashImportParams
    }
  },
  {
    id: 'ubereats',
    searchTerms: ['uber', 'eats', 'ubereats'],
    titleKey: 'IMPORTER_UBEREATS_TITLE',
    titleDefault: 'Uber Eats',
    descriptionKey: 'IMPORTER_UBEREATS_DESCRIPTION',
    descriptionDefault: 'Import menu from an Uber Eats store URL',
    importButtonKey: 'IMPORTER_IMPORT_MENU',
    importButtonDefault: 'Import Menu',
    logoColor: '#06C167',
    logoLabel: 'UE',
    modalConfig: {
      titleKey: 'IMPORTER_MODAL_UBEREATS_TITLE',
      titleDefault: 'Import from Uber Eats',
      subtitleKey: 'IMPORTER_MODAL_UBEREATS_SUBTITLE',
      subtitleDefault: 'Paste the Uber Eats store URL for this business',
      urlLabelKey: 'IMPORTER_MODAL_UBEREATS_URL_LABEL',
      urlLabelDefault: 'Uber Eats store URL',
      urlPlaceholderKey: 'IMPORTER_MODAL_UBEREATS_URL_PLACEHOLDER',
      urlPlaceholderDefault: 'https://www.ubereats.com/store/...',
      urlHelperKey: 'IMPORTER_MODAL_UBEREATS_URL_HELPER',
      urlHelperDefault: 'Paste the full URL of the Uber Eats store whose menu you want to import',
      statusImportingKey: 'IMPORTER_STATUS_IMPORTING_UBEREATS',
      statusImportingDefault: 'Importing menu from Uber Eats... This may take a few minutes.',
      includeAllMenuVariantsKey: 'IMPORTER_MODAL_INCLUDE_ALL_MENU_VARIANTS',
      includeAllMenuVariantsDefault: 'Include all menu variants',
      validateForm: validateUberEatsForm,
      buildImportParams: buildUberEatsImportParams
    }
  },
  {
    id: 'gloriafood',
    searchTerms: ['gloriafood', 'gloria', 'onlineorderpro', 'globalfood'],
    titleKey: 'IMPORTER_GLORIAFOOD_TITLE',
    titleDefault: 'GloriaFood',
    descriptionKey: 'IMPORTER_GLORIAFOOD_DESCRIPTION',
    descriptionDefault: 'Import menu from GloriaFood using your Fetch Menu Restaurant Key',
    importButtonKey: 'IMPORTER_IMPORT_MENU',
    importButtonDefault: 'Import Menu',
    logoColor: '#F15A24',
    logoLabel: 'GF',
    showImagesNote: true,
    // Dedicated GloriaFoodImportModal (Restaurant Key) — not MenuImportModal.
    usesCustomModal: true
  },
  {
    id: 'ordering',
    searchTerms: ['ordering', 'orderingplus', 'ordering.co', 'orderingco'],
    titleKey: 'IMPORTER_ORDERING_TITLE',
    titleDefault: 'Ordering.co',
    descriptionKey: 'IMPORTER_ORDERING_DESCRIPTION',
    descriptionDefault: 'Import menu from OrderingPlus (URL or project + store)',
    importButtonKey: 'IMPORTER_IMPORT_MENU',
    importButtonDefault: 'Import Menu',
    logoColor: '#7C3AED',
    logoLabel: 'OP',
    modalConfig: {
      titleKey: 'IMPORTER_MODAL_ORDERING_TITLE',
      titleDefault: 'Import from Ordering.co',
      subtitleKey: 'IMPORTER_MODAL_ORDERING_SUBTITLE',
      subtitleDefault: 'Paste an OrderingPlus business URL or enter project and store details',
      urlLabelKey: 'IMPORTER_MODAL_ORDERING_URL_LABEL',
      urlLabelDefault: 'OrderingPlus business URL',
      urlPlaceholderKey: 'IMPORTER_MODAL_ORDERING_URL_PLACEHOLDER',
      urlPlaceholderDefault: 'https://api.orderingplus.com/v400/en/yourproject/business/yourstore_…',
      urlHelperKey: 'IMPORTER_MODAL_ORDERING_URL_HELPER',
      urlHelperDefault: 'Long URLs are shortened automatically on the server (only the menu fetch query is kept).',
      orderingOrKey: 'IMPORTER_MODAL_ORDERING_OR',
      orderingOrDefault: 'Or enter project and store without a full URL:',
      orderingProjectLabelKey: 'IMPORTER_MODAL_ORDERING_PROJECT_LABEL',
      orderingProjectLabelDefault: 'OrderingPlus project ID',
      orderingProjectPlaceholderKey: 'IMPORTER_MODAL_ORDERING_PROJECT_PLACEHOLDER',
      orderingProjectPlaceholderDefault: 'e.g. yourproject',
      orderingBusinessSegmentLabelKey: 'IMPORTER_MODAL_ORDERING_SEGMENT_LABEL',
      orderingBusinessSegmentLabelDefault: 'Business slug or ID',
      orderingBusinessSegmentPlaceholderKey: 'IMPORTER_MODAL_ORDERING_SEGMENT_PLACEHOLDER',
      orderingBusinessSegmentPlaceholderDefault: 'e.g. yourstore',
      orderingStructuredHintKey: 'IMPORTER_MODAL_ORDERING_STRUCTURED_HINT',
      orderingStructuredHintDefault: 'Use the project segment and the value after /business/ in the OrderingPlus API path (slug or numeric id).',
      statusImportingKey: 'IMPORTER_STATUS_IMPORTING_ORDERING',
      statusImportingDefault: 'Importing menu from OrderingPlus…',
      includeAllMenuVariantsKey: null,
      validateForm: validateOrderingForm,
      buildImportParams: buildOrderingImportParams
    }
  }
]

export {
  validateDoorDashForm,
  validateUberEatsForm,
  validateOrderingForm
}
